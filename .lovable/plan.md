

## Plano: Redistribuicao automatica de itens pendentes por inatividade

### Problema

Hoje o sistema so redistribui itens quando o tablet fica **offline** (sem heartbeat por 30 segundos). Se o tablet estiver online mas ninguem clicar em "Iniciar", o item fica parado indefinidamente naquele setor.

### Solucao

Criar um **cron job** que roda a cada minuto e verifica se existem itens `pending` ha mais de X minutos sem ninguem iniciar. Se houver outro setor com operador online e menos carga, o item e movido automaticamente.

### Alteracoes

**1. Nova coluna em `app_settings`**

Adicionar `pending_redistribution_minutes` (integer, default 3) -- tempo maximo que um item pode ficar `pending` antes de ser redistribuido para outro setor.

**2. Nova funcao SQL: `redistribute_stale_pending_items()`**

- Busca itens com status `pending` onde `created_at` e mais antigo que X minutos
- Para cada item, verifica se o setor atual tem operador online
- Se o setor tem operador online mas o item esta parado, verifica se ha outro setor com operador online e menos carga
- Move o item para o setor menos carregado (usando `get_least_loaded_sector`)
- Retorna a quantidade de itens redistribuidos
- NAO redistribui itens que ja estao `in_prep` (alguem ja iniciou)

**3. Atualizar a Edge Function `redistribute-items`**

Adicionar uma terceira opcao `cleanup_stale_pending: true` que:
- Le o timeout configurado em `app_settings.pending_redistribution_minutes`
- Executa a nova funcao `redistribute_stale_pending_items`
- Registra log dos itens movidos

**4. Criar cron job via `pg_cron`**

Agendar uma chamada HTTP a cada minuto para a Edge Function `redistribute-items` com `cleanup_stale_pending: true`. Isso garante que itens "esquecidos" sejam redistribuidos automaticamente.

**5. Configuracao na UI (Settings)**

Adicionar o campo "Tempo maximo pendente antes de redistribuir (minutos)" na tela de configuracoes, junto aos outros parametros do KDS.

### Logica de redistribuicao

```text
A cada 1 minuto:
  1. Buscar itens pending ha mais de X minutos
  2. Para cada item:
     a. O setor atual tem operador online?
        - SIM: Verificar se outro setor tem operador online E menos carga
          - SIM: Mover item para la
          - NAO: Manter no setor atual
        - NAO: Ja coberto pela logica existente de setor offline
  3. Log dos movimentos
```

### Detalhes tecnicos

- A funcao SQL usa `FOR UPDATE SKIP LOCKED` para evitar conflitos com operadores clicando "Iniciar" no mesmo momento
- O cron roda a cada 60 segundos, entao o tempo real de redistribuicao sera entre X e X+1 minutos
- Itens `in_prep`, `in_oven` ou `ready` nunca sao redistribuidos (alguem ja esta trabalhando neles)
- O setor de bordas (`kds_edge_sector_id`) e excluido da redistribuicao automatica para manter a logica de fluxo de bordas

### Resultado

- Item pendente ha mais de 3 minutos (configuravel) e automaticamente movido para o setor com menos carga
- Operador do outro setor ve o item aparecer na fila em tempo real
- Sem intervencao manual necessaria

