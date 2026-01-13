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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cardápio Web API error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro na API: ${response.status}`,
          details: errorText 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Cardápio Web API response:', JSON.stringify(data).substring(0, 200));

    return new Response(
      JSON.stringify({ success: true, store: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
