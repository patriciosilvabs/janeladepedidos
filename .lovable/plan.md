

## Correção: Pedido 6809 sem setor (não aparece nos tablets)

### Problema

O pedido 6809 (Karolina Archer) foi criado com sucesso, mas seu item tem `assigned_sector_id = NULL`. Sem setor atribuído, o item não aparece em nenhum tablet KDS.

### Causa raiz

A migration de idempotência (v1.0.15) substituiu a RPC `create_order_items_from_json` inteira, mas **perdeu a lógica de distribuição automática de setor** que existia na versão anterior.

A versão anterior (migration `20260208115107`) continha este bloco essencial:

```text
IF p_default_sector_id IS NULL THEN
  -- Busca o setor KDS online com menos itens pendentes
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
  
  -- Fallback: qualquer setor KDS (mesmo offline)
  IF v_sector_id IS NULL THEN
    SELECT s.id INTO v_sector_id FROM sectors s
    LEFT JOIN order_items oi ON ...
    WHERE s.view_type = 'kds' ...
    ORDER BY COUNT(oi.id) ASC LIMIT 1;
  END IF;
ELSE
  v_sector_id := p_default_sector_id;
END IF;
```

A versão substituida (idempotência) manteve apenas `v_sector_id := p_default_sector_id`, que e NULL. Resultado: todos os itens criados apos a v1.0.15 ficam sem setor.

### Solucao

**1. Restaurar a lógica de auto-distribuição na RPC `create_order_items_from_json`**

Recriar a RPC mantendo AMBOS: o guard de idempotência E a distribuição inteligente de setor. Trocar a linha `v_sector_id := p_default_sector_id` pela lógica completa de busca de setor online com fallback.

**2. Corrigir o pedido 6809 no banco**

Atribuir o item orfao do pedido 6809 a um setor KDS disponivel (BANCADA = PRODUCAO A ou B, com base em carga).

**3. Atualizar versao para v1.0.16**

### Detalhes tecnicos

**Migration SQL -- Alterar RPC `create_order_items_from_json`:**

Substituir o bloco `v_sector_id := p_default_sector_id` (que aparece uma vez, antes do loop de quantidades) pelo seguinte:

```text
-- Auto-distribute when no default sector provided
IF p_default_sector_id IS NULL THEN
  -- Try: least loaded ONLINE KDS sector (excluding edge sector)
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
  
  -- Fallback: any KDS sector (even offline)
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
```

**Correcao do pedido 6809:**

```text
UPDATE order_items 
SET assigned_sector_id = (
  SELECT s.id FROM sectors s
  LEFT JOIN order_items oi ON oi.assigned_sector_id = s.id AND oi.status IN ('pending', 'in_prep')
  WHERE s.view_type = 'kds' 
    AND s.id != (SELECT kds_edge_sector_id FROM app_settings WHERE id = 'default')
  GROUP BY s.id ORDER BY COUNT(oi.id) ASC LIMIT 1
)
WHERE order_id = 'c55c52a8-c1cc-4bd4-b35d-7b8bc2ada326'
  AND assigned_sector_id IS NULL;
```

### Impacto

- Restaura a distribuicao inteligente de carga entre bancadas
- Mantém o guard de idempotência contra duplicação
- O pedido 6809 aparecerá imediatamente no tablet apos a correção no banco
