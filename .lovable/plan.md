
# Plano: Corrigir Notificação ao CardápioWeb - Endpoint "Pedido Pronto"

## Problema Identificado

O endpoint `/waiting_to_catch` está retornando **HTTP 404 Not Found**, conforme os logs:

```
Calling CardápioWeb AGUARDANDO COLETA for order 180756212: 
  https://integracao.cardapioweb.com/api/partner/v1/orders/180756212/waiting_to_catch

Response: 404 {"status":404,"error":"Not Found"}
```

O endpoint **não existe** na API do CardápioWeb!

## Análise da Documentação

Segundo a documentação oficial do CardápioWeb, os endpoints de status de pedido são:

| Ação | Endpoint Provável |
|------|------------------|
| Aceitar pedido | `/orders/{id}/accept` |
| Iniciar preparação | `/orders/{id}/preparation_start` |
| **Pedido pronto** | `/orders/{id}/ready` |
| Pedido entregue | `/orders/{id}/delivered` |
| Cancelar pedido | `/orders/{id}/cancel` |
| Saiu para entrega | `/orders/{id}/dispatch` ✓ (já funciona) |

## O Dilema

- O endpoint `/ready` existe e funciona, **MAS** automaticamente muda o status para "Saiu para Entrega" (porque o CardápioWeb dispara o Foody)
- O endpoint `/waiting_to_catch` **não existe** (404)

## Solução: Verificar Configuração do CardápioWeb

A questão provavelmente é que o CardápioWeb tem uma configuração de **"Despacho Automático"** ou integração nativa com Foody que dispara automaticamente quando o pedido é marcado como pronto.

### Opção 1: Usar `/ready` e desabilitar despacho automático no CardápioWeb

O cliente precisa acessar o painel do CardápioWeb e:
1. Ir em Configurações → Integrações → Foody
2. **Desabilitar** a opção de "Despacho Automático" ou "Enviar automaticamente para entregador"

Com isso, ao chamar `/ready`:
- O pedido aparece como "Pronto" no CardápioWeb
- O Foody só é acionado quando o Dashboard chama `/dispatch` (coluna Despachados)

### Opção 2: Se não houver como desabilitar

Se o CardápioWeb não permitir desabilitar o envio automático, então:
- **Não notificar** o CardápioWeb quando sai do Buffer
- Notificar **apenas quando for despachado** (já funciona com `/dispatch`)

## Alteração Necessária

Voltar a usar o endpoint `/ready` que existe e funciona:

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/notify-order-ready/index.ts` | Trocar de `/waiting_to_catch` para `/ready` |

```typescript
// ANTES (404 - não funciona)
const endpoint = `${baseUrl}/api/partner/v1/orders/${externalId}/waiting_to_catch`;

// DEPOIS (funciona)
const endpoint = `${baseUrl}/api/partner/v1/orders/${externalId}/ready`;
```

## Resultado Esperado

1. O pedido sai do status "Em Preparação" no CardápioWeb
2. Aparece como "Pronto" ou "Aguardando Coleta"
3. Se o CardápioWeb disparar automaticamente para "Saiu para Entrega", o cliente precisa verificar as configurações de integração no painel do CardápioWeb

## Nota Importante para o Usuário

Se após usar `/ready` o pedido automaticamente mudar para "Saiu para Entrega", isso é **configuração do CardápioWeb**, não do sistema. O usuário deve verificar no painel do CardápioWeb se existe opção de desabilitar o "despacho automático" ou "envio automático ao Foody".
