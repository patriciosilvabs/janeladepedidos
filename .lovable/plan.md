

# Limpeza automatica da coluna "Pedido Pronto" as 23:59

## Problema

A coluna "Pedido Pronto" acumula pedidos com status `ready` indefinidamente. Na imagem, ha 759 pedidos parados, alguns com mais de 198 horas. Isso polui a interface e degrada a performance.

## Solucao

Criar um segundo cron job no banco de dados que roda toda noite as 23:59 (horario de Brasilia) e fecha esses pedidos automaticamente.

## Detalhes Tecnicos

### Cron Job (via SQL insert, sem migracao)

```text
Nome: cleanup-ready-orders
Agendamento: 59 2 * * * (02:59 UTC = 23:59 BRT)
Acao: UPDATE public.orders SET status = 'closed' WHERE status = 'ready'
```

O status `closed` e usado em vez de deletar os pedidos para manter a logica de "soft delete" que evita loops de re-importacao com o CardapioWeb. Pedidos fechados nao aparecem em nenhuma coluna do dashboard.

### Por que `closed` e nao `DELETE`

A constraint `orders_status_check` permite os valores: `pending`, `waiting_buffer`, `ready`, `dispatched`, `closed`, `cancelled`. O status `closed` indica que o pedido foi encerrado e nao deve ser re-importado. Se os pedidos fossem deletados, o sistema de integracao poderia re-importa-los como novos.

### Arquivos modificados
- Nenhum arquivo de codigo -- apenas 1 insert SQL no banco para criar o cron job
