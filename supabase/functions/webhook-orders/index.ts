import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ================== ASYNC INGESTION LAYER ==================
// v2.0 - Fire-and-forget: validates, saves raw payload, returns 200 OK immediately
// All heavy processing moved to process-webhook-queue edge function

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

    // Extract API token from headers
    const apiToken = req.headers.get('x-api-key') || req.headers.get('x-webhook-token');

    if (!apiToken) {
      console.error('Missing API token in request headers');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing API token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find store by API token (quick query)
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name')
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
      console.error(`No store found for token: ${apiToken?.substring(0, 8)}...`);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid API token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse body
    const payload = await req.json();

    console.log(`[webhook-orders] Received for store "${store.name}": event=${payload.event_type}, order_id=${payload.order_id}`);

    // Insert into webhook_queue
    const { data: queueEntry, error: insertError } = await supabase
      .from('webhook_queue')
      .insert({
        store_id: store.id,
        payload: payload,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[webhook-orders] Error inserting into queue:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to queue webhook' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[webhook-orders] Queued as ${queueEntry.id} - returning 200 OK`);

    // Fire-and-forget: trigger background processing (no await!)
    const processUrl = `${supabaseUrl}/functions/v1/process-webhook-queue`;
    fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ queue_id: queueEntry.id }),
    }).catch(err => {
      console.error(`[webhook-orders] Fire-and-forget error (will be retried):`, err);
    });

    // Return 200 OK immediately
    return new Response(
      JSON.stringify({ status: 'received', queue_id: queueEntry.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[webhook-orders] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
