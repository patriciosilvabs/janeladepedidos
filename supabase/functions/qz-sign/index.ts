import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * QZ Tray Digital Signature Edge Function
 * 
 * Signs requests using RSA-SHA1 for QZ Tray silent printing.
 * The private key is stored securely as an environment variable.
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { toSign } = await req.json();
    
    if (!toSign) {
      console.error('[qz-sign] Missing toSign parameter');
      return new Response(
        JSON.stringify({ error: 'Missing toSign parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const privateKeyPem = Deno.env.get('QZ_PRIVATE_KEY');
    
    if (!privateKeyPem) {
      console.error('[qz-sign] QZ_PRIVATE_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Private key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse PEM and extract key data
    const pemContents = privateKeyPem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '');
    
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    // Import the private key for RSA-SHA1 signing
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-1', // QZ Tray uses SHA-1 for compatibility
      },
      false,
      ['sign']
    );

    // Sign the data
    const encoder = new TextEncoder();
    const data = encoder.encode(toSign);
    const signatureBuffer = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      data
    );

    // Convert to base64
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    console.log('[qz-sign] Successfully signed request');
    
    return new Response(
      JSON.stringify({ signature }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Signing failed';
    console.error('[qz-sign] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
