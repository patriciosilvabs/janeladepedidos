

## Corrigir itens simples sendo engolidos pela pos-explosao de combo

### Problema

Itens sem opcoes (como "Domzitos de chocolate preto e coco ralado") sao removidos da lista final pela logica de "pos-explosao" no `explodeComboItems`. Essa logica foi criada para mesclar itens residuais (como bebidas dentro de combos) de volta no item principal, mas esta afetando itens completamente independentes.

O trecho problematico (linhas 100-125 do `poll-orders/index.ts`):

```text
for (const ri of result) {
  const hasFlavor = opts.some(...);
  const hasEdge = opts.some(...);

  if (!hasFlavor && !hasEdge && finalResult.length > 0) {
    pendingComplements.push(...opts);  // <-- ENGOLE o item
  } else {
    finalResult.push(ri);
  }
}
```

Como "Domzitos" nao tem opcoes, `hasFlavor` e `hasEdge` sao ambos `false`, e como `finalResult` ja tem a pizza, o Domzitos e descartado -- suas opcoes (vazias) sao "mescladas" e o item desaparece completamente.

### Solucao

Modificar a logica de pos-explosao para **nunca engolir itens que possuem `item_id` diferente** do item que foi explodido. O merge so deve ocorrer entre fragmentos do **mesmo combo/produto original**.

Para isso, vamos rastrear o `item_id` de origem em cada item e so aplicar o merge quando os itens compartilham o mesmo `item_id`.

### Mudancas tecnicas

**1. `supabase/functions/poll-orders/index.ts` (funcao `explodeComboItems`)**

Na explosao (linhas 78-95), marcar cada item gerado com `_source_item_id`:

```text
result.push({
  ...item,
  quantity: 1,
  options: newOptions,
  observation: index === 0 ? item.observation : null,
  _source_item_id: item.item_id || item.name,  // rastrear origem
});
```

Itens que nao sao explodidos (passam direto) tambem recebem a marcacao:

```text
result.push({ ...item, _source_item_id: item.item_id || item.name });
```

Na pos-explosao (linhas 100-125), mudar a condicao para comparar o `_source_item_id`:

```text
for (const ri of result) {
  const opts = ri.options || [];
  const hasFlavor = opts.some(...);
  const hasEdge = opts.some(...);
  const sourceId = ri._source_item_id;

  // So mescla se: (1) nao tem sabor/borda, (2) ja existe resultado,
  // E (3) pertence ao mesmo produto de origem
  if (!hasFlavor && !hasEdge && finalResult.length > 0 
      && finalResult[finalResult.length - 1]._source_item_id === sourceId) {
    pendingComplements.push(...opts);
  } else {
    finalResult.push(ri);
  }
}
```

Antes de retornar, limpar a propriedade temporaria:

```text
return finalResult.map(({ _source_item_id, ...rest }) => rest);
```

**2. `supabase/functions/webhook-orders/index.ts`** - Aplicar a mesma correcao (funcao duplicada)

**3. `src/lib/version.ts`** - Bump para `v1.0.8`

### Impacto

- Itens independentes como "Domzitos" passam a ser preservados corretamente
- A logica de merge continua funcionando para combos reais (bebida dentro de combo pizza)
- Nenhuma alteracao no banco de dados necessaria

### Teste

Apos deploy, o proximo ciclo de polling vai detectar que o pedido 6760 tem 1/2 itens e reparar automaticamente, criando o Domzitos corretamente.

