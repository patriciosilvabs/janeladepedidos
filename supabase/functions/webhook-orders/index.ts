import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  items?: any;
  total_amount?: number;
  delivery_fee?: number;
  payment_method?: string;
  notes?: string;
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
      .single();

    // Validate webhook token if configured
    const webhookToken = req.headers.get('x-webhook-token');
    if (settings?.cardapioweb_webhook_token && settings.cardapioweb_enabled) {
      if (!webhookToken || webhookToken !== settings.cardapioweb_webhook_token) {
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

    const body: IncomingOrder | IncomingOrder[] = await req.json();
    const orders = Array.isArray(body) ? body : [body];

    console.log(`Received ${orders.length} order(s)`);

    const insertedOrders = [];

    for (const order of orders) {
      // Validate required fields
      if (!order.customer_name || !order.address || !order.lat || !order.lng) {
        console.error('Invalid order:', order);
        continue;
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
        continue;
      }

      insertedOrders.push(data);
      console.log(`Order ${data.id} inserted successfully`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertedOrders.length,
        orders: insertedOrders,
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
