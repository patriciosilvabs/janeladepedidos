

## Problema Identificado

O botão de **Configurações** não está aparecendo porque seu usuário não possui uma role (papel) atribuída no sistema.

### Diagnóstico

| Item | Status |
|------|--------|
| Usuário logado | patriciobarbosadasilva@gmail.com |
| Role atual | **Nenhuma** (NULL) |
| Tabela user_roles | Vazia |

### Por que isso aconteceu?

Ao fazer o **remix** do projeto, os dados de usuários e roles não foram copiados. A tabela `user_roles` veio vazia, então o sistema não reconhece seu usuário como administrador.

### Fluxo atual

```text
Login → AuthContext busca role → NULL → isAdmin = false → Botão escondido
```

---

## Plano de Correção

### Passo 1: Inserir role de owner

Executar uma migration para inserir seu usuário como **owner** na tabela `user_roles`:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('4a5ee05a-17fd-47ff-8bb6-676436ce9f8c', 'owner');
```

### Passo 2: Verificar resultado

Após a inserção, o sistema irá:
1. Reconhecer seu usuário como `owner`
2. Exibir o botão de **Configurações** no header
3. Mostrar todas as abas incluindo **Setores** e **Usuários**

---

## Detalhes Técnicos

O componente `Header.tsx` renderiza o `SettingsDialog` apenas quando `isAdmin` é `true`:

```tsx
{isAdmin && <SettingsDialog />}
```

A propriedade `isAdmin` vem do `AuthContext` e é calculada como:

```tsx
isAdmin: role === 'admin' || role === 'owner'
```

Como a role estava `null`, o botão não aparecia.

