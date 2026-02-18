

# Limpeza automatica do historico do forno as 23:59

## O que sera feito

Criar um agendamento (cron job) no banco de dados que roda toda noite as 23:59 e limpa o campo `oven_entry_at` dos itens com status `ready`. Isso faz com que a aba "Historico" do tablet do forno apareca vazia quando o operador chegar no dia seguinte, sem afetar o status dos pedidos nem o fluxo de despacho.

## Por que funciona

A aba "Historico" busca itens onde `oven_entry_at IS NOT NULL` e `status = 'ready'`. Ao zerar o `oven_entry_at` desses itens, eles simplesmente deixam de aparecer na consulta. Nenhum pedido e deletado, nenhum status e alterado.

## Detalhes Tecnicos

### 1. Habilitar extensoes necessarias (migracao SQL)

Habilitar `pg_cron` e `pg_net` para permitir agendamento de tarefas no banco.

### 2. Criar o cron job (via insert SQL)

```text
Agendamento: '59 23 * * *' (todos os dias as 23:59 UTC)
Acao: UPDATE order_items SET oven_entry_at = NULL WHERE status = 'ready' AND oven_entry_at IS NOT NULL
```

Esse comando limpa apenas os itens que ja estao prontos e passaram pelo forno. Itens que ainda estao `in_oven` (em preparo ativo) nao sao afetados.

### Observacao sobre fuso horario

O cron roda em UTC. Se o horario local desejado e 23:59 no Brasil (UTC-3), o cron sera configurado para `59 2 * * *` (02:59 UTC do dia seguinte). Isso sera ajustado na implementacao.

### Arquivos modificados
- Nenhum arquivo de codigo -- apenas configuracao no banco de dados (1 migracao + 1 insert SQL)

