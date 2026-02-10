

## Correcao: Duplicacao de itens pelo auto-repair

### Problema identificado

O mecanismo de **auto-repair** no `poll-orders` esta criando itens duplicados. A causa raiz:

1. Um pedido e importado com 2 itens no JSON original (ex: 2 pizzas meio a meio)
2. Os itens sao criados corretamente no `order_items` (2 registros, meio a meio detectado)
3. Os operadores processam os itens (status muda para `in_prep`, `in_oven`, `ready`)
4. No proximo ciclo de polling, o auto-repair compara: `actualCount (2) < expectedCount (2)` -- OK, nao repara
5. **Porem**, quando um item e deletado ou ha uma inconsistencia momentanea, o repair dispara
6. O repair tenta deletar apenas itens com status `pending`, mas os itens ja estao em `ready`/`in_prep` -- **nao deleta nada**
7. O repair cria novos itens em cima dos existentes -- **duplicacao**

Dados reais encontrados no banco:
- Renato Santos (pedido 6790): 2 itens no JSON, 4 no banco (duplicado)
- Ana Regina (pedido 9688): 2 itens no JSON, 14 no banco (7x duplicado!)
- Ju Freitas (pedido 6789): 2 itens no JSON, 2 no banco (OK)

### Solucao

**1. Corrigir o auto-repair no `poll-orders/index.ts`**

Alterar a logica de repair para:
- Comparar `actualCount` contra o resultado **pos-explosao** (nao contra o JSON original)
- OU simplesmente pular o repair quando `actualCount >= expectedCount` pos-explosao
- Remover a restricao `.in('status', ['pending'])` na exclusao -- se vai reparar, deve limpar tudo ou nao reparar

Abordagem escolhida: calcular o `expectedCount` APOS a explosao de combos, nao antes. Assim, se o pedido tem 2 items no JSON mas apos explosao gera 3, o repair so dispara se `actualCount < 3`.

Alem disso, quando o repair deletar itens, deve deletar **todos** os itens do pedido (nao apenas `pending`), ou melhor, **nao disparar o repair se o pedido ja tem itens nao-pending** (itens ja estao sendo processados pelos operadores).

**Regra final**: Se existem itens com status diferente de `pending` (ou seja, ja estao sendo trabalhados), o repair NAO deve executar. Isso evita interferir no trabalho dos operadores.

**2. Aplicar a mesma correcao no `webhook-orders/index.ts`** (se houver logica de repair similar)

**3. Limpar duplicatas existentes no banco**

Executar uma query SQL para remover os itens duplicados que ja foram criados, mantendo apenas o mais antigo de cada grupo.

### Detalhes tecnicos

**`supabase/functions/poll-orders/index.ts` (linhas ~496-586)**

Alterar a secao de auto-repair para:

```text
// Antes de verificar repair, checar se ha itens nao-pending
const { data: nonPendingItems } = await supabase
  .from('order_items')
  .select('id')
  .eq('order_id', order.id)
  .neq('status', 'pending')
  .limit(1);

// Se existem itens ja em processamento, NAO reparar
if (nonPendingItems && nonPendingItems.length > 0) {
  // Skip repair - items already being worked on
  continue; // (pula para verificacao de status)
}
```

Isso garante que o repair so executa quando TODOS os itens ainda estao `pending` (ou nao existem), evitando duplicacao.

**Limpeza de dados existentes** (migration SQL):

Remover itens duplicados mantendo apenas o registro mais antigo de cada `(order_id, product_name, flavors)`.

**`src/lib/version.ts`**

Atualizar para `v1.0.13`.

