

# Corrigir: Mapeamentos replicando entre lojas

## Problema
Ao cadastrar mapeamentos em uma loja, os mesmos codigos sao salvos tambem na outra loja. Atualmente existem 72 mapeamentos duplicados entre as duas lojas.

**Causa raiz:** O componente `StoreGroupMappings` nao usa `key` no React, entao ao trocar de loja o componente reutiliza o estado interno antigo. Alem disso, o `bulkAddMappings` do hook usa `mappings` do closure (que pode estar desatualizado ao trocar de loja), permitindo que itens "novos" sejam inseridos com o `store_id` errado no cache.

## Solucao

### 1. Adicionar `key` no componente (prevencao futura)
Em `StoresManager.tsx`, forcar remount ao trocar de loja:
```text
<StoreGroupMappings key={editingStore.id} storeId={editingStore.id} />
```

### 2. Adicionar constraint UNIQUE no banco (protecao definitiva)
Criar um indice unico em `(store_id, option_group_id)` para que o banco nunca aceite duplicatas.

### 3. Limpar dados duplicados
Remover os 72 mapeamentos que foram replicados indevidamente para a loja errada.

## Detalhes Tecnicos

**Arquivos a modificar:**
- `src/components/StoresManager.tsx` — adicionar `key={editingStore.id}` no `StoreGroupMappings`

**Migracao SQL:**
1. Deletar mapeamentos duplicados da loja que recebeu dados indevidos
2. Adicionar constraint `UNIQUE(store_id, option_group_id)` na tabela `store_option_group_mappings`

**Mudanca no hook** (`useStoreGroupMappings.ts`):
- No `bulkAddMappings`, adicionar `.eq('store_id', storeId)` na verificacao de duplicatas para garantir que so filtra mapeamentos da loja correta (defesa em profundidade)

