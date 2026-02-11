

# Upload de Planilha CardápioWeb para Mapeamento Automático

## Objetivo
Permitir upload de CSV/planilha exportada do CardápioWeb na tela de Lojas, parseando automaticamente as categorias de opções e criando mapeamentos de grupo.

## Problema
O CSV do CardápioWeb contém "Código interno" por item individual, mas o sistema de mapeamento atual usa `option_group_id` (ID numérico do grupo de opções vindo da API). O CSV tem a coluna "Categoria/Complemento" que corresponde ao **nome** do grupo, mas nao ao ID numerico.

## Solucao em 2 Etapas

### Etapa 1 - Buscar IDs via API (Edge Function)
Criar uma edge function `fetch-store-option-groups` que:
1. Conecta na API CardápioWeb da loja usando o token configurado
2. Busca os produtos e extrai os `option_group_id` + `option_group_name` unicos
3. Retorna a lista de grupos disponiveis com seus IDs e nomes

### Etapa 2 - Upload CSV + Correlacao
1. Usuario faz upload do CSV na UI
2. Sistema parseia client-side, extrai categorias unicas de linhas com Tipo=OPCAO
3. Correlaciona nomes do CSV com nomes dos grupos da API (etapa 1)
4. Auto-classifica: categorias com "sabor/sabores" -> flavor, "borda/massa" -> edge, resto -> complement
5. Mostra preview para usuario confirmar antes de salvar

### Alternativa mais simples (recomendada)
Em vez de fazer upload de CSV, adicionar um botao **"Importar da API"** que:
1. Chama a API CardápioWeb diretamente
2. Busca todos os produtos com suas opcoes
3. Extrai os `option_group_id` + `option_group_name` unicos
4. Auto-classifica por keywords
5. Mostra preview para confirmar
6. Salva os mapeamentos em batch

Essa abordagem eh melhor porque:
- Obtem o `option_group_id` real (necessario para o mapeamento funcionar)
- Nao depende do formato do CSV (que pode mudar)
- Mais simples para o usuario (1 clique vs upload de arquivo)

## Detalhes Tecnicos

### Nova Edge Function: `fetch-store-option-groups`
- Recebe `store_id` no body
- Busca token/url da loja no banco
- Faz GET na API de produtos do CardápioWeb
- Extrai pares unicos `{ option_group_id, option_group_name }`
- Retorna lista ordenada

### Alteracoes no Frontend

**`src/components/StoreGroupMappings.tsx`**:
- Adicionar botao "Importar da API" ao lado do formulario manual
- Abrir dialog/modal com preview dos grupos encontrados
- Cada grupo mostra: ID, Nome, tipo sugerido (auto-classificado)
- Usuario pode alterar tipo antes de confirmar
- Botao "Salvar Todos" faz batch insert, pulando duplicados

**`src/hooks/useStoreGroupMappings.ts`**:
- Adicionar mutation `bulkAddMappings` para inserir multiplos de uma vez

### Auto-classificacao por Keywords
```text
flavor: sabor, sabores, escolha, selecione, pizza
edge:   borda, massa, tradicional
complement: tudo que nao se encaixar nos anteriores
```

### Fluxo do Usuario
1. Abre edicao da loja
2. Desce ate "Mapeamento de Grupos"
3. Clica "Importar da API"
4. Sistema busca grupos automaticamente
5. Preview mostra grupos com classificacao sugerida
6. Usuario ajusta se necessario
7. Clica "Salvar" -> mapeamentos criados

### Arquivos a criar/editar
- `supabase/functions/fetch-store-option-groups/index.ts` (novo)
- `src/components/StoreGroupMappings.tsx` (editar - adicionar botao + dialog de import)
- `src/hooks/useStoreGroupMappings.ts` (editar - adicionar bulkAdd)
- `supabase/config.toml` (nao editavel - JWT config automatico)

