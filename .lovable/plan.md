

# Corrigir: Buscar todos os grupos de opções (não apenas 20 pedidos)

## Problema
A edge function `fetch-store-option-groups` analisa apenas os **primeiros 20 pedidos** para extrair grupos de opções. Isso faz com que grupos que nao apareceram nesses 20 pedidos nao sejam encontrados.

A API do CardápioWeb retorna dezenas de pedidos (46-51 por loja conforme os logs), e cada pedido pode ter diferentes combinacoes de grupos.

## Solucao

Alterar a edge function para processar **todos os pedidos** retornados pela API (nao apenas 20), e buscar os detalhes em paralelo para ser mais rapido.

## Detalhes Tecnicos

**Arquivo:** `supabase/functions/fetch-store-option-groups/index.ts`

1. Remover o limite de 20 pedidos (`orders.slice(0, 20)`) e processar todos
2. Buscar detalhes em lotes paralelos (5 de cada vez) em vez de sequencialmente, para nao demorar muito
3. Adicionar log da quantidade total de pedidos processados

### Mudanca principal
```text
ANTES: const ordersToCheck = orders.slice(0, 20);  // max 20
DEPOIS: processar TODOS os pedidos, em lotes de 5 em paralelo
```

### Impacto
- A funcao vai demorar um pouco mais (segundos a mais), mas vai encontrar todos os grupos de opcoes existentes
- O processamento paralelo (5 por vez) evita sobrecarregar a API do CardápioWeb

