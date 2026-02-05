-- Adicionar colunas para separar tipos de dados
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS edge_type text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS flavors text;

-- Atualizar função para classificar options em categorias
CREATE OR REPLACE FUNCTION public.create_order_items_from_json(
  p_order_id uuid,
  p_items jsonb,
  p_default_sector_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  -- Determinar setor padrão se não fornecido
  IF p_default_sector_id IS NULL THEN
    SELECT id INTO v_sector_id 
    FROM sectors 
    WHERE view_type = 'production' 
    LIMIT 1;
  ELSE
    v_sector_id := p_default_sector_id;
  END IF;

  -- Iterar sobre cada item do pedido
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_complements := '';
    v_edge_type := '';
    v_flavors := '';
    v_observation := '';
    
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
          -- 1. BORDAS: começam com # ou contêm "Borda"
          IF v_option_name LIKE '#%' OR v_option_name ILIKE '%borda%' THEN
            IF v_edge_type != '' THEN
              v_edge_type := v_edge_type || E'\n';
            END IF;
            v_edge_type := v_edge_type || v_option_name;
            
          -- 2. SABORES: contêm (G), (M), (P) ou grupo contém "Sabor"
          ELSIF v_option_name ~ '\([GgMmPp]\)' OR v_option_group ILIKE '%sabor%' THEN
            IF v_flavors != '' THEN
              v_flavors := v_flavors || E'\n';
            END IF;
            v_flavors := v_flavors || '• ' || v_option_name;
            
          -- 3. OUTROS: massas, adicionais, etc
          ELSE
            IF v_complements != '' THEN
              v_complements := v_complements || E'\n';
            END IF;
            v_complements := v_complements || '- ' || v_option_name;
          END IF;
        END IF;
      END LOOP;
    END IF;
    
    -- Inserir item com campos separados
    INSERT INTO order_items (
      order_id,
      product_name,
      quantity,
      notes,
      complements,
      edge_type,
      flavors,
      assigned_sector_id,
      status
    ) VALUES (
      p_order_id,
      COALESCE(v_item->>'name', 'Item sem nome'),
      COALESCE((v_item->>'quantity')::integer, 1),
      NULLIF(v_observation, ''),
      NULLIF(v_complements, ''),
      NULLIF(v_edge_type, ''),
      NULLIF(v_flavors, ''),
      v_sector_id,
      'pending'
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;