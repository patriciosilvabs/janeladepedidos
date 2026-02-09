import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ================== COMBO EXPLOSION ==================

function explodeComboItems(items: any[], edgeKeywords: string[], flavorKeywords: string[]): any[] {
  const result: any[] = [];

  for (const item of items) {
    const options = item.options || [];
    if (options.length === 0) {
      result.push({ ...item, _source_item_id: item.item_id || item.name });
      continue;
    }

    // Classify each option as edge, flavor, or complement
    // Group flavors by option_group_id
    const flavorGroups: Record<string, any[]> = {};
    const edgeOptions: any[] = [];
    const complementOptions: any[] = [];

    for (const opt of options) {
      const name = (opt.name || '').toLowerCase();
      const isEdge = edgeKeywords.some(k =>
        k === '#' ? name.startsWith('#') : name.includes(k.toLowerCase())
      );
      const isFlavor = !isEdge && flavorKeywords.some(k =>
        name.includes(k.toLowerCase())
      );

      if (isEdge) {
        edgeOptions.push(opt);
      } else if (isFlavor) {
        const groupId = String(opt.option_group_id || 'default');
        if (!flavorGroups[groupId]) flavorGroups[groupId] = [];
        flavorGroups[groupId].push(opt);
      } else {
        complementOptions.push(opt);
      }
    }

    const flavorGroupKeys = Object.keys(flavorGroups);

    // Detect half-and-half: if ALL flavors across ALL groups
    // start with "1/2", "½", or "meia", skip explosion
    const allFlavors = Object.values(flavorGroups).flat();
    const allHalf = allFlavors.length > 1 && allFlavors.every((f: any) => {
      const n = (f.name || '').trim();
      return /^(1\/2|½|meia)\s/i.test(n);
    });

    if (allHalf) {
      console.log(`[explodeCombo] Half-and-half detected for "${item.name}", keeping as single item`);
      result.push({ ...item, _source_item_id: item.item_id || item.name });
      continue;
    }

    // If only 0 or 1 flavor group, no explosion needed
    if (flavorGroupKeys.length <= 1) {
      result.push({ ...item, _source_item_id: item.item_id || item.name });
      continue;
    }

    // Expand edge options by quantity (e.g. "# Massa Tradicional" qty:2 -> 2 entries)
    const expandedEdges: any[] = [];
    for (const edge of edgeOptions) {
      const qty = edge.quantity || 1;
      for (let i = 0; i < qty; i++) {
        expandedEdges.push({ ...edge, quantity: 1 });
      }
    }

    // Explode: each flavor group becomes a separate item
    flavorGroupKeys.forEach((groupId, index) => {
      const groupFlavors = flavorGroups[groupId];
      // Pair edge by index (positional distribution)
      const pairedEdge = index < expandedEdges.length ? [expandedEdges[index]] : [];

      const newOptions = [
        ...groupFlavors,
        ...pairedEdge,
        ...(index === 0 ? complementOptions : []),  // complements on first only
      ];

      result.push({
        ...item,
        quantity: 1,
        options: newOptions,
        observation: index === 0 ? item.observation : null,
        _source_item_id: item.item_id || item.name,
      });
    });

    console.log(`[explodeCombo] Exploded "${item.name}" into ${flavorGroupKeys.length} items`);
  }

  // Post-explosion: merge complement-only items back into first flavor item
  const finalResult: any[] = [];
  const pendingComplements: any[] = [];

  for (const ri of result) {
    const opts = ri.options || [];
    const hasFlavor = opts.some((o: any) => {
      const n = (o.name || '').toLowerCase();
      return flavorKeywords.some(k => n.includes(k.toLowerCase()));
    });
    const hasEdge = opts.some((o: any) => {
      const n = (o.name || '').toLowerCase();
      return edgeKeywords.some(k => k === '#' ? n.startsWith('#') : n.includes(k.toLowerCase()));
    });

    const sourceId = ri._source_item_id;

    // Only merge if: (1) no flavor/edge, (2) already has results,
    // AND (3) belongs to the same source product
    if (!hasFlavor && !hasEdge && finalResult.length > 0
        && finalResult[finalResult.length - 1]._source_item_id === sourceId) {
      pendingComplements.push(...opts);
    } else {
      finalResult.push(ri);
    }
  }

  if (pendingComplements.length > 0 && finalResult.length > 0) {
    finalResult[0].options = [...(finalResult[0].options || []), ...pendingComplements];
    console.log(`[explodeCombo] Merged ${pendingComplements.length} complement options back into first item`);
  }

  // Clean up temporary tracking property
  return finalResult.map(({ _source_item_id, ...rest }) => rest);
}

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
  allowed_order_types: string[] | null;
  allowed_categories: string[] | null;
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

    // WHITELIST: Apenas estes status indicam pedido confirmado/pago
    const confirmedStatuses = ['confirmed', 'preparing', 'ready', 'in_production', 'accepted'];
    
    // Status ignorados (cancelamentos)
    const cancelledStatuses = ['canceled', 'cancelled', 'rejected'];
    
    // Allowed order types for this store
    const allowedTypes = store.allowed_order_types || ['delivery', 'takeaway', 'dine_in', 'counter'];
    
    const activeOrders = ordersData.filter(order => {
      const status = (order.status || '').toLowerCase();
      const orderType = (order.order_type || '').toLowerCase();
      
      // Map to internal type for allowed check
      const mappedType = orderType === 'takeout' ? 'takeaway' 
        : orderType === 'onsite' ? 'counter'
        : (orderType === 'closed_table' || orderType === 'table') ? 'dine_in'
        : orderType || 'delivery';
      
      // Filter by allowed order types for this store
      if (!allowedTypes.includes(mappedType)) {
        console.log(`[poll-orders] Ignoring order ${order.id} - type "${mappedType}" not allowed for store "${store.name}"`);
        return false;
      }
      
      // Sempre ignorar cancelados
      if (cancelledStatuses.includes(status)) {
        return false;
      }
      
      // Pedidos de mesa: permitir status 'closed' (conta fechada) além dos confirmados
      if (tableOrderTypes.includes(orderType)) {
        if (confirmedStatuses.includes(status) || status === 'closed') {
          console.log(`[poll-orders] Including table order ${order.id} with status: ${status}`);
          return true;
        }
        console.log(`[poll-orders] Ignoring table order ${order.id} - status "${status}" not confirmed`);
        return false;
      }
      
      // Para delivery/retirada/balcão: SOMENTE status confirmados (WHITELIST)
      if (!confirmedStatuses.includes(status)) {
        console.log(`[poll-orders] Ignoring order ${order.id} - status "${status}" not in confirmed whitelist`);
        return false;
      }
      
      return true;
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
          // Log item keys for debugging category field
          if (orderDetails.items[0]) {
            console.log(`[poll-orders] Item keys sample:`, Object.keys(orderDetails.items[0]));
            console.log(`[poll-orders] First item sample: name="${orderDetails.items[0].name}", kind="${orderDetails.items[0].kind}"`);
          }

          let itemsToCreate = orderDetails.items;

          // Filter by allowed categories using product NAME (API has no category field)
          const allowedCategories = store.allowed_categories;
          if (allowedCategories && allowedCategories.length > 0) {
            const before = itemsToCreate.length;
            itemsToCreate = itemsToCreate.filter((item: any) => {
              const name = (item.name || '').toLowerCase();
              const kind = (item.kind || '').toLowerCase();
              if (!name && !kind) return true; // safety net
              return allowedCategories.some((c: string) => {
                const keyword = c.toLowerCase();
                return kind.includes(keyword) || name.includes(keyword);
              });
            });
            console.log(`[poll-orders] Category filter (kind+name): ${before} -> ${itemsToCreate.length} items (allowed: ${allowedCategories.join(', ')})`);
          }

          if (itemsToCreate.length === 0) {
            console.log(`[poll-orders] No items after category filter for order ${insertedOrder.id}`);
          } else {
            // Explode combos before sending to DB
            try {
              const { data: settingsData } = await supabase
                .from('app_settings')
                .select('kds_edge_keywords, kds_flavor_keywords')
                .eq('id', 'default')
                .maybeSingle();
              
              const edgeKw = (settingsData?.kds_edge_keywords || '#, Borda').split(',').map((s: string) => s.trim());
              const flavorKw = (settingsData?.kds_flavor_keywords || '(G), (M), (P), Sabor').split(',').map((s: string) => s.trim());
              const beforeExplode = itemsToCreate.length;
              itemsToCreate = explodeComboItems(itemsToCreate, edgeKw, flavorKw);
              if (itemsToCreate.length !== beforeExplode) {
                console.log(`[poll-orders] Combo explosion: ${beforeExplode} -> ${itemsToCreate.length} items`);
              }
            } catch (explodeErr) {
              console.error(`[poll-orders] Error in combo explosion (continuing with original items):`, explodeErr);
            }

            const { data: itemsResult, error: itemsError } = await supabase.rpc(
              'create_order_items_from_json',
              {
                p_order_id: insertedOrder.id,
                p_items: itemsToCreate,
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
          // === AUTO-REPAIR: Check if order has missing items (partial or zero) ===
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('id')
            .eq('order_id', order.id);

          const { data: orderData } = await supabase
            .from('orders')
            .select('items')
            .eq('id', order.id)
            .single();

          const actualCount = orderItems?.length || 0;
          const rawItems = orderData?.items || [];
          const expectedCount = Array.isArray(rawItems) ? rawItems.length : 0;

          if (actualCount < expectedCount) {
            console.log(`[poll-orders] Order ${order.cardapioweb_order_id} has ${actualCount}/${expectedCount} items, repairing...`);

            // Delete existing items before re-creating (only for pending orders)
            if (actualCount > 0) {
              const { error: deleteError } = await supabase
                .from('order_items')
                .delete()
                .eq('order_id', order.id)
                .in('status', ['pending']);
              
              if (deleteError) {
                console.error(`[poll-orders] Repair: Error deleting existing items:`, deleteError);
                continue;
              }
              console.log(`[poll-orders] Repair: Deleted ${actualCount} existing pending items for re-creation`);
            }
            
            try {
              // Use items already stored in orders.items (more reliable than re-fetching API)
              let itemsToRepair = Array.isArray(rawItems) ? [...rawItems] : [];

              // Apply category filter
              const allowedCategories = store.allowed_categories;
              if (allowedCategories && allowedCategories.length > 0) {
                const before = itemsToRepair.length;
                itemsToRepair = itemsToRepair.filter((item: any) => {
                  const name = (item.name || '').toLowerCase();
                  const kind = (item.kind || '').toLowerCase();
                  if (!name && !kind) return true;
                  return allowedCategories.some((c: string) => {
                    const keyword = c.toLowerCase();
                    return kind.includes(keyword) || name.includes(keyword);
                  });
                });
                console.log(`[poll-orders] Repair category filter: ${before} -> ${itemsToRepair.length} items`);
              }

              if (itemsToRepair.length > 0) {
                // Explode combos
                try {
                  const { data: settingsData } = await supabase
                    .from('app_settings')
                    .select('kds_edge_keywords, kds_flavor_keywords')
                    .eq('id', 'default')
                    .maybeSingle();
                  
                  const edgeKw = (settingsData?.kds_edge_keywords || '#, Borda').split(',').map((s: string) => s.trim());
                  const flavorKw = (settingsData?.kds_flavor_keywords || '(G), (M), (P), Sabor').split(',').map((s: string) => s.trim());
                  itemsToRepair = explodeComboItems(itemsToRepair, edgeKw, flavorKw);
                } catch (explodeErr) {
                  console.error(`[poll-orders] Repair: combo explosion error (continuing):`, explodeErr);
                }

                const { data: repairResult, error: repairError } = await supabase.rpc(
                  'create_order_items_from_json',
                  {
                    p_order_id: order.id,
                    p_items: itemsToRepair,
                    p_default_sector_id: null,
                  }
                );

                if (repairError) {
                  console.error(`[poll-orders] Repair: Error creating items for order ${order.id}:`, repairError);
                } else {
                  console.log(`[poll-orders] Repair: Created ${repairResult} items for order ${order.cardapioweb_order_id}`);
                }
              } else {
                console.log(`[poll-orders] Repair: No items after category filter for order ${order.cardapioweb_order_id}`);
              }
            } catch (repairErr) {
              console.error(`[poll-orders] Repair: Error repairing order ${order.id}:`, repairErr);
            }
          }
          // === END AUTO-REPAIR ===

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

          // If order not found (404), it was deleted/cancelled - use cancel with alert
          if (statusResponse.status === 404) {
            console.log(`[poll-orders] Order ${order.cardapioweb_order_id} not found in CardapioWeb, cancelling with alert...`);
            await supabase.rpc('cancel_order_with_alert', { p_order_id: order.id });
            result.cancelled++;
            continue;
          }

          if (statusResponse.ok) {
            const details = await statusResponse.json();
            const status = details.order_status || details.status;
            const orderType = (order.order_type || '').toLowerCase();
            
            const isTableOrder = tableOrderTypes.includes(orderType);
            
            if (isTableOrder && status === 'closed') {
              continue;
            }
            
            // For cancellation statuses, use cancel with alert
            if (['cancelled', 'canceled', 'rejected'].includes(status) || 
                (!isTableOrder && status === 'closed')) {
              console.log(`[poll-orders] Order ${order.cardapioweb_order_id} has status "${status}", cancelling with alert...`);
              await supabase.rpc('cancel_order_with_alert', { p_order_id: order.id });
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
