
# Plano: Configurar QZ Tray para Impressão Silenciosa (Sem Popup)

## O Problema

O popup "Allow" aparece porque o QZ Tray não está conseguindo validar a assinatura digital. Para funcionar sem popups, três coisas precisam estar sincronizadas:

1. **Chave Privada** (no servidor) - usada para assinar
2. **Certificado Público** (no código) - enviado ao QZ Tray
3. **Confiança no QZ Tray** (no computador local) - precisa confiar no certificado

## Diagnóstico

O código está correto, mas provavelmente:
- O certificado no código (`QZ_CERTIFICATE`) não corresponde à chave privada (`QZ_PRIVATE_KEY`)
- OU o QZ Tray não tem este certificado instalado como "confiável"

## Solução: Gerar Novo Par de Chaves + Instalar Certificado

### Passo 1: Gerar um Novo Par de Chaves

No computador (Windows/Mac/Linux), execute estes comandos em um terminal:

```text
# 1. Gerar chave privada RSA
openssl genrsa -out qz-private-key.pem 2048

# 2. Gerar certificado público (válido por 20 anos)
openssl req -new -x509 -key qz-private-key.pem -out qz-certificate.pem -days 7300 -subj "/CN=Groupify/O=SuaEmpresa"
```

Isso vai criar dois arquivos:
- `qz-private-key.pem` - Chave privada (para o servidor)
- `qz-certificate.pem` - Certificado público (para o código e QZ Tray)

### Passo 2: Atualizar o Secret no Lovable

1. Abra o arquivo `qz-private-key.pem` com um editor de texto
2. Copie TODO o conteúdo (incluindo `-----BEGIN PRIVATE KEY-----` e `-----END PRIVATE KEY-----`)
3. No Lovable, vá em **Configurações → Secrets** e atualize o secret `QZ_PRIVATE_KEY` com esse conteúdo

### Passo 3: Atualizar o Certificado no Código

Vou atualizar o arquivo `src/lib/qzTray.ts` com o conteúdo do arquivo `qz-certificate.pem` que você gerou.

### Passo 4: Instalar Certificado no QZ Tray (Computador Local)

Este é o passo crucial para eliminar o popup:

1. Localize a pasta de instalação do QZ Tray:
   - **Windows**: `C:\Program Files\QZ Tray\`
   - **Mac**: `/Applications/QZ Tray.app/Contents/Resources/`
   - **Linux**: `/opt/qz-tray/`

2. Copie o arquivo `qz-certificate.pem` para a subpasta `auth/` dentro da pasta do QZ Tray:
   - Windows: `C:\Program Files\QZ Tray\auth\qz-certificate.pem`
   - Mac: `/Applications/QZ Tray.app/Contents/Resources/auth/qz-certificate.pem`

3. Renomeie ou apague o arquivo `root-ca.crt` existente na pasta `auth/` (faça backup primeiro)

4. **Reinicie o QZ Tray** (feche no ícone da bandeja e abra novamente)

### Passo 5: Teste

Após reiniciar o QZ Tray, faça um teste de impressão. O popup "Allow" não deve mais aparecer.

## Resumo Visual

```text
+-----------------------+     +------------------------+     +-------------------+
|   qz-private-key.pem  | --> |  Secret: QZ_PRIVATE_KEY | --> | Edge Function     |
|   (chave privada)     |     |  (no Lovable Cloud)     |     | assina requisição |
+-----------------------+     +------------------------+     +-------------------+
                                                                       |
                                                                       v
+-----------------------+     +------------------------+     +-------------------+
|  qz-certificate.pem   | --> |  Código qzTray.ts      | --> | Envia cert ao     |
|  (certificado)        |     |  (QZ_CERTIFICATE)       |     | QZ Tray           |
+-----------------------+     +------------------------+     +-------------------+
         |                                                            |
         v                                                            v
+-----------------------+                                  +-------------------+
|  Pasta auth/ do       |                                  | QZ Tray valida    |
|  QZ Tray no PC        | -------------------------------- | assinatura        |
|  (mesmo certificado)  |                                  | = SEM POPUP!      |
+-----------------------+                                  +-------------------+
```

## Alterações no Código

Após você gerar o certificado e me enviar o conteúdo do `qz-certificate.pem`, vou atualizar o arquivo `src/lib/qzTray.ts` com o novo certificado.

## Observação Importante

O certificado que está atualmente no código (`QZ Tray Demo Cert`) é um certificado de demonstração do QZ. Para produção, é necessário usar um certificado próprio gerado com os comandos acima.
