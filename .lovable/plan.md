

# Plano: Balanceamento Dinamico de Carga por Item

## Problema Identificado

A funcao `create_order_items_from_json` atualmente:

1. **Calcula o setor APENAS UMA VEZ** (linhas 30-51) antes de processar os itens
2. **Nao considera operadores online** - pode enviar para bancada vazia
3. **Todos os itens do pedido vao para o mesmo setor** independente da quantidade

### Resultado Atual
```
Pedido com 5 pizzas chega
    |
    v
Sistema verifica: "Bancada A tem 2 itens, Bancada B tem 3"
    |
    v
Escolhe Bancada A UMA VEZ
    |
    v
TODAS as 5 pizzas vao para Bancada A (agora com 7 itens!)
```

### Resultado Esperado
```
Pedido com 5 pizzas chega
    |
    v
Pizza 1: Bancada A (2 itens) -> A fica com 3
Pizza 2: Bancada B (3 itens) -> B fica com 4
Pizza 3: Bancada A (3 itens) -> A fica com 4
Pizza 4: Bancada A (4 itens) = B (4 itens) -> A fica com 5
Pizza 5: Bancada B (4 itens) -> B fica com 5
    |
    v
Distribuicao equilibrada: A=5, B=5
```

## Solucao Proposta

Modificar a funcao SQL `create_order_items_from_json` para:

1. **Recalcular o setor para CADA item** dentro do loop
2. **Filtrar apenas setores com operadores online**
3. **Fallback para setores offline** se nenhum operador estiver disponivel

## Mudancas no Banco de Dados

### Nova Versao da Funcao `create_order_items_from_json`

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Calculo do setor | 1x antes do loop | Nx dentro do loop |
| Considera presenca | Nao | Sim (last_seen_at > 30s) |
| Fallback | Primeiro setor KDS | Setor com menor carga (online ou offline) |

### Codigo da Nova Logica (dentro do loop, antes do INSERT)

```sql
-- NOVA LOGICA: Recalcular setor para cada item (balanceamento dinamico)
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
  
  -- Fallback: se nenhum operador online, usar qualquer setor KDS
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
END IF;
```

## Fluxo Pos-Mudanca

```
Pedido importado
     |
     v
Para cada item:
     |
     +--> Verificar setores com operadores online
     |         |
     |         +--> Ordenar por menor carga (pending + in_prep)
     |         |
     |         +--> Selecionar o primeiro (menor carga)
     |
     +--> Se nenhum online: fallback para qualquer setor KDS
     |
     +--> Inserir item com assigned_sector_id calculado
     |
     v
Proximo item (recalcula carga atualizada)
```

## Consideracoes Importantes

1. **Performance**: O recalculo por item adiciona queries, mas como pedidos tipicamente tem poucos itens (1-5), o impacto e minimo

2. **Consistencia**: Itens do mesmo pedido podem ir para bancadas diferentes - isso e intencional para balancear carga

3. **Itens com Borda**: Continuam indo para o setor de bordas primeiro, mas o `next_sector_id` tambem sera calculado dinamicamente

4. **Redistribuicao**: A funcao `redistribute_offline_sector_items` continua funcionando para quando operadores ficam offline apos a distribuicao inicial

## Arquivos a Modificar

| Arquivo | Tipo | Mudanca |
|---------|------|---------|
| Nova migration SQL | Database | Atualizar funcao `create_order_items_from_json` |

## Resultado Esperado

- Itens distribuidos proporcionalmente entre bancadas com operadores online
- Nenhuma bancada fica sobrecarregada enquanto outra esta ociosa
- Sistema continua funcionando mesmo sem operadores online (fallback)

