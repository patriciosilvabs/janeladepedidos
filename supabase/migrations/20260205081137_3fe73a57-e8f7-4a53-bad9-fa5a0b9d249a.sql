-- Adicionar coluna para complementos/sabores
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS complements text;

-- Atualizar função para separar dados corretamente
CREATE OR REPLACE FUNCTION public.create_order_items_from_json(p_order_id uuid, p_items jsonb, p_default_sector_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_option jsonb;
  v_count integer := 0;
  v_qty integer;
  i integer;
  v_available_sectors uuid[];
  v_sector_count integer;
  v_assigned_sector uuid;
  v_fallback_sectors uuid[];
  v_observation text;
  v_complements text;
  v_option_name text;
BEGIN
  -- Se setor específico foi passado, usar diretamente
  IF p_default_sector_id IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_qty := COALESCE((v_item->>'quantity')::integer, 1);
      
      -- Extrair observation (observação do cliente) -> vai para notes
      v_observation := v_item->>'observation';
      
      -- Extrair options (sabores, bordas, complementos) -> vai para complements
      v_complements := '';
      FOR v_option IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'options', '[]'::jsonb))
      LOOP
        v_option_name := v_option->>'name';
        IF v_complements != '' THEN
          v_complements := v_complements || E'\n';
        END IF;
        v_complements := v_complements || '- ' || v_option_name;
      END LOOP;
      
      -- Criar um registro para CADA unidade do produto
      FOR i IN 1..v_qty
      LOOP
        INSERT INTO order_items (order_id, product_name, quantity, notes, complements, assigned_sector_id)
        VALUES (p_order_id, v_item->>'name', 1, NULLIF(v_observation, ''), NULLIF(v_complements, ''), p_default_sector_id);
        v_count := v_count + 1;
      END LOOP;
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
      v_qty := COALESCE((v_item->>'quantity')::integer, 1);
      
      v_observation := v_item->>'observation';
      v_complements := '';
      FOR v_option IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'options', '[]'::jsonb))
      LOOP
        v_option_name := v_option->>'name';
        IF v_complements != '' THEN
          v_complements := v_complements || E'\n';
        END IF;
        v_complements := v_complements || '- ' || v_option_name;
      END LOOP;
      
      FOR i IN 1..v_qty
      LOOP
        INSERT INTO order_items (order_id, product_name, quantity, notes, complements, assigned_sector_id)
        VALUES (p_order_id, v_item->>'name', 1, NULLIF(v_observation, ''), NULLIF(v_complements, ''), NULL);
        v_count := v_count + 1;
      END LOOP;
    END LOOP;
    RETURN v_count;
  END IF;
  
  -- Distribuir por carga (setor com menos itens pendentes)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item->>'quantity')::integer, 1);
    
    v_observation := v_item->>'observation';
    v_complements := '';
    FOR v_option IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'options', '[]'::jsonb))
    LOOP
      v_option_name := v_option->>'name';
      IF v_complements != '' THEN
        v_complements := v_complements || E'\n';
      END IF;
      v_complements := v_complements || '- ' || v_option_name;
    END LOOP;
    
    -- Cada unidade do produto vai para o setor com menor carga
    FOR i IN 1..v_qty
    LOOP
      v_assigned_sector := get_least_loaded_sector(v_available_sectors);
      
      INSERT INTO order_items (order_id, product_name, quantity, notes, complements, assigned_sector_id)
      VALUES (p_order_id, v_item->>'name', 1, NULLIF(v_observation, ''), NULLIF(v_complements, ''), v_assigned_sector);
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN v_count;
END;
$function$;