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

    const baseUrl = url || 'https://app.foodydelivery.com/rest/1.2';
    
    // Test connection by fetching orders from today
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const endDate = startDate;

    const response = await fetch(
      `${baseUrl}/orders?startDate=${startDate}&endDate=${endDate}`,
      {
        method: 'GET',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json;charset=UTF-8',
        },
      }
    );

    console.log('Foody API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Foody API error:', errorText);
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
    console.log('Foody API response:', JSON.stringify(data).substring(0, 200));

    return new Response(
      JSON.stringify({ success: true, ordersCount: Array.isArray(data) ? data.length : 0 }),
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
