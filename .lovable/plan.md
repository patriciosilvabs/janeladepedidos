

## Correção: Fluxo de roteamento invertido (BORDAS → PRODUÇÃO)

### Problema

A lógica na RPC `create_order_items_from_json` está com o roteamento invertido. Itens com borda estão indo primeiro para a PRODUÇÃO e depois para BORDAS, quando o fluxo correto é:

**BORDAS → PRODUÇÃO (distribuição) → FORNO (despacho)**

### Causa raiz

No código atual da RPC, quando um item tem borda (`v_has_edge = true`):

```text
-- Código atual (ERRADO):
IF v_has_edge AND v_edge_sector_id IS NOT NULL THEN
  v_next_sector_id := v_edge_sector_id;  -- próximo = BORDAS (errado!)
END IF;
-- assigned_sector_id = v_sector_id (PRODUÇÃO) -- item começa na PRODUÇÃO
```

O item é atribuído à PRODUÇÃO (`assigned_sector_id`) e o próximo setor é BORDAS (`next_sector_id`). Isso é o oposto do fluxo correto.

### Solução

Inverter a lógica: quando tem borda, o item deve **começar** em BORDAS e depois ir para PRODUÇÃO.

```text
-- Código corrigido:
IF v_has_edge AND v_edge_sector_id IS NOT NULL THEN
  v_next_sector_id := v_sector_id;        -- próximo = PRODUÇÃO (correto!)
  v_sector_id := v_edge_sector_id;        -- começa em BORDAS (correto!)
END IF;
```

### Reparo de dados existentes

Corrigir itens pendentes que estão com roteamento invertido (na PRODUÇÃO com `next_sector_id` apontando para BORDAS):

```text
UPDATE order_items
SET assigned_sector_id = next_sector_id,
    next_sector_id = assigned_sector_id
WHERE next_sector_id = '42470e75-5c62-438d-9a7e-31c6f57f4a30'  -- BORDAS
  AND assigned_sector_id != '42470e75-5c62-438d-9a7e-31c6f57f4a30'
  AND status IN ('pending', 'in_prep');
```

### Passos

1. Migration SQL para corrigir a RPC (inverter `v_sector_id` e `v_next_sector_id`)
2. UPDATE para corrigir itens pendentes com roteamento invertido
3. Atualizar versao para v1.0.18

### Detalhes tecnicos

**Alteracao na RPC** (1 bloco):

Trocar:
```text
IF v_has_edge AND v_edge_sector_id IS NOT NULL THEN
  v_next_sector_id := v_edge_sector_id;
END IF;
```

Por:
```text
IF v_has_edge AND v_edge_sector_id IS NOT NULL THEN
  v_next_sector_id := v_sector_id;
  v_sector_id := v_edge_sector_id;
END IF;
```

Isso garante que `assigned_sector_id = BORDAS` (primeiro destino) e `next_sector_id = PRODUCAO` (destino apos preparo da borda).

