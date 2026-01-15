import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderResult {
  orderId: string;
  success: boolean;
  error?: string;
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

    console.log(`Processing dispatch notifications for ${orderIds.length} orders`);

    const results: OrderResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const orderId of orderIds) {
      try {
        // Fetch order data
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('external_id, store_id')
          .eq('id', orderId)
          .single();

        if (orderError || !order) {
          console.error(`Order ${orderId} not found:`, orderError);
          results.push({ orderId, success: false, error: 'Order not found' });
          errorCount++;
          continue;
        }

        if (!order.external_id) {
          console.log(`Order ${orderId} has no external_id, skipping CardapioWeb notification`);
          results.push({ orderId, success: true });
          successCount++;
          continue;
        }

        // Fetch store configuration
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('cardapioweb_api_url, cardapioweb_api_token, cardapioweb_enabled')
          .eq('id', order.store_id)
          .single();

        if (storeError || !store) {
          console.error(`Store ${order.store_id} not found:`, storeError);
          results.push({ orderId, success: false, error: 'Store not found' });
          errorCount++;
          continue;
        }

        if (!store.cardapioweb_enabled) {
          console.log(`CardapioWeb disabled for store ${order.store_id}, skipping`);
          results.push({ orderId, success: true });
          successCount++;
          continue;
        }

        if (!store.cardapioweb_api_url || !store.cardapioweb_api_token) {
          console.error(`CardapioWeb not configured for store ${order.store_id}`);
          results.push({ orderId, success: false, error: 'CardapioWeb not configured' });
          errorCount++;
          continue;
        }

        // Call CardapioWeb dispatch endpoint
        const baseUrl = store.cardapioweb_api_url.replace(/\/$/, '');
        const endpoint = `${baseUrl}/api/partner/v1/orders/${order.external_id}/dispatch`;

        console.log(`Calling CardapioWeb dispatch for order ${order.external_id}: ${endpoint}`);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'X-API-KEY': store.cardapioweb_api_token,
            'Content-Type': 'application/json',
          },
        });

        const responseText = await response.text();
        console.log(`CardapioWeb dispatch response for ${order.external_id}:`, response.status, responseText);

        // 409 Conflict = already dispatched, 404 = order doesn't exist - both are OK
        if (response.ok || response.status === 409 || response.status === 404) {
          console.log(`Dispatch notification successful for order ${order.external_id}`);
          results.push({ orderId, success: true });
          successCount++;
        } else {
          console.error(`Dispatch failed for order ${order.external_id}:`, response.status, responseText);
          results.push({ orderId, success: false, error: `HTTP ${response.status}: ${responseText}` });
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
