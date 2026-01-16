import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CardapioWebOrder {
  id: number;
  code?: string;
  display_id?: number;  // Número visível do pedido (ex: 7955)
  status: string;
  order_type: string;
  created_at?: string;  // Data de criação (snake_case da API)
  updated_at?: string;  // Data de atualização
  customer: {
    name: string;
    phone?: string;
  };
  // Estrutura correta da API: delivery_address (não delivery.address)
  delivery_address?: {
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
  delivery_fee?: number;  // Taxa de entrega no root (não em delivery.fee)
  total?: number;
  payments?: Array<{ method?: string }>;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
    notes?: string;
  }>;
  notes?: string;
}

interface Store {
  id: string;
  name: string;
  cardapioweb_api_token: string | null;
  cardapioweb_api_url: string | null;
  cardapioweb_enabled: boolean;
  default_city: string | null;
  default_region: string | null;
  default_country: string | null;
}

async function pollStoreOrders(
  supabase: any,
  store: Store
): Promise<{ newOrders: number; processed: number; totalFromApi: number; deliveryOnly: number; cancelled: number; error?: string }> {
  const result = { newOrders: 0, processed: 0, totalFromApi: 0, deliveryOnly: 0, cancelled: 0 };

  if (!store.cardapioweb_api_token || !store.cardapioweb_api_url) {
    console.log(`[poll-orders] Store "${store.name}" missing API configuration`);
    return { ...result, error: 'Missing API token or URL' };
  }

  const baseUrl = store.cardapioweb_api_url;
  const token = store.cardapioweb_api_token;

  console.log(`[poll-orders] Fetching orders for store "${store.name}" from: ${baseUrl}`);
  
  try {
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
      console.error(`[poll-orders] Store "${store.name}" API error:`, ordersResponse.status, errorText);
      return { ...result, error: `API error: ${ordersResponse.status}` };
    }

    const ordersData: CardapioWebOrder[] = await ordersResponse.json();
    
    // Log first order to debug structure
    if (ordersData.length > 0) {
      console.log(`[poll-orders] First order raw data:`, JSON.stringify(ordersData[0], null, 2));
    }
    
    // Filter only delivery orders
    const deliveryOrders = ordersData.filter(order => order.order_type === 'delivery');
    result.totalFromApi = ordersData.length;
    result.deliveryOnly = deliveryOrders.length;
    
    console.log(`[poll-orders] Store "${store.name}": ${ordersData.length} total, ${deliveryOrders.length} delivery`);

    for (const order of deliveryOrders) {
      result.processed++;
      const cardapiowebOrderId = String(order.id);

      // Check if order already exists
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('cardapioweb_order_id', cardapiowebOrderId)
        .maybeSingle();

      if (existingOrder) {
        console.log(`[poll-orders] Order already exists: ${cardapiowebOrderId}`);
        continue;
      }

      // Fetch order details
      console.log(`[poll-orders] Fetching details for order: ${order.id}, code from list: ${order.code}`);
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
          console.log(`[poll-orders] Order details raw:`, JSON.stringify(orderDetails, null, 2));
        }
      } catch (err) {
        console.error(`[poll-orders] Error fetching order details:`, err);
      }

      // Use display_id from details, fallback to code or order id
      const orderCode = orderDetails.display_id?.toString() || orderDetails.code || order.display_id?.toString() || String(order.id);
      console.log(`[poll-orders] Final order code to save: ${orderCode}`);

      // Extract address info - API usa delivery_address direto (não delivery.address)
      const address = orderDetails.delivery_address || {};
      
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

      // Insert new order with store_id
      const { error: insertError } = await supabase.from('orders').insert({
        cardapioweb_order_id: orderCode,  // Número visível do pedido (ex: 7955)
        external_id: cardapiowebOrderId,  // ID interno para chamadas de API
        customer_name: orderDetails.customer?.name || 'Cliente',
        customer_phone: orderDetails.customer?.phone || null,
        address: fullAddress,
        street: address.street || null,
        house_number: address.number || null,
        neighborhood: address.neighborhood || null,
        city: address.city || store.default_city || 'João Pessoa',
        region: address.state || store.default_region || 'PB',
        country: address.country || store.default_country || 'BR',
        postal_code: address.zipCode || null,
        lat,
        lng,
        total_amount: orderDetails.total || 0,
        delivery_fee: orderDetails.delivery_fee || 0,  // Corrigido: delivery_fee no root
        payment_method: orderDetails.payments?.[0]?.method || null,
        items: orderDetails.items || [],
        notes: orderDetails.notes || address.complement || null,
        status: 'pending',
        store_id: store.id,
        cardapioweb_created_at: orderDetails.created_at || null,  // Corrigido: created_at (snake_case)
      });

      if (insertError) {
        console.error(`[poll-orders] Error inserting order:`, insertError);
      } else {
        result.newOrders++;
        console.log(`[poll-orders] Inserted new order: ${cardapiowebOrderId} for store "${store.name}"`);
      }
    }

    // Check status of existing pending orders and remove cancelled ones
    const { data: existingPendingOrders } = await supabase
      .from('orders')
      .select('id, external_id, cardapioweb_order_id')
      .eq('store_id', store.id)
      .eq('status', 'pending')
      .not('external_id', 'is', null);

    if (existingPendingOrders && existingPendingOrders.length > 0) {
      console.log(`[poll-orders] Checking ${existingPendingOrders.length} existing pending orders for store "${store.name}"`);
      
      for (const order of existingPendingOrders) {
        try {
          const statusResponse = await fetch(
            `${baseUrl}/api/partner/v1/orders/${order.external_id}`,
            {
              method: 'GET',
              headers: {
                'X-API-KEY': token,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
            }
          );

          // If order not found (404), it was deleted/cancelled
          if (statusResponse.status === 404) {
            console.log(`[poll-orders] Order ${order.cardapioweb_order_id} not found in CardapioWeb, removing...`);
            await supabase.from('orders').delete().eq('id', order.id);
            result.cancelled++;
            continue;
          }

          if (statusResponse.ok) {
            const details = await statusResponse.json();
            const status = details.order_status || details.status;
            
            // If cancelled or closed, remove from local database
            if (['cancelled', 'closed', 'rejected'].includes(status)) {
              console.log(`[poll-orders] Order ${order.cardapioweb_order_id} has status "${status}", removing...`);
              await supabase.from('orders').delete().eq('id', order.id);
              result.cancelled++;
            }
          }
        } catch (err) {
          console.error(`[poll-orders] Error checking order ${order.external_id}:`, err);
        }
      }
    }
  } catch (err) {
    console.error(`[poll-orders] Error polling store "${store.name}":`, err);
    return { ...result, error: String(err) };
  }

  return result;
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

    // Fetch all enabled stores
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('*')
      .eq('cardapioweb_enabled', true);

    if (storesError) {
      console.error('[poll-orders] Error fetching stores:', storesError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch stores' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!stores || stores.length === 0) {
      console.log('[poll-orders] No enabled stores found');
      return new Response(
        JSON.stringify({ success: true, message: 'No enabled stores', newOrders: 0, storesProcessed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[poll-orders] Found ${stores.length} enabled store(s)`);

    // Process each store
    const results: Array<{ storeName: string; storeId: string } & Awaited<ReturnType<typeof pollStoreOrders>>> = [];
    let totalNewOrders = 0;
    let totalProcessed = 0;
    let totalCancelled = 0;

    for (const store of stores) {
      const storeResult = await pollStoreOrders(supabase, store as Store);
      results.push({
        storeName: store.name,
        storeId: store.id,
        ...storeResult,
      });
      totalNewOrders += storeResult.newOrders;
      totalProcessed += storeResult.processed;
      totalCancelled += storeResult.cancelled;
    }

    console.log(`[poll-orders] Completed. New: ${totalNewOrders}, Processed: ${totalProcessed}, Cancelled: ${totalCancelled}`);

    // Build message
    const messageParts: string[] = [];
    if (totalNewOrders > 0) messageParts.push(`${totalNewOrders} novo(s)`);
    if (totalCancelled > 0) messageParts.push(`${totalCancelled} cancelado(s)`);
    
    const message = messageParts.length > 0
      ? `${messageParts.join(', ')} em ${stores.length} loja(s)`
      : `Nenhum pedido novo encontrado em ${stores.length} loja(s)`;

    return new Response(
      JSON.stringify({
        success: true,
        newOrders: totalNewOrders,
        processed: totalProcessed,
        cancelled: totalCancelled,
        storesProcessed: stores.length,
        storeResults: results,
        message,
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
