

# Plano: Investigar e Corrigir Notificação de Pedido Pronto

## Descoberta Importante

O status `waiting_to_catch` **existe no CardápioWeb** como um status de pedido (reconhecido em `sync-orders-status`), mas **não como endpoint da API** (retornou 404 quando tentamos chamar `/waiting_to_catch`).

Isso sugere que:
1. O KDS do CardápioWeb marca o pedido internamente como `waiting_to_catch` (pronto, aguardando coleta)
2. O endpoint da API `/ready` marca o pedido e possivelmente dispara integração automática com Foody

## Opções de Solução

### Opção 1: Investigar Documentação Completa da API (Recomendado)

A documentação fornecida menciona "Pedido pronto POST" mas não mostra se aceita parâmetros no body. Talvez o endpoint `/ready` aceite um JSON body com flags como:

```json
{
  "auto_dispatch": false,
  "notify_driver": false
}
```

**Ação:** Testar enviar body JSON com diferentes flags para o endpoint `/ready`

### Opção 2: Contatar Suporte CardápioWeb

Email: integracao@cardapioweb.com

Perguntar especificamente:
- "Como marcar um pedido como PRONTO via API sem disparar automaticamente a integração com Foody/entregadores?"
- "Existe um parâmetro ou flag para o endpoint /ready que controla o auto-dispatch?"
- "O status 'waiting_to_catch' pode ser definido via API?"

### Opção 3: Desabilitar Auto-Dispatch no Painel CardápioWeb

Se o CardápioWeb tem uma configuração de "Despacho Automático" ou "Integração Foody", desabilitar essa opção pode fazer o endpoint `/ready` funcionar corretamente.

## Próximo Passo Imediato: Testar com Body JSON

Podemos tentar enviar um body vazio ou com flags específicas para o endpoint `/ready`:

| Teste | Body | Hipótese |
|-------|------|----------|
| 1 | `{}` | Talvez body vazio mude comportamento |
| 2 | `{"status": "waiting_to_catch"}` | Forçar status específico |
| 3 | `{"skip_dispatch": true}` | Flag para pular despacho |

## Alteração Proposta para Teste

Modificar a função `notifyCardapioWebReady` para incluir um body JSON na requisição:

```typescript
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'X-API-KEY': store.cardapioweb_api_token,
    'Accept': 'application/json',
    'Content-Type': 'application/json',  // ADICIONAR
  },
  body: JSON.stringify({}),  // ADICIONAR - testar com body vazio primeiro
});
```

## Resumo

1. **Causa provável:** O endpoint `/ready` do CardápioWeb tem comportamento diferente quando chamado via API vs KDS interno
2. **Próximo passo:** Testar com body JSON na requisição
3. **Plano B:** Contatar suporte CardápioWeb para orientação

