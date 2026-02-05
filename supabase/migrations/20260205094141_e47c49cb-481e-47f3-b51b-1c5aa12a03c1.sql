
-- Atualizar função create_order_items_from_json com balanceamento dinâmico por item
CREATE OR REPLACE FUNCTION public.create_order_items_from_json(p_order_id uuid, p_items jsonb, p_default_sector_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_option jsonb;
  v_option_name text;
  v_option_group text;
  v_complements text;
  v_edge_type text;
  v_flavors text;
  v_observation text;
  v_count integer := 0;
  v_sector_id uuid;
  v_next_sector_id uuid;
  v_edge_sector_id uuid;
  v_edge_keywords text;
  v_flavor_keywords text;
  v_edge_arr text[];
  v_flavor_arr text[];
  v_keyword text;
  v_is_edge boolean;
  v_is_flavor boolean;
  v_has_edge boolean;
  v_item_qty integer;
  v_qty_idx integer;
BEGIN
  -- Buscar setor de bordas configurado
  SELECT kds_edge_sector_id INTO v_edge_sector_id
  FROM app_settings 
  WHERE id = 'default';

  -- Buscar keywords configuradas
  SELECT 
    COALESCE(kds_edge_keywords, '#, Borda'),
    COALESCE(kds_flavor_keywords, '(G), (M), (P), Sabor')
  INTO v_edge_keywords, v_flavor_keywords
  FROM app_settings 
  WHERE id = 'default';
  
  -- Usar defaults se não encontrou
  IF v_edge_keywords IS NULL THEN
    v_edge_keywords := '#, Borda';
  END IF;
  IF v_flavor_keywords IS NULL THEN
    v_flavor_keywords := '(G), (M), (P), Sabor';
  END IF;
  
  -- Converter para arrays (split por vírgula, trim espaços)
  SELECT array_agg(trim(k)) INTO v_edge_arr 
  FROM unnest(string_to_array(v_edge_keywords, ',')) AS k
  WHERE trim(k) != '';
  
  SELECT array_agg(trim(k)) INTO v_flavor_arr 
  FROM unnest(string_to_array(v_flavor_keywords, ',')) AS k
  WHERE trim(k) != '';

  -- Iterar sobre cada item do pedido
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_complements := '';
    v_edge_type := '';
    v_flavors := '';
    v_observation := '';
    v_has_edge := false;
    v_next_sector_id := NULL;
    
    -- Extrair observação do cliente (campo observation)
    IF v_item->>'observation' IS NOT NULL AND v_item->>'observation' != '' THEN
      v_observation := v_item->>'observation';
    END IF;
    
    -- Processar options e classificar por categoria
    IF v_item->'options' IS NOT NULL AND jsonb_array_length(v_item->'options') > 0 THEN
      FOR v_option IN SELECT * FROM jsonb_array_elements(v_item->'options')
      LOOP
        v_option_name := COALESCE(v_option->>'name', '');
        v_option_group := COALESCE(v_option->>'group', '');
        
        IF v_option_name != '' THEN
          v_is_edge := false;
          v_is_flavor := false;
          
          -- 1. Verificar se é BORDA (usando keywords configuradas)
          IF v_edge_arr IS NOT NULL THEN
            FOREACH v_keyword IN ARRAY v_edge_arr
            LOOP
              IF v_keyword = '#' THEN
                IF v_option_name LIKE '#%' THEN
                  v_is_edge := true;
                  EXIT;
                END IF;
              ELSIF v_option_name ILIKE '%' || v_keyword || '%' THEN
                v_is_edge := true;
                EXIT;
              END IF;
            END LOOP;
          END IF;
          
          -- 2. Se não é borda, verificar se é SABOR
          IF NOT v_is_edge AND v_flavor_arr IS NOT NULL THEN
            FOREACH v_keyword IN ARRAY v_flavor_arr
            LOOP
              IF v_option_name ILIKE '%' || v_keyword || '%' THEN
                v_is_flavor := true;
                EXIT;
              END IF;
            END LOOP;
            
            IF NOT v_is_flavor THEN
              FOREACH v_keyword IN ARRAY v_flavor_arr
              LOOP
                IF v_option_group ILIKE '%' || v_keyword || '%' THEN
                  v_is_flavor := true;
                  EXIT;
                END IF;
              END LOOP;
            END IF;
          END IF;
          
          -- Classificar o option
          IF v_is_edge THEN
            v_has_edge := true; -- Marcar que tem borda
            IF v_edge_type != '' THEN
              v_edge_type := v_edge_type || E'\n';
            END IF;
            v_edge_type := v_edge_type || v_option_name;
          ELSIF v_is_flavor THEN
            IF v_flavors != '' THEN
              v_flavors := v_flavors || E'\n';
            END IF;
            v_flavors := v_flavors || '• ' || v_option_name;
          ELSE
            IF v_complements != '' THEN
              v_complements := v_complements || E'\n';
            END IF;
            v_complements := v_complements || '- ' || v_option_name;
          END IF;
        END IF;
      END LOOP;
    END IF;
    
    -- Extrair quantidade do item (normalização: criar 1 registro por unidade)
    v_item_qty := COALESCE((v_item->>'quantity')::integer, 1);
    
    -- Loop para criar um registro por unidade do item
    FOR v_qty_idx IN 1..v_item_qty
    LOOP
      -- BALANCEAMENTO DINÂMICO: Recalcular setor para CADA item
      IF p_default_sector_id IS NULL THEN
        -- Primeiro tenta setores COM operadores online
        SELECT s.id INTO v_sector_id
        FROM sectors s
        JOIN sector_presence sp ON sp.sector_id = s.id
        LEFT JOIN order_items oi ON oi.assigned_sector_id = s.id 
          AND oi.status IN ('pending', 'in_prep')
        WHERE s.view_type = 'kds'
          AND sp.is_online = true
          AND sp.last_seen_at > NOW() - INTERVAL '30 seconds'
          AND (v_edge_sector_id IS NULL OR s.id != v_edge_sector_id)
        GROUP BY s.id
        ORDER BY COUNT(oi.id) ASC
        LIMIT 1;
        
        -- Fallback: se nenhum operador online, usar qualquer setor KDS com menor carga
        IF v_sector_id IS NULL THEN
          SELECT s.id INTO v_sector_id
          FROM sectors s
          LEFT JOIN order_items oi ON oi.assigned_sector_id = s.id 
            AND oi.status IN ('pending', 'in_prep')
          WHERE s.view_type = 'kds'
            AND (v_edge_sector_id IS NULL OR s.id != v_edge_sector_id)
          GROUP BY s.id
          ORDER BY COUNT(oi.id) ASC
          LIMIT 1;
        END IF;
      ELSE
        v_sector_id := p_default_sector_id;
      END IF;
      
      -- Determinar roteamento baseado em borda
      IF v_has_edge AND v_edge_sector_id IS NOT NULL THEN
        -- Para itens com borda: next_sector_id também calculado dinamicamente
        v_next_sector_id := v_sector_id;
        
        -- Inserir item direcionado para setor de bordas
        INSERT INTO order_items (
          order_id,
          product_name,
          quantity,
          notes,
          complements,
          edge_type,
          flavors,
          assigned_sector_id,
          next_sector_id,
          status
        ) VALUES (
          p_order_id,
          COALESCE(v_item->>'name', 'Item sem nome'),
          1, -- Sempre 1 (normalizado)
          NULLIF(v_observation, ''),
          NULLIF(v_complements, ''),
          NULLIF(v_edge_type, ''),
          NULLIF(v_flavors, ''),
          v_edge_sector_id,
          v_next_sector_id,
          'pending'
        );
      ELSE
        -- Inserir item normalmente (sem roteamento de bordas)
        INSERT INTO order_items (
          order_id,
          product_name,
          quantity,
          notes,
          complements,
          edge_type,
          flavors,
          assigned_sector_id,
          next_sector_id,
          status
        ) VALUES (
          p_order_id,
          COALESCE(v_item->>'name', 'Item sem nome'),
          1, -- Sempre 1 (normalizado)
          NULLIF(v_observation, ''),
          NULLIF(v_complements, ''),
          NULLIF(v_edge_type, ''),
          NULLIF(v_flavors, ''),
          v_sector_id,
          NULL,
          'pending'
        );
      END IF;
      
      v_count := v_count + 1;
    END LOOP; -- Fim do loop de quantidade
  END LOOP; -- Fim do loop de itens
  
  RETURN v_count;
END;
$function$;
