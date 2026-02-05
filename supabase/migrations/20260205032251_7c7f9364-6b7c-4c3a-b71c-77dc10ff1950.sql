-- Criar tabela de presença de operadores por setor
CREATE TABLE public.sector_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sector_id, user_id)
);

-- Índice para busca rápida de setores online
CREATE INDEX idx_sector_presence_online 
ON public.sector_presence(sector_id) 
WHERE is_online = true;

-- Índice para limpeza por timeout
CREATE INDEX idx_sector_presence_last_seen 
ON public.sector_presence(last_seen_at);

-- Habilitar RLS
ALTER TABLE public.sector_presence ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view all presence" 
ON public.sector_presence 
FOR SELECT 
USING (true);

CREATE POLICY "Users can manage own presence" 
ON public.sector_presence 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sector_presence;

-- Função para buscar setores com operadores online
CREATE OR REPLACE FUNCTION public.get_available_sectors()
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sectors uuid[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT s.id ORDER BY s.id)
  INTO v_sectors
  FROM sectors s
  JOIN sector_presence sp ON sp.sector_id = s.id
  WHERE s.view_type = 'kds'
    AND sp.is_online = true
    AND sp.last_seen_at > NOW() - INTERVAL '30 seconds';
  
  RETURN COALESCE(v_sectors, ARRAY[]::uuid[]);
END;
$$;

-- Função para buscar setor com menor carga
CREATE OR REPLACE FUNCTION public.get_least_loaded_sector(p_available_sectors uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sector_id uuid;
BEGIN
  -- Retorna o setor com menos itens pendentes/em preparo
  SELECT s.id
  INTO v_sector_id
  FROM unnest(p_available_sectors) AS s(id)
  LEFT JOIN order_items oi ON oi.assigned_sector_id = s.id 
    AND oi.status IN ('pending', 'in_prep')
  GROUP BY s.id
  ORDER BY COUNT(oi.id) ASC
  LIMIT 1;
  
  RETURN v_sector_id;
END;
$$;

-- Atualizar função de criação de itens para usar balanceamento por carga
CREATE OR REPLACE FUNCTION public.create_order_items_from_json(p_order_id uuid, p_items jsonb, p_default_sector_id uuid DEFAULT NULL::uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item jsonb;
  v_count integer := 0;
  v_available_sectors uuid[];
  v_sector_count integer;
  v_assigned_sector uuid;
  v_fallback_sectors uuid[];
BEGIN
  -- Se foi especificado setor, usar diretamente
  IF p_default_sector_id IS NOT NULL THEN
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
  END IF;
  
  -- Buscar setores com operadores online
  v_available_sectors := get_available_sectors();
  v_sector_count := COALESCE(array_length(v_available_sectors, 1), 0);
  
  -- Fallback: se nenhum operador online, usar todos os setores KDS
  IF v_sector_count = 0 THEN
    SELECT ARRAY_AGG(id ORDER BY name) INTO v_fallback_sectors
    FROM sectors
    WHERE view_type = 'kds';
    
    v_available_sectors := COALESCE(v_fallback_sectors, ARRAY[]::uuid[]);
    v_sector_count := COALESCE(array_length(v_available_sectors, 1), 0);
  END IF;
  
  -- Se ainda não há setores, criar itens sem atribuição
  IF v_sector_count = 0 THEN
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
        NULL
      );
      v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
  END IF;
  
  -- Distribuir por carga (setor com menos itens pendentes)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Buscar setor com menor carga atual
    v_assigned_sector := get_least_loaded_sector(v_available_sectors);
    
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
      v_assigned_sector
    );
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Função para redistribuir itens de setores offline
CREATE OR REPLACE FUNCTION public.redistribute_offline_sector_items(p_offline_sector_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_available_sectors uuid[];
  v_sector_count integer;
  v_item record;
  v_target_sector uuid;
  v_updated integer := 0;
BEGIN
  -- Buscar setores com operadores online (exceto o offline)
  SELECT ARRAY_AGG(DISTINCT s.id)
  INTO v_available_sectors
  FROM sectors s
  JOIN sector_presence sp ON sp.sector_id = s.id
  WHERE s.view_type = 'kds'
    AND s.id != p_offline_sector_id
    AND sp.is_online = true
    AND sp.last_seen_at > NOW() - INTERVAL '30 seconds';
  
  v_sector_count := COALESCE(array_length(v_available_sectors, 1), 0);
  
  -- Se não há outros setores online, não redistribuir
  IF v_sector_count = 0 THEN
    RETURN 0;
  END IF;
  
  -- Redistribuir itens pendentes do setor offline
  FOR v_item IN 
    SELECT id FROM order_items 
    WHERE assigned_sector_id = p_offline_sector_id
      AND status = 'pending'
    ORDER BY created_at
  LOOP
    v_target_sector := get_least_loaded_sector(v_available_sectors);
    
    UPDATE order_items 
    SET assigned_sector_id = v_target_sector
    WHERE id = v_item.id;
    
    v_updated := v_updated + 1;
  END LOOP;
  
  RETURN v_updated;
END;
$$;

-- Função para upsert de presença (registrar/atualizar heartbeat)
CREATE OR REPLACE FUNCTION public.upsert_sector_presence(p_sector_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO sector_presence (sector_id, user_id, last_seen_at, is_online)
  VALUES (p_sector_id, p_user_id, NOW(), true)
  ON CONFLICT (sector_id, user_id) 
  DO UPDATE SET 
    last_seen_at = NOW(),
    is_online = true;
END;
$$;

-- Função para remover presença (logout/cleanup)
CREATE OR REPLACE FUNCTION public.remove_sector_presence(p_sector_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE sector_presence 
  SET is_online = false
  WHERE sector_id = p_sector_id AND user_id = p_user_id;
END;
$$;

-- Função para marcar presenças antigas como offline (cron job)
CREATE OR REPLACE FUNCTION public.cleanup_stale_presence()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE sector_presence 
  SET is_online = false
  WHERE is_online = true
    AND last_seen_at < NOW() - INTERVAL '30 seconds';
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;