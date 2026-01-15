import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderResult {
  orderId: string;
  success: boolean;
  cardapioweb_ready?: boolean;
  cardapioweb_dispatched?: boolean;
  foody_sent?: boolean;
  error?: string;
}

interface OrderData {
  id: string;
  external_id: string | null;
  store_id: string | null;
  foody_uid: string | null;
  cardapioweb_notified: boolean | null;
}

interface StoreData {
  cardapioweb_api_url: string | null;
  cardapioweb_api_token: string | null;
  cardapioweb_enabled: boolean | null;
}

// Notifica CardápioWeb que o pedido está PRONTO
async function notifyCardapioWebReady(
  store: StoreData,
  externalId: string
): Promise<{ success: boolean; error?: string }> {
  if (!store.cardapioweb_enabled || !store.cardapioweb_api_url || !store.cardapioweb_api_token) {
    console.log(`CardápioWeb not enabled or configured, skipping ready notification`);
    return { success: true };
  }

  const baseUrl = store.cardapioweb_api_url.replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/partner/v1/orders/${externalId}/ready`;

  console.log(`Calling CardápioWeb READY for order ${externalId}: ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-API-KEY': store.cardapioweb_api_token,
        'Accept': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log(`CardápioWeb READY response for ${externalId}:`, response.status, responseText);

    // 409 = already ready, which is fine
    if (response.ok || response.status === 409) {
      return { success: true };
    }

    return { success: false, error: `HTTP ${response.status}: ${responseText}` };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error calling CardápioWeb READY for ${externalId}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

// Notifica CardápioWeb que o pedido saiu para ENTREGA
async function notifyCardapioWebDispatch(
  store: StoreData,
  externalId: string
): Promise<{ success: boolean; error?: string }> {
  if (!store.cardapioweb_enabled || !store.cardapioweb_api_url || !store.cardapioweb_api_token) {
    console.log(`CardápioWeb not enabled or configured, skipping dispatch notification`);
    return { success: true };
  }

  const baseUrl = store.cardapioweb_api_url.replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/partner/v1/orders/${externalId}/dispatch`;

  console.log(`Calling CardápioWeb DISPATCH for order ${externalId}: ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-API-KEY': store.cardapioweb_api_token,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log(`CardápioWeb DISPATCH response for ${externalId}:`, response.status, responseText);

    // 409 = already dispatched, 404 = order doesn't exist - both are OK
    if (response.ok || response.status === 409 || response.status === 404) {
      return { success: true };
    }

    return { success: false, error: `HTTP ${response.status}: ${responseText}` };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error calling CardápioWeb DISPATCH for ${externalId}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { orderIds } = await req.json();

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'orderIds is required and must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing dispatch for ${orderIds.length} orders`);

    // Buscar configurações do Foody
    const { data: appSettings } = await supabase
      .from('app_settings')
      .select('foody_enabled')
      .eq('id', 'default')
      .single();

    const foodyEnabled = (appSettings as { foody_enabled?: boolean } | null)?.foody_enabled || false;
    console.log(`Foody enabled: ${foodyEnabled}`);

    const results: OrderResult[] = [];
    let successCount = 0;
    let errorCount = 0;
    const ordersToSendToFoody: string[] = [];

    for (const orderId of orderIds) {
      try {
        // Fetch order data
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('id, external_id, store_id, foody_uid, cardapioweb_notified')
          .eq('id', orderId)
          .single();

        if (orderError || !order) {
          console.error(`Order ${orderId} not found:`, orderError);
          results.push({ orderId, success: false, error: 'Order not found' });
          errorCount++;
          continue;
        }

        const typedOrder = order as OrderData;

        if (!typedOrder.external_id) {
          console.log(`Order ${orderId} has no external_id, skipping CardápioWeb notification`);
          
          // Mesmo sem external_id, podemos enviar ao Foody se habilitado
          if (foodyEnabled && !typedOrder.foody_uid) {
            ordersToSendToFoody.push(orderId);
          }
          
          results.push({ orderId, success: true, cardapioweb_ready: false, cardapioweb_dispatched: false });
          successCount++;
          continue;
        }

        // Fetch store configuration
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('cardapioweb_api_url, cardapioweb_api_token, cardapioweb_enabled')
          .eq('id', typedOrder.store_id)
          .single();

        if (storeError || !store) {
          console.error(`Store ${typedOrder.store_id} not found:`, storeError);
          results.push({ orderId, success: false, error: 'Store not found' });
          errorCount++;
          continue;
        }

        const typedStore = store as StoreData;
        let cardapiowebReady = false;
        let cardapiowebDispatched = false;

        // PASSO 1: Chamar /ready no CardápioWeb (marcar como PRONTO)
        console.log(`Step 1: Marking order ${typedOrder.external_id} as READY on CardápioWeb`);
        const readyResult = await notifyCardapioWebReady(typedStore, typedOrder.external_id);
        
        if (readyResult.success) {
          cardapiowebReady = true;
          console.log(`Order ${typedOrder.external_id} marked as READY successfully`);
        } else {
          console.error(`Failed to mark order ${typedOrder.external_id} as READY:`, readyResult.error);
          // Continuar mesmo se falhar - tentar dispatch mesmo assim
        }

        // PASSO 2: Chamar /dispatch no CardápioWeb (marcar como SAIU PARA ENTREGA)
        console.log(`Step 2: Marking order ${typedOrder.external_id} as DISPATCHED on CardápioWeb`);
        const dispatchResult = await notifyCardapioWebDispatch(typedStore, typedOrder.external_id);

        if (dispatchResult.success) {
          cardapiowebDispatched = true;
          console.log(`Order ${typedOrder.external_id} marked as DISPATCHED successfully`);
          
          // Atualizar pedido como notificado com sucesso
          await supabase
            .from('orders')
            .update({
              cardapioweb_notified: true,
              cardapioweb_notified_at: new Date().toISOString(),
              notification_error: null,
            })
            .eq('id', orderId);
        } else {
          console.error(`Failed to dispatch order ${typedOrder.external_id}:`, dispatchResult.error);
          
          // Marcar erro de notificação
          await supabase
            .from('orders')
            .update({
              cardapioweb_notified: false,
              notification_error: dispatchResult.error,
            })
            .eq('id', orderId);
          
          results.push({ orderId, success: false, error: dispatchResult.error });
          errorCount++;
          continue;
        }

        // Adicionar à lista de envio ao Foody se habilitado e ainda não enviado
        if (foodyEnabled && !typedOrder.foody_uid) {
          ordersToSendToFoody.push(orderId);
        }

        results.push({ 
          orderId, 
          success: true, 
          cardapioweb_ready: cardapiowebReady,
          cardapioweb_dispatched: cardapiowebDispatched 
        });
        successCount++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing order ${orderId}:`, errorMessage);
        results.push({ orderId, success: false, error: errorMessage });
        errorCount++;
      }
    }

    // Enviar pedidos ao Foody em lote (se houver)
    if (ordersToSendToFoody.length > 0) {
      console.log(`Sending ${ordersToSendToFoody.length} orders to Foody after dispatch...`);
      
      try {
        const foodyResponse = await fetch(`${supabaseUrl}/functions/v1/send-to-foody`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ orderIds: ordersToSendToFoody }),
        });

        const foodyResult = await foodyResponse.json();
        console.log('Foody send result:', foodyResult);

        // Atualizar resultados com informação do Foody
        for (const result of results) {
          if (ordersToSendToFoody.includes(result.orderId)) {
            result.foody_sent = foodyResult.success || false;
          }
        }
      } catch (foodyError) {
        console.error('Error sending to Foody:', foodyError);
        // Não falhar a operação principal por causa do Foody
      }
    }

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        processed: orderIds.length,
        successCount,
        errors: errorCount,
        foody_sent_count: ordersToSendToFoody.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in notify-order-dispatch function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
