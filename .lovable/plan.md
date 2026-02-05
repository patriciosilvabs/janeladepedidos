
# Plano: Corrigir Desmembramento de Itens com Quantity > 1

## Problema Identificado

O pedido **#SIM-ML8XC6PX** com 4 pizzas aparece como **1 único card** no tablet, quando deveria aparecer como **4 cards individuais**.

### Diagnóstico do Banco de Dados

```
orders:
- items: [{name: "Pizza Margherita", quantity: 4, notes: "SEM CEBOLA"}]

order_items:
- 1 registro com quantity: 4 (INCORRETO)
- Deveria ter 4 registros com quantity: 1 cada
```

### Causa Raiz

A função SQL `create_order_items_from_json` **não desmembra** itens com `quantity > 1`. Ela simplesmente copia o valor `quantity` do JSON para o registro:

```sql
-- Código atual (ERRADO)
INSERT INTO order_items (..., quantity, ...)
VALUES (..., COALESCE((v_item->>'quantity')::integer, 1), ...);
-- Resultado: 1 registro com quantity: 4
```

---

## Solução

Modificar a função SQL `create_order_items_from_json` para criar **um registro por unidade** do produto, usando um loop interno que repete o INSERT para cada unidade.

### Lógica Corrigida

```sql
-- Para cada item no JSON
FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
LOOP
  v_qty := COALESCE((v_item->>'quantity')::integer, 1);
  
  -- Criar um registro para cada unidade do produto
  FOR i IN 1..v_qty
  LOOP
    INSERT INTO order_items (
      order_id,
      product_name,
      quantity,  -- Sempre 1
      notes,
      assigned_sector_id
    ) VALUES (
      p_order_id,
      v_item->>'name',
      1,  -- CADA REGISTRO TEM QUANTITY = 1
      v_item->>'notes',
      v_assigned_sector  -- Distribuído por carga
    );
    v_count := v_count + 1;
  END LOOP;
END LOOP;
```

### Exemplo de Resultado

**Entrada:** `[{name: "Pizza Margherita", quantity: 4}]`

**Saída (4 registros):**
| product_name | quantity | assigned_sector_id |
|--------------|----------|-------------------|
| Pizza Margherita | 1 | BANCADA A |
| Pizza Margherita | 1 | BANCADA B |
| Pizza Margherita | 1 | BANCADA A |
| Pizza Margherita | 1 | BANCADA B |

---

## Alterações Necessárias

### Migração SQL

Recriar a função `create_order_items_from_json` com a lógica de desmembramento:

```sql
CREATE OR REPLACE FUNCTION public.create_order_items_from_json(
  p_order_id uuid, 
  p_items jsonb, 
  p_default_sector_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item jsonb;
  v_count integer := 0;
  v_qty integer;
  i integer;
  v_available_sectors uuid[];
  v_sector_count integer;
  v_assigned_sector uuid;
  v_fallback_sectors uuid[];
BEGIN
  -- Se setor específico foi passado
  IF p_default_sector_id IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_qty := COALESCE((v_item->>'quantity')::integer, 1);
      FOR i IN 1..v_qty
      LOOP
        INSERT INTO order_items (order_id, product_name, quantity, notes, assigned_sector_id)
        VALUES (p_order_id, v_item->>'name', 1, v_item->>'notes', p_default_sector_id);
        v_count := v_count + 1;
      END LOOP;
    END LOOP;
    RETURN v_count;
  END IF;
  
  -- Buscar setores com operadores online
  v_available_sectors := get_available_sectors();
  v_sector_count := COALESCE(array_length(v_available_sectors, 1), 0);
  
  -- Fallback para todos os setores KDS se nenhum operador online
  IF v_sector_count = 0 THEN
    SELECT ARRAY_AGG(id ORDER BY name) INTO v_fallback_sectors
    FROM sectors WHERE view_type = 'kds';
    v_available_sectors := COALESCE(v_fallback_sectors, ARRAY[]::uuid[]);
    v_sector_count := COALESCE(array_length(v_available_sectors, 1), 0);
  END IF;
  
  -- Sem setores disponíveis - criar sem atribuição
  IF v_sector_count = 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_qty := COALESCE((v_item->>'quantity')::integer, 1);
      FOR i IN 1..v_qty
      LOOP
        INSERT INTO order_items (order_id, product_name, quantity, notes, assigned_sector_id)
        VALUES (p_order_id, v_item->>'name', 1, v_item->>'notes', NULL);
        v_count := v_count + 1;
      END LOOP;
    END LOOP;
    RETURN v_count;
  END IF;
  
  -- Distribuir por carga entre setores
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item->>'quantity')::integer, 1);
    FOR i IN 1..v_qty
    LOOP
      -- Cada unidade vai para o setor com menor carga
      v_assigned_sector := get_least_loaded_sector(v_available_sectors);
      
      INSERT INTO order_items (order_id, product_name, quantity, notes, assigned_sector_id)
      VALUES (p_order_id, v_item->>'name', 1, v_item->>'notes', v_assigned_sector);
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN v_count;
END;
$$;
```

---

## Resultado Esperado

| Pedido | Antes (Bug) | Depois (Corrigido) |
|--------|-------------|-------------------|
| 4x Pizza Margherita | 1 card mostrando "4x" | 4 cards individuais |
| 2x Pizza Calabresa + 1x Pepperoni | 2 cards | 3 cards |

### Benefícios Adicionais

1. **Balanceamento automático**: Cada pizza vai para o setor com menor carga
2. **Produção paralela**: Diferentes operadores podem trabalhar nas 4 pizzas simultaneamente
3. **Rastreabilidade**: Cada pizza tem seu próprio ciclo de vida (pending → in_prep → in_oven → ready)

---

## Arquivos a Modificar

| Tipo | Arquivo/Ação |
|------|--------------|
| **Migração SQL** | Nova migração para recriar `create_order_items_from_json` |
