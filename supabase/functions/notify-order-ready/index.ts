import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderData {
  id: string;
  external_id: string | null;
  store_id: string | null;
  order_type: string | null;
}

interface StoreData {
  cardapioweb_api_url: string | null;
  cardapioweb_api_token: string | null;
  cardapioweb_enabled: boolean | null;
}

// Notifica CardápioWeb que o pedido está PRONTO
// Usa o endpoint /ready conforme documentação oficial da API CardápioWeb
// Nota: Se o pedido automaticamente mudar para "Saiu para Entrega", o cliente
// deve verificar as configurações de integração Foody no painel do CardápioWeb
async function notifyCardapioWebReady(
  store: StoreData,
  externalId: string,
  orderType: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!store.cardapioweb_enabled || !store.cardapioweb_api_url || !store.cardapioweb_api_token) {
    console.log(`CardápioWeb not enabled or configured, skipping ready notification`);
    return { success: true };
  }

  const baseUrl = store.cardapioweb_api_url.replace(/\/$/, '');
  
  // Usar endpoint /ready conforme documentação oficial CardápioWeb
  // Este é o endpoint correto para marcar pedido como "Pronto"
  const endpoint = `${baseUrl}/api/partner/v1/orders/${externalId}/ready`;

  console.log(`Calling CardápioWeb READY for order ${externalId} (type: ${orderType || 'unknown'}): ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-API-KEY': store.cardapioweb_api_token,
        'Accept': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log(`CardápioWeb READY response for ${externalId}:`, response.status, responseText.substring(0, 200));

    // 204 = success, 409 = already in that status, which is fine
    if (response.ok || response.status === 204 || response.status === 409) {
      return { success: true };
    }

    return { success: false, error: `HTTP ${response.status}: ${responseText.substring(0, 100)}` };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error calling CardápioWeb READY for ${externalId}:`, errorMsg);
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

    const { orderIds, groupId, urgent } = await req.json();

    if (urgent) {
      console.log('🚨 URGENT ORDER - Bypassing buffer, immediate dispatch');
    }

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'IDs de pedidos não fornecidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${orderIds.length} orders - marking as READY and notifying CardápioWeb${urgent ? ' (URGENT - BYPASS)' : ''}`);

    const now = new Date().toISOString();
    const results: { orderId: string; success: boolean; cardapiowebNotified: boolean; error?: string }[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const orderId of orderIds) {
      try {
        // Fetch order data
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('id, external_id, store_id, order_type')
          .eq('id', orderId)
          .single();

        if (orderError || !order) {
          console.error(`Order ${orderId} not found:`, orderError);
          results.push({ orderId, success: false, cardapiowebNotified: false, error: 'Order not found' });
          errorCount++;
          continue;
        }

        const typedOrder = order as OrderData;

        // Update order status to ready (mark as urgent if applicable)
        const updateData: Record<string, unknown> = {
          status: 'ready',
          ready_at: now,
          group_id: null,
        };
        
        if (urgent) {
          updateData.is_urgent = true;
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', orderId);

        if (updateError) {
          console.error(`Error updating order ${orderId}:`, updateError);
          results.push({ orderId, success: false, cardapiowebNotified: false, error: 'Failed to update order' });
          errorCount++;
          continue;
        }

        // Skip CardápioWeb notification if no external_id
        if (!typedOrder.external_id) {
          console.log(`Order ${orderId} has no external_id, skipping CardápioWeb notification`);
          results.push({ orderId, success: true, cardapiowebNotified: false });
          successCount++;
          continue;
        }

        // Fetch store configuration
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('cardapioweb_api_url, cardapioweb_api_token, cardapioweb_enabled')
          .eq('id', typedOrder.store_id)
          .single();

        if (storeError || !store) {
          console.error(`Store ${typedOrder.store_id} not found:`, storeError);
          results.push({ orderId, success: true, cardapiowebNotified: false, error: 'Store not found' });
          successCount++;
          continue;
        }

        const typedStore = store as StoreData;

        // Notify CardápioWeb that order is READY
        // This will trigger CardápioWeb's native Foody integration
        console.log(`Notifying CardápioWeb for order ${typedOrder.external_id} (type: ${typedOrder.order_type || 'unknown'})${urgent ? ' (URGENT)' : ''}`);
        const readyResult = await notifyCardapioWebReady(typedStore, typedOrder.external_id, typedOrder.order_type);

        if (readyResult.success) {
          console.log(`Order ${typedOrder.external_id} marked as READY on CardápioWeb - Foody will be notified by CardápioWeb`);
          
          // Update order with notification success
          await supabase
            .from('orders')
            .update({
              cardapioweb_notified: true,
              cardapioweb_notified_at: now,
              notification_error: null,
            })
            .eq('id', orderId);

          results.push({ orderId, success: true, cardapiowebNotified: true });
          successCount++;
        } else {
          console.error(`Failed to notify CardápioWeb for order ${typedOrder.external_id}:`, readyResult.error);
          
          // Update order with notification error
          await supabase
            .from('orders')
            .update({
              cardapioweb_notified: false,
              notification_error: readyResult.error,
            })
            .eq('id', orderId);

          results.push({ orderId, success: true, cardapiowebNotified: false, error: readyResult.error });
          successCount++; // Order is still marked as ready locally
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing order ${orderId}:`, errorMessage);
        results.push({ orderId, success: false, cardapiowebNotified: false, error: errorMessage });
        errorCount++;
      }
    }

    // Update group status if provided
    if (groupId) {
      await supabase
        .from('delivery_groups')
        .update({ status: 'dispatched', dispatched_at: now })
        .eq('id', groupId);
    }

    const cardapiowebNotifiedCount = results.filter(r => r.cardapiowebNotified).length;

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        processed: orderIds.length,
        successCount,
        errors: errorCount,
        cardapiowebNotified: cardapiowebNotifiedCount,
        results,
        message: `${successCount} pedido(s) marcado(s) como PRONTO. ${cardapiowebNotifiedCount} notificado(s) ao CardápioWeb.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in notify-order-ready:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
