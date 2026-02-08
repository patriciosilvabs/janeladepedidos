

# Desmembrar Combos em Pizzas Individuais no KDS

## Problema

A funcao `create_order_items_from_json` so desmembra itens quando `quantity > 1`. Porem, combos como "3 Pizzas G + Refri" chegam com `quantity: 1` e 3 sabores dentro. O resultado e 1 unico card no KDS contendo 3 pizzas, quando deveria ser 3 cards individuais (1 por pizza).

## Solucao

Alterar a funcao SQL `create_order_items_from_json` para detectar quando um item tem multiplos sabores e criar um registro separado para cada sabor. Cada registro mantera a borda correspondente (se houver) e os complementos serao atribuidos apenas ao primeiro item para evitar duplicacao.

## Logica de Desmembramento

```text
ANTES (hoje):
+------------------------------------------+
| Combo: 3 Pizzas G + Refri               |
| Sabores: BAURU, CALABRESA ACE, CALABRESA |
| Bordas: Cheddar, Cream Cheese, Catupiry  |
| Complementos: 2x Refri 1L               |
+------------------------------------------+
          (1 card no KDS)

DEPOIS (proposto):
+-------------------------+  +-------------------------+  +-------------------------+
| Combo: 3 Pizzas G+Refri|  | Combo: 3 Pizzas G+Refri|  | Combo: 3 Pizzas G+Refri|
| Sabor: BAURU (G)        |  | Sabor: CALABRESA ACE(G)|  | Sabor: CALABRESA (G)   |
| Borda: Cheddar          |  | Borda: Cream Cheese     |  | Borda: Catupiry        |
| Complementos: 2x Refri  |  |                         |  |                        |
+-------------------------+  +-------------------------+  +-------------------------+
          (3 cards no KDS - 1 por pizza)
```

## Detalhes Tecnicos

### 1. Migracao SQL - Atualizar `create_order_items_from_json`

Apos coletar os sabores e bordas (como ja e feito hoje), adicionar logica:

- Contar o numero de sabores (`v_flavor_count`) baseado nas quebras de linha no campo `v_flavors`
- Se `v_flavor_count > 1`: criar N registros (1 por sabor), distribuindo as bordas correspondentes (1a borda para 1o sabor, 2a para 2o, etc.)
- Se `v_flavor_count <= 1`: manter comportamento atual (1 registro por item, multiplicado pelo `quantity`)
- Complementos e observacoes sao atribuidos apenas ao primeiro registro do grupo para nao duplicar informacao
- O nome do produto se mantem o mesmo em todos os registros do grupo, para manter a rastreabilidade do combo original
- Cada registro individual passa pelo mesmo balanceamento de setor que ja existe

### 2. Pareamento Borda-Sabor

As bordas e sabores sao coletados na mesma ordem em que aparecem no JSON de options. A logica de pareamento:

- Converter `v_flavors` e `v_edge_type` em arrays usando quebra de linha como separador
- Para cada indice i: sabor[i] casa com borda[i] (se existir)
- Se ha menos bordas que sabores, os sabores extras ficam sem borda
- Se ha menos sabores que bordas, as bordas extras vao no ultimo sabor

### 3. Balanceamento de Carga

Cada pizza individual criada pelo desmembramento passa pelo algoritmo de balanceamento existente. Isso significa que as 3 pizzas de um combo podem ser distribuidas para setores diferentes (PRODUCAO A, PRODUCAO B), maximizando o paralelismo.

### 4. Impacto no Despacho

O painel de despacho ja agrupa itens por `order_id`, entao as 3 pizzas continuarao aparecendo juntas no momento da expedicao, mesmo sendo produzidas em setores diferentes.

## Arquivos Afetados

- **Nova migracao SQL**: Atualizar funcao `create_order_items_from_json` com logica de desmembramento por sabor
- Nenhuma alteracao no frontend necessaria - o modo "Por Item" ja trata cada registro como um card individual

## Consideracoes

- Pedidos ja existentes no banco (como o #6592) nao serao afetados retroativamente. Apenas novos pedidos passarao pela nova logica
- O pedido #6592 atual pode ser redistribuido manualmente se necessario

