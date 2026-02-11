

# Corrigir: SQL function ignorando mapeamento de grupos

## Problema

O fluxo de classificacao tem **duas camadas**:

1. **explodeCombo.ts** (TypeScript, edge function) — ja usa o mapeamento hibrido corretamente. Cada option recebe uma tag `_type` (edge/flavor/complement) baseada no `store_option_group_mappings`.

2. **create_order_items_from_json** (SQL, PostgreSQL) — classifica as options usando **apenas keywords** (`kds_edge_keywords`, `kds_flavor_keywords`). Ignora completamente a tag `_type` que o explodeCombo ja adicionou.

Resultado: mesmo com os mapeamentos cadastrados, a tarja laranja de "Borda" nao aparece porque o SQL re-classifica tudo por keywords e nao encontra match (ex: "Borda de Cheddar" so funciona se "Borda" estiver nas keywords).

## Solucao

Atualizar a funcao SQL `create_order_items_from_json` para **checar `_type` primeiro** e so usar keywords como fallback.

## Detalhes Tecnicos

**Migracao SQL** — alterar a logica de classificacao dentro do loop de options (linhas 88-125 da funcao atual):

Antes:
```text
v_is_edge := false;
v_is_flavor := false;
-- percorre keywords para classificar
```

Depois:
```text
v_is_edge := false;
v_is_flavor := false;

-- 1) Checar tag _type do mapeamento hibrido (prioridade)
IF v_option->>'_type' = 'edge' THEN
  v_is_edge := true;
ELSIF v_option->>'_type' = 'flavor' THEN
  v_is_flavor := true;
ELSIF v_option->>'_type' = 'complement' THEN
  -- nada, vai cair em complemento
ELSE
  -- 2) Fallback: keywords (comportamento atual)
  ... (logica existente de keywords)
END IF;
```

Isso garante que quando o `explodeCombo.ts` ja classificou a option via mapeamento, o SQL respeita essa decisao. Quando nao ha tag `_type` (pedidos antigos ou sem mapeamento), o fallback de keywords continua funcionando normalmente.

**Nenhuma mudanca em arquivos TypeScript** — o `explodeCombo.ts` ja injeta `_type` corretamente.

