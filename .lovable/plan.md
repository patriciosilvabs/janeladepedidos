

# Fix: Borda nao aparece em destaque

## Problema

Os campos `kds_edge_keywords` e `kds_flavor_keywords` na tabela `app_settings` estao com valor vazio (`''`) em vez de NULL. Isso quebra a classificacao de bordas e sabores:

- **SQL (create_order_items_from_json):** `COALESCE('', '#, Borda')` retorna `''` (string vazia NAO e NULL). Os arrays de keywords ficam vazios e TUDO vai para `complements`.
- **Edge function (explodeCombo.ts):** JavaScript trata corretamente (`'' || default`), mas so adiciona `_type` em opcoes com mapeamento no banco. Sem mapeamento, nao coloca `_type`.
- **Resultado:** Sem `_type` + sem keywords = tudo vira complemento. Borda, sabores, tudo misturado.

## Solucao (duas camadas de defesa)

### 1. Corrigir SQL: tratar string vazia como NULL
Na funcao `create_order_items_from_json`, trocar `COALESCE` por `COALESCE(NULLIF(..., ''), default)`:

```text
COALESCE(NULLIF(kds_edge_keywords, ''), '#, Borda')
COALESCE(NULLIF(kds_flavor_keywords, ''), '(G), (M), (P), Sabor')
```

Isso garante que strings vazias usem os defaults, igual ao JavaScript.

### 2. explodeCombo: sempre injetar _type (mesmo via keywords)
Atualmente o `_type` so e adicionado quando ha mapeamento no banco. Quando a classificacao e feita por keywords, o `_type` nao e setado, e o SQL fica "cego".

Adicionar `opt._type = 'edge'` / `opt._type = 'flavor'` / `opt._type = 'complement'` tambem no branch de keyword fallback do `explodeCombo.ts`.

## Impacto

- Pedidos NOVOS serao classificados corretamente (borda com tarja laranja, sabores em destaque)
- Pedidos ANTIGOS ja criados (como o 6861) precisariam ser reprocessados ou corrigidos manualmente no banco
- Nenhuma mudanca visual no frontend (KDSItemCard ja exibe `edge_type` e `flavors` corretamente)

## Detalhes Tecnicos

**Arquivos a modificar:**
- `supabase/functions/_shared/explodeCombo.ts` -- adicionar `opt._type` no branch de keywords (linhas 131-145)

**Migracao SQL:**
- Recriar `create_order_items_from_json` com `NULLIF` nos keywords

**Correcao de dados (pedido 6861):**
- UPDATE direto no `order_items` para separar edge_type e flavors do campo complements

