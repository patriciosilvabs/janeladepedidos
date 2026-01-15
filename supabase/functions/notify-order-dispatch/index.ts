import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderResult {
  orderId: string;
  success: boolean;
  dispatchNotified?: boolean;
  error?: string;
}

interface OrderData {
  id: string;
  external_id: string | null;
  store_id: string | null;
  cardapioweb_notified: boolean | null;
}

interface StoreData {
  cardapioweb_api_url: string | null;
  cardapioweb_api_token: string | null;
  cardapioweb_enabled: boolean | null;
}

// Notifica CardápioWeb que o pedido saiu para ENTREGA
async function notifyCardapioWebDispatch(
  store: StoreData,
  externalId: string
): Promise<{ success: boolean; error?: string }> {
  if (!store.cardapioweb_enabled || !store.cardapioweb_api_url || !store.cardapioweb_api_token) {
    console.log(`CardápioWeb not enabled or configured, skipping dispatch notification`);
    return { success: true };
  }

  const baseUrl = store.cardapioweb_api_url.replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/partner/v1/orders/${externalId}/dispatch`;

  console.log(`Calling CardápioWeb DISPATCH for order ${externalId}: ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-API-KEY': store.cardapioweb_api_token,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log(`CardápioWeb DISPATCH response for ${externalId}:`, response.status, responseText.substring(0, 200));

    // 204 = success, 409 = already dispatched, 404 = order doesn't exist - all are OK
    // (404 means the order was already processed/closed on CardápioWeb side)
    if (response.ok || response.status === 204 || response.status === 409 || response.status === 404) {
      return { success: true };
    }

    return { success: false, error: `HTTP ${response.status}: ${responseText.substring(0, 100)}` };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error calling CardápioWeb DISPATCH for ${externalId}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { orderIds } = await req.json();

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'orderIds is required and must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing dispatch (motoboy collection) for ${orderIds.length} orders`);

    const results: OrderResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const orderId of orderIds) {
      try {
        // Fetch order data
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('id, external_id, store_id, cardapioweb_notified')
          .eq('id', orderId)
          .single();

        if (orderError || !order) {
          console.error(`Order ${orderId} not found:`, orderError);
          results.push({ orderId, success: false, error: 'Order not found' });
          errorCount++;
          continue;
        }

        const typedOrder = order as OrderData;

        if (!typedOrder.external_id) {
          console.log(`Order ${orderId} has no external_id, skipping CardápioWeb dispatch notification`);
          results.push({ orderId, success: true, dispatchNotified: false });
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
          results.push({ orderId, success: false, error: 'Store not found' });
          errorCount++;
          continue;
        }

        const typedStore = store as StoreData;

        // Chamar /dispatch no CardápioWeb (marcar como SAIU PARA ENTREGA)
        console.log(`Marking order ${typedOrder.external_id} as DISPATCHED on CardápioWeb`);
        const dispatchResult = await notifyCardapioWebDispatch(typedStore, typedOrder.external_id);

        if (dispatchResult.success) {
          console.log(`Order ${typedOrder.external_id} marked as DISPATCHED successfully`);
          
          results.push({ 
            orderId, 
            success: true, 
            dispatchNotified: true 
          });
          successCount++;
        } else {
          console.error(`Failed to dispatch order ${typedOrder.external_id}:`, dispatchResult.error);
          
          // Marcar erro de notificação
          await supabase
            .from('orders')
            .update({
              notification_error: dispatchResult.error,
            })
            .eq('id', orderId);
          
          results.push({ orderId, success: false, error: dispatchResult.error });
          errorCount++;
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing order ${orderId}:`, errorMessage);
        results.push({ orderId, success: false, error: errorMessage });
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        processed: orderIds.length,
        successCount,
        errors: errorCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in notify-order-dispatch function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
