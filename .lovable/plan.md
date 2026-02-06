
## Plano: Separar visualizacao de itens unicos vs pedidos com multiplos itens no Forno

### Problema atual

Todos os pedidos no painel do forno sao exibidos dentro de um `OrderOvenBlock` com cabecalho de pedido, contador de itens e botao "DESPACHAR". Isso e desnecessario para pedidos com apenas 1 pizza -- eles devem aparecer de forma simples, mostrando apenas o sabor com timer e o botao "PRONTO" ao lado.

### Comportamento desejado

- **Pedido com 1 item no forno (sem siblings pendentes):** Exibe apenas o `OvenItemRow` simples -- timer, nome/sabor e botao "PRONTO". Sem cabecalho de pedido, sem bloco agrupado, sem botao "DESPACHAR".
- **Pedido com 2+ itens (no forno + siblings):** Mantem o `OrderOvenBlock` atual com cabecalho, contador e botao "DESPACHAR".

### Alteracao

**Arquivo: `src/components/kds/OvenTimerPanel.tsx`**

Na renderizacao dos `orderGroups`, verificar o total de itens do pedido (oven + siblings). Se o pedido tiver apenas 1 item no forno E nenhum sibling pendente/ready, renderizar diretamente o `OvenItemRow` avulso. Caso contrario, renderizar o `OrderOvenBlock` como hoje.

Logica:

```text
Para cada grupo de pedido:
  totalItens = ovenItems.length + siblingItems.length
  Se totalItens == 1:
    Renderizar OvenItemRow simples (timer + sabor + botao PRONTO)
  Senao:
    Renderizar OrderOvenBlock (cabecalho + DESPACHAR)
```

### Detalhes tecnicos

- Apenas o arquivo `OvenTimerPanel.tsx` precisa ser alterado (linhas 145-159)
- O `OvenItemRow` ja tem toda a logica de timer, botao PRONTO e marcacao de ready -- basta renderiza-lo diretamente
- O `handleMarkItemReady` ja funciona de forma independente para cada item
- Nenhuma alteracao em `OrderOvenBlock.tsx` ou `OvenItemRow.tsx`
