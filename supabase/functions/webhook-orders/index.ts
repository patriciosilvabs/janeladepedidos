 import { createClient, SupabaseClient } from '@supabase/supabase-js';
 
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
 
 // ================== TYPES ==================
 
 interface CardapioWebCustomer {
   name: string;
   phone?: string | null;
 }
 
 interface CardapioWebAddress {
   formatted?: string;
   street?: string;
   number?: string;
   neighborhood?: string;
   city?: string;
   state?: string;
   country?: string;
   postal_code?: string;
   lat?: number;
   lng?: number;
   complement?: string;
 }
 
 interface CardapioWebOption {
   name: string;
   group?: string;
 }
 
  interface CardapioWebItem {
    name: string;
    quantity: number;
    options?: CardapioWebOption[];
    observation?: string;
    unit_price?: number;
    total_price?: number;
    category?: string;
    category_name?: string;
  }
 
 interface CardapioWebOrder {
   id: number;
   display_id?: number;
   status?: string;
   order_type?: string;
   customer?: CardapioWebCustomer;
   address?: CardapioWebAddress;
   items?: CardapioWebItem[];
   total?: number;
   delivery_fee?: number;
   payment_method?: string;
   observation?: string;
   created_at?: string;
 }
 
 interface CardapioWebWebhookPayload {
   event_type: string;
   event_id?: string;
   order_id: number;
   merchant_id?: number;
   created_at?: string;
   order?: CardapioWebOrder;
   // Legacy status event fields
   order_status?: string;
 }
 
  interface StoreRecord {
    id: string;
    name: string;
    default_city: string | null;
    default_region: string | null;
    default_country: string | null;
    allowed_order_types: string[] | null;
    allowed_categories: string[] | null;
  }
 
// ================== COMBO EXPLOSION ==================

