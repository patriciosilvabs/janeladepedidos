

# Plano: Corrigir CORS na Edge Function sync-orders-status

## Problema Identificado

O erro de CORS está acontecendo porque os headers CORS da edge function não incluem todos os headers que o cliente Supabase envia automaticamente.

## Solução

Atualizar o `corsHeaders` na função `sync-orders-status` para incluir os headers adicionais do cliente Supabase:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

## Outras Edge Functions a Verificar

Vou verificar e corrigir os CORS headers em todas as edge functions do projeto para garantir consistência:

1. `sync-orders-status` - Atualizar headers
2. `sign-qz` - Verificar se precisa atualização
3. Outras funções no projeto

## Arquivos a Modificar

- `supabase/functions/sync-orders-status/index.ts` - Atualizar corsHeaders

## Status do QZ Tray

Sobre o plano que você compartilhou: **já está implementado corretamente!**
- A função `sign-qz` já foi criada com jsrsasign
- O frontend já chama `/functions/v1/sign-qz`
- O secret `QZ_PRIVATE_KEY` já está configurado
- O certificado já está no código

O erro de WebSocket (`wss://localhost:8181/` failed) é **esperado** se o QZ Tray não estiver rodando no computador. Isso não é um problema do código.

