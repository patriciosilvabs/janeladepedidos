import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IncomingOrder {
  id?: string;
  external_id?: string;
  customer_name: string;
  customer_phone?: string;
  address: string;
  neighborhood?: string;
  lat: number;
  lng: number;
  items?: any;
  total_amount?: number;
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
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          address: order.address,
          neighborhood: order.neighborhood,
          lat: order.lat,
          lng: order.lng,
          items: order.items,
          total_amount: order.total_amount,
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
