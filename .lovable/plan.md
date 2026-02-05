

## Plano: Impressão Automática no Despacho

### Objetivo

Adicionar uma configuração para ativar/desativar a impressão automática quando um item é marcado como "PRONTO" no painel do forno (setor de despacho). Quando ativo, o sistema imprimirá automaticamente um ticket com as informações do item/pedido.

---

### Parte 1: Adicionar Campo de Configuração no Banco

**Migração SQL:**

```sql
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS printnode_dispatch_enabled boolean DEFAULT false;
```

Este campo controla especificamente se a impressão ocorre ao marcar itens como prontos no despacho.

---

### Parte 2: Atualizar Interface de Configurações

**Arquivo:** `src/hooks/useSettings.ts`

Adicionar o novo campo à interface `AppSettings`:
```typescript
printnode_dispatch_enabled: boolean;
```

**Arquivo:** `src/components/PrinterSettings.tsx`

Adicionar uma nova opção de switch na seção de configurações:
- Label: "Imprimir ao Marcar Pronto no Despacho"
- Descrição: "Quando ativo, um ticket será impresso automaticamente ao clicar em PRONTO no painel do forno"
- Comportamento: auto-save com debounce (mesmo padrão usado atualmente)

---

### Parte 3: Criar Função de Formatação do Ticket

**Novo arquivo:** `src/utils/printTicket.ts`

Função utilitária para gerar o conteúdo do ticket em texto simples:

```typescript
export function formatDispatchTicket(item: OrderItemWithOrder): string {
  // Retorna texto formatado com:
  // - Número do pedido
  // - Nome do cliente
  // - Endereço/bairro
  // - Nome do produto
  // - Quantidade
  // - Observações (se houver)
  // - Complementos (se houver)
  // - Borda (se houver)
  // - Sabores (se houver)
  // - Data/hora
}
```

---

### Parte 4: Integrar Impressão no OvenTimerPanel

**Arquivo:** `src/components/kds/OvenTimerPanel.tsx`

Modificações:

1. Importar `usePrintNode` e `useSettings`
2. Buscar configurações: `printnode_enabled`, `printnode_dispatch_enabled`, `printnode_printer_id`
3. Na função `handleMarkReady`:
   - Após marcar o item como pronto com sucesso
   - Verificar se `printnode_enabled && printnode_dispatch_enabled && printnode_printer_id`
   - Se ativo, chamar `printRaw()` com o ticket formatado

Fluxo:
```text
Clique PRONTO → markItemReady() → sucesso → verificar configs → printRaw()
```

---

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| **Migração SQL** | Adicionar coluna `printnode_dispatch_enabled` |
| `src/hooks/useSettings.ts` | Adicionar campo na interface |
| `src/components/PrinterSettings.tsx` | Adicionar switch de configuração |
| `src/utils/printTicket.ts` | Criar função de formatação do ticket |
| `src/components/kds/OvenTimerPanel.tsx` | Integrar chamada de impressão |

---

### Detalhes Técnicos

- A impressão é silenciosa (não bloqueia UI)
- Erros de impressão são logados mas não impedem o fluxo
- O ticket usa formato texto simples (compatível com impressoras térmicas)
- A configuração `printnode_enabled` é o "master switch" - precisa estar ativo para qualquer impressão funcionar
- A nova configuração `printnode_dispatch_enabled` controla especificamente a impressão no despacho

