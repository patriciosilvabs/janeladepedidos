

## Mover polling para o nível raiz da aplicação

### Problema

O polling de pedidos (`usePolling`) só é chamado dentro do componente `Dashboard` (aba "Despacho"). Quando o admin troca para "KDS Produção", o `Dashboard` é desmontado, o polling para, e nenhum pedido novo é importado do CardápioWeb.

### Solução

Mover a chamada do `usePolling` do `Dashboard.tsx` para o `Index.tsx` (componente raiz da página). Assim, o polling roda independente de qual aba está ativa.

### Mudanças

1. **`src/pages/Index.tsx`**
   - Importar `usePolling` 
   - Chamar `usePolling(20000)` no corpo do componente (ao lado dos outros hooks globais como `useAuth`, `useSettings`)

2. **`src/components/Dashboard.tsx`**
   - Remover o import e a chamada de `usePolling`
   - Remover referências a `isPolling`, `lastSync`, `pollingEnabled`, `manualPoll` do Dashboard (se usadas apenas para exibição de status de sincronização, mover essa UI para o Header ou manter como props vindas do Index)

3. **`src/lib/version.ts`** - Bump para `v1.0.6`

### Detalhes técnicos

No `Index.tsx`, adicionar logo abaixo dos hooks existentes:

```text
const { isPolling, lastSync, isEnabled: pollingEnabled, manualPoll } = usePolling(20000);
```

No `Dashboard.tsx`, verificar se `isPolling`, `lastSync`, `manualPoll` são usados na UI do Dashboard (ex: botão de sincronizar manual, indicador de última sincronização). Se sim, passar como props do Index para o Dashboard. Se não, apenas remover.

Isso garante que basta o sistema estar aberto para os pedidos fluírem, independente da aba ativa.
