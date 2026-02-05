import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as npm from "npm:jsrsasign"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { request } = await req.json()
  
  // Pega a chave privada que você salvou nos Secrets do Supabase
  const key = Deno.env.get("QZ_PRIVATE_KEY")?.replace(/\\n/g, '\n');
  
  const sig = new npm.jsrsasign.KJUR.crypto.Signature({ "alg": "SHA1withRSA" });
  sig.init(key);
  sig.updateString(request);
  const signature = npm.jsrsasign.hextob64(sig.sign());

  return new Response(signature, {
    headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
  })
})
