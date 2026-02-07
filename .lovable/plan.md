

## Melhorias nos itens "Aguardando..." no Painel do Forno

### Problema
Na seção de itens aguardando dentro do bloco de pedido no Painel do Forno, aparece apenas o nome da categoria (ex: "Pizza Grande - 1 Sabor"), sem mostrar o sabor. O funcionário precisa ver qual pizza está aguardando para poder conferir. Além disso, o texto "Aguardando..." precisa ser mais visível (maior e piscando).

### Alterações

**`src/components/kds/OrderOvenBlock.tsx`** (linhas 174-198)

Na seção de `waitingItems`, fazer duas mudanças:

1. **Exibir os sabores** abaixo do nome do produto, usando a mesma lógica de parse de `item.flavors` já usada no `OvenItemRow` (split por `\n`, limpar bullets). Mostrar como badges/chips igual ao item no forno.

2. **Destacar o "Aguardando..."**: aumentar o tamanho do texto para `text-base font-semibold` e adicionar a classe `animate-pulse` especificamente nele (mantendo a opacidade reduzida do container mas com o texto "Aguardando..." pulsando de forma mais evidente).

### Detalhes visuais

- Sabores aparecem como badges abaixo do nome do produto (mesma formatação do `OvenItemRow`)
- "Aguardando..." fica com fonte maior (`text-base`) e bold, pulsando (`animate-pulse`)
- O container mantém a borda tracejada e opacidade reduzida para diferenciar dos itens no forno

