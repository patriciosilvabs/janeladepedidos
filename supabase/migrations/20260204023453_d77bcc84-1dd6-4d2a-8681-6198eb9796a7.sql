-- =============================================
-- KDS MULTITENANT: Order Items Atômicos
-- =============================================

-- 1. Criar enum para status dos itens
CREATE TYPE item_status AS ENUM (
  'pending',    -- Aguardando preparo
  'in_prep',    -- Em preparação (claimed)
  'in_oven',    -- No forno (timer 120s)
  'ready'       -- Pronto para despacho
);

-- 2. Criar tabela order_items
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  notes text,
  status item_status NOT NULL DEFAULT 'pending',
  assigned_sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  claimed_by uuid,
  claimed_at timestamptz,
  oven_entry_at timestamptz,
  estimated_exit_at timestamptz,
  ready_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Índices para performance
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_status ON public.order_items(status);
CREATE INDEX idx_order_items_sector ON public.order_items(assigned_sector_id);
CREATE INDEX idx_order_items_claimed ON public.order_items(claimed_by, claimed_at);
CREATE INDEX idx_order_items_oven ON public.order_items(status, estimated_exit_at) 
  WHERE status = 'in_oven';

-- 4. RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on order_items"
ON public.order_items
FOR ALL
USING (true)
WITH CHECK (true);

-- 5. Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

-- 6. Adicionar colunas à tabela orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS all_items_ready boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS mixed_origin boolean DEFAULT false;

-- 7. Adicionar weight_limit aos setores
ALTER TABLE public.sectors
ADD COLUMN IF NOT EXISTS weight_limit integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS is_oven_sector boolean DEFAULT false;

-- =============================================
-- FUNÇÕES RPC PARA CONTROLE DE CONCORRÊNCIA
-- =============================================

-- 8. claim_order_item - Pessimistic locking para 9+ tablets
CREATE OR REPLACE FUNCTION public.claim_order_item(
  p_item_id uuid,
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_item record;
BEGIN
  -- Tenta fazer lock exclusivo na linha
  SELECT * INTO v_item
  FROM order_items
  WHERE id = p_item_id
  FOR UPDATE NOWAIT;  -- Falha imediatamente se já há lock
  
  -- Verifica se pode fazer claim
  IF v_item.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'item_not_pending',
      'message', 'Item já está em preparo'
    );
  END IF;
  
  -- Verifica se há claim válido (últimos 30 segundos)
  IF v_item.claimed_by IS NOT NULL 
     AND v_item.claimed_at > NOW() - INTERVAL '30 seconds' 
     AND v_item.claimed_by != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'already_claimed',
      'message', 'Item já foi capturado por outro operador',
      'claimed_by', v_item.claimed_by
    );
  END IF;
  
  -- Faz o claim
  UPDATE order_items
  SET 
    claimed_by = p_user_id,
    claimed_at = NOW(),
    status = 'in_prep'
  WHERE id = p_item_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'item_id', p_item_id,
    'claimed_at', NOW()
  );
  
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'lock_conflict',
      'message', 'Outro operador está processando este item'
    );
END;
$$;

-- 9. release_item_claim - Liberar claim (timeout ou cancelamento)
CREATE OR REPLACE FUNCTION public.release_item_claim(
  p_item_id uuid,
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE order_items
  SET 
    claimed_by = NULL,
    claimed_at = NULL,
    status = 'pending'
  WHERE id = p_item_id
    AND claimed_by = p_user_id
    AND status = 'in_prep';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_found_or_not_owner',
      'message', 'Item não encontrado ou você não é o dono do claim'
    );
  END IF;
  
  RETURN jsonb_build_object('success', true, 'item_id', p_item_id);
END;
$$;

-- 10. send_to_oven - Colocar item no forno com timer
CREATE OR REPLACE FUNCTION public.send_to_oven(
  p_item_id uuid,
  p_user_id uuid,
  p_oven_time_seconds integer DEFAULT 120
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
BEGIN
  SELECT * INTO v_item
  FROM order_items
  WHERE id = p_item_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  
  IF v_item.status != 'in_prep' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_status',
      'message', 'Item precisa estar em preparo para ir ao forno'
    );
  END IF;
  
  IF v_item.claimed_by != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_owner',
      'message', 'Apenas quem fez claim pode enviar ao forno'
    );
  END IF;
  
  UPDATE order_items
  SET 
    status = 'in_oven',
    oven_entry_at = NOW(),
    estimated_exit_at = NOW() + (p_oven_time_seconds || ' seconds')::interval
  WHERE id = p_item_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'item_id', p_item_id,
    'oven_entry_at', NOW(),
    'estimated_exit_at', NOW() + (p_oven_time_seconds || ' seconds')::interval
  );
END;
$$;

-- 11. mark_item_ready - Marcar item como pronto
CREATE OR REPLACE FUNCTION public.mark_item_ready(
  p_item_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE order_items
  SET 
    status = 'ready',
    ready_at = NOW()
  WHERE id = p_item_id
    AND status = 'in_oven';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_in_oven');
  END IF;
  
  -- Verifica se todos os itens do pedido estão prontos
  PERFORM check_order_completion(
    (SELECT order_id FROM order_items WHERE id = p_item_id)
  );
  
  RETURN jsonb_build_object('success', true, 'item_id', p_item_id, 'ready_at', NOW());
END;
$$;

-- 12. check_order_completion - Verificar se pedido está completo
CREATE OR REPLACE FUNCTION public.check_order_completion(
  p_order_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_ready integer;
  v_sectors integer;
BEGIN
  SELECT 
    COUNT(*),
    SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END),
    COUNT(DISTINCT assigned_sector_id)
  INTO v_total, v_ready, v_sectors
  FROM order_items
  WHERE order_id = p_order_id;
  
  IF v_total = v_ready THEN
    UPDATE orders
    SET 
      all_items_ready = true,
      mixed_origin = (v_sectors > 1)
    WHERE id = p_order_id;
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- 13. Trigger para verificar completude após mudança de status
CREATE OR REPLACE FUNCTION public.on_item_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ready' AND OLD.status != 'ready' THEN
    PERFORM check_order_completion(NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_item_status_change
AFTER UPDATE OF status ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.on_item_status_change();

-- 14. Função para criar items a partir do JSON de orders
CREATE OR REPLACE FUNCTION public.create_order_items_from_json(
  p_order_id uuid,
  p_items jsonb,
  p_default_sector_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_count integer := 0;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id,
      product_name,
      quantity,
      notes,
      assigned_sector_id
    ) VALUES (
      p_order_id,
      v_item->>'name',
      COALESCE((v_item->>'quantity')::integer, 1),
      v_item->>'notes',
      p_default_sector_id
    );
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;