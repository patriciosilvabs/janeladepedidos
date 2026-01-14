import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CardapioWebOrder {
  id: number;
  code: string;
  status: string;
  customer: {
    name: string;
    phone?: string;
  };
  delivery?: {
    address?: {
      street?: string;
      number?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      country?: string;
      zipCode?: string;
      complement?: string;
      latitude?: number;
      longitude?: number;
    };
    fee?: number;
  };
  total?: number;
  payments?: Array<{ method?: string }>;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
    notes?: string;
  }>;
  notes?: string;
  createdAt?: string;
}

Deno.serve(async (req) => {
  console.log('[poll-orders] Request received:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch settings
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (settingsError) {
      console.error('[poll-orders] Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings?.cardapioweb_enabled) {
      console.log('[poll-orders] Cardápio Web integration is disabled');
      return new Response(
        JSON.stringify({ success: true, message: 'Integration disabled', newOrders: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.cardapioweb_api_token || !settings.cardapioweb_api_url) {
      console.log('[poll-orders] Missing API configuration');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing API token or URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = settings.cardapioweb_api_url;
    const token = settings.cardapioweb_api_token;

    // Fetch orders from Cardápio Web - only confirmed orders
    console.log('[poll-orders] Fetching orders from:', baseUrl);
    const ordersResponse = await fetch(`${baseUrl}/api/partner/v1/orders?status[]=confirmed`, {
      method: 'GET',
      headers: {
        'X-API-KEY': token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      console.error('[poll-orders] API error:', ordersResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `API error: ${ordersResponse.status}`, details: errorText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ordersData: CardapioWebOrder[] = await ordersResponse.json();
    console.log('[poll-orders] Found', ordersData.length, 'orders');

    let newOrdersCount = 0;
    let processedCount = 0;

    for (const order of ordersData) {
      processedCount++;
      const cardapiowebOrderId = String(order.id);

      // Check if order already exists
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('cardapioweb_order_id', cardapiowebOrderId)
        .maybeSingle();

      if (existingOrder) {
        console.log('[poll-orders] Order already exists:', cardapiowebOrderId);
        continue;
      }

      // Fetch order details
      console.log('[poll-orders] Fetching details for order:', order.id);
      let orderDetails = order;
      
      try {
        const detailsResponse = await fetch(`${baseUrl}/api/partner/v1/orders/${order.id}`, {
          method: 'GET',
          headers: {
            'X-API-KEY': token,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        if (detailsResponse.ok) {
          orderDetails = await detailsResponse.json();
        }
      } catch (err) {
        console.error('[poll-orders] Error fetching order details:', err);
      }

      // Extract address info
      const delivery = orderDetails.delivery || {};
      const address = delivery.address || {};
      
      const lat = address.latitude || -7.1195;
      const lng = address.longitude || -34.8450;

      const fullAddress = [
        address.street,
        address.number,
        address.neighborhood,
        address.city,
        address.state,
      ]
        .filter(Boolean)
        .join(', ') || 'Endereço não informado';

      // Insert new order
      const { error: insertError } = await supabase.from('orders').insert({
        cardapioweb_order_id: cardapiowebOrderId,
        external_id: orderDetails.code || cardapiowebOrderId,
        customer_name: orderDetails.customer?.name || 'Cliente',
        customer_phone: orderDetails.customer?.phone || null,
        address: fullAddress,
        street: address.street || null,
        house_number: address.number || null,
        neighborhood: address.neighborhood || null,
        city: address.city || settings.default_city || 'João Pessoa',
        region: address.state || settings.default_region || 'PB',
        country: address.country || settings.default_country || 'BR',
        postal_code: address.zipCode || null,
        lat,
        lng,
        total_amount: orderDetails.total || 0,
        delivery_fee: delivery.fee || 0,
        payment_method: orderDetails.payments?.[0]?.method || null,
        items: orderDetails.items || [],
        notes: orderDetails.notes || address.complement || null,
        status: 'pending',
      });

      if (insertError) {
        console.error('[poll-orders] Error inserting order:', insertError);
      } else {
        newOrdersCount++;
        console.log('[poll-orders] Inserted new order:', cardapiowebOrderId);
      }
    }

    console.log('[poll-orders] Completed. New orders:', newOrdersCount, 'Processed:', processedCount);

    return new Response(
      JSON.stringify({
        success: true,
        newOrders: newOrdersCount,
        processed: processedCount,
        message: newOrdersCount > 0 
          ? `${newOrdersCount} novo(s) pedido(s) importado(s)` 
          : 'Nenhum pedido novo encontrado',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[poll-orders] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Unexpected error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
