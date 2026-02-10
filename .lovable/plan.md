

## Melhoria da Sincronizacao com CardapioWeb: Classificacao Inteligente de Pizzas

### Diagnostico

Analisei os dados reais dos pedidos recentes e identifiquei que:

1. **Pedidos 6820 e 6821** (criados APOS a correcao): meio-a-meio detectado corretamente, 1 item cada. A correcao esta funcionando.
2. **Pedido 6819** (criado ANTES da correcao): dados legados com explosao incorreta - precisa ser reparado.
3. **Problema arquitetural**: a logica de explosao de combos existe DUPLICADA em dois lugares (poll-orders e webhook-orders) e precisa ser mantida em sincronia. Alem disso, a RPC `create_order_items_from_json` tambem tem sua propria logica de separacao de sabores, criando duas camadas que podem conflitar.

### Padroes reais do CardapioWeb identificados

Analisando os dados da API:

```text
CASO 1 - Pizza meio a meio (MESMA grupo):
  option_group_id: 956482 -> "1/2 Calabresa (G)", "1/2 Portuguesa (G)"
  Resultado correto: 1 item (JA FUNCIONA)

CASO 2 - Pizza meio a meio (GRUPOS diferentes no combo):
  option_group_id: 944283 -> "1/2 MARGUERITA (G)"
  option_group_id: 955201 -> "1/2 MARGUERITA (G)"
  Resultado correto: 1 item (JA FUNCIONA com allHalf)

CASO 3 - Combo 2 pizzas inteiras:
  option_group_id: 955409 -> "CALABRESA (G)"
  option_group_id: 955408 -> "MILHO VERDE (G)"
  Resultado correto: 2 itens (JA FUNCIONA)

CASO 4 - Combo misto (inteira + meio a meio):
  option_group_id: A -> "CALABRESA (G)"
  option_group_id: B -> "1/2 FRANGO (G)"
  option_group_id: C -> "1/2 MARGUERITA (G)"
  Resultado correto: 2 itens (inteira + meio a meio)
  Status: NAO TRATADO (allHalf=false -> explode em 3)
```

### Plano de Correcao

#### 1. Criar funcao compartilhada de classificacao

Extrair a logica `explodeComboItems` para um arquivo compartilhado (`supabase/functions/_shared/explodeCombo.ts`) para garantir que poll-orders e webhook-orders usem EXATAMENTE o mesmo codigo. Hoje sao copias independentes que podem divergir.

#### 2. Melhorar deteccao de meio-a-meio (smart grouping)

Em vez do `allHalf` (tudo-ou-nada), implementar agrupamento inteligente:

```text
Para cada grupo de sabores:
  - Se TODOS os sabores do grupo comecam com "1/2" -> marcar como "half-group"
  - Se NENHUM comeca com "1/2" -> marcar como "whole-group"

Depois, MESCLAR grupos adjacentes de "half" em uma unica "unidade pizza":
  - 2 half-groups consecutivos = 1 pizza meio a meio
  - 1 whole-group = 1 pizza inteira

Resultado: explodir por "unidade pizza", nao por option_group_id
```

Isso resolve o CASO 4 (combo misto) corretamente.

#### 3. Reparar dados legados do pedido 6819

Executar UPDATE para corrigir os itens explodidos incorretamente do pedido 6819 (deletar itens fragmentados e recriar usando a logica corrigida).

#### 4. Adicionar logging estruturado

Log detalhado com formato padrao para rastrear cada decisao de classificacao:

```text
[classify] "Combo: Pizza G + Refri 1L"
  -> 3 flavor groups: [half, half, whole]
  -> Merged: [half+half=1 pizza, whole=1 pizza]
  -> Result: 2 pizza units
```

#### 5. Atualizar versao para v1.0.20

### Detalhes tecnicos

**Arquivos modificados:**
- `supabase/functions/poll-orders/index.ts` - substituir explodeComboItems pela versao melhorada
- `supabase/functions/webhook-orders/index.ts` - mesma substituicao
- `src/lib/version.ts` - bump para v1.0.20

**Logica do smart grouping (pseudocodigo):**
```text
function explodeComboItems(items, edgeKeywords, flavorKeywords):
  for each item:
    classify options -> edges, flavors (by group), complements
    
    if <= 1 flavor group -> no explosion
    
    // Smart half detection per group
    pizzaUnits = []
    pendingHalves = []
    
    for each flavorGroup ordered by group_id:
      allGroupHalf = every flavor in group starts with "1/2"
      
      if allGroupHalf:
        pendingHalves.push(group)
        // Check if we have a pair of halves
        if pendingHalves has 2 groups:
          pizzaUnits.push(merge(pendingHalves))
          pendingHalves = []
      else:
        // Flush any unpaired halves as their own unit
        if pendingHalves.length > 0:
          pizzaUnits.push(merge(pendingHalves))
          pendingHalves = []
        pizzaUnits.push(group)  // whole pizza
    
    // Flush remaining halves
    if pendingHalves.length > 0:
      pizzaUnits.push(merge(pendingHalves))
    
    // Explode by pizza units (not by raw groups)
    create one item per pizza unit
```

**Migration SQL:** Nenhuma alteracao de schema necessaria. Apenas reparo de dados do pedido 6819.

