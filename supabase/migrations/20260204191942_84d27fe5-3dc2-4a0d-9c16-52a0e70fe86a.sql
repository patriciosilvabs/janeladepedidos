-- Função utilitária para distribuir itens sem setor entre bancadas KDS
CREATE OR REPLACE FUNCTION public.distribute_unassigned_items()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kds_sectors uuid[];
  v_sector_count integer;
  v_item record;
  v_index integer := 0;
  v_updated integer := 0;
BEGIN
  -- Buscar setores KDS ativos ordenados por nome
  SELECT ARRAY_AGG(id ORDER BY name) INTO v_kds_sectors
  FROM sectors
  WHERE view_type = 'kds';
  
  v_sector_count := COALESCE(array_length(v_kds_sectors, 1), 0);
  
  IF v_sector_count = 0 THEN
    RETURN 0;
  END IF;
  
  -- Distribuir itens sem setor em round-robin
  FOR v_item IN 
    SELECT id FROM order_items 
    WHERE assigned_sector_id IS NULL
    ORDER BY created_at
  LOOP
    UPDATE order_items 
    SET assigned_sector_id = v_kds_sectors[(v_index % v_sector_count) + 1]
    WHERE id = v_item.id;
    
    v_index := v_index + 1;
    v_updated := v_updated + 1;
  END LOOP;
  
  RETURN v_updated;
END;
$$;

-- Atualizar a função create_order_items_from_json para distribuir automaticamente
CREATE OR REPLACE FUNCTION public.create_order_items_from_json(p_order_id uuid, p_items jsonb, p_default_sector_id uuid DEFAULT NULL::uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item jsonb;
  v_count integer := 0;
  v_kds_sectors uuid[];
  v_sector_count integer;
  v_index integer := 0;
  v_assigned_sector uuid;
BEGIN
  -- Se não foi especificado setor, buscar setores KDS para distribuição round-robin
  IF p_default_sector_id IS NULL THEN
    SELECT ARRAY_AGG(id ORDER BY name) INTO v_kds_sectors
    FROM sectors
    WHERE view_type = 'kds';
    
    v_sector_count := COALESCE(array_length(v_kds_sectors, 1), 0);
  END IF;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Determinar qual setor atribuir
    IF p_default_sector_id IS NOT NULL THEN
      v_assigned_sector := p_default_sector_id;
    ELSIF v_sector_count > 0 THEN
      -- Distribuição round-robin entre setores KDS
      v_assigned_sector := v_kds_sectors[(v_index % v_sector_count) + 1];
      v_index := v_index + 1;
    ELSE
      v_assigned_sector := NULL;
    END IF;
    
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