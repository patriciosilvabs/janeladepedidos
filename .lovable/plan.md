 # Descoberta: Limitação da API CardápioWeb para Pedidos de Mesa
 
 **Atualizado em**: 05/02/2026
 **Status**: Documentado - Limitação conhecida da API externa

## Informacao Crucial da Documentacao

A documentacao oficial do CardapioWeb confirma:

> "Pedidos de mesas e comandas so ficam disponiveis nesse endpoint **apos serem cancelados ou finalizados**."

Isso explica porque os pedidos de Mesa nunca aparecem no sistema - eles tem `order_type: closed_table` e **NAO sao expostos pela API de polling enquanto estao abertos**.

---

## Como a API Funciona

### Order Types
| Valor | Descricao |
|-------|-----------|
| `delivery` | Pedido de delivery |
| `takeout` | Pedido de retirada |
| `onsite` | Pedido para consumo no local |
| `closed_table` | Pedido de mesa ou comanda |

### Status Validos para Filtro
| Status | Descricao |
|--------|-----------|
| `waiting_confirmation` | Pedido pendente |
| `confirmed` | Pedido confirmado e em preparacao |
| `scheduled_confirmed` | Pedido agendado confirmado |
| `waiting_to_catch` | Pedido pronto esperando retirada |
| `released` | Pedido saiu para entrega |
| `closed` | Pedido finalizado |
| `canceled` | Pedido cancelado |

---

## Fluxo Atual vs Limitacao

```text
PEDIDOS DE DELIVERY/RETIRADA/BALCAO:
  Cliente faz pedido
       |
       v
  status = waiting_confirmation
       |
       v
  Loja aceita -> status = confirmed
       |
       v
  [APARECE NO POLLING] ✅
       |
       v
  Sistema importa para KDS


PEDIDOS DE MESA (closed_table):
  Cliente senta na mesa
       |
       v
  Mesa aberta com itens
       |
       v
  [NAO APARECE NO POLLING] ❌ <-- Limitacao da API
       |
       v
  Mesa fechada -> status = closed
       |
       v
  [AGORA APARECE NO POLLING] ✅
       |
       v
  Mas ja esta finalizado...
```

---

## Opcoes Disponiveis

### Opcao 1: Aceitar a Limitacao (Simples)

Manter o sistema atual que funciona para:
- Delivery
- Retirada (takeout)
- Balcao (onsite)

Pedidos de Mesa nao serao capturados em tempo real.

### Opcao 2: Implementar Webhook (Recomendado pelo CardapioWeb)

A API suporta webhooks que notificam em tempo real:
- `ORDER_CREATED` - Novo pedido
- `ORDER_STATUS_UPDATED` - Status alterado

**POREM**, a documentacao tambem diz:
> "Pedidos de mesas e comandas sao notificados somente quando sao cancelados ou finalizados."

Ou seja, mesmo com webhook, pedidos de Mesa so chegam quando fecham.

### Opcao 3: Contatar o CardapioWeb

Perguntar se existe algum endpoint especifico para mesas abertas, ou se ha planos de disponibilizar isso na API. Email: integracao@cardapioweb.com

### Opcao 4: Importar Mesas Fechadas

Configurar o sistema para importar pedidos de Mesa quando eles sao **finalizados** (`closed`), para fins de historico e relatorios. Nao seriam processados no KDS em tempo real, mas teriam registro.

---

## Status Atual do Sistema

O polling esta funcionando corretamente e importando:
- Pedidos de Delivery
- Pedidos de Retirada
- Pedidos de Balcao

Os logs mostram: "Imported 24 new orders", "Imported 13 new orders", etc.

---

## Recomendacao

1. **Manter o polling atual** - Esta funcionando para delivery/retirada
2. **Adicionar filtro para status `closed`** - Para capturar mesas finalizadas para historico
3. **Implementar webhook (opcional)** - Para notificacao em tempo real de novos pedidos
4. **Contatar CardapioWeb** - Perguntar sobre API para mesas abertas

---

## Resumo

| Tipo de Pedido | Disponivel no Polling? | Disponivel em Tempo Real? |
|----------------|------------------------|---------------------------|
| Delivery | Sim | Sim |
| Retirada | Sim | Sim |
| Balcao | Sim | Sim |
| Mesa/Comanda | Apenas quando fechado | Nao |

Esta e uma limitacao da API do CardapioWeb, nao do nosso sistema.

