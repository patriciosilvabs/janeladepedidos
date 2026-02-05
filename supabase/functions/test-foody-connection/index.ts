const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    const baseUrl = url || 'https://app.foodydelivery.com/rest/1.2';
    
    // Test connection by checking if token is valid
    // Try to access the API - if we get 401/403, token is invalid
    // Any other response means connection works
    console.log('Testing Foody connection to:', baseUrl);
    
    const response = await fetch(
      `${baseUrl}/orders`,
      {
        method: 'GET',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json;charset=UTF-8',
        },
      }
    );

    console.log('Foody API response status:', response.status);
    const responseText = await response.text();
    console.log('Foody API response:', responseText.substring(0, 300));

    // Check for authentication errors
    if (response.status === 401 || response.status === 403) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Token inválido ou sem permissão',
          details: responseText 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Even if we get other errors (like missing required params), 
    // the connection itself is working if we got a response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Conexão estabelecida com sucesso',
        apiStatus: response.status
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error testing Foody connection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
