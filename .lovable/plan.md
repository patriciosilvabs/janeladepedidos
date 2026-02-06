

## Plano: Agrupar itens por pedido no Painel do Forno

### Problema atual

O painel do forno exibe cada item individualmente, sem contexto do pedido completo. Quando um pedido tem 3 pizzas, o operador de despacho nao sabe que precisa esperar todas ficarem prontas antes de embalar. Itens aparecem e somem independentemente.

### Solucao

Redesenhar o `OvenTimerPanel` para agrupar itens por pedido (order_id), mostrando um bloco unico por pedido com:

1. **Itens no forno** -- com timer e botao PRONTO individual
2. **Itens aguardando** (em preparo/pendentes no mesmo pedido) -- exibidos como "Aguardando..." com visual opaco/pulsante
3. **Botao PRONTO mestre** no topo do bloco do pedido -- so ativa quando TODOS os itens daquele pedido estiverem prontos individualmente

### Fluxo visual (referencia da imagem)

```text
+-----------------------------------------------+
| Forno (3)        #6386          [PRONTO mestre]|
+-----------------------------------------------+
| 1:17  #6386  Pizza Chocolate Branco  [PRONTO] |
|-----------------------------------------------|
|  Aguardando...  (opaco, pulsando fraco)        |
|-----------------------------------------------|
|  Aguardando...  (opaco, pulsando fraco)        |
+-----------------------------------------------+
```

### Alteracoes tecnicas

**Arquivo: `src/components/kds/OvenTimerPanel.tsx`**

1. **Buscar itens irmaos do mesmo pedido**: Alem de buscar `in_oven`, fazer uma query adicional para buscar TODOS os itens dos pedidos que possuem pelo menos um item no forno. Isso inclui itens com status `pending`, `in_prep` e `ready`.

2. **Criar componente `OrderOvenBlock`**: Novo componente que agrupa todos os itens de um pedido:
   - Header com numero do pedido, contagem de itens (badge), nome da loja e botao PRONTO mestre
   - Lista de itens no forno (com `OvenItemRow` existente e botao PRONTO individual)
   - Lista de itens aguardando (visual opaco, sem botao de acao)
   - Botao PRONTO mestre so habilita quando todos os itens do pedido no forno ja foram marcados como prontos individualmente (status `ready`)

3. **Logica do botao PRONTO mestre**:
   - Desabilitado enquanto houver pelo menos um item do pedido que NAO seja `ready`
   - Quando clicado, dispara a impressao do ticket de despacho (se configurado)
   - Serve como confirmacao final de que o pedido completo esta pronto para sair

4. **Itens "Aguardando..."**:
   - Exibidos abaixo dos itens no forno
   - Visual: borda tracejada, opacidade reduzida (opacity-40), animacao de pulse suave
   - Mostram o nome do produto e quantidade
   - Quando o item irmo entrar no forno (via realtime), ele automaticamente transiciona para `OvenItemRow` com timer

5. **Tracking de itens prontos localmente**: Manter um estado local `readyItems: Set<string>` para rastrear quais itens ja foram marcados como prontos pelo operador dentro do bloco. Quando o operador clica PRONTO em um item individual:
   - O item muda visualmente para "verde/confirmado" mas permanece no bloco
   - O item e adicionado ao set de prontos
   - Quando todos estao no set, o botao mestre ativa

**Arquivo: `src/hooks/useOrderItems.ts`**

6. **Nova query para itens irmaos**: Adicionar uma query ou expandir a existente para buscar todos os itens de pedidos que tenham pelo menos um item `in_oven`. Isso pode ser feito com uma query separada usando os `order_id`s dos itens no forno.

### Resultado esperado

- Operador de despacho ve cada pedido como um bloco unico
- Sabe exatamente quantos itens faltam (visuais "Aguardando...")
- So pode finalizar o pedido quando todas as pizzas estiverem prontas
- Impressao do ticket de despacho ocorre apenas ao clicar no botao mestre (evita imprimir parcialmente)

