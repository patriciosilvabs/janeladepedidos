

# Correção: Usuários Criados Não Aparecem na Lista

## Problema Identificado

Ao criar um usuário via "Criar Usuário", o sistema mostra sucesso mas o usuário não aparece na lista. A investigação revelou:

| Tabela | Quantidade |
|--------|------------|
| `auth.users` | 3 usuários |
| `user_roles` | 1 entrada (apenas o owner) |

**Causa Raiz**: O trigger `on_auth_user_created_assign_role` que deveria criar automaticamente a entrada em `user_roles` **não existe** na tabela `auth.users`. Em Lovable Cloud, triggers não podem ser criados em schemas gerenciadas (`auth`).

A edge function `create-user` assume que o trigger cria a entrada e apenas atualiza a role se necessário, mas como o trigger não existe, a entrada nunca é criada.

---

## Solução Proposta

Modificar a edge function `create-user` para **criar explicitamente** a entrada em `user_roles` ao invés de depender de um trigger.

### Mudanças na Edge Function

**Arquivo**: `supabase/functions/create-user/index.ts`

```text
ANTES (linha 109-121):
// Update user role (trigger creates with 'user' role by default)
if (role !== 'user') {
  await adminClient.from('user_roles').update({ role }).eq('user_id', newUser.user.id);
}

DEPOIS:
// Criar entrada em user_roles (trigger não funciona em auth schema)
const { error: insertRoleError } = await adminClient
  .from('user_roles')
  .insert({ 
    user_id: newUser.user.id, 
    role: role,
    sector_id: sector_id || null  // Adicionar suporte a setor
  });

if (insertRoleError) {
  console.error('Insert role error:', insertRoleError);
  // Tentar limpar o usuário criado
  await adminClient.auth.admin.deleteUser(newUser.user.id);
  return Response({ error: 'Erro ao criar permissões do usuário' });
}
```

### Adicionar Suporte a Setor na Criação

O `CreateUserDialog` já aceita `sector_id` como parâmetro, mas a edge function não o utiliza. Vamos corrigir isso.

---

## Correção de Dados Existentes

Os 2 usuários criados anteriormente (`user-a@domhelderpizzaria.com.br` e `setor-a@domhelderpizzaria.com.br`) precisam ter suas entradas criadas manualmente em `user_roles`.

Uma query SQL será executada para corrigir isso:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'::app_role FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles);
```

---

## Fluxo Corrigido

```text
1. Owner clica "Criar Usuário"
2. Edge function recebe (email, password, role, sector_id)
3. Cria usuário em auth.users via admin.createUser()
4. Insere entrada em user_roles com role e sector_id
5. Se falhar, deleta o usuário criado (rollback)
6. Retorna sucesso
7. Frontend invalida query → novo usuário aparece na lista
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/create-user/index.ts` | Criar entrada em `user_roles` explicitamente |
| Migration SQL | Corrigir usuários existentes sem `user_roles` |

---

## Benefícios

- Usuários criados aparecem imediatamente na lista
- Suporte a atribuição de setor durante criação
- Rollback automático se a criação de permissões falhar
- Não depende de triggers que não funcionam em schemas gerenciadas

