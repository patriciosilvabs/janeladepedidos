import * as jsrsasign from "npm:jsrsasign@11.1.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { request } = await req.json();
    
    if (!request) {
      console.error('[sign-qz] No request data provided');
      return new Response('Missing request data', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Get private key from secrets
    const privateKey = Deno.env.get("QZ_PRIVATE_KEY");
    
    if (!privateKey) {
      console.error('[sign-qz] QZ_PRIVATE_KEY not configured');
      return new Response('Server configuration error', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Replace escaped newlines with actual newlines
    const formattedKey = privateKey.replace(/\\n/g, '\n');
    
    console.log('[sign-qz] Signing request, key length:', formattedKey.length);
    
    // Create signature using SHA1withRSA
    const sig = new jsrsasign.KJUR.crypto.Signature({ alg: "SHA1withRSA" });
    sig.init(formattedKey);
    sig.updateString(request);
    const hexSignature = sig.sign();
    const signature = jsrsasign.hextob64(hexSignature);

    console.log('[sign-qz] Signature created successfully, length:', signature.length);

    return new Response(signature, {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('[sign-qz] Error signing request:', error);
    return new Response(`Signing error: ${error.message}`, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
