import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PRINTNODE_API_URL = 'https://api.printnode.com';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const PRINTNODE_API_KEY = Deno.env.get('PRINTNODE_API_KEY');
    if (!PRINTNODE_API_KEY) {
      throw new Error('PRINTNODE_API_KEY is not configured');
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Base64 encode API key for Basic Auth (key:)
    const authString = btoa(`${PRINTNODE_API_KEY}:`);

    // GET /whoami - Test connection
    if (action === 'whoami') {
      const response = await fetch(`${PRINTNODE_API_URL}/whoami`, {
        headers: {
          'Authorization': `Basic ${authString}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`PrintNode API error [${response.status}]: ${text}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /computers - List computers
    if (action === 'computers') {
      const response = await fetch(`${PRINTNODE_API_URL}/computers`, {
        headers: {
          'Authorization': `Basic ${authString}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`PrintNode API error [${response.status}]: ${text}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /printers - List printers
    if (action === 'printers') {
      const response = await fetch(`${PRINTNODE_API_URL}/printers`, {
        headers: {
          'Authorization': `Basic ${authString}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`PrintNode API error [${response.status}]: ${text}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /printjobs - Submit print job
    if (action === 'print' && req.method === 'POST') {
      const body = await req.json();
      const { printerId, title, content, contentType = 'raw_base64', options } = body;

      if (!printerId || !content) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: printerId, content' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const printJobPayload = {
        printerId: parseInt(printerId, 10),
        title: title || 'Print Job',
        contentType,
        content,
        source: 'Buffer Logístico',
        ...(options && { options }),
      };

      console.log('Submitting print job:', { printerId, title, contentType });

      const response = await fetch(`${PRINTNODE_API_URL}/printjobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(printJobPayload),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('PrintNode print error:', text);
        throw new Error(`PrintNode API error [${response.status}]: ${text}`);
      }

      const printJobId = await response.json();
      console.log('Print job created:', printJobId);

      return new Response(JSON.stringify({ success: true, printJobId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /printjobs - List print jobs
    if (action === 'printjobs') {
      const limit = url.searchParams.get('limit') || '50';
      const response = await fetch(`${PRINTNODE_API_URL}/printjobs?limit=${limit}`, {
        headers: {
          'Authorization': `Basic ${authString}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`PrintNode API error [${response.status}]: ${text}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /printjobs/:id/states - Get print job states
    if (action === 'printjob-states') {
      const printJobId = url.searchParams.get('printJobId');
      if (!printJobId) {
        return new Response(
          JSON.stringify({ error: 'Missing printJobId parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch(`${PRINTNODE_API_URL}/printjobs/${printJobId}/states`, {
        headers: {
          'Authorization': `Basic ${authString}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`PrintNode API error [${response.status}]: ${text}`);
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: whoami, computers, printers, print, printjobs, printjob-states' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('PrintNode edge function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
