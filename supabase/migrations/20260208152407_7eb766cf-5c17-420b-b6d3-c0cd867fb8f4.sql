
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
  v_category text;
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
  v_flavor_array text[];
  v_edge_array text[];
  v_flavor_count integer;
  v_edge_count integer;
  v_flavor_idx integer;
  v_single_flavor text;
  v_single_edge text;
  v_is_first_of_group boolean;
  v_all_half boolean;
  v_clean_flavor text;
BEGIN
  SELECT kds_edge_sector_id INTO v_edge_sector_id
  FROM app_settings WHERE id = 'default';

  SELECT 
    COALESCE(kds_edge_keywords, '#, Borda'),
    COALESCE(kds_flavor_keywords, '(G), (M), (P), Sabor')
  INTO v_edge_keywords, v_flavor_keywords
  FROM app_settings WHERE id = 'default';
  
  IF v_edge_keywords IS NULL THEN v_edge_keywords := '#, Borda'; END IF;
  IF v_flavor_keywords IS NULL THEN v_flavor_keywords := '(G), (M), (P), Sabor'; END IF;
  
  SELECT array_agg(trim(k)) INTO v_edge_arr 
  FROM unnest(string_to_array(v_edge_keywords, ',')) AS k
  WHERE trim(k) != '';
  
  SELECT array_agg(trim(k)) INTO v_flavor_arr 
  FROM unnest(string_to_array(v_flavor_keywords, ',')) AS k
  WHERE trim(k) != '';

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_complements := '';
    v_edge_type := '';
    v_flavors := '';
    v_observation := '';
    v_category := '';
    v_has_edge := false;
    v_next_sector_id := NULL;
    
    v_category := COALESCE(v_item->>'category', '');
    
    IF v_item->>'observation' IS NOT NULL AND v_item->>'observation' != '' THEN
      v_observation := v_item->>'observation';
    END IF;
    
    -- Process options
    IF v_item->'options' IS NOT NULL AND jsonb_array_length(v_item->'options') > 0 THEN
      FOR v_option IN SELECT * FROM jsonb_array_elements(v_item->'options')
      LOOP
        v_option_name := COALESCE(v_option->>'name', '');
        v_option_group := COALESCE(v_option->>'group', '');
        
        IF v_option_name != '' THEN
          v_is_edge := false;
          v_is_flavor := false;
          
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
          
          IF v_is_edge THEN
            v_has_edge := true;
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

    -- Check product NAME against edge keywords
    IF NOT v_has_edge AND v_edge_arr IS NOT NULL THEN
      FOREACH v_keyword IN ARRAY v_edge_arr
      LOOP
        IF v_keyword = '#' THEN
          IF (v_item->>'name') LIKE '#%' THEN
            v_has_edge := true;
            v_edge_type := COALESCE(v_item->>'name', '');
            EXIT;
          END IF;
        ELSIF (v_item->>'name') ILIKE '%' || v_keyword || '%' THEN
          v_has_edge := true;
          v_edge_type := COALESCE(v_item->>'name', '');
          EXIT;
        END IF;
      END LOOP;
    END IF;
    
    v_item_qty := COALESCE((v_item->>'quantity')::integer, 1);
    
    -- FLAVOR SPLITTING LOGIC
    v_flavor_array := string_to_array(v_flavors, E'\n');
    v_flavor_count := COALESCE(array_length(v_flavor_array, 1), 0);
    
    -- =====================================================
    -- NEW: Detect half-and-half pizzas (1/2, ½, meia)
    -- If ALL flavors start with a half prefix, keep them
    -- together as a single item instead of splitting.
    -- =====================================================
    v_all_half := false;
    IF v_flavor_count > 1 THEN
      v_all_half := true;
      FOR v_flavor_idx IN 1..v_flavor_count
      LOOP
        v_single_flavor := v_flavor_array[v_flavor_idx];
        -- Remove bullet prefix "• " from the beginning
        v_clean_flavor := regexp_replace(v_single_flavor, '^[•*\-]\s*', '');
        IF v_clean_flavor !~* '^\s*(1/2|½|meia)\s' THEN
          v_all_half := false;
          EXIT;
        END IF;
      END LOOP;
    END IF;
    
    IF v_flavor_count > 1 AND NOT v_all_half THEN
      -- Split each flavor into a separate item (NOT half-and-half)
      v_edge_array := string_to_array(v_edge_type, E'\n');
      v_edge_count := COALESCE(array_length(v_edge_array, 1), 0);
      
      FOR v_qty_idx IN 1..v_item_qty
      LOOP
        FOR v_flavor_idx IN 1..v_flavor_count
        LOOP
          v_single_flavor := v_flavor_array[v_flavor_idx];
          v_is_first_of_group := (v_flavor_idx = 1 AND v_qty_idx = 1);
          
          IF v_flavor_idx <= v_edge_count THEN
            v_single_edge := v_edge_array[v_flavor_idx];
          ELSE
            v_single_edge := '';
          END IF;
          
          v_has_edge := (v_single_edge IS NOT NULL AND v_single_edge != '');
          
          IF p_default_sector_id IS NULL THEN
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
          
          IF v_has_edge AND v_edge_sector_id IS NOT NULL THEN
            v_next_sector_id := v_sector_id;
            
            INSERT INTO order_items (
              order_id, product_name, quantity, notes, complements,
              edge_type, flavors, assigned_sector_id, next_sector_id,
              status, category
            ) VALUES (
              p_order_id,
              COALESCE(v_item->>'name', 'Item sem nome'),
              1,
              CASE WHEN v_is_first_of_group THEN NULLIF(v_observation, '') ELSE NULL END,
              CASE WHEN v_is_first_of_group THEN NULLIF(v_complements, '') ELSE NULL END,
              NULLIF(v_single_edge, ''),
              v_single_flavor,
              v_edge_sector_id,
              v_next_sector_id,
              'pending',
              NULLIF(v_category, '')
            );
          ELSE
            INSERT INTO order_items (
              order_id, product_name, quantity, notes, complements,
              edge_type, flavors, assigned_sector_id, next_sector_id,
              status, category
            ) VALUES (
              p_order_id,
              COALESCE(v_item->>'name', 'Item sem nome'),
              1,
              CASE WHEN v_is_first_of_group THEN NULLIF(v_observation, '') ELSE NULL END,
              CASE WHEN v_is_first_of_group THEN NULLIF(v_complements, '') ELSE NULL END,
              NULLIF(v_single_edge, ''),
              v_single_flavor,
              v_sector_id,
              NULL,
              'pending',
              NULLIF(v_category, '')
            );
          END IF;
          
          v_count := v_count + 1;
        END LOOP;
      END LOOP;
      
    ELSE
      -- Single flavor, OR half-and-half (all flavors kept together)
      FOR v_qty_idx IN 1..v_item_qty
      LOOP
        IF p_default_sector_id IS NULL THEN
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
        
        IF v_has_edge AND v_edge_sector_id IS NOT NULL THEN
          v_next_sector_id := v_sector_id;
          
          INSERT INTO order_items (
            order_id, product_name, quantity, notes, complements,
            edge_type, flavors, assigned_sector_id, next_sector_id,
            status, category
          ) VALUES (
            p_order_id,
            COALESCE(v_item->>'name', 'Item sem nome'),
            1,
            NULLIF(v_observation, ''),
            NULLIF(v_complements, ''),
            NULLIF(v_edge_type, ''),
            NULLIF(v_flavors, ''),
            v_edge_sector_id,
            v_next_sector_id,
            'pending',
            NULLIF(v_category, '')
          );
        ELSE
          INSERT INTO order_items (
            order_id, product_name, quantity, notes, complements,
            edge_type, flavors, assigned_sector_id, next_sector_id,
            status, category
          ) VALUES (
            p_order_id,
            COALESCE(v_item->>'name', 'Item sem nome'),
            1,
            NULLIF(v_observation, ''),
            NULLIF(v_complements, ''),
            NULLIF(v_edge_type, ''),
            NULLIF(v_flavors, ''),
            v_sector_id,
            NULL,
            'pending',
            NULLIF(v_category, '')
          );
        END IF;
        
        v_count := v_count + 1;
      END LOOP;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$function$;
