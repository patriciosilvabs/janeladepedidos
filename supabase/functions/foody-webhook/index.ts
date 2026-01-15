import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token',
};

interface FoodyStatusEvent {
  uid?: string;
  order_id?: string;
  status: string;
  driver?: {
    name?: string;
    phone?: string;
  };
  timestamp?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configurações para validar token (opcional)
    const { data: settings } = await supabase
      .from('app_settings')
      .select('foody_api_token, foody_enabled')
      .eq('id', 'default')
      .maybeSingle();

    const foodySettings = settings as { foody_api_token?: string; foody_enabled?: boolean } | null;
    
    if (!foodySettings?.foody_enabled) {
      console.log('Foody integration is disabled, but received webhook');
      return new Response(
        JSON.stringify({ success: true, message: 'Foody is disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: FoodyStatusEvent = await req.json();
    console.log('Received Foody webhook:', JSON.stringify(body));

    const { uid, order_id, status } = body;
    const foodyUid = uid || order_id;

    if (!foodyUid) {
      console.error('No order identifier in webhook');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing order identifier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar pedido pelo foody_uid
    const { data: order, error: findError } = await supabase
      .from('orders')
      .select('id, status, foody_status')
      .eq('foody_uid', foodyUid)
      .maybeSingle();

    if (findError) {
      console.error('Error finding order:', findError);
      return new Response(
        JSON.stringify({ success: false, error: findError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!order) {
      console.log(`Order with foody_uid ${foodyUid} not found`);
      return new Response(
        JSON.stringify({ success: true, message: 'Order not found', ignored: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingOrder = order as { id: string; status: string; foody_status: string | null };
    console.log(`Processing Foody status update for order ${existingOrder.id}: ${status}`);

    // Mapear status do Foody para ações no sistema
    switch (status.toLowerCase()) {
      case 'accepted':
      case 'assigned':
        // Motoboy aceitou/foi atribuído ao pedido
        await supabase
          .from('orders')
          .update({ foody_status: 'assigned' })
          .eq('id', existingOrder.id);
        
        console.log(`Order ${existingOrder.id} - driver assigned`);
        break;

      case 'collected':
      case 'picked_up':
      case 'on_the_way':
        // Motoboy coletou o pedido
        await supabase
          .from('orders')
          .update({ 
            foody_status: 'collected',
            status: 'dispatched',
            dispatched_at: new Date().toISOString(),
          })
          .eq('id', existingOrder.id);
        
        console.log(`Order ${existingOrder.id} - collected by driver, marked as dispatched`);
        break;

      case 'delivered':
      case 'completed':
        // Entrega concluída - remover pedido do sistema
        const { error: deleteError } = await supabase
          .from('orders')
          .delete()
          .eq('id', existingOrder.id);

        if (deleteError) {
          console.error('Error deleting delivered order:', deleteError);
        } else {
          console.log(`Order ${existingOrder.id} delivered and removed from system`);
        }
        break;

      case 'cancelled':
      case 'failed':
        // Entrega cancelada/falhou - manter pedido mas atualizar status
        await supabase
          .from('orders')
          .update({ 
            foody_status: 'cancelled',
            foody_error: `Delivery ${status}`,
          })
          .eq('id', existingOrder.id);
        
        console.log(`Order ${existingOrder.id} - delivery ${status}`);
        break;

      case 'returning':
        // Motoboy retornando (pedido não entregue)
        await supabase
          .from('orders')
          .update({ 
            foody_status: 'returning',
            foody_error: 'Driver returning - delivery failed',
          })
          .eq('id', existingOrder.id);
        
        console.log(`Order ${existingOrder.id} - driver returning`);
        break;

      default:
        // Atualizar status genérico
        await supabase
          .from('orders')
          .update({ foody_status: status })
          .eq('id', existingOrder.id);
        
        console.log(`Order ${existingOrder.id} - status updated to ${status}`);
    }

    return new Response(
      JSON.stringify({ success: true, order_id: existingOrder.id, status }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Foody webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
