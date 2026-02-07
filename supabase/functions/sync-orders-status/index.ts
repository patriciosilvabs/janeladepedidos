import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Store {
  id: string;
  name: string;
  cardapioweb_api_url: string | null;
  cardapioweb_api_token: string | null;
  cardapioweb_enabled: boolean | null;
}

interface Order {
  id: string;
  cardapioweb_order_id: string | null;
  external_id: string | null;
  status: string;
  store_id: string | null;
  order_type: string | null;
}

interface StoreResult {
  storeName: string;
  checked: number;
  closed: number;
  cancelled: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

async function syncStoreOrders(
  supabase: any,
  store: Store
): Promise<StoreResult> {
  const result: StoreResult = {
    storeName: store.name,
    checked: 0,
    closed: 0,
    cancelled: 0,
    updated: 0,
    unchanged: 0,
    errors: [],
  };

  console.log(`[sync-orders-status] Syncing orders for store: ${store.name}`);

  // Fetch active orders for this store (only pending and waiting_buffer)
  // Ready orders are managed by the local flow and should NOT be re-synced
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, cardapioweb_order_id, external_id, status, store_id, order_type')
    .eq('store_id', store.id)
    .in('status', ['pending', 'waiting_buffer'])
    .not('external_id', 'is', null);

  if (ordersError) {
    console.error(`[sync-orders-status] Error fetching orders for store ${store.name}:`, ordersError);
    result.errors.push(`Erro ao buscar pedidos: ${ordersError.message}`);
    return result;
  }

  if (!orders || orders.length === 0) {
    console.log(`[sync-orders-status] No active orders for store: ${store.name}`);
    return result;
  }

  console.log(`[sync-orders-status] Found ${orders.length} active orders for store: ${store.name}`);
  result.checked = orders.length;

  const apiUrl = store.cardapioweb_api_url || 'https://integracao.cardapioweb.com';
  const apiToken = store.cardapioweb_api_token;

  if (!apiToken) {
    console.error(`[sync-orders-status] No API token for store: ${store.name}`);
    result.errors.push('Token de API não configurado');
    return result;
  }

  for (const order of orders) {
    try {
      const orderUrl = `${apiUrl}/api/partner/v1/orders/${order.external_id}`;
      console.log(`[sync-orders-status] Checking order #${order.cardapioweb_order_id} (API ID: ${order.external_id}) at ${orderUrl}`);

      const response = await fetch(orderUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiToken,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        // Order no longer exists in CardápioWeb - mark as cancelled (soft delete)
        console.log(`[sync-orders-status] Order ${order.cardapioweb_order_id} not found in CardápioWeb, marking as cancelled`);
        const { error: updateError } = await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', order.id);

        if (updateError) {
          result.errors.push(`Erro ao cancelar pedido ${order.cardapioweb_order_id}: ${updateError.message}`);
        } else {
          result.cancelled++;
        }
        continue;
      }

      if (!response.ok) {
        console.error(`[sync-orders-status] Error fetching order ${order.cardapioweb_order_id}:`, response.status);
        result.errors.push(`Erro ao consultar pedido ${order.cardapioweb_order_id}: HTTP ${response.status}`);
        continue;
      }

      const orderDetails = await response.json();
      const cardapiowebStatus = orderDetails.order_status || orderDetails.status;

      console.log(`[sync-orders-status] Order ${order.cardapioweb_order_id} status in CardápioWeb: ${cardapiowebStatus}`);

      // Tipos de pedido que são de mesa (chegam com status closed da API)
      const tableOrderTypes = ['closed_table', 'dine_in', 'table'];
      const isTableOrder = tableOrderTypes.includes((order.order_type || '').toLowerCase());

      // Status que indicam que o pedido foi CANCELADO
      const cancelledStatuses = ['cancelled', 'canceled'];
      
      // Status que indicam conclusão
      const completedStatuses = ['closed', 'delivered', 'finished'];

      // Status que indicam que o motoboy COLETOU (marcar como dispatched)
      const dispatchedStatuses = ['released', 'dispatched', 'on_the_way'];

      // Pedidos de mesa com status closed são NORMAIS - não alterar
      if (isTableOrder && cardapiowebStatus === 'closed') {
        console.log(`[sync-orders-status] Order ${order.cardapioweb_order_id} is table order with closed status - keeping (normal for table orders)`);
        result.unchanged++;
        continue;
      }

      // Cancelled orders -> mark as cancelled (soft delete)
      if (cancelledStatuses.includes(cardapiowebStatus)) {
        console.log(`[sync-orders-status] Order ${order.cardapioweb_order_id} is ${cardapiowebStatus}, marking as cancelled`);
        const { error: updateError } = await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', order.id);

        if (updateError) {
          result.errors.push(`Erro ao cancelar pedido ${order.cardapioweb_order_id}: ${updateError.message}`);
        } else {
          result.cancelled++;
        }
        continue;
      }

      // Completed orders (non-table) -> mark as closed (soft delete)
      if (completedStatuses.includes(cardapiowebStatus) && !isTableOrder) {
        console.log(`[sync-orders-status] Order ${order.cardapioweb_order_id} is ${cardapiowebStatus} (completed, non-table), marking as closed`);
        const { error: updateError } = await supabase
          .from('orders')
          .update({ status: 'closed' })
          .eq('id', order.id);

        if (updateError) {
          result.errors.push(`Erro ao fechar pedido ${order.cardapioweb_order_id}: ${updateError.message}`);
        } else {
          result.closed++;
        }
        continue;
      }

      // Check if order was collected by driver (mark as dispatched)
      if (dispatchedStatuses.includes(cardapiowebStatus) && order.status !== 'dispatched') {
        console.log(`[sync-orders-status] Order ${order.cardapioweb_order_id} collected by driver (${cardapiowebStatus}), marking as dispatched`);
        const { error: dispatchError } = await supabase.rpc('set_order_dispatched', {
          p_order_id: order.id,
        });

        if (dispatchError) {
          result.errors.push(`Erro ao despachar pedido ${order.cardapioweb_order_id}: ${dispatchError.message}`);
        } else {
          result.updated++;
        }
        continue;
      }

      // Status 'ready' ou 'waiting_to_catch' do CardápioWeb - IGNORAR para pedidos pending
      if (['ready', 'waiting_to_catch'].includes(cardapiowebStatus) && order.status === 'pending') {
        console.log(`[sync-orders-status] Order ${order.cardapioweb_order_id} is ${cardapiowebStatus} in CardápioWeb - ignoring (local flow controls buffer)`);
        result.unchanged++;
        continue;
      }

      // Order status is unchanged or in a state we don't need to handle
      result.unchanged++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[sync-orders-status] Error processing order ${order.cardapioweb_order_id}:`, err);
      result.errors.push(`Erro ao processar pedido ${order.cardapioweb_order_id}: ${errorMessage}`);
    }
  }

  console.log(`[sync-orders-status] Store ${store.name} sync complete:`, result);
  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[sync-orders-status] Starting manual sync');

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
      console.error('[sync-orders-status] Error fetching stores:', storesError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch stores' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!stores || stores.length === 0) {
      console.log('[sync-orders-status] No enabled stores found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma loja habilitada encontrada',
          synced: 0,
          closed: 0,
          cancelled: 0,
          updated: 0,
          unchanged: 0,
          storeResults: [] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-orders-status] Found ${stores.length} enabled stores`);

    // Sync orders for each store
    const storeResults: StoreResult[] = [];
    let totalClosed = 0;
    let totalCancelled = 0;
    let totalUpdated = 0;
    let totalUnchanged = 0;
    let totalChecked = 0;

    for (const store of stores) {
      const result = await syncStoreOrders(supabase, store);
      storeResults.push(result);
      totalClosed += result.closed;
      totalCancelled += result.cancelled;
      totalUpdated += result.updated;
      totalUnchanged += result.unchanged;
      totalChecked += result.checked;
    }

    // Build summary message
    const messageParts: string[] = [];
    if (totalClosed > 0) messageParts.push(`${totalClosed} pedido(s) fechado(s)`);
    if (totalCancelled > 0) messageParts.push(`${totalCancelled} pedido(s) cancelado(s)`);
    if (totalUpdated > 0) messageParts.push(`${totalUpdated} pedido(s) atualizado(s)`);
    if (messageParts.length === 0) messageParts.push('Nenhuma alteração necessária');

    const response = {
      success: true,
      synced: totalChecked,
      closed: totalClosed,
      cancelled: totalCancelled,
      updated: totalUpdated,
      unchanged: totalUnchanged,
      message: messageParts.join(', '),
      storeResults,
    };

    console.log('[sync-orders-status] Sync complete:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sync-orders-status] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
