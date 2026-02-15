import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { explodeComboItems } from '../_shared/explodeCombo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ================== TYPES ==================

interface CardapioWebCustomer {
  name: string;
  phone?: string | null;
}

interface CardapioWebAddress {
  formatted?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  lat?: number;
  lng?: number;
  complement?: string;
}

interface CardapioWebItem {
  name: string;
  quantity: number;
  options?: any[];
  observation?: string;
  unit_price?: number;
  total_price?: number;
  category?: string;
  category_name?: string;
}

interface CardapioWebOrder {
  id: number;
  display_id?: number;
  status?: string;
  order_type?: string;
  customer?: CardapioWebCustomer;
  address?: CardapioWebAddress;
  items?: CardapioWebItem[];
  total?: number;
  delivery_fee?: number;
  payment_method?: string;
  observation?: string;
  created_at?: string;
}

interface CardapioWebWebhookPayload {
  event_type: string;
  event_id?: string;
  order_id: number;
  merchant_id?: number;
  created_at?: string;
  order?: CardapioWebOrder;
  order_status?: string;
}

interface StoreRecord {
  id: string;
  name: string;
  default_city: string | null;
  default_region: string | null;
  default_country: string | null;
  allowed_order_types: string[] | null;
  allowed_categories: string[] | null;
  cardapioweb_api_url?: string;
  cardapioweb_api_token?: string;
}

// ================== HELPERS ==================

function mapOrderType(cardapiowebType?: string): string {
  switch (cardapiowebType) {
    case 'delivery': return 'delivery';
    case 'takeout': return 'takeaway';
    case 'onsite': return 'counter';
    case 'closed_table':
    case 'dine_in': return 'dine_in';
    default: return cardapiowebType || 'delivery';
  }
}

function buildAddress(order: CardapioWebOrder, store: StoreRecord): {
  address: string; street?: string; house_number?: string; neighborhood?: string;
  city?: string; region?: string; country?: string; postal_code?: string;
  lat: number; lng: number;
} {
  const addr = order.address;
  const orderType = order.order_type;

  if (!addr || (orderType === 'closed_table' || orderType === 'dine_in' || orderType === 'onsite')) {
    return {
      address: order.customer?.name || 'Pedido Local',
      city: store.default_city || undefined,
      region: store.default_region || undefined,
      country: store.default_country || 'BR',
      lat: 0, lng: 0,
    };
  }

  return {
    address: addr.formatted || `${addr.street || ''}, ${addr.number || ''}`.trim() || 'Endereço não informado',
    street: addr.street,
    house_number: addr.number,
    neighborhood: addr.neighborhood,
    city: addr.city || store.default_city || undefined,
    region: addr.state || store.default_region || undefined,
    country: addr.country || store.default_country || 'BR',
    postal_code: addr.postal_code,
    lat: addr.lat || 0,
    lng: addr.lng || 0,
  };
}

// ================== HANDLERS ==================

