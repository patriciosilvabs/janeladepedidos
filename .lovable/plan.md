

# Corrigir Logout Global que Desloga Todos os Dispositivos

## Problema Identificado

A funcao `signOut()` no `AuthContext.tsx` usa `supabase.auth.signOut()` sem especificar o escopo. O comportamento padrao e `scope: 'global'`, que **revoga todos os tokens de refresh** do usuario em todos os dispositivos. Isso causa:

1. Usuario faz logout no PC -> token do tablet e invalidado
2. Tablet tenta renovar o token -> falha -> redireciona para `/auth`
3. Mesmo sem logout explicito, um novo login pode causar conflito com tokens existentes

## Solucao

Alterar o `signOut` para usar `scope: 'local'`, que revoga apenas a sessao do dispositivo atual, mantendo os outros dispositivos logados normalmente.

## Mudancas Tecnicas

### 1. `src/contexts/AuthContext.tsx`

Alterar a funcao `signOut` de:

```typescript
const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};
```

Para:

```typescript
const signOut = async () => {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  return { error };
};
```

### 2. `src/components/ProtectedRoute.tsx`

Aumentar o grace period para dar mais tempo ao token refresh e evitar redirecionamentos falsos durante renovacao de token:

- Aumentar o delay de `200ms` para `500ms` quando havia usuario previamente logado
- Isso previne o flash de redirecionamento durante renovacoes de token que demoram um pouco mais

### Resultado Esperado

- Fazer logout em um dispositivo NAO afetara outros dispositivos
- Cada tablet/PC mantera sua propria sessao independente
- Tokens de refresh continuarao funcionando normalmente em todos os dispositivos

