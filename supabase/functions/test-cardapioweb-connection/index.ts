import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, useSandbox } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Helper function to test a specific URL
    async function testUrl(baseUrl: string): Promise<{ success: boolean; data?: any; isHtml?: boolean; status?: number; error?: string }> {
      try {
        const response = await fetch(`${baseUrl}/store`, {
          method: 'GET',
          headers: {
            'X-API-KEY': token,
            'Content-Type': 'application/json',
          },
        });

        const responseText = await response.text();
        console.log(`Testing ${baseUrl} - Status: ${response.status}, Response preview: ${responseText.substring(0, 100)}`);

        // Check if response is HTML
        if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
          return { success: false, isHtml: true, status: response.status };
        }

        if (!response.ok) {
          return { success: false, status: response.status, error: responseText.substring(0, 200) };
        }

        try {
          const data = JSON.parse(responseText);
          return { success: true, data };
        } catch {
          return { success: false, error: 'Resposta não é JSON válido' };
        }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Erro de conexão' };
      }
    }

    const productionUrl = 'https://integracao.cardapioweb.com';
    const sandboxUrl = 'https://integracao.sandbox.cardapioweb.com';

    // Test the appropriate environment
    const urlToTest = useSandbox ? sandboxUrl : productionUrl;
    const result = await testUrl(urlToTest);

    if (result.success) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          store: result.data,
          environment: useSandbox ? 'sandbox' : 'production'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If production fails with HTML, try sandbox automatically
    if (!useSandbox && result.isHtml) {
      console.log('Production returned HTML, trying sandbox...');
      const sandboxResult = await testUrl(sandboxUrl);
      
      if (sandboxResult.success) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            store: sandboxResult.data,
            environment: 'sandbox',
            note: 'Token funcionou no ambiente Sandbox. Configure a URL correta nas configurações.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Return error with helpful message
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: result.isHtml 
          ? 'Token inválido - API retornou página HTML' 
          : `Erro na API: ${result.status || result.error}`,
        details: result.isHtml 
          ? 'Verifique se o token está correto. Para testes, use o token Sandbox: 7nSyGq49NVXuyZfgEQNPg3TdUqLNXTMNMNJwckvE'
          : result.error
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error testing Cardápio Web connection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
