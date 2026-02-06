

## Plano: Categorias de Produtos por Loja

### Objetivo

Permitir que cada loja configure quais categorias de produto (pizza, bebida, sobremesa, etc.) devem ser exibidas no tablet/KDS. Itens de categorias nao habilitadas serao ignorados na importacao.

---

### Parte 1: Migracao SQL

Duas alteracoes no banco:

1. **Adicionar coluna `category` na tabela `order_items`** para armazenar a categoria do item importado:

```sql
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS category text;
```

2. **Adicionar coluna `allowed_categories` na tabela `stores`** para configurar as categorias permitidas por loja:

```sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS allowed_categories text[] DEFAULT NULL;
```

Quando `NULL`, todas as categorias sao aceitas (compatibilidade retroativa).

---

### Parte 2: Capturar Categoria na Importacao

**Arquivos:** `supabase/functions/webhook-orders/index.ts` e `supabase/functions/poll-orders/index.ts`

- Adicionar campo `category` (ou `category_name`) na interface de item do CardapioWeb
- Passar a categoria no JSON enviado para a RPC `create_order_items_from_json`

**Arquivo:** Migracao SQL (atualizar a funcao `create_order_items_from_json`)

- Extrair o campo `category` de cada item do JSON
- Inserir na coluna `category` da tabela `order_items`

---

### Parte 3: Filtrar por Categorias Permitidas

Na funcao `create_order_items_from_json`, antes de inserir cada item:

- Receber o `store_id` como parametro (novo parametro `p_store_id`)
- Buscar `allowed_categories` da loja
- Se a lista nao for nula e a categoria do item nao estiver na lista, pular o item

Alternativamente, o filtro pode ser feito nas edge functions antes de chamar a RPC, o que e mais simples:

```typescript
// Filtrar itens por categorias permitidas da loja
const allowedCategories = store.allowed_categories;
const filteredItems = allowedCategories 
  ? items.filter(item => {
      const cat = (item.category || '').toLowerCase();
      return allowedCategories.some(c => c.toLowerCase() === cat);
    })
  : items;
```

---

### Parte 4: Interface - StoresManager

No dialogo de criar/editar loja, adicionar uma secao "Categorias Exibidas no Tablet":

- Campo de texto com tags/chips para adicionar categorias (ex: Pizza, Bebida, Sobremesa, Lanche)
- Botao para adicionar novas categorias
- Quando vazio/nulo, significa "todas as categorias" (exibir indicador visual)
- Sugestoes de categorias comuns pre-definidas para facilitar

O campo sera editavel como uma lista de tags com opcao de adicionar novas.

---

### Parte 5: Hook useStores

Atualizar as interfaces `Store` e `StoreInsert` para incluir:

```typescript
allowed_categories: string[] | null;
```

---

### Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| **Migracao SQL** | Adicionar `category` em `order_items` e `allowed_categories` em `stores` |
| **Migracao SQL** | Atualizar `create_order_items_from_json` para salvar categoria |
| `src/hooks/useStores.ts` | Adicionar campo na interface |
| `src/components/StoresManager.tsx` | Adicionar UI de categorias com tags/chips |
| `supabase/functions/webhook-orders/index.ts` | Capturar categoria do item e filtrar |
| `supabase/functions/poll-orders/index.ts` | Capturar categoria do item e filtrar |

---

### Detalhes Tecnicos

- A coluna `allowed_categories` usa `NULL` como default (aceita tudo) em vez de array vazio, para nao quebrar lojas existentes
- A categoria e salva em lowercase normalizado para comparacao case-insensitive
- O filtro acontece na edge function (server-side) antes de chamar a RPC
- Categorias sao strings livres -- o usuario digita o nome exato que vem da API do CardapioWeb
- Sugestoes pre-definidas: "Pizza", "Bebida", "Sobremesa", "Lanche", "Porcao", "Combo", "Acai"

