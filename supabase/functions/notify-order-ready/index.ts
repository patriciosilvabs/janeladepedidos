import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderToDispatch {
  id: string;
  cardapioweb_order_id: string | null;
  store_id: string | null;
}

// Função para notificar o CardápioWeb que o pedido está pronto
async function notifyCardapioWebReady(
  supabase: any,
  order: OrderToDispatch
): Promise<{ success: boolean; error?: string }> {
  const storeId = order.store_id;
  const cardapiowebOrderId = order.cardapioweb_order_id;

  if (!cardapiowebOrderId) {
    console.log(`Order ${order.id} has no cardapioweb_order_id, skipping CardápioWeb notification`);
    return { success: true };
  }

  if (!storeId) {
    console.log(`Order ${order.id} has no store_id, skipping CardápioWeb notification`);
    return { success: true };
  }

  // Buscar configurações da loja
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('cardapioweb_api_url, cardapioweb_api_token, cardapioweb_enabled')
    .eq('id', storeId)
    .single();

  if (storeError) {
    console.error(`Error fetching store ${storeId}:`, storeError);
    return { success: false, error: `Store fetch error: ${storeError.message}` };
  }

  if (!store?.cardapioweb_enabled || !store?.cardapioweb_api_token) {
    console.log(`CardápioWeb not enabled or configured for store ${storeId}`);
    return { success: true }; // Não é erro, apenas não está configurado
  }

  const apiUrl = store.cardapioweb_api_url || 'https://integracao.cardapioweb.com';

  try {
    console.log(`Notifying CardápioWeb that order ${cardapiowebOrderId} is ready...`);
    
    // Tentar atualizar status no CardápioWeb para "ready"
    // Primeiro tentamos PUT /orders/{id}/status
    let response = await fetch(
      `${apiUrl}/api/partner/v1/orders/${cardapiowebOrderId}/status`,
      {
        method: 'PUT',
        headers: {
          'X-API-KEY': store.cardapioweb_api_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'ready' }),
      }
    );

    // Se não funcionar, tenta PATCH no pedido
    if (!response.ok && response.status === 404) {
      console.log('PUT /status not found, trying PATCH on order...');
      response = await fetch(
        `${apiUrl}/api/partner/v1/orders/${cardapiowebOrderId}`,
        {
          method: 'PATCH',
          headers: {
            'X-API-KEY': store.cardapioweb_api_token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'ready', order_status: 'ready' }),
        }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`CardápioWeb status update failed: ${response.status}`, errorText);
      return { success: false, error: `CardápioWeb API Error: ${response.status} - ${errorText}` };
    }

    console.log(`CardápioWeb notified successfully: Order ${cardapiowebOrderId} is ready`);
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error notifying CardápioWeb:', errorMsg);
    return { success: false, error: errorMsg };
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

    const { orderIds, groupId } = await req.json();

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'IDs de pedidos não fornecidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar pedidos
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, cardapioweb_order_id, store_id')
      .in('id', orderIds);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar pedidos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${orders.length} orders - notifying CardápioWeb only`);

    const results = [];
    const errors = [];

    for (const order of orders as OrderToDispatch[]) {
      try {
        // APENAS notificar o CardápioWeb que o pedido está pronto
        const cardapioResult = await notifyCardapioWebReady(supabase, order);
        
        const now = new Date().toISOString();
        
        if (!cardapioResult.success) {
          console.error(`CardápioWeb notification failed for order ${order.id}:`, cardapioResult.error);
          errors.push({ orderId: order.id, error: cardapioResult.error });
          
          // Atualizar status local para dispatched com erro de notificação
          await supabase
            .from('orders')
            .update({
              status: 'dispatched',
              dispatched_at: now,
              notification_error: cardapioResult.error,
            })
            .eq('id', order.id);
        } else {
          results.push({ orderId: order.id, notified: true });
          
          // Atualizar status local para dispatched e limpar erro anterior
          await supabase
            .from('orders')
            .update({
              status: 'dispatched',
              dispatched_at: now,
              notification_error: null,
            })
            .eq('id', order.id);
        }

      } catch (orderError) {
        console.error(`Error processing order ${order.id}:`, orderError);
        const errorMessage = orderError instanceof Error ? orderError.message : 'Unknown error';
        errors.push({ orderId: order.id, error: errorMessage });
        
        // Salvar erro de exceção
        await supabase
          .from('orders')
          .update({
            status: 'dispatched',
            dispatched_at: new Date().toISOString(),
            notification_error: errorMessage,
          })
          .eq('id', order.id);
      }
    }

    // Atualizar status do grupo
    if (groupId) {
      const now = new Date().toISOString();
      await supabase
        .from('delivery_groups')
        .update({ status: 'dispatched', dispatched_at: now })
        .eq('id', groupId);
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        processed: results.length,
        errors: errors.length,
        results,
        errorDetails: errors,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Dispatch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
