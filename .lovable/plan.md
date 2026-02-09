

## Renomear tela principal e remover coluna "Em Producao"

### Resumo

1. Renomear "Buffer Logistico" para **Central de Pedidos** no header
2. Remover a coluna "Em Producao" do Dashboard (redundante com as bancadas KDS)
3. O Dashboard passa a ter **3 colunas**: Buffer de Espera, Pedido Pronto, Despachados
4. Atualizar versao para `v1.0.10`

### Detalhes das mudancas

**`src/components/Header.tsx`**
- Trocar "Buffer Logistico" por "Central de Pedidos"
- Trocar subtitulo "Agrupamento inteligente de entregas" por "Gestao centralizada de pedidos" (ou similar)

**`src/components/Dashboard.tsx`**
- Remover a coluna "Em Producao" (pendingOrders) do grid
- Alterar o grid de `md:grid-cols-4` para `md:grid-cols-3`
- Manter o filtro `pendingOrders` internamente (usado no calculo do buffer dinamico)
- Remover o import de `ChefHat` (nao sera mais usado nessa tela)

**`src/lib/version.ts`**
- Atualizar de `v1.0.9` para `v1.0.10`

### O que NAO muda

- As bancadas KDS continuam exibindo os itens pendentes normalmente
- O OvenTimerPanel (painel do forno) continua aparecendo no topo do Dashboard
- A logica de buffer, ready e dispatch permanece identica
- Os calculos de buffer dinamico continuam usando `pendingOrders.length`

