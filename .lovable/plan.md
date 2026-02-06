

## Plano: Filtro de Tipos de Pedido por Loja + Conferencia de Sabores no Despacho

---

### Funcionalidade 1: Configuracao de Tipos de Pedido por Loja

Cada loja podera escolher quais tipos de pedido devem ser importados para o sistema (delivery, retirada, mesa, balcao). Pedidos de tipos nao habilitados serao ignorados.

#### 1.1 Migracao SQL

Adicionar coluna na tabela `stores`:

```sql
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS allowed_order_types text[] DEFAULT ARRAY['delivery', 'takeaway', 'dine_in', 'counter'];
```

Por padrao, todos os tipos sao permitidos (compatibilidade retroativa).

#### 1.2 Interface - StoresManager

No dialogo de criar/editar loja, adicionar uma secao "Tipos de Pedido Aceitos" com 4 checkboxes:

- Delivery (delivery)
- Retirada (takeaway)
- Mesa (dine_in)
- Balcao (counter)

#### 1.3 Edge Functions - Filtragem

**webhook-orders:** Apos identificar a loja pelo token, verificar se o `order_type` mapeado esta na lista `allowed_order_types` da loja. Se nao estiver, ignorar o pedido com log.

**poll-orders:** Ao iterar os pedidos retornados pela API, verificar o tipo contra a lista da loja antes de inserir.

#### 1.4 Hook useStores

Atualizar a interface `Store` e `StoreInsert` para incluir `allowed_order_types: string[]`.

---

### Funcionalidade 2: Conferencia de Sabores no Painel do Forno

No painel de despacho, cada item que possui sabores exibira a lista de sabores com botoes individuais de confirmacao. O operador so podera marcar "PRONTO" apos conferir todos os sabores.

#### 2.1 Modificar OvenItemRow

Exibir os sabores do item (campo `flavors` da tabela `order_items`) parseados da string:

```text
Formato atual: "* Sabor 1\n* Sabor 2\n* Sabor 3"
```

Cada sabor aparecera como um botao/chip que o operador clica para confirmar a conferencia.

#### 2.2 Estado de Conferencia (local)

Estado local no componente `OvenItemRow`:

```typescript
const [confirmedFlavors, setConfirmedFlavors] = useState<Set<number>>(new Set());

// Parsear sabores
const flavorsList = item.flavors
  ?.split('\n')
  .map(f => f.replace(/^[*\-]\s*/, '').trim())
  .filter(Boolean) || [];

// Botao PRONTO bloqueado ate todos confirmados
const allFlavorsConfirmed = flavorsList.length === 0 || confirmedFlavors.size >= flavorsList.length;
```

#### 2.3 Visual

Cada sabor aparece como um botao:
- **Nao conferido:** fundo cinza/outline, texto normal
- **Conferido:** fundo verde, icone de check

O botao "PRONTO" fica desabilitado (opaco) ate que todos os sabores estejam confirmados.

Layout expandido do OvenItemRow:

```text
[Timer]  #5130  Loja Centro
         Pizza Grande
         [* Calabresa]  [* Mussarela]  [v Frango]   <-- botoes de sabor
                                        [PRONTO]
```

---

### Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| **Migracao SQL** | Adicionar `allowed_order_types` na tabela `stores` |
| `src/hooks/useStores.ts` | Adicionar campo na interface |
| `src/components/StoresManager.tsx` | Adicionar checkboxes de tipos de pedido |
| `supabase/functions/webhook-orders/index.ts` | Filtrar por tipos permitidos da loja |
| `supabase/functions/poll-orders/index.ts` | Filtrar por tipos permitidos da loja |
| `src/components/kds/OvenTimerPanel.tsx` | Exibir sabores com botoes de conferencia |

---

### Detalhes Tecnicos

- A coluna `allowed_order_types` usa array de texto nativo do PostgreSQL
- A conferencia de sabores e 100% local (sem persistencia no banco) - serve apenas como checklist visual para o operador
- A filtragem de tipos acontece nas edge functions (server-side), pedidos ignorados nao entram no banco
- Compatibilidade retroativa: lojas existentes recebem todos os tipos habilitados por padrao

