 import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token, x-api-key',
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
 
   console.log(`Creating order from webhook: external_id=${externalId}, type=${order.order_type}, customer=${customerName}`);
 
   // Insert order
   const { data: insertedOrder, error: insertError } = await supabase
     .from('orders')
     .insert({
       external_id: externalId,
       cardapioweb_order_id: order.display_id?.toString() || externalId,
       cardapioweb_created_at: order.created_at || payload.created_at,
       customer_name: customerName,
       customer_phone: order.customer?.phone,
       order_type: mapOrderType(order.order_type),
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
     const { data: itemCount, error: itemsError } = await supabase.rpc(
       'create_order_items_from_json',
       {
         p_order_id: insertedOrder.id,
         p_items: order.items,
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
 
   return { action: 'created', order_id: insertedOrder.id, items_created: itemsCreated };
 }
 
 async function handleOrderCancelledOrClosed(
   supabase: SupabaseClient,
   payload: CardapioWebWebhookPayload,
   eventType: string
 ): Promise<{ action: string; order_id?: number; error?: string }> {
   const externalId = payload.order_id.toString();
 
   console.log(`Processing ${eventType} for order ${externalId}`);
 
   // Find and delete the order
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
 
   // Delete the order (cascade will handle order_items)
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
       .select('id, name, default_city, default_region, default_country')
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
       console.error(`No store found for token: ${apiToken.substring(0, 8)}...`);
       return new Response(
         JSON.stringify({ error: 'Unauthorized - Invalid API token' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     console.log(`Webhook received for store: ${store.name} (${store.id})`);
 
     const body = await req.json() as CardapioWebWebhookPayload;
     const eventType = body.event_type;
 
     console.log(`Event: ${eventType}, order_id: ${body.order_id}`);
 
     let result: { action: string; [key: string]: unknown };
 
     switch (eventType) {
       case 'order.placed':
       case 'order.confirmed':
         result = await handleOrderPlaced(supabase, body, store as StoreRecord);
         break;
 
       case 'order.cancelled':
       case 'order.closed':
         result = await handleOrderCancelledOrClosed(supabase, body, eventType);
         break;
 
       case 'order.ready':
       case 'order.dispatched':
       case 'order.delivered':
         result = await handleOrderStatusChange(supabase, body);
         break;
 
       default:
         console.log(`Unknown event type: ${eventType} - ignoring`);
         result = { action: 'ignored', reason: 'unknown_event_type' };
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
