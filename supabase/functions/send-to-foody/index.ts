import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface OrderData {
  id: string;
  external_id: string | null;
  cardapioweb_order_id: string | null;
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
  items: unknown;
  total_amount: number | null;
  delivery_fee: number | null;
  payment_method: string | null;
  notes: string | null;
  store_id: string | null;
  foody_uid: string | null;
}

interface FoodyOrderPayload {
  id: string;
  status: string;
  deliveryPoint: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    street?: string;
    houseNumber?: string;
    neighborhood?: string;
    city?: string;
    region?: string;
    country?: string;
    postalCode?: string;
  };
  customer: {
    customerName: string;
    customerPhone?: string;
  };
  orderTotal?: number;
  deliveryFee?: number;
  paymentMethod?: string;
  notes?: string;
  orderDetails?: string;
}

function mapPaymentMethod(method: string | null): string {
  if (!method) return 'online';
  
  const methodLower = method.toLowerCase();
  if (methodLower.includes('dinheiro') || methodLower.includes('money') || methodLower.includes('cash')) {
    return 'money';
  }
  if (methodLower.includes('cartão') || methodLower.includes('card') || methodLower.includes('credito') || methodLower.includes('debito')) {
    return 'card';
  }
  if (methodLower.includes('pix')) {
    return 'pix';
  }
  return 'online';
}

function formatItems(items: unknown): string {
  if (!items) return '';
  
  try {
    if (Array.isArray(items)) {
      return items.map((item: { name?: string; quantity?: number; price?: number }) => {
        const qty = item.quantity || 1;
        const name = item.name || 'Item';
        const price = item.price ? ` - R$ ${item.price.toFixed(2)}` : '';
        return `${qty}x ${name}${price}`;
      }).join('\n');
    }
    return JSON.stringify(items);
  } catch {
    return '';
  }
}

function buildFoodyPayload(order: OrderData, directRoute: boolean = false): FoodyOrderPayload {
  // Usar os últimos 10 caracteres do external_id ou cardapioweb_order_id como ID
  const orderId = (order.external_id || order.cardapioweb_order_id || order.id).slice(-10);
  
  // Construir endereço formatado
  const addressParts = [
    order.street,
    order.house_number ? `nº ${order.house_number}` : null,
    order.neighborhood,
    order.city,
    order.region,
  ].filter(Boolean);
  
  const formattedAddress = addressParts.length > 0 ? addressParts.join(', ') : order.address;

  const payload: FoodyOrderPayload = {
    id: orderId,
    status: 'ready', // Pedido está pronto para entrega
    deliveryPoint: {
      address: formattedAddress,
      coordinates: {
        latitude: order.lat,
        longitude: order.lng,
      },
      street: order.street || undefined,
      houseNumber: order.house_number || undefined,
      neighborhood: order.neighborhood || undefined,
      city: order.city || undefined,
      region: order.region || undefined,
      country: order.country || 'BR',
      postalCode: order.postal_code || undefined,
    },
    customer: {
      customerName: order.customer_name,
      customerPhone: order.customer_phone || undefined,
    },
    orderTotal: order.total_amount || undefined,
    deliveryFee: order.delivery_fee || undefined,
    paymentMethod: mapPaymentMethod(order.payment_method),
    notes: order.notes || undefined,
    orderDetails: formatItems(order.items),
  };

  // Add directRoute/priority flags for urgent orders
  if (directRoute) {
    // Note: Adjust these field names based on Foody's actual API specification
    (payload as any).directRoute = true;
    (payload as any).priority = 'urgent';
    (payload as any).groupable = false; // Prevent grouping with other orders
  }

  return payload;
}

// deno-lint-ignore no-explicit-any
async function sendOrderToFoody(
  supabase: any,
  order: OrderData,
  foodyApiUrl: string,
  foodyApiToken: string,
  directRoute: boolean = false
): Promise<{ success: boolean; foody_uid?: string; error?: string }> {
  
  // Verificar se já foi enviado ao Foody
  if (order.foody_uid) {
    console.log(`Order ${order.id} already sent to Foody (uid: ${order.foody_uid})`);
    return { success: true, foody_uid: order.foody_uid };
  }

  const payload = buildFoodyPayload(order, directRoute);
  console.log(`Sending order ${order.id} to Foody (directRoute: ${directRoute}):`, JSON.stringify(payload));

  try {
    const response = await fetch(`${foodyApiUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${foodyApiToken}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log(`Foody API response (${response.status}):`, responseText);

    if (!response.ok) {
      return { 
        success: false, 
        error: `Foody API Error: ${response.status} - ${responseText}` 
      };
    }

    // Tentar extrair o UID da resposta
    let foodyUid: string | undefined;
    try {
      const responseData = JSON.parse(responseText);
      foodyUid = responseData.uid || responseData.id || responseData.order_id;
    } catch {
      // Se não conseguir parsear, usar o ID do pedido
      foodyUid = payload.id;
    }

    // Atualizar pedido com informações do Foody
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        foody_uid: foodyUid,
        foody_status: 'open',
        foody_error: null,
      })
      .eq('id', order.id);

    if (updateError) {
      console.error(`Error updating order ${order.id} with Foody data:`, updateError);
    }

    console.log(`Order ${order.id} sent to Foody successfully (uid: ${foodyUid})`);
    return { success: true, foody_uid: foodyUid };

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error sending order ${order.id} to Foody:`, errorMsg);
    
    // Salvar erro no banco
    await supabase
      .from('orders')
      .update({ foody_error: errorMsg })
      .eq('id', order.id);
    
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

    const { orderIds, directRoute } = await req.json();

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'IDs de pedidos não fornecidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configurações do Foody
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('foody_api_url, foody_api_token, foody_enabled')
      .eq('id', 'default')
      .single();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar configurações' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const foodySettings = settings as { foody_api_url?: string; foody_api_token?: string; foody_enabled?: boolean };
    
    if (!foodySettings?.foody_enabled) {
      console.log('Foody integration is disabled');
      return new Response(
        JSON.stringify({ success: true, message: 'Foody integration is disabled', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!foodySettings?.foody_api_token || !foodySettings?.foody_api_url) {
      console.log('Foody not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Foody não está configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar pedidos
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

    console.log(`Processing ${orders.length} orders for Foody (directRoute: ${directRoute || false})`);

    const results: { orderId: string; foody_uid?: string }[] = [];
    const errors: { orderId: string; error: string }[] = [];

    for (const order of orders as OrderData[]) {
      const result = await sendOrderToFoody(
        supabase,
        order,
        foodySettings.foody_api_url,
        foodySettings.foody_api_token,
        directRoute || false
      );

      if (result.success) {
        results.push({ orderId: order.id, foody_uid: result.foody_uid });
      } else {
        errors.push({ orderId: order.id, error: result.error || 'Unknown error' });
      }
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        processed: results.length,
        errors: errors.length,
        results,
        errorDetails: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Send to Foody error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
