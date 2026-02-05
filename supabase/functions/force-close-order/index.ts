import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ success: false, error: 'orderId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Force closing order ${orderId}`);

    // Fetch order data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('external_id, store_id, cardapioweb_order_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error(`Order ${orderId} not found:`, orderError);
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no external_id, just delete the order locally
    if (!order.external_id) {
      console.log(`Order ${orderId} has no external_id, deleting locally only`);
      
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (deleteError) {
        console.error(`Error deleting order ${orderId}:`, deleteError);
        return new Response(
          JSON.stringify({ success: false, error: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Order deleted locally (no CardápioWeb link)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no store_id, just delete locally
    if (!order.store_id) {
      console.log(`Order ${orderId} has no store_id, deleting locally only`);
      
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (deleteError) {
        console.error(`Error deleting order ${orderId}:`, deleteError);
        return new Response(
          JSON.stringify({ success: false, error: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Order deleted locally (no store linked)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch store configuration
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('cardapioweb_api_url, cardapioweb_api_token, cardapioweb_enabled')
      .eq('id', order.store_id)
      .single();

    if (storeError || !store) {
      console.error(`Store ${order.store_id} not found:`, storeError);
      return new Response(
        JSON.stringify({ success: false, error: 'Store not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If CardápioWeb is disabled or not configured, just delete locally
    if (!store.cardapioweb_enabled || !store.cardapioweb_api_url || !store.cardapioweb_api_token) {
      console.log(`CardápioWeb not configured for store ${order.store_id}, deleting locally only`);
      
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (deleteError) {
        console.error(`Error deleting order ${orderId}:`, deleteError);
        return new Response(
          JSON.stringify({ success: false, error: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Order deleted locally (CardápioWeb not configured)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call CardápioWeb close endpoint
    const baseUrl = store.cardapioweb_api_url.replace(/\/$/, '');
    const endpoint = `${baseUrl}/api/partner/v1/orders/${order.external_id}/close`;

    console.log(`Calling CardápioWeb close for order ${order.cardapioweb_order_id || order.external_id}: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-API-KEY': store.cardapioweb_api_token,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log(`CardápioWeb close response for ${order.external_id}:`, response.status, responseText);

    // 200 OK, 409 Conflict (already closed), 404 (order doesn't exist) - all are acceptable to proceed with deletion
    if (response.ok || response.status === 409 || response.status === 404) {
      console.log(`CardápioWeb close successful for order ${order.external_id}, deleting from local DB`);
      
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (deleteError) {
        console.error(`Error deleting order ${orderId}:`, deleteError);
        return new Response(
          JSON.stringify({ success: false, error: `CardápioWeb closed but local delete failed: ${deleteError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Order closed on CardápioWeb and removed from system',
          cardapioweb_status: response.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Other errors - don't delete, return error
    console.error(`CardápioWeb close failed for order ${order.external_id}:`, response.status, responseText);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `CardápioWeb returned error: ${response.status} - ${responseText}`,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in force-close-order function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
