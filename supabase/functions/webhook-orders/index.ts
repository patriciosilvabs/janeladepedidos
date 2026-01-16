import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token',
};

interface IncomingOrder {
  id?: string;
  external_id?: string;
  cardapioweb_order_id?: string;
  customer_name: string;
  customer_phone?: string;
  address: string;
  street?: string;
  house_number?: string;
  neighborhood?: string;
  city?: string;
  region?: string;
  country?: string;
  postal_code?: string;
  lat: number;
  lng: number;
  items?: unknown;
  total_amount?: number;
  delivery_fee?: number;
  payment_method?: string;
  notes?: string;
}

interface StatusEvent {
  event_id: string;
  event_type: string;
  order_id: number;
  order_status: string;
  merchant_id?: number;
  created_at?: string;
}

interface OrderRecord {
  id: string;
  status: string;
}

type WebhookPayload = IncomingOrder | IncomingOrder[] | StatusEvent;

async function handleStatusEvent(
  supabase: SupabaseClient,
  event: StatusEvent
): Promise<{ action: string; reason?: string; order_id?: number }> {
  const { order_id, order_status, event_type } = event;

  console.log(`Processing status event: ${event_type} - Order ${order_id} -> ${order_status}`);

  // Buscar pedido pelo external_id (ID real da API, não o display_id)
  const { data: existingOrder, error: findError } = await supabase
    .from('orders')
    .select('id, status')
    .eq('external_id', order_id.toString())
    .maybeSingle();

  if (findError) {
    console.error('Error finding order:', findError);
    return { action: 'error', reason: findError.message };
  }

  if (!existingOrder) {
    console.log(`Order ${order_id} not found in database - ignoring status event`);
    return { action: 'ignored', reason: 'not_found' };
  }

  const order = existingOrder as OrderRecord;

  switch (order_status) {
    case 'closed':
    case 'cancelled':
      // Remover pedido do sistema (já foi finalizado ou cancelado)
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', order.id);

      if (deleteError) {
        console.error('Error deleting order:', deleteError);
        return { action: 'error', reason: deleteError.message };
      }

      console.log(`Order ${order_id} deleted (status: ${order_status})`);
      return { action: 'deleted', order_id };

    case 'ready':
    case 'waiting_to_catch':
      // Mover para buffer SE ainda estiver pending
      if (order.status === 'pending') {
        // Usar RPC para garantir que ready_at use NOW() do PostgreSQL
        const { error: updateError } = await supabase.rpc('mark_order_ready', {
          order_id: order.id,
        });

        if (updateError) {
          console.error('Error updating order:', updateError);
          return { action: 'error', reason: updateError.message };
        }

        console.log(`Order ${order_id} moved to waiting_buffer`);
        return { action: 'updated', order_id };
      }

      console.log(`Order ${order_id} already processed (current status: ${order.status})`);
      return { action: 'ignored', reason: 'already_processed' };

    case 'released':
    case 'dispatched':
    case 'on_the_way':
      // Motoboy coletou o pedido - marcar como despachado
      if (['pending', 'waiting_buffer', 'ready'].includes(order.status)) {
        // Usar RPC para garantir que dispatched_at use NOW() do PostgreSQL
        const { error: dispatchError } = await supabase.rpc('set_order_dispatched', {
          p_order_id: order.id,
        });

        if (dispatchError) {
          console.error('Error dispatching order:', dispatchError);
          return { action: 'error', reason: dispatchError.message };
        }

        console.log(`Order ${order_id} marked as dispatched (released by delivery)`);
        return { action: 'dispatched', order_id };
      }

      console.log(`Order ${order_id} already dispatched (current status: ${order.status})`);
      return { action: 'ignored', reason: 'already_dispatched' };

    case 'pending_online_payment':
    case 'waiting_confirmation':
    case 'confirmed':
      // Ignorar esses status - pedido ainda não está pronto
      console.log(`Order ${order_id} status ${order_status} - ignoring`);
      return { action: 'ignored', reason: 'status_not_actionable' };

    default:
      console.log(`Order ${order_id} unknown status ${order_status} - ignoring`);
      return { action: 'ignored', reason: 'unknown_status' };
  }
}

async function handleNewOrder(
  supabase: SupabaseClient,
  order: IncomingOrder
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // Validate required fields
  if (!order.customer_name || !order.address || !order.lat || !order.lng) {
    console.error('Invalid order - missing required fields:', {
      customer_name: !!order.customer_name,
      address: !!order.address,
      lat: !!order.lat,
      lng: !!order.lng,
    });
    return { success: false, error: 'Missing required fields' };
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      external_id: order.external_id || order.id,
      cardapioweb_order_id: order.cardapioweb_order_id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      address: order.address,
      street: order.street,
      house_number: order.house_number,
      neighborhood: order.neighborhood,
      city: order.city,
      region: order.region,
      country: order.country || 'BR',
      postal_code: order.postal_code,
      lat: order.lat,
      lng: order.lng,
      items: order.items,
      total_amount: order.total_amount,
      delivery_fee: order.delivery_fee,
      payment_method: order.payment_method,
      notes: order.notes,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting order:', error);
    return { success: false, error: error.message };
  }

  const insertedOrder = data as { id: string };
  console.log(`Order ${insertedOrder.id} inserted successfully`);
  return { success: true, data };
}

function isStatusEvent(payload: unknown): payload is StatusEvent {
  return (
    payload !== null &&
    typeof payload === 'object' &&
    'event_type' in payload &&
    typeof (payload as StatusEvent).event_type === 'string' &&
    'order_id' in payload &&
    typeof (payload as StatusEvent).order_id === 'number'
  );
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch settings to validate webhook token
    const { data: settings } = await supabase
      .from('app_settings')
      .select('cardapioweb_webhook_token, cardapioweb_enabled')
      .eq('id', 'default')
      .maybeSingle();

    // Validate webhook token if configured
    const webhookToken = req.headers.get('x-webhook-token');
    const settingsData = settings as { cardapioweb_webhook_token?: string; cardapioweb_enabled?: boolean } | null;
    if (settingsData?.cardapioweb_webhook_token && settingsData.cardapioweb_enabled) {
      if (!webhookToken || webhookToken !== settingsData.cardapioweb_webhook_token) {
        console.error('Invalid webhook token');
        return new Response(
          JSON.stringify({ error: 'Unauthorized - Invalid webhook token' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    const body: WebhookPayload = await req.json();

    // Check if this is a status event from CardápioWeb
    if (isStatusEvent(body)) {
      const result = await handleStatusEvent(supabase, body);
      return new Response(
        JSON.stringify({
          success: true,
          type: 'status_event',
          ...result,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Handle new orders (single or array)
    const orders = Array.isArray(body) ? body : [body as IncomingOrder];
    console.log(`Received ${orders.length} new order(s)`);

    const insertedOrders: unknown[] = [];
    const errors: { order: IncomingOrder; error: string }[] = [];

    for (const order of orders) {
      const result = await handleNewOrder(supabase, order);
      if (result.success && result.data) {
        insertedOrders.push(result.data);
      } else if (result.error) {
        errors.push({ order, error: result.error });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        type: 'new_orders',
        inserted: insertedOrders.length,
        orders: insertedOrders,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
