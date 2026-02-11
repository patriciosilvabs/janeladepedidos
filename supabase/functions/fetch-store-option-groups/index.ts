import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { store_id } = await req.json();
    if (!store_id) {
      return new Response(JSON.stringify({ error: 'store_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch store config
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('cardapioweb_api_token, cardapioweb_api_url')
      .eq('id', store_id)
      .single();

    if (storeError || !store) {
      return new Response(JSON.stringify({ error: 'Loja não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!store.cardapioweb_api_token) {
      return new Response(JSON.stringify({ error: 'Token da API não configurado para esta loja' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = store.cardapioweb_api_url || 'https://integracao.cardapioweb.com';

    // Fetch orders to extract option groups
    console.log(`[fetch-groups] Fetching orders from ${baseUrl} for store ${store_id}`);
    const ordersResponse = await fetch(`${baseUrl}/api/partner/v1/orders`, {
      method: 'GET',
      headers: {
        'X-API-KEY': store.cardapioweb_api_token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      console.error(`[fetch-groups] API error: ${ordersResponse.status}`, errorText.substring(0, 200));
      return new Response(JSON.stringify({ error: `Erro na API: ${ordersResponse.status}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orders = await ordersResponse.json();
    console.log(`[fetch-groups] Got ${orders.length} orders, fetching details...`);

    // Collect unique option groups from order details
    const groupMap = new Map<number, string>();

    // Fetch details for each order (up to 20 to be reasonable)
    const ordersToCheck = orders.slice(0, 20);
    
    for (const order of ordersToCheck) {
      try {
        const detailRes = await fetch(`${baseUrl}/api/partner/v1/orders/${order.id}`, {
          method: 'GET',
          headers: {
            'X-API-KEY': store.cardapioweb_api_token,
            'Accept': 'application/json',
          },
        });

        if (!detailRes.ok) continue;
        const detail = await detailRes.json();

        // Extract option groups from items
        const items = detail.items || [];
        for (const item of items) {
          const options = item.options || item.additions || [];
          for (const opt of options) {
            if (opt.option_group_id && !groupMap.has(opt.option_group_id)) {
              const groupName = opt.option_group_name || opt.group || '';
              groupMap.set(opt.option_group_id, groupName);
            }
          }
        }
      } catch (err) {
        console.error(`[fetch-groups] Error fetching order ${order.id}:`, err);
      }
    }

    // Convert to array and sort
    const groups = Array.from(groupMap.entries())
      .map(([id, name]) => ({ option_group_id: id, group_name: name }))
      .sort((a, b) => a.group_name.localeCompare(b.group_name));

    console.log(`[fetch-groups] Found ${groups.length} unique option groups`);

    return new Response(JSON.stringify({ groups, orders_checked: ordersToCheck.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[fetch-groups] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
