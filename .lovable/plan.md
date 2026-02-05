
# Plano: Eliminar Popup "Allow" do QZ Tray

## Problema

O QZ Tray exige confirmação do usuário ("Allow/OK") a cada impressão porque o sistema está configurado sem certificado digital de segurança.

## Soluções Disponíveis

### Opção 1: Configurar no QZ Tray Local (MAIS SIMPLES)

Não requer mudança de código. Configure diretamente no QZ Tray instalado:

**Passos:**
1. Clique no ícone do QZ Tray na bandeja do sistema (perto do relógio)
2. Selecione **"Advanced" → "Site Manager"**
3. Adicione o domínio da aplicação:
   - Para preview: `id-preview--32fe4f98-1aa0-4e3d-8760-3b11e29b5a98.lovable.app`
   - Para produção: `groupify-logistics.lovable.app`
4. Marque a opção **"Remember this decision"** ou **"Always allow"**
5. Clique em **"Save"**

**Vantagem:** Não requer desenvolvimento adicional
**Desvantagem:** Precisa configurar em cada computador

---

### Opção 2: Implementar Certificado Digital (MAIS ROBUSTA)

Implementar assinatura digital para que o QZ Tray confie automaticamente na aplicação.

**Arquitetura:**

```text
┌─────────────────┐         ┌──────────────────────────┐
│    Frontend     │         │   Edge Function          │
│                 │         │   qz-sign                │
│  Precisa        │ ──────► │                          │
│  imprimir       │         │  Recebe: toSign string   │
│                 │ ◄────── │  Retorna: signature      │
│  Envia dados    │         │                          │
│  para QZ Tray   │         │  (usa private key)       │
└─────────────────┘         └──────────────────────────┘
```

**Arquivos a criar/modificar:**

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/qz-sign/index.ts` | **Criar** | Edge function que assina requests |
| `src/lib/qzTray.ts` | **Modificar** | Chamar a edge function para assinatura |
| Secrets | **Adicionar** | Chave privada como secret do projeto |

**Passos de implementação:**

1. **Gerar par de chaves:**
   ```bash
   openssl genrsa -out private-key.pem 2048
   openssl req -x509 -new -key private-key.pem -out digital-certificate.crt
   ```

2. **Criar Edge Function para assinatura:**
   ```typescript
   // supabase/functions/qz-sign/index.ts
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
   import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
   
   serve(async (req) => {
     const { toSign } = await req.json();
     const privateKey = Deno.env.get('QZ_PRIVATE_KEY');
     
     // Assinar usando RSA-SHA512
     const signature = await signWithPrivateKey(toSign, privateKey);
     
     return new Response(JSON.stringify({ signature }));
   });
   ```

3. **Modificar qzTray.ts:**
   ```typescript
   // Certificado (pode ser inline ou fetch)
   const CERTIFICATE = `-----BEGIN CERTIFICATE-----
   ... conteúdo do certificado ...
   -----END CERTIFICATE-----`;
   
   window.qz.security.setCertificatePromise((resolve) => {
     resolve(CERTIFICATE);
   });
   
   window.qz.security.setSignaturePromise((toSign) => (resolve) => {
     // Chamar edge function
     fetch('/functions/v1/qz-sign', {
       method: 'POST',
       body: JSON.stringify({ toSign })
     })
     .then(r => r.json())
     .then(data => resolve(data.signature));
   });
   ```

---

## Recomendação

**Para resolver rapidamente:** Use a **Opção 1** (configurar no QZ Tray local). Basta:

1. Clicar no ícone QZ Tray → **Advanced → Site Manager**
2. Adicionar o domínio e marcar "Always allow"
3. Reiniciar o navegador

**Para produção robusta:** Implemente a **Opção 2** posteriormente quando o sistema estiver estabilizado.

---

## Resumo

| Solução | Esforço | Segurança | Manutenção |
|---------|---------|-----------|------------|
| Site Manager (local) | Baixo (5 min) | Média | Por computador |
| Certificado Digital | Alto (1-2h) | Alta | Centralizado |

Qual opção você prefere seguir?
