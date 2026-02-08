
# Corrigir filtro de categorias que permite bebidas no tablet

## Problema identificado

O filtro de categorias **nao funciona** porque todos os itens estao com `category = null` no banco de dados. Isso acontece por dois motivos:

1. **A API do CardapioWeb nao retorna `category` nem `category_name` nos itens** - o mapeamento atual (`item.category || item.category_name || ''`) nunca encontra esses campos, resultando em string vazia.
2. **A logica do filtro deixa passar itens sem categoria**: a condicao `return !cat || allowedCategories.some(...)` significa "se nao tem categoria, aceita o item". Entao TODOS os itens passam.

## Solucao

### 1. Extrair categoria da API do CardapioWeb corretamente

Os itens da API do CardapioWeb geralmente vem com um campo `group` ou similar que indica a categoria do produto. Vamos adicionar logs detalhados para capturar a estrutura real dos itens e tambem tentar extrair de campos alternativos como `group`, `group_name`, `type`, etc.

### 2. Inverter a logica do filtro

Quando `allowed_categories` esta configurado, itens SEM categoria devem ser **bloqueados** (nao aceitos). A logica correta e:

```
Antes:  return !cat || allowedCategories.some(c => c.toLowerCase() === cat)
Depois: return cat && allowedCategories.some(c => cat.includes(c.toLowerCase()))
```

Alem disso, usar `includes` em vez de igualdade exata para que "Bebida" capture "Bebidas", e a categoria "Pizza" capture "Pizzas Especiais", etc.

### 3. Adicionar logs para diagnosticar os campos da API

Inserir um log que mostre as chaves de cada item retornado pela API, para que possamos identificar o campo correto de categoria.

## Arquivos a alterar

### `supabase/functions/poll-orders/index.ts`

- Linhas 291-306: Adicionar log das chaves dos itens, expandir mapeamento de categoria para incluir `group`, `group_name`, `type`, e inverter logica do filtro.

### `supabase/functions/webhook-orders/index.ts`

- Linhas 210-227: Mesma correcao no webhook.
- Linhas 366-374: Corrigir mapeamento na funcao de parse tambem.

## Detalhes tecnicos da mudanca

Mapeamento expandido de categoria:
```typescript
category: item.category || item.category_name || item.group || item.group_name || item.type || '',
```

Nova logica de filtro (ambos os arquivos):
```typescript
itemsToCreate = itemsToCreate.filter(item => {
  const cat = (item.category || '').toLowerCase();
  // Se o item nao tem categoria e ha filtro ativo, bloquear
  if (!cat) return false;
  // Verificar se a categoria contem alguma das permitidas (match parcial)
  return allowedCategories.some(c => cat.includes(c.toLowerCase()));
});
```

Log de diagnostico (temporario, para identificar o campo correto):
```typescript
if (orderDetails.items?.[0]) {
  console.log(`[poll-orders] Item keys sample:`, Object.keys(orderDetails.items[0]));
  console.log(`[poll-orders] First item raw:`, JSON.stringify(orderDetails.items[0]).substring(0, 500));
}
```
