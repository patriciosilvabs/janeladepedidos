import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getOrderTypeLabel(orderType: string): string {
  const labels: Record<string, string> = {
    'delivery': 'Delivery',
    'dine_in': 'Mesa',
    'table': 'Mesa',
    'closed_table': 'Mesa',
    'takeaway': 'Retirada',
    'takeout': 'Retirada',
    'counter': 'Balcão',
    'onsite': 'Balcão',
  };
  return labels[orderType] || orderType;
}

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
): Promise<{ newOrders: number; processed: number; totalFromApi: number; cancelled: number; error?: string }> {
  const result = { newOrders: 0, processed: 0, totalFromApi: 0, cancelled: 0 };

  if (!store.cardapioweb_api_token || !store.cardapioweb_api_url) {
    console.log(`[poll-orders] Store "${store.name}" missing API configuration`);
    return { ...result, error: 'Missing API token or URL' };
  }

  const baseUrl = store.cardapioweb_api_url;
  const token = store.cardapioweb_api_token;

  console.log(`[poll-orders] Fetching orders for store "${store.name}" from: ${baseUrl}`);
  
  try {
   // Buscar todos os pedidos sem filtrar por status
   // Isso permite capturar pedidos de Mesa (status diferente de confirmed)
   // e descobrir quais valores de status a API retorna
   const ordersResponse = await fetch(
     `${baseUrl}/api/partner/v1/orders`,
     {
      method: 'GET',
      headers: {
        'X-API-KEY': token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
     }
   );

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
    
    result.totalFromApi = ordersData.length;
    
    console.log(`[poll-orders] Store "${store.name}": ${ordersData.length} pedidos encontrados`);

    // Tipos de pedido que são de mesa (chegam com status closed)
    const tableOrderTypes = ['closed_table', 'dine_in', 'table'];

    // Log para debug dos order_types recebidos
    const orderTypesFound = [...new Set(ordersData.map(o => o.order_type))];
    console.log(`[poll-orders] Order types found:`, orderTypesFound.join(', '));

    // Log específico para pedidos de mesa
    const tableOrders = ordersData.filter(o => tableOrderTypes.includes((o.order_type || '').toLowerCase()));
    if (tableOrders.length > 0) {
      console.log(`[poll-orders] Table orders found: ${tableOrders.length}`);
      tableOrders.slice(0, 3).forEach(o => {
        console.log(`[poll-orders] Table order ${o.id}: type=${o.order_type}, status=${o.status}`);
      });
    }

    // Filtrar pedidos ativos OU pedidos de mesa (que chegam como closed)
    const ignoredStatuses = ['canceled', 'cancelled', 'rejected'];
    const activeOrders = ordersData.filter(order => {
      const status = (order.status || '').toLowerCase();
      const orderType = (order.order_type || '').toLowerCase();
      
      // Permitir pedidos de mesa com qualquer status exceto cancelados
      if (tableOrderTypes.includes(orderType)) {
        const isIgnored = ignoredStatuses.includes(status);
        if (!isIgnored) {
          console.log(`[poll-orders] Including table order ${order.id} with status: ${status}`);
        }
        return !isIgnored;
      }
      
      // Para outros tipos, ignorar status finalizados
      const extendedIgnored = [...ignoredStatuses, 'closed', 'delivered', 'dispatched'];
      return !extendedIgnored.includes(status);
    });
    
    console.log(`[poll-orders] ${activeOrders.length} active orders out of ${ordersData.length} total`);
    
    // OTIMIZAÇÃO 2: Buscar todos os external_ids existentes de uma vez (1 query em vez de N)
    const orderIds = activeOrders.map(o => String(o.id));
    console.log(`[poll-orders] Looking for external_ids:`, orderIds.slice(0, 5).join(', '));
    
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('external_id')
      .eq('store_id', store.id)
      .in('external_id', orderIds);
    
    const existingSet = new Set(existingOrders?.map((o: { external_id: string | null }) => o.external_id) || []);
    console.log(`[poll-orders] Found ${existingSet.size} existing orders in DB:`, [...existingSet].slice(0, 5).join(', '));
    
    // OTIMIZAÇÃO 3: Filtrar apenas pedidos novos
    const newOrders = activeOrders.filter(o => !existingSet.has(String(o.id)));
    
    console.log(`[poll-orders] ${newOrders.length} new orders to import`);
    
    // Processar apenas pedidos novos
    for (const order of newOrders) {
      result.processed++;
      const cardapiowebOrderId = String(order.id);

      // Fetch order details only for new orders
      console.log(`[poll-orders] Fetching details for NEW order: ${order.id}`);
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
        console.error(`[poll-orders] Error fetching order details:`, err);
      }

      // Use display_id from details, fallback to code or order id
      const orderCode = orderDetails.display_id?.toString() || orderDetails.code || order.display_id?.toString() || String(order.id);
 
      // Verificar se é delivery para extrair endereço
      const isDelivery = order.order_type === 'delivery';
      const address = isDelivery ? (orderDetails.delivery_address || {}) : {};
      
      // Coordenadas: usar padrão se não for delivery
      const lat = isDelivery ? (address.latitude || -7.1195) : -7.1195;
      const lng = isDelivery ? (address.longitude || -34.8450) : -34.8450;

      // Endereço formatado baseado no tipo
      const fullAddress = isDelivery
        ? [address.street, address.number, address.neighborhood, address.city, address.state]
            .filter(Boolean)
            .join(', ') || 'Endereço não informado'
        : getOrderTypeLabel(order.order_type);

      // Insert new order with store_id
      const { data: insertedOrder, error: insertError } = await supabase
        .from('orders')
        .insert({
        cardapioweb_order_id: orderCode,  // Número visível do pedido (ex: 7955)
        external_id: cardapiowebOrderId,  // ID interno para chamadas de API
        customer_name: orderDetails.customer?.name || 'Cliente',
        customer_phone: orderDetails.customer?.phone || null,
        address: fullAddress,
        street: isDelivery ? (address.street || null) : null,
        house_number: isDelivery ? (address.number || null) : null,
        neighborhood: isDelivery ? (address.neighborhood || null) : null,
        city: isDelivery ? (address.city || store.default_city || 'João Pessoa') : store.default_city || 'João Pessoa',
        region: isDelivery ? (address.state || store.default_region || 'PB') : store.default_region || 'PB',
        country: isDelivery ? (address.country || store.default_country || 'BR') : store.default_country || 'BR',
        postal_code: isDelivery ? (address.zipCode || null) : null,
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
        order_type: order.order_type || 'delivery',
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`[poll-orders] Error inserting order:`, insertError);
      } else {
        result.newOrders++;
        console.log(`[poll-orders] Inserted new order: ${cardapiowebOrderId} for store "${store.name}"`);

        // Criar order_items para KDS
        if (orderDetails.items && Array.isArray(orderDetails.items)) {
          const { data: itemsResult, error: itemsError } = await supabase.rpc(
            'create_order_items_from_json',
            {
              p_order_id: insertedOrder.id,
              p_items: orderDetails.items,
              p_default_sector_id: null,
            }
          );

          if (itemsError) {
            console.error(`[poll-orders] Error creating order items:`, itemsError);
          } else {
            console.log(`[poll-orders] Created ${itemsResult} items for order ${insertedOrder.id}`);
          }
        }
      }
    }

    // Check status of existing pending orders and remove cancelled ones
    const { data: existingPendingOrders } = await supabase
      .from('orders')
      .select('id, external_id, cardapioweb_order_id, order_type')
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
            const orderType = (order.order_type || '').toLowerCase();
            
            // Pedidos de mesa (closed_table, dine_in, table) chegam com status "closed" - isso é normal
            // Não devemos deletá-los por causa do status closed
            const isTableOrder = tableOrderTypes.includes(orderType);
            
            // Se for pedido de mesa com status closed, é normal - não deletar
            if (isTableOrder && status === 'closed') {
              continue;
            }
            
            // Para outros tipos ou status de cancelamento, remover
            if (['cancelled', 'canceled', 'rejected'].includes(status) || 
                (!isTableOrder && status === 'closed')) {
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
