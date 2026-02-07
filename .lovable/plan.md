
## Plano: Funcao de Recuperar Senha

### O que sera feito

Adicionar o fluxo completo de "Esqueci minha senha" na tela de login, usando o sistema de autenticacao nativo do projeto.

### Fluxo do usuario

1. Na tela de login, clicar em "Esqueceu sua senha?"
2. Informar o email
3. Receber um email com link de redefinicao
4. Ao clicar no link, ser redirecionado para uma pagina onde define a nova senha
5. Apos redefinir, ser redirecionado para o app

### Alteracoes

**1. `src/contexts/AuthContext.tsx`**
- Adicionar funcao `resetPassword(email)` que chama `supabase.auth.resetPasswordForEmail` com `redirectTo` apontando para `/auth/reset`
- Adicionar funcao `updatePassword(newPassword)` que chama `supabase.auth.updateUser({ password })`
- Atualizar a interface `AuthContextType` com essas duas funcoes

**2. `src/hooks/useAuth.ts`**
- Nenhuma alteracao (ja re-exporta o contexto)

**3. `src/pages/Auth.tsx`**
- Adicionar um terceiro estado de tela: `login`, `signup`, `forgot`
- No modo `forgot`: exibir apenas campo de email + botao "Enviar link de recuperacao"
- Adicionar link "Esqueceu sua senha?" abaixo do botao de login
- Tratar mensagem de sucesso ("Verifique seu email")

**4. Criar `src/pages/ResetPassword.tsx`** (nova pagina)
- Formulario com campos "Nova senha" e "Confirmar senha"
- Validacao com zod (minimo 6 caracteres, senhas iguais)
- Chama `updatePassword` ao submeter
- Apos sucesso, redireciona para `/`
- Mesma aparencia visual da pagina de login (Card, icone, etc.)

**5. `src/App.tsx`**
- Adicionar rota `/auth/reset` apontando para `ResetPassword`

### Detalhes tecnicos

- `supabase.auth.resetPasswordForEmail` envia o email automaticamente usando o sistema de autenticacao do projeto -- nao precisa de edge function nem Resend
- O `redirectTo` sera `window.location.origin + '/auth/reset'` para que o link do email leve o usuario a pagina de redefinicao
- O evento `PASSWORD_RECOVERY` do `onAuthStateChange` ja cria uma sessao temporaria automaticamente, permitindo que `supabase.auth.updateUser` funcione na pagina de reset
- O `AuthContext` tambem tratara o evento `PASSWORD_RECOVERY` no `onAuthStateChange` para setar `loading = false`
