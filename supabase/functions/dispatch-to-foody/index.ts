import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderToDispatch {
  id: string;
  external_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  address: string;
  street: string | null;
  house_number: string | null;
  neighborhood: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postal_code: string | null;
  lat: number;
  lng: number;
  items: any;
  total_amount: number | null;
  notes: string | null;
  delivery_fee: number | null;
  payment_method: string | null;
}

interface FoodyOrder {
  id: string;
  status: string;
  deliveryPoint: {
    address: string;
    street: string;
    houseNumber: string;
    postalCode: string;
    coordinates: { lat: number; lng: number };
    city: string;
    region: string;
    country: string;
  };
  customer: {
    customerName: string;
    customerPhone: string;
  };
  orderTotal: number;
  orderDetails: string;
  notes: string;
  deliveryFee: number;
  paymentMethod: string;
}

function extractStreetFromAddress(address: string): string {
  // Try to extract street from address before the number
  const match = address.match(/^([^,\d]+)/);
  return match ? match[1].trim() : address;
}

function extractNumberFromAddress(address: string): string {
  // Try to extract house number from address
  const match = address.match(/(\d+)/);
  return match ? match[1] : '';
}

function formatItems(items: any): string {
  if (!items) return '';
  if (typeof items === 'string') return items;
  if (Array.isArray(items)) {
    return items.map((item: any) => {
      if (typeof item === 'string') return item;
      const qty = item.quantity || item.qty || 1;
      const name = item.name || item.product || item.description || '';
      return `${qty}x ${name}`;
    }).join(', ');
  }
  return JSON.stringify(items);
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

    // Fetch settings from database
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar configurações' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.foody_enabled) {
      console.log('Foody integration disabled, skipping API call');
      // Just update status locally
      const now = new Date().toISOString();
      await supabase
        .from('orders')
        .update({ status: 'dispatched', dispatched_at: now })
        .in('id', orderIds);

      if (groupId) {
        await supabase
          .from('delivery_groups')
          .update({ status: 'dispatched', dispatched_at: now })
          .eq('id', groupId);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Pedidos despachados (Foody desabilitado)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.foody_api_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token da API Foody não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .in('id', orderIds);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar pedidos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Dispatching ${orders.length} orders to Foody`);

    const results = [];
    const errors = [];

    for (const order of orders as OrderToDispatch[]) {
      try {
        // Transform order to Foody format
        const foodyOrder: FoodyOrder = {
          id: (order.external_id || order.id).substring(0, 10),
          status: 'ready',
          deliveryPoint: {
            address: order.address,
            street: order.street || extractStreetFromAddress(order.address),
            houseNumber: order.house_number || extractNumberFromAddress(order.address),
            postalCode: order.postal_code || '',
            coordinates: { lat: order.lat, lng: order.lng },
            city: order.city || settings.default_city,
            region: order.region || settings.default_region,
            country: order.country || settings.default_country,
          },
          customer: {
            customerName: order.customer_name,
            customerPhone: order.customer_phone || '',
          },
          orderTotal: order.total_amount || 0,
          orderDetails: formatItems(order.items),
          notes: order.notes || '',
          deliveryFee: order.delivery_fee || 0,
          paymentMethod: order.payment_method || 'online',
        };

        console.log(`Sending order ${order.id} to Foody:`, JSON.stringify(foodyOrder));

        const response = await fetch(`${settings.foody_api_url}/orders`, {
          method: 'POST',
          headers: {
            'Authorization': settings.foody_api_token,
            'Content-Type': 'application/json;charset=UTF-8',
          },
          body: JSON.stringify(foodyOrder),
        });

        console.log(`Foody API response for order ${order.id}:`, response.status);

        if (response.status === 429) {
          // Rate limit - wait and retry
          console.log('Rate limited, waiting 1 second...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Foody API error for order ${order.id}:`, errorText);
          errors.push({ orderId: order.id, error: `API Error: ${response.status}` });
          
          await supabase
            .from('orders')
            .update({ foody_error: `API Error: ${response.status} - ${errorText}` })
            .eq('id', order.id);
          continue;
        }

        const responseData = await response.json();
        console.log(`Foody API success for order ${order.id}:`, JSON.stringify(responseData));

        // Update order with Foody UID
        const now = new Date().toISOString();
        await supabase
          .from('orders')
          .update({
            status: 'dispatched',
            dispatched_at: now,
            foody_uid: responseData.uid || responseData.id,
            foody_status: 'sent',
            foody_error: null,
          })
          .eq('id', order.id);

        results.push({ orderId: order.id, foodyUid: responseData.uid || responseData.id });
      } catch (orderError) {
        console.error(`Error processing order ${order.id}:`, orderError);
        const errorMessage = orderError instanceof Error ? orderError.message : 'Unknown error';
        errors.push({ orderId: order.id, error: errorMessage });
        
        await supabase
          .from('orders')
          .update({ foody_error: errorMessage })
          .eq('id', order.id);
      }
    }

    // Update group status if all orders processed
    if (groupId && errors.length === 0) {
      const now = new Date().toISOString();
      await supabase
        .from('delivery_groups')
        .update({ status: 'dispatched', dispatched_at: now })
        .eq('id', groupId);
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        dispatched: results.length,
        errors: errors.length,
        results,
        errorDetails: errors,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Dispatch to Foody error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
