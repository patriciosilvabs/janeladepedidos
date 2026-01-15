import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token',
};

interface FoodyStatusEvent {
  uid?: string;
  order_id?: string;
  status: string;
  driver?: {
    name?: string;
    phone?: string;
  };
  timestamp?: string;
}

interface NotifyResult {
  success: boolean;
  error?: string;
}

async function notifyCardapioWeb(
  supabase: any,
  orderId: string,
  action: 'dispatch' | 'close'
): Promise<NotifyResult> {
  try {
    // Buscar dados do pedido incluindo store_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('external_id, store_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Order not found for CardapioWeb notification:', orderError);
      return { success: false, error: 'Order not found' };
    }

    const orderData = order as { external_id: string; store_id: string };

    if (!orderData.external_id) {
      console.log('Order has no external_id, skipping CardapioWeb notification');
      return { success: true };
    }

    // Buscar configuração da loja
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('cardapioweb_api_url, cardapioweb_api_token, cardapioweb_enabled')
      .eq('id', orderData.store_id)
      .single();

    if (storeError || !store) {
      console.error('Store not found for CardapioWeb notification:', storeError);
      return { success: false, error: 'Store not found' };
    }

    const storeData = store as { 
      cardapioweb_api_url?: string; 
      cardapioweb_api_token?: string; 
      cardapioweb_enabled?: boolean;
    };

    if (!storeData.cardapioweb_enabled) {
      console.log('CardapioWeb is disabled for this store, skipping notification');
      return { success: true };
    }

    if (!storeData.cardapioweb_api_url || !storeData.cardapioweb_api_token) {
      console.error('CardapioWeb API URL or token not configured for store');
      return { success: false, error: 'CardapioWeb not configured' };
    }

    // Montar URL do endpoint
    const baseUrl = storeData.cardapioweb_api_url.replace(/\/$/, '');
    const endpoint = `${baseUrl}/api/partner/v1/orders/${orderData.external_id}/${action}`;

    console.log(`Notifying CardapioWeb: ${action} for order ${orderData.external_id}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-API-KEY': storeData.cardapioweb_api_token,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log(`CardapioWeb ${action} response:`, response.status, responseText);

    // 409 Conflict significa que o status já foi atualizado - consideramos sucesso
    // 404 significa que o pedido não existe mais lá - continuamos com operação local
    if (response.ok || response.status === 409 || response.status === 404) {
      console.log(`CardapioWeb ${action} notification successful for order ${orderData.external_id}`);
      return { success: true };
    }

    console.error(`CardapioWeb ${action} failed:`, response.status, responseText);
    return { success: false, error: `HTTP ${response.status}: ${responseText}` };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error notifying CardapioWeb ${action}:`, errorMessage);
    return { success: false, error: errorMessage };
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

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configurações para validar token (opcional)
    const { data: settings } = await supabase
      .from('app_settings')
      .select('foody_api_token, foody_enabled')
      .eq('id', 'default')
      .maybeSingle();

    const foodySettings = settings as { foody_api_token?: string; foody_enabled?: boolean } | null;
    
    if (!foodySettings?.foody_enabled) {
      console.log('Foody integration is disabled, but received webhook');
      return new Response(
        JSON.stringify({ success: true, message: 'Foody is disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: FoodyStatusEvent = await req.json();
    console.log('Received Foody webhook:', JSON.stringify(body));

    const { uid, order_id, status } = body;
    const foodyUid = uid || order_id;

    if (!foodyUid) {
      console.error('No order identifier in webhook');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing order identifier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar pedido pelo foody_uid
    const { data: order, error: findError } = await supabase
      .from('orders')
      .select('id, status, foody_status')
      .eq('foody_uid', foodyUid)
      .maybeSingle();

    if (findError) {
      console.error('Error finding order:', findError);
      return new Response(
        JSON.stringify({ success: false, error: findError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!order) {
      console.log(`Order with foody_uid ${foodyUid} not found`);
      return new Response(
        JSON.stringify({ success: true, message: 'Order not found', ignored: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingOrder = order as { id: string; status: string; foody_status: string | null };
    console.log(`Processing Foody status update for order ${existingOrder.id}: ${status}`);

    // Mapear status do Foody para ações no sistema
    switch (status.toLowerCase()) {
      case 'accepted':
      case 'assigned':
        // Motoboy aceitou/foi atribuído ao pedido
        await supabase
          .from('orders')
          .update({ foody_status: 'assigned' })
          .eq('id', existingOrder.id);
        
        console.log(`Order ${existingOrder.id} - driver assigned`);
        break;

      case 'collected':
      case 'picked_up':
        // Motoboy coletou o pedido
        await supabase
          .from('orders')
          .update({ 
            foody_status: 'collected',
            status: 'dispatched',
            dispatched_at: new Date().toISOString(),
          })
          .eq('id', existingOrder.id);
        
        console.log(`Order ${existingOrder.id} - collected by driver, marked as dispatched`);

        // Notificar CardapioWeb que o pedido saiu para entrega
        const dispatchResult = await notifyCardapioWeb(supabase, existingOrder.id, 'dispatch');
        if (!dispatchResult.success) {
          console.error(`Failed to notify CardapioWeb dispatch for order ${existingOrder.id}:`, dispatchResult.error);
          await supabase
            .from('orders')
            .update({ 
              cardapioweb_notified: false,
              notification_error: dispatchResult.error,
            })
            .eq('id', existingOrder.id);
        } else {
          console.log(`CardapioWeb notified: order ${existingOrder.id} dispatched`);
          await supabase
            .from('orders')
            .update({ 
              cardapioweb_notified: true,
              cardapioweb_notified_at: new Date().toISOString(),
              notification_error: null,
            })
            .eq('id', existingOrder.id);
        }
        break;

      case 'on_the_way':
        // Motoboy em rota de entrega
        await supabase
          .from('orders')
          .update({ 
            foody_status: 'on_the_way',
            status: 'dispatched',
            dispatched_at: existingOrder.status !== 'dispatched' ? new Date().toISOString() : undefined,
          })
          .eq('id', existingOrder.id);
        
        console.log(`Order ${existingOrder.id} - driver on the way`);
        break;

      case 'delivered':
      case 'completed':
        // Notificar CardapioWeb que o pedido foi entregue ANTES de deletar
        const closeResult = await notifyCardapioWeb(supabase, existingOrder.id, 'close');
        if (!closeResult.success) {
          console.error(`Failed to notify CardapioWeb close for order ${existingOrder.id}:`, closeResult.error);
        } else {
          console.log(`CardapioWeb notified: order ${existingOrder.id} closed/delivered`);
        }

        // Entrega concluída - remover pedido do sistema
        const { error: deleteError } = await supabase
          .from('orders')
          .delete()
          .eq('id', existingOrder.id);

        if (deleteError) {
          console.error('Error deleting delivered order:', deleteError);
        } else {
          console.log(`Order ${existingOrder.id} delivered and removed from system`);
        }
        break;

      case 'cancelled':
      case 'failed':
        // Entrega cancelada/falhou - manter pedido mas atualizar status
        await supabase
          .from('orders')
          .update({ 
            foody_status: 'cancelled',
            foody_error: `Delivery ${status}`,
          })
          .eq('id', existingOrder.id);
        
        console.log(`Order ${existingOrder.id} - delivery ${status}`);
        break;

      case 'returning':
        // Motoboy retornando (pedido não entregue)
        await supabase
          .from('orders')
          .update({ 
            foody_status: 'returning',
            foody_error: 'Driver returning - delivery failed',
          })
          .eq('id', existingOrder.id);
        
        console.log(`Order ${existingOrder.id} - driver returning`);
        break;

      default:
        // Atualizar status genérico
        await supabase
          .from('orders')
          .update({ foody_status: status })
          .eq('id', existingOrder.id);
        
        console.log(`Order ${existingOrder.id} - status updated to ${status}`);
    }

    return new Response(
      JSON.stringify({ success: true, order_id: existingOrder.id, status }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Foody webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
