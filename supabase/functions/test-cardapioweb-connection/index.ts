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
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test connection to Cardápio Web API
    const response = await fetch('https://integracao.cardapioweb.com/store', {
      method: 'GET',
      headers: {
        'X-API-KEY': token,
        'Content-Type': 'application/json',
      },
    });

    console.log('Cardápio Web API response status:', response.status);
    
    const responseText = await response.text();
    console.log('Cardápio Web API response preview:', responseText.substring(0, 200));

    // Check if response is HTML (invalid token usually returns login page)
    if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Token inválido - API retornou página HTML em vez de JSON',
          details: 'Verifique se o token da API está correto'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro na API: ${response.status}`,
          details: responseText.substring(0, 500)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to parse as JSON
    try {
      const data = JSON.parse(responseText);
      return new Response(
        JSON.stringify({ success: true, store: data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Resposta da API não é JSON válido',
          details: responseText.substring(0, 200)
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