async function handleOrderPlaced(
  supabase: SupabaseClient,
  payload: CardapioWebWebhookPayload,
  store: StoreRecord
): Promise<{ action: string; order_id?: string; items_created?: number; error?: string }> {
  const order = payload.order;
  if (!order) {
    console.error('order.placed event missing order data');
    return { action: 'error', error: 'missing_order_data' };
  }

  const externalId = order.id.toString();

  // IDEMPOTENCY: Check if order already exists
  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('external_id', externalId)
    .maybeSingle();

  if (existing) {
    console.log(`Order ${externalId} already exists (id: ${existing.id}) - skipping`);
    return { action: 'skipped', order_id: existing.id };
  }

  const addressData = buildAddress(order, store);
  const customerName = order.customer?.name || `Pedido #${order.display_id || order.id}`;
  const mappedOrderType = mapOrderType(order.order_type);

  // Check if order type is allowed for this store
  const allowedTypes = store.allowed_order_types || ['delivery', 'takeaway', 'dine_in', 'counter'];
  if (!allowedTypes.includes(mappedOrderType)) {
    console.log(`Order type "${mappedOrderType}" not allowed for store "${store.name}"`);
    return { action: 'ignored', error: `order_type_not_allowed: ${mappedOrderType}` };
  }

  console.log(`Creating order: external_id=${externalId}, type=${mappedOrderType}, customer=${customerName}`);

  const { data: insertedOrder, error: insertError } = await supabase
    .from('orders')
    .insert({
      external_id: externalId,
      cardapioweb_order_id: order.display_id?.toString() || externalId,
      cardapioweb_created_at: order.created_at || payload.created_at,
      customer_name: customerName,
      customer_phone: order.customer?.phone,
      order_type: mappedOrderType,
      store_id: store.id,
      ...addressData,
      items: order.items,
      total_amount: order.total,
      delivery_fee: order.delivery_fee,
      payment_method: order.payment_method,
      notes: order.observation,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Error inserting order:', insertError);
    return { action: 'error', error: insertError.message };
  }

  console.log(`Order created: ${insertedOrder.id}`);

  // Fetch option group mappings for hybrid classification
  let storeMappings: { option_group_id: number; option_type: string }[] = [];
  try {
    const { data: gm } = await supabase
      .from('store_option_group_mappings')
      .select('option_group_id, option_type')
      .eq('store_id', store.id);
    storeMappings = (gm || []) as any[];
  } catch (e) {
    console.error('[process] Error fetching group mappings:', e);
  }

  // Create order_items
  let itemsCreated = 0;
  if (order.items && order.items.length > 0) {
    if (order.items[0]) {
      console.log(`[process] Item keys sample:`, Object.keys(order.items[0]));
    }

    let itemsToCreate = order.items as any[];

    // Filter by allowed categories
    const allowedCategories = store.allowed_categories;
    if (allowedCategories && allowedCategories.length > 0) {
      const before = itemsToCreate.length;
      itemsToCreate = itemsToCreate.filter((item: any) => {
        const name = (item.name || '').toLowerCase();
        const kind = ((item as any).kind || '').toLowerCase();
        if (!name && !kind) return true;
        return allowedCategories.some(c => {
          const keyword = c.toLowerCase();
          return kind.includes(keyword) || name.includes(keyword);
        });
      });
      console.log(`Category filter: ${before} -> ${itemsToCreate.length} items`);
    }

    if (itemsToCreate.length === 0) {
      console.log('No items after category filter');
    } else {
      // Explode combos
      try {
        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('kds_edge_keywords, kds_flavor_keywords')
          .eq('id', 'default')
          .maybeSingle();

        const edgeKw = (settingsData?.kds_edge_keywords || '#, Borda').split(',').map((s: string) => s.trim());
        const flavorKw = (settingsData?.kds_flavor_keywords || '(G), (M), (P), Sabor').split(',').map((s: string) => s.trim());
        const beforeExplode = itemsToCreate.length;
        itemsToCreate = explodeComboItems(itemsToCreate, edgeKw, flavorKw, storeMappings);
        if (itemsToCreate.length !== beforeExplode) {
          console.log(`[process] Combo explosion: ${beforeExplode} -> ${itemsToCreate.length} items`);
        }
      } catch (explodeErr) {
        console.error(`[process] Combo explosion error (continuing):`, explodeErr);
      }

      const { data: itemCount, error: itemsError } = await supabase.rpc(
        'create_order_items_from_json',
        { p_order_id: insertedOrder.id, p_items: itemsToCreate, p_default_sector_id: null }
      );

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
      } else {
        itemsCreated = itemCount as number;
        console.log(`Created ${itemsCreated} items for order ${insertedOrder.id}`);
      }
    }
  }

  return { action: 'created', order_id: insertedOrder.id, items_created: itemsCreated };
}

async function handleOrderCancelledOrClosed(
  supabase: SupabaseClient,
  payload: CardapioWebWebhookPayload,
  eventType: string
): Promise<{ action: string; order_id?: number; error?: string }> {
  const externalId = payload.order_id.toString();
  console.log(`Processing ${eventType} for order ${externalId}`);

  const { data: existingOrder, error: findError } = await supabase
    .from('orders')
    .select('id, status')
    .eq('external_id', externalId)
    .maybeSingle();

  if (findError) {
    console.error('Error finding order:', findError);
    return { action: 'error', error: findError.message };
  }

  if (!existingOrder) {
    console.log(`Order ${externalId} not found - ignoring ${eventType}`);
    return { action: 'ignored', order_id: payload.order_id };
  }

  if (['pending', 'waiting_buffer'].includes(existingOrder.status)) {
    const { data: cancelResult, error: cancelError } = await supabase.rpc('cancel_order_with_alert', {
      p_order_id: existingOrder.id,
    });

    if (cancelError) {
      console.error('Error cancelling order with alert:', cancelError);
      return { action: 'error', error: cancelError.message };
    }

    console.log(`Order ${externalId} cancelled with alert`, cancelResult);
    return { action: 'cancelled_with_alert', order_id: payload.order_id };
  }

  const { error: deleteError } = await supabase
    .from('orders')
    .delete()
    .eq('id', existingOrder.id);

  if (deleteError) {
    console.error('Error deleting order:', deleteError);
    return { action: 'error', error: deleteError.message };
  }

  console.log(`Order ${externalId} deleted (event: ${eventType})`);
  return { action: 'deleted', order_id: payload.order_id };
}

