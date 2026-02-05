

# Plano: Testar Flags de Controle no Endpoint /ready

## Contexto

O erro de build atual (408 Request Timeout) é temporário - problema de rede do CDN esm.sh, não do código. Será resolvido automaticamente no próximo build.

## Estratégia de Testes

Baseado nas suas sugestões, vamos testar diferentes payloads para o endpoint `/ready`:

### Teste 1: Flags de Dispatch

```typescript
body: JSON.stringify({ 
  "dispatch": false 
})
```

### Teste 2: Flag auto_dispatch

```typescript
body: JSON.stringify({ 
  "auto_dispatch": false 
})
```

### Teste 3: Status + Notify

```typescript
body: JSON.stringify({ 
  "status": "READY",
  "notify": false 
})
```

## Implementação Proposta

Modificar `notify-order-ready/index.ts` para enviar um body com flags de controle:

```typescript
// Tentar desabilitar auto-dispatch via body
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'X-API-KEY': store.cardapioweb_api_token,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ 
    dispatch: false,
    auto_dispatch: false,
    notify: false
  }),
});
```

## Verificação do Tipo de Pedido

Adicionar log do `order_type` para verificar se o comportamento muda baseado em delivery vs takeout:

```typescript
console.log(`Order type: ${orderType} - Se delivery, API pode disparar logística automaticamente`);
```

## Endpoint Alternativo

Se as flags não funcionarem, testar o endpoint `/prepared` como alternativa:

```typescript
// Testar se /prepared existe
const endpoint = `${baseUrl}/api/partner/v1/orders/${externalId}/prepared`;
```

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/notify-order-ready/index.ts` | Adicionar flags `dispatch: false`, `auto_dispatch: false`, `notify: false` no body |

## Resultado Esperado

1. A API do CardápioWeb respeita as flags e mantém o pedido em "Pronto"
2. O cliente não é notificado automaticamente
3. O Foody só é acionado quando nosso sistema chama `/dispatch`

## Plano B

Se nenhuma flag funcionar, a recomendação é contatar o suporte CardápioWeb com a pergunta técnica que você sugeriu - é a forma mais segura de obter a resposta definitiva.

