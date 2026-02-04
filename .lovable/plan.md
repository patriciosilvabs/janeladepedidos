

# Distribuicao Automatica de Itens Entre Bancadas

## Problema Atual

Quando itens sao criados sem setor atribuido (`assigned_sector_id = NULL`), eles ficam invisiveis para os operadores das bancadas. A solucao atual de atribuir tudo a uma unica bancada nao e ideal pois sobrecarrega um setor.

## Solucao Proposta

Implementar uma **distribuicao automatica round-robin** que alterna os itens entre os setores KDS disponiveis (Bancada A e Bancada B).

---

## Mudancas Necessarias

### 1. Criar Funcao SQL para Distribuicao Automatica

Uma funcao no banco de dados que distribui itens sem setor entre as bancadas disponiveis:

```sql
CREATE OR REPLACE FUNCTION distribute_unassigned_items()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_kds_sectors uuid[];
  v_sector_count integer;
  v_item record;
  v_index integer := 0;
  v_updated integer := 0;
BEGIN
  -- Buscar setores KDS ativos
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
```

### 2. Atualizar a Funcao `create_order_items_from_json`

Modificar para distribuir automaticamente quando nenhum setor e especificado:

```sql
-- Dentro da funcao, se p_default_sector_id for NULL:
-- Usar round-robin entre setores KDS disponiveis
```

---

## Fluxo de Distribuicao

```text
Novo pedido chega (webhook ou simulador)
        |
        v
Setor especificado? ----SIM----> Atribuir ao setor escolhido
        |
       NAO
        |
        v
Buscar setores KDS ativos (Bancada A, B...)
        |
        v
Distribuir itens em round-robin:
  Item 1 -> Bancada A
  Item 2 -> Bancada B
  Item 3 -> Bancada A
  Item 4 -> Bancada B
  ...
```

---

## Correcao dos Dados Atuais

Redistribuir os itens existentes entre as bancadas:

```sql
-- Redistribuir itens que foram todos alocados na Bancada A
-- Metade vai para Bancada B
WITH numbered_items AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM order_items
  WHERE assigned_sector_id = '92e3f369-a599-4c7e-a0a0-29d8719c2161'
)
UPDATE order_items 
SET assigned_sector_id = 'bfbd6e97-509a-4597-94b8-84d907332472'
FROM numbered_items
WHERE order_items.id = numbered_items.id
  AND numbered_items.rn % 2 = 0;
```

---

## Resultado Esperado

| Cenario | Antes | Depois |
|---------|-------|--------|
| 10 itens sem setor | Todos na Bancada A | 5 na A, 5 na B |
| Novo pedido 3 itens | Nenhuma bancada ve | 2 na A, 1 na B (ou vice-versa) |

---

## Arquivos a Modificar

| Tipo | Arquivo/Recurso | Alteracao |
|------|-----------------|-----------|
| SQL | Migration | Criar funcao `distribute_unassigned_items` |
| SQL | Migration | Atualizar `create_order_items_from_json` para distribuir automaticamente |
| SQL | Query | Redistribuir itens atuais entre bancadas |

---

## Beneficios

- Carga de trabalho balanceada entre operadores
- Nenhum item fica "perdido" sem setor
- Funciona automaticamente para novos pedidos
- Admin pode sempre sobrescrever escolhendo setor especifico no simulador

