CREATE OR REPLACE FUNCTION public.create_order_items_from_json(
  p_order_id uuid, 
  p_items jsonb, 
  p_default_sector_id uuid DEFAULT NULL
)
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
  v_options_text text;
  v_option_name text;
  v_notes text;
BEGIN
  -- Se setor específico foi passado, usar diretamente
  IF p_default_sector_id IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_qty := COALESCE((v_item->>'quantity')::integer, 1);
      
      -- Extrair observation (observação do cliente)
      v_observation := v_item->>'observation';
      
      -- Extrair options (sabores, bordas, complementos)
      v_options_text := '';
      FOR v_option IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'options', '[]'::jsonb))
      LOOP
        v_option_name := v_option->>'name';
        -- Remover prefixo # se existir
        IF v_option_name LIKE '#%' THEN
          v_option_name := TRIM(SUBSTRING(v_option_name FROM 2));
        END IF;
        
        IF v_options_text != '' THEN
          v_options_text := v_options_text || ' | ';
        END IF;
        v_options_text := v_options_text || v_option_name;
      END LOOP;
      
      -- Combinar options + observation
      v_notes := '';
      IF v_options_text != '' THEN
        v_notes := v_options_text;
      END IF;
      IF v_observation IS NOT NULL AND v_observation != '' THEN
        IF v_notes != '' THEN
          v_notes := v_notes || ' || OBS: ' || v_observation;
        ELSE
          v_notes := v_observation;
        END IF;
      END IF;
      
      -- Criar um registro para CADA unidade do produto
      FOR i IN 1..v_qty
      LOOP
        INSERT INTO order_items (order_id, product_name, quantity, notes, assigned_sector_id)
        VALUES (p_order_id, v_item->>'name', 1, NULLIF(v_notes, ''), p_default_sector_id);
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
      
      -- Mesma lógica de extração
      v_observation := v_item->>'observation';
      v_options_text := '';
      FOR v_option IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'options', '[]'::jsonb))
      LOOP
        v_option_name := v_option->>'name';
        IF v_option_name LIKE '#%' THEN
          v_option_name := TRIM(SUBSTRING(v_option_name FROM 2));
        END IF;
        IF v_options_text != '' THEN
          v_options_text := v_options_text || ' | ';
        END IF;
        v_options_text := v_options_text || v_option_name;
      END LOOP;
      
      v_notes := '';
      IF v_options_text != '' THEN
        v_notes := v_options_text;
      END IF;
      IF v_observation IS NOT NULL AND v_observation != '' THEN
        IF v_notes != '' THEN
          v_notes := v_notes || ' || OBS: ' || v_observation;
        ELSE
          v_notes := v_observation;
        END IF;
      END IF;
      
      FOR i IN 1..v_qty
      LOOP
        INSERT INTO order_items (order_id, product_name, quantity, notes, assigned_sector_id)
        VALUES (p_order_id, v_item->>'name', 1, NULLIF(v_notes, ''), NULL);
        v_count := v_count + 1;
      END LOOP;
    END LOOP;
    RETURN v_count;
  END IF;
  
  -- Distribuir por carga (setor com menos itens pendentes)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item->>'quantity')::integer, 1);
    
    -- Mesma lógica de extração
    v_observation := v_item->>'observation';
    v_options_text := '';
    FOR v_option IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'options', '[]'::jsonb))
    LOOP
      v_option_name := v_option->>'name';
      IF v_option_name LIKE '#%' THEN
        v_option_name := TRIM(SUBSTRING(v_option_name FROM 2));
      END IF;
      IF v_options_text != '' THEN
        v_options_text := v_options_text || ' | ';
      END IF;
      v_options_text := v_options_text || v_option_name;
    END LOOP;
    
    v_notes := '';
    IF v_options_text != '' THEN
      v_notes := v_options_text;
    END IF;
    IF v_observation IS NOT NULL AND v_observation != '' THEN
      IF v_notes != '' THEN
        v_notes := v_notes || ' || OBS: ' || v_observation;
      ELSE
        v_notes := v_observation;
      END IF;
    END IF;
    
    -- Cada unidade do produto vai para o setor com menor carga
    FOR i IN 1..v_qty
    LOOP
      v_assigned_sector := get_least_loaded_sector(v_available_sectors);
      
      INSERT INTO order_items (order_id, product_name, quantity, notes, assigned_sector_id)
      VALUES (p_order_id, v_item->>'name', 1, NULLIF(v_notes, ''), v_assigned_sector);
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN v_count;
END;
$function$;