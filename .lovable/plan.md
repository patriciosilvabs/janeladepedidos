
# Plano: Implementar Assinatura Digital QZ Tray

## Objetivo

Configurar a assinatura digital no QZ Tray para eliminar os popups de confirmação "Allow/OK" a cada impressão.

## Arquitetura da Solução

A assinatura digital do QZ Tray funciona assim:

1. **Certificado Público**: Fornecido ao QZ Tray para identificar a aplicação (pode ficar no frontend)
2. **Chave Privada**: Usada para assinar cada requisição (deve ficar segura no backend)

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         FLUXO DE ASSINATURA                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐     1. toSign string      ┌──────────────────┐   │
│  │   Frontend   │ ─────────────────────────►│  Edge Function   │   │
│  │  qzTray.ts   │                           │    qz-sign       │   │
│  │              │◄───────────────────────── │                  │   │
│  └──────────────┘     2. signature          └──────────────────┘   │
│         │                                            │              │
│         │                                            │              │
│         ▼                                            ▼              │
│  ┌──────────────┐                           ┌──────────────────┐   │
│  │   QZ Tray    │                           │  Secret Store    │   │
│  │   (local)    │                           │  QZ_PRIVATE_KEY  │   │
│  └──────────────┘                           └──────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/qz-sign/index.ts` | **Criar** | Edge function que assina requests com RSA-SHA1 |
| `src/lib/qzTray.ts` | **Modificar** | Configurar certificado e chamar edge function para assinatura |
| `supabase/config.toml` | **Modificar** | Registrar a nova edge function |
| Secrets | **Adicionar** | `QZ_PRIVATE_KEY` com a chave privada fornecida |

## Implementação Detalhada

### 1. Criar Edge Function `qz-sign`

Esta função recebe o texto a ser assinado e retorna a assinatura RSA-SHA1 em base64:

```typescript
// supabase/functions/qz-sign/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { toSign } = await req.json();
  const privateKeyPem = Deno.env.get('QZ_PRIVATE_KEY');
  
  // Importar chave privada e assinar com RSA-SHA1
  const signature = await signWithPrivateKey(toSign, privateKeyPem);
  
  return new Response(JSON.stringify({ signature }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

### 2. Modificar `qzTray.ts`

Substituir as funções de segurança vazias pelo certificado e chamada à edge function:

```typescript
// Certificado público (inline)
const QZ_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIECzCCAvOgAwIBAgIGAZwtiQ/CMA0GCSqGSIb3DQEBCwUAMIGiMQswCQYDVQQG
... (certificado completo)
-----END CERTIFICATE-----`;

// Na função connect():
window.qz.security.setCertificatePromise((resolve) => {
  resolve(QZ_CERTIFICATE);
});

window.qz.security.setSignaturePromise((toSign) => (resolve) => {
  fetch('https://cpxuluerkzpynlcdnxcq.supabase.co/functions/v1/qz-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toSign })
  })
  .then(r => r.json())
  .then(data => resolve(data.signature))
  .catch(() => resolve(''));
});
```

### 3. Adicionar Secret

Armazenar a chave privada como secret do projeto para uso seguro na edge function.

## Considerações de Segurança

- **Chave privada**: Nunca exposta no frontend, apenas acessível pela edge function
- **Certificado público**: Pode ficar no frontend (é público por natureza)
- **Edge function pública**: Não requer autenticação pois a assinatura só é útil com o QZ Tray local
- **Algoritmo**: QZ Tray usa RSA-SHA1 para compatibilidade (não SHA256)

## Resultado Esperado

Após implementação:
- Conexão com QZ Tray será automaticamente confiável
- Nenhum popup "Allow/OK" aparecerá
- Impressões serão 100% silenciosas
- Funciona em qualquer computador sem configuração manual
