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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { orderIds, groupId } = await req.json();

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'IDs de pedidos não fornecidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${orderIds.length} orders - marking as READY locally (CardápioWeb will be notified on dispatch)`);

    // Apenas atualizar status local para ready - NÃO notificar CardápioWeb aqui
    // A notificação ao CardápioWeb será feita quando o motoboy coletar (dispatch)
    const now = new Date().toISOString();
    
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'ready',
        ready_at: now,
        group_id: null, // Limpar grupo ao marcar como pronto
      })
      .in('id', orderIds);

    if (updateError) {
      console.error('Error updating orders to ready:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao atualizar pedidos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${orderIds.length} orders marked as READY locally - awaiting motoboy collection`);

    // Atualizar status do grupo se fornecido
    if (groupId) {
      await supabase
        .from('delivery_groups')
        .update({ status: 'dispatched', dispatched_at: now })
        .eq('id', groupId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: orderIds.length,
        message: 'Pedidos marcados como PRONTO. CardápioWeb será notificado quando o motoboy coletar.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in notify-order-ready:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