async function fetchOrderFromApi(
  store: StoreRecord,
  orderId: number
): Promise<CardapioWebOrder | null> {
  const baseUrl = store.cardapioweb_api_url || 'https://integracao.cardapioweb.com';
  const token = store.cardapioweb_api_token;

  if (!token) {
    console.error('Store missing API token');
    return null;
  }

  try {
    console.log(`Fetching order from API: ${baseUrl}/api/partner/v1/orders/${orderId}`);
    const response = await fetch(`${baseUrl}/api/partner/v1/orders/${orderId}`, {
      method: 'GET',
      headers: { 'X-API-KEY': token, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error(`Failed to fetch order ${orderId}: ${response.status}`);
      return null;
    }

    const orderData = await response.json();
    console.log(`Fetched order data: ${JSON.stringify(orderData).substring(0, 500)}`);

    return {
      id: orderData.id,
      display_id: orderData.display_id || orderData.code,
      status: orderData.status || orderData.order_status,
      order_type: orderData.order_type,
      customer: orderData.customer,
      address: orderData.delivery_address ? {
        formatted: [
          orderData.delivery_address.street, orderData.delivery_address.number,
          orderData.delivery_address.neighborhood, orderData.delivery_address.city,
          orderData.delivery_address.state,
        ].filter(Boolean).join(', '),
        street: orderData.delivery_address.street,
        number: orderData.delivery_address.number,
        neighborhood: orderData.delivery_address.neighborhood,
        city: orderData.delivery_address.city,
        state: orderData.delivery_address.state,
        country: orderData.delivery_address.country,
        postal_code: orderData.delivery_address.zipCode,
        lat: orderData.delivery_address.latitude,
        lng: orderData.delivery_address.longitude,
        complement: orderData.delivery_address.complement,
      } : undefined,
      items: orderData.items?.map((item: any) => ({
        name: item.name,
        quantity: item.quantity || 1,
        options: item.options || item.additions || [],
        observation: item.notes || item.observation,
        unit_price: item.price || item.unit_price,
        total_price: item.total || item.total_price,
        category: item.category || item.category_name || '',
      })),
      total: orderData.total,
      delivery_fee: orderData.delivery_fee,
      payment_method: orderData.payments?.[0]?.method,
      observation: orderData.notes,
      created_at: orderData.created_at,
    };
  } catch (error) {
    console.error(`Error fetching order ${orderId}:`, error);
    return null;
  }
}

async function handleOrderStatusChange(
  supabase: SupabaseClient,
  payload: CardapioWebWebhookPayload
): Promise<{ action: string; order_id?: number; reason?: string }> {
  const externalId = payload.order_id.toString();
  const status = payload.order?.status || payload.order_status;
  console.log(`Processing status change for order ${externalId}: ${status}`);

  const { data: existingOrder, error: findError } = await supabase
    .from('orders')
    .select('id, status')
    .eq('external_id', externalId)
    .maybeSingle();

  if (findError) return { action: 'error', reason: findError.message };
  if (!existingOrder) return { action: 'ignored', order_id: payload.order_id, reason: 'not_found' };

  if (status === 'released' || status === 'dispatched' || status === 'on_the_way') {
    if (['pending', 'waiting_buffer', 'ready'].includes(existingOrder.status)) {
      const { error: dispatchError } = await supabase.rpc('set_order_dispatched', {
        p_order_id: existingOrder.id,
      });
      if (dispatchError) return { action: 'error', reason: dispatchError.message };
      console.log(`Order ${externalId} marked as dispatched`);
      return { action: 'dispatched', order_id: payload.order_id };
    }
    return { action: 'ignored', order_id: payload.order_id, reason: 'already_dispatched' };
  }

  console.log(`Order ${externalId} status ${status} - ignoring`);
  return { action: 'ignored', order_id: payload.order_id, reason: 'local_flow_controls' };
}

// ================== MAIN PROCESSOR ==================

async function processQueueEntry(supabase: SupabaseClient, queueId: string): Promise<void> {
  // Fetch queue entry
  const { data: entry, error: fetchError } = await supabase
    .from('webhook_queue')
    .select('id, store_id, payload, status')
    .eq('id', queueId)
    .single();

  if (fetchError || !entry) {
    console.error(`[process] Queue entry ${queueId} not found:`, fetchError);
    return;
  }

  if (entry.status !== 'pending') {
    console.log(`[process] Queue entry ${queueId} status is "${entry.status}" - skipping`);
    return;
  }

  // Mark as processing
  await supabase.from('webhook_queue').update({ status: 'processing' }).eq('id', queueId);

  try {
    // Fetch full store data
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name, default_city, default_region, default_country, allowed_order_types, allowed_categories, cardapioweb_api_url, cardapioweb_api_token')
      .eq('id', entry.store_id)
      .single();

    if (storeError || !store) {
      throw new Error(`Store ${entry.store_id} not found: ${storeError?.message}`);
    }

    const body = entry.payload as CardapioWebWebhookPayload;
    const eventType = body.event_type;
    const normalizedEvent = eventType?.toLowerCase().replace(/_/g, '.');

    console.log(`[process] Processing queue ${queueId}: event=${eventType}, order_id=${body.order_id}, store=${store.name}`);

    // If creation event but missing order data, fetch from API
    if (['order.created', 'order.placed', 'order.new'].includes(normalizedEvent) && !body.order) {
      console.log(`[process] Event ${eventType} missing order data, fetching from API...`);
      const fetchedOrder = await fetchOrderFromApi(store as StoreRecord, body.order_id);
      if (fetchedOrder) {
        body.order = fetchedOrder;
      } else {
        throw new Error(`Could not fetch order ${body.order_id} from API`);
      }
    }

    // Pre-payment status check
    const prePaymentStatuses = ['pending', 'waiting_confirmation', 'awaiting_payment', 'placed'];
    const orderStatus = (body.order?.status || body.order_status || '').toLowerCase();
    const isCreationEvent = ['order.placed', 'order.created', 'order.new'].includes(normalizedEvent);

    let result: { action: string; [key: string]: unknown };

    if (isCreationEvent && prePaymentStatuses.includes(orderStatus)) {
      console.log(`[process] Ignoring ${normalizedEvent} - status "${orderStatus}" (awaiting payment)`);
      result = { action: 'ignored', reason: 'awaiting_payment', status: orderStatus };
    } else {
      switch (normalizedEvent) {
        case 'order.confirmed':
          result = await handleOrderPlaced(supabase, body, store as StoreRecord);
          break;

        case 'order.placed':
        case 'order.created':
        case 'order.new':
          if (orderStatus === 'confirmed' || orderStatus === 'preparing' || orderStatus === 'ready') {
            result = await handleOrderPlaced(supabase, body, store as StoreRecord);
          } else {
            result = { action: 'ignored', reason: 'not_confirmed', status: orderStatus };
          }
          break;

        case 'order.cancelled':
        case 'order.closed':
        case 'order.canceled':
          result = await handleOrderCancelledOrClosed(supabase, body, eventType);
          break;

        case 'order.ready':
        case 'order.dispatched':
        case 'order.delivered':
        case 'order.status.updated':
          result = await handleOrderStatusChange(supabase, body);
          break;

        default:
          if (body.order?.status || body.order_status) {
            if (orderStatus === 'confirmed' || orderStatus === 'preparing' || orderStatus === 'ready') {
              result = await handleOrderPlaced(supabase, body, store as StoreRecord);
            } else if (orderStatus === 'cancelled' || orderStatus === 'closed' || orderStatus === 'canceled') {
              result = await handleOrderCancelledOrClosed(supabase, body, eventType);
            } else if (prePaymentStatuses.includes(orderStatus)) {
              result = { action: 'ignored', reason: 'awaiting_payment', status: orderStatus };
            } else {
              result = await handleOrderStatusChange(supabase, body);
            }
          } else {
            result = { action: 'ignored', reason: 'unknown_event_type' };
          }
      }
    }

    console.log(`[process] Queue ${queueId} completed:`, JSON.stringify(result));

    // Mark as completed
    await supabase.from('webhook_queue').update({
      status: 'completed',
      processed_at: new Date().toISOString(),
    }).eq('id', queueId);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[process] Queue ${queueId} failed:`, errorMsg);

    await supabase.from('webhook_queue').update({
      status: 'error',
      error_message: errorMsg,
      processed_at: new Date().toISOString(),
    }).eq('id', queueId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { queue_id } = await req.json();

    if (!queue_id) {
      return new Response(
        JSON.stringify({ error: 'queue_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await processQueueEntry(supabase, queue_id);

    return new Response(
      JSON.stringify({ success: true, queue_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-webhook-queue] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
