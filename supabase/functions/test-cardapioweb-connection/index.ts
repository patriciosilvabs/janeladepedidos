const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, url } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use custom URL if provided, otherwise default to production
    const baseUrl = url || 'https://integracao.cardapioweb.com';
    
    console.log(`Testing connection to: ${baseUrl}`);

    try {
      const response = await fetch(`${baseUrl}/api/partner/v1/orders`, {
        method: 'GET',
        headers: {
          'X-API-KEY': token,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      const responseText = await response.text();
      console.log(`Status: ${response.status}, Response preview: ${responseText.substring(0, 100)}`);

      // Check if response is HTML (invalid token or wrong URL)
      if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Token inválido - API retornou página HTML',
            details: 'Verifique se o token e a URL estão corretos.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!response.ok) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Erro na API: ${response.status}`,
            details: responseText.substring(0, 200)
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const data = JSON.parse(responseText);
        const ordersCount = Array.isArray(data) ? data.length : 0;
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            ordersCount,
            message: `Conexão OK! ${ordersCount} pedidos encontrados.`,
            url: baseUrl
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'Resposta não é JSON válido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (err) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: err instanceof Error ? err.message : 'Erro de conexão'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error testing Cardápio Web connection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