function explodeComboItems(items: any[], edgeKeywords: string[], flavorKeywords: string[]): any[] {
  const result: any[] = [];

  for (const item of items) {
    const options = item.options || [];
    if (options.length === 0) {
      result.push({ ...item, _source_item_id: item.item_id || item.name });
      continue;
    }

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

    // Detect half-and-half pizzas — keep as single item
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

    if (flavorGroupKeys.length <= 1) {
      result.push({ ...item, _source_item_id: item.item_id || item.name });
      continue;
    }

    // Expand edge options by quantity
    const expandedEdges: any[] = [];
    for (const edge of edgeOptions) {
      const qty = edge.quantity || 1;
      for (let i = 0; i < qty; i++) {
        expandedEdges.push({ ...edge, quantity: 1 });
      }
    }

    flavorGroupKeys.forEach((groupId, index) => {
      const groupFlavors = flavorGroups[groupId];
      const pairedEdge = index < expandedEdges.length ? [expandedEdges[index]] : [];

      const newOptions = [
        ...groupFlavors,
        ...pairedEdge,
        ...(index === 0 ? complementOptions : []),
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

  return finalResult.map(({ _source_item_id, ...rest }) => rest);
}

// ================== HELPERS ==================
 
 function mapOrderType(cardapiowebType?: string): string {
   switch (cardapiowebType) {
     case 'delivery':
       return 'delivery';
     case 'takeout':
       return 'takeaway';
     case 'onsite':
       return 'counter';
     case 'closed_table':
     case 'dine_in':
       return 'dine_in';
     default:
       return cardapiowebType || 'delivery';
   }
 }
 
 function buildAddress(order: CardapioWebOrder, store: StoreRecord): {
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
 } {
   const addr = order.address;
   const orderType = order.order_type;
   
   // For table/counter orders without address, use store defaults
   if (!addr || (orderType === 'closed_table' || orderType === 'dine_in' || orderType === 'onsite')) {
     return {
       address: order.customer?.name || 'Pedido Local',
       city: store.default_city || undefined,
       region: store.default_region || undefined,
       country: store.default_country || 'BR',
       lat: 0,
       lng: 0,
     };
   }
   
   return {
     address: addr.formatted || `${addr.street || ''}, ${addr.number || ''}`.trim() || 'Endereço não informado',
     street: addr.street,
     house_number: addr.number,
     neighborhood: addr.neighborhood,
     city: addr.city || store.default_city || undefined,
     region: addr.state || store.default_region || undefined,
     country: addr.country || store.default_country || 'BR',
     postal_code: addr.postal_code,
     lat: addr.lat || 0,
     lng: addr.lng || 0,
   };
 }
 
 // ================== HANDLERS ==================
 
 async function handleOrderPlaced(
   supabase: SupabaseClient,
   payload: CardapioWebWebhookPayload,
   store: StoreRecord
 ): Promise<{ action: string; order_id?: string; items_created?: number; error?: string }> {
   const order = payload.order;
   if (!order) {
     console.error('order.placed event missing order data');
     return { action: 'error', error: 'missing_order_data' };
   }
 
   const externalId = order.id.toString();
   
   // IDEMPOTENCY: Check if order already exists
   const { data: existing } = await supabase
     .from('orders')
     .select('id')
     .eq('external_id', externalId)
     .maybeSingle();
   
   if (existing) {
     console.log(`Order ${externalId} already exists (id: ${existing.id}) - skipping`);
     return { action: 'skipped', order_id: existing.id };
   }
 
   const addressData = buildAddress(order, store);
   const customerName = order.customer?.name || `Pedido #${order.display_id || order.id}`;
   const mappedOrderType = mapOrderType(order.order_type);

   // Check if order type is allowed for this store
   const allowedTypes = store.allowed_order_types || ['delivery', 'takeaway', 'dine_in', 'counter'];
   if (!allowedTypes.includes(mappedOrderType)) {
     console.log(`Order type "${mappedOrderType}" not allowed for store "${store.name}" (allowed: ${allowedTypes.join(', ')})`);
     return { action: 'ignored', error: `order_type_not_allowed: ${mappedOrderType}` };
   }

   console.log(`Creating order from webhook: external_id=${externalId}, type=${mappedOrderType}, customer=${customerName}`);
 
   // Insert order
   const { data: insertedOrder, error: insertError } = await supabase
     .from('orders')
     .insert({
       external_id: externalId,
       cardapioweb_order_id: order.display_id?.toString() || externalId,
       cardapioweb_created_at: order.created_at || payload.created_at,
       customer_name: customerName,
       customer_phone: order.customer?.phone,
       order_type: mappedOrderType,
       store_id: store.id,
       ...addressData,
       items: order.items,
       total_amount: order.total,
       delivery_fee: order.delivery_fee,
       payment_method: order.payment_method,
       notes: order.observation,
       status: 'pending',
     })
     .select('id')
     .single();
 
   if (insertError) {
     console.error('Error inserting order:', insertError);
     return { action: 'error', error: insertError.message };
   }
 
   console.log(`Order created: ${insertedOrder.id}`);
 
   // Create order_items using RPC
    let itemsCreated = 0;
    if (order.items && order.items.length > 0) {
      // Log item keys for debugging category field
      if (order.items[0]) {
        console.log(`[webhook] Item keys sample:`, Object.keys(order.items[0]));
        console.log(`[webhook] First item raw:`, JSON.stringify(order.items[0]).substring(0, 500));
      }

      let itemsToCreate = order.items as any[];

      // Filter by allowed categories using kind (API field) + fallback to name
      const allowedCategories = store.allowed_categories;
      if (allowedCategories && allowedCategories.length > 0) {
        const before = itemsToCreate.length;
        itemsToCreate = itemsToCreate.filter((item: any) => {
          const name = (item.name || '').toLowerCase();
          const kind = ((item as any).kind || '').toLowerCase();
          if (!name && !kind) return true; // safety net
          return allowedCategories.some(c => {
            const keyword = c.toLowerCase();
            return kind.includes(keyword) || name.includes(keyword);
          });
        });
        console.log(`Category filter (kind+name): ${before} -> ${itemsToCreate.length} items (allowed: ${allowedCategories.join(', ')})`);
      }

      if (itemsToCreate.length === 0) {
        console.log('No items remaining after category filter - skipping order item creation');
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
            console.log(`[webhook] Combo explosion: ${beforeExplode} -> ${itemsToCreate.length} items`);
          }
        } catch (explodeErr) {
          console.error(`[webhook] Error in combo explosion (continuing with original items):`, explodeErr);
        }

        const { data: itemCount, error: itemsError } = await supabase.rpc(
          'create_order_items_from_json',
          {
            p_order_id: insertedOrder.id,
            p_items: itemsToCreate,
            p_default_sector_id: null,
          }
        );

        if (itemsError) {
          console.error('Error creating order items:', itemsError);
        } else {
          itemsCreated = itemCount as number;
          console.log(`Created ${itemsCreated} items for order ${insertedOrder.id}`);
        }
      }
    }
 
   return { action: 'created', order_id: insertedOrder.id, items_created: itemsCreated };
 }
 
  async function handleOrderCancelledOrClosed(
    supabase: SupabaseClient,
    payload: CardapioWebWebhookPayload,
    eventType: string
  ): Promise<{ action: string; order_id?: number; error?: string }> {
    const externalId = payload.order_id.toString();
  
    console.log(`Processing ${eventType} for order ${externalId}`);
  
    // Find the order
    const { data: existingOrder, error: findError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('external_id', externalId)
      .maybeSingle();
  
    if (findError) {
      console.error('Error finding order:', findError);
      return { action: 'error', error: findError.message };
    }
  
    if (!existingOrder) {
      console.log(`Order ${externalId} not found - ignoring ${eventType}`);
      return { action: 'ignored', order_id: payload.order_id };
    }

    // If order is still pending/in production, use cancel_order_with_alert for KDS notification
    if (['pending', 'waiting_buffer'].includes(existingOrder.status)) {
      const { data: cancelResult, error: cancelError } = await supabase.rpc('cancel_order_with_alert', {
        p_order_id: existingOrder.id,
      });

      if (cancelError) {
        console.error('Error cancelling order with alert:', cancelError);
        return { action: 'error', error: cancelError.message };
      }

      console.log(`Order ${externalId} marked as cancelled with alert (event: ${eventType})`, cancelResult);
      return { action: 'cancelled_with_alert', order_id: payload.order_id };
    }

    // If already dispatched/ready, just delete
    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', existingOrder.id);
  
    if (deleteError) {
      console.error('Error deleting order:', deleteError);
      return { action: 'error', error: deleteError.message };
    }
  
    console.log(`Order ${externalId} deleted (event: ${eventType})`);
    return { action: 'deleted', order_id: payload.order_id };
  }
 
async function fetchOrderFromApi(
  store: StoreRecord & { cardapioweb_api_url?: string; cardapioweb_api_token?: string },
  orderId: number
): Promise<CardapioWebOrder | null> {
  const baseUrl = store.cardapioweb_api_url || 'https://integracao.cardapioweb.com';
  const token = store.cardapioweb_api_token;
  
  if (!token) {
    console.error('Store missing API token for fetching order details');
    return null;
  }
  
  try {
    console.log(`Fetching order details from API: ${baseUrl}/api/partner/v1/orders/${orderId}`);
    const response = await fetch(`${baseUrl}/api/partner/v1/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch order ${orderId}: ${response.status}`);
      return null;
    }
    
    const orderData = await response.json();
    console.log(`Fetched order data: ${JSON.stringify(orderData).substring(0, 500)}`);
    
    // Map API response to CardapioWebOrder format
    return {
      id: orderData.id,
      display_id: orderData.display_id || orderData.code,
      status: orderData.status || orderData.order_status,
      order_type: orderData.order_type,
      customer: orderData.customer,
      address: orderData.delivery_address ? {
        formatted: [
          orderData.delivery_address.street,
          orderData.delivery_address.number,
          orderData.delivery_address.neighborhood,
          orderData.delivery_address.city,
          orderData.delivery_address.state,
        ].filter(Boolean).join(', '),
        street: orderData.delivery_address.street,
        number: orderData.delivery_address.number,
        neighborhood: orderData.delivery_address.neighborhood,
        city: orderData.delivery_address.city,
        state: orderData.delivery_address.state,
        country: orderData.delivery_address.country,
        postal_code: orderData.delivery_address.zipCode,
        lat: orderData.delivery_address.latitude,
        lng: orderData.delivery_address.longitude,
        complement: orderData.delivery_address.complement,
      } : undefined,
      items: orderData.items?.map((item: any) => ({
        name: item.name,
        quantity: item.quantity || 1,
        options: item.options || item.additions || [],
        observation: item.notes || item.observation,
        unit_price: item.price || item.unit_price,
        total_price: item.total || item.total_price,
        category: item.category || item.category_name || '',
      })),
      total: orderData.total,
      delivery_fee: orderData.delivery_fee,
      payment_method: orderData.payments?.[0]?.method,
      observation: orderData.notes,
      created_at: orderData.created_at,
    };
  } catch (error) {
    console.error(`Error fetching order ${orderId}:`, error);
    return null;
  }
}

 async function handleOrderStatusChange(
   supabase: SupabaseClient,
   payload: CardapioWebWebhookPayload
 ): Promise<{ action: string; order_id?: number; reason?: string }> {
   const externalId = payload.order_id.toString();
   const status = payload.order?.status || payload.order_status;
 
   console.log(`Processing status change for order ${externalId}: ${status}`);
 
   const { data: existingOrder, error: findError } = await supabase
     .from('orders')
     .select('id, status')
     .eq('external_id', externalId)
     .maybeSingle();
 
   if (findError) {
     console.error('Error finding order:', findError);
     return { action: 'error', reason: findError.message };
   }
 
   if (!existingOrder) {
     console.log(`Order ${externalId} not found for status update`);
     return { action: 'ignored', order_id: payload.order_id, reason: 'not_found' };
   }
 
   // Handle dispatch-related statuses
   if (status === 'released' || status === 'dispatched' || status === 'on_the_way') {
     if (['pending', 'waiting_buffer', 'ready'].includes(existingOrder.status)) {
       const { error: dispatchError } = await supabase.rpc('set_order_dispatched', {
         p_order_id: existingOrder.id,
       });
 
       if (dispatchError) {
         console.error('Error dispatching order:', dispatchError);
         return { action: 'error', reason: dispatchError.message };
       }
 
       console.log(`Order ${externalId} marked as dispatched`);
       return { action: 'dispatched', order_id: payload.order_id };
     }
     return { action: 'ignored', order_id: payload.order_id, reason: 'already_dispatched' };
   }
 
   // Ignore other statuses (ready, confirmed, etc.) - local flow controls these
   console.log(`Order ${externalId} status ${status} - ignoring (local flow controls)`);
   return { action: 'ignored', order_id: payload.order_id, reason: 'local_flow_controls' };
 }
 
 // ================== MAIN HANDLER ==================
 
 Deno.serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const supabase = createClient(supabaseUrl, supabaseKey);
 
     if (req.method !== 'POST') {
       return new Response(
         JSON.stringify({ error: 'Method not allowed' }),
         { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Extract API token from headers (X-API-KEY or X-Webhook-Token)
     const apiToken = req.headers.get('x-api-key') || req.headers.get('x-webhook-token');
     
     if (!apiToken) {
       console.error('Missing API token in request headers');
       return new Response(
         JSON.stringify({ error: 'Unauthorized - Missing API token' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Find store by API token
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id, name, default_city, default_region, default_country, allowed_order_types, allowed_categories')
        .eq('cardapioweb_api_token', apiToken)
        .eq('cardapioweb_enabled', true)
        .maybeSingle();
 
     if (storeError) {
       console.error('Error finding store:', storeError);
       return new Response(
         JSON.stringify({ error: 'Internal error' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     if (!store) {
        console.error(`No store found for token: ${apiToken?.substring(0, 8) || 'undefined'}...`);
       return new Response(
         JSON.stringify({ error: 'Unauthorized - Invalid API token' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     console.log(`Webhook received for store: ${store.name} (${store.id})`);
 
     const body = await req.json() as CardapioWebWebhookPayload;
     const eventType = body.event_type;
 
     console.log(`Event: ${eventType}, order_id: ${body.order_id}`);
 
     // Normalize event type for matching (case-insensitive, handle both formats)
      const normalizedEvent = eventType?.toLowerCase().replace(/_/g, '.');
      
      console.log(`Normalized event: ${normalizedEvent}`);
      console.log(`Full payload: ${JSON.stringify(body).substring(0, 500)}...`);

      let result: { action: string; [key: string]: unknown };
 
     // If ORDER_CREATED but missing order data, fetch from API
      if (['order.created', 'order.placed', 'order.new'].includes(normalizedEvent) && !body.order) {
       console.log(`Event ${eventType} missing order data, fetching from API...`);
       
       // Need to fetch store with API credentials
       const { data: storeWithCreds } = await supabase
         .from('stores')
         .select('id, name, default_city, default_region, default_country, cardapioweb_api_url, cardapioweb_api_token')
         .eq('id', store.id)
         .single();
       
       if (storeWithCreds) {
         const fetchedOrder = await fetchOrderFromApi(storeWithCreds as any, body.order_id);
         if (fetchedOrder) {
           body.order = fetchedOrder;
           console.log(`Successfully fetched order data for ${body.order_id}`);
         } else {
           console.error(`Failed to fetch order ${body.order_id} from API`);
           return new Response(
             JSON.stringify({ success: false, error: 'Could not fetch order details' }),
             { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
           );
         }
       }
     }

     // Status de pedidos que ainda não foram pagos/confirmados - ignorar
     const prePaymentStatuses = ['pending', 'waiting_confirmation', 'awaiting_payment', 'placed'];
     const orderStatus = (body.order?.status || body.order_status || '').toLowerCase();
     
     // Para eventos de criação, verificar se o pedido está confirmado
     const isCreationEvent = ['order.placed', 'order.created', 'order.new'].includes(normalizedEvent);
     
     if (isCreationEvent && prePaymentStatuses.includes(orderStatus)) {
       console.log(`Ignoring ${normalizedEvent} - order status is "${orderStatus}" (awaiting payment)`);
       result = { action: 'ignored', reason: 'awaiting_payment', status: orderStatus };
     } else {
       switch (normalizedEvent) {
         case 'order.confirmed':
           // Pagamento confirmado - SEMPRE processar
           result = await handleOrderPlaced(supabase, body, store as StoreRecord);
           break;

         case 'order.placed':
         case 'order.created':
         case 'order.new':
           // Só processar se status for confirmed (já verificamos acima se é pre-payment)
           if (orderStatus === 'confirmed' || orderStatus === 'preparing' || orderStatus === 'ready') {
             result = await handleOrderPlaced(supabase, body, store as StoreRecord);
           } else {
             console.log(`Ignoring ${normalizedEvent} with status "${orderStatus}" - not confirmed yet`);
             result = { action: 'ignored', reason: 'not_confirmed', status: orderStatus };
           }
           break;

         case 'order.cancelled':
         case 'order.closed':
         case 'order.canceled':
           result = await handleOrderCancelledOrClosed(supabase, body, eventType);
           break;

         case 'order.ready':
         case 'order.dispatched':
         case 'order.delivered':
         case 'order.status.updated':
           result = await handleOrderStatusChange(supabase, body);
           break;

         default:
           // For ORDER_STATUS_UPDATED or other status events, try to handle based on order status
           if (body.order?.status || body.order_status) {
             console.log(`Handling status-based event: ${eventType}, status: ${orderStatus}`);
             
             // ONLY import if status is confirmed or beyond
             if (orderStatus === 'confirmed' || orderStatus === 'preparing' || orderStatus === 'ready') {
               result = await handleOrderPlaced(supabase, body, store as StoreRecord);
             } else if (orderStatus === 'cancelled' || orderStatus === 'closed' || orderStatus === 'canceled') {
               result = await handleOrderCancelledOrClosed(supabase, body, eventType);
             } else if (prePaymentStatuses.includes(orderStatus)) {
               console.log(`Ignoring event with pre-payment status: ${orderStatus}`);
               result = { action: 'ignored', reason: 'awaiting_payment', status: orderStatus };
             } else {
               result = await handleOrderStatusChange(supabase, body);
             }
           } else {
             console.log(`Unknown event type: ${eventType} - ignoring`);
             result = { action: 'ignored', reason: 'unknown_event_type' };
           }
       }
     }
 
     return new Response(
       JSON.stringify({ success: true, event_type: eventType, ...result }),
       { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
 
   } catch (error) {
     console.error('Webhook error:', error);
     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
     return new Response(
       JSON.stringify({ error: 'Internal server error', details: errorMessage }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });
