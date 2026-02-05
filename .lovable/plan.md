

# Plano: Corrigir Tela que Aparece e Desaparece

## Problema Identificado

O problema "tela aparece e depois some" e acontece por uma **race condition no fluxo de autenticacao** que causa ciclos de redirecionamento:

```text
Usuario logado
    |
    v
Token expira/refresh inicia
    |
    v
AuthContext: user = null temporariamente (loading = false)
    |
    v
ProtectedRoute detecta !user -> Redireciona para /auth
    |
    v
Auth.tsx recebe o user atualizado -> Redireciona para /
    |
    v
Ciclo se repete = FLASH BRANCO
```

## Causa Raiz

No `AuthContext.tsx`, quando ocorre um evento de autenticacao (como `TOKEN_REFRESHED`), o estado `loading` e setado como `false` **antes** de verificar se ainda ha um usuario valido. Isso causa uma janela onde:

- `loading = false`
- `user = null` (temporariamente)

O `ProtectedRoute` interpreta isso como "usuario nao logado" e redireciona.

## Solucao

### Mudanca 1: AuthContext.tsx - Nao setar loading=false durante refresh

Adicionar verificacao para eventos de refresh de token para nao mudar o estado de loading durante a transicao:

```typescript
// AuthContext.tsx - linha 56-83
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, currentSession) => {
    if (!mountedRef.current) return;
    
    // Debounce TOKEN_REFRESHED events to prevent rate limiting
    const now = Date.now();
    if (event === 'TOKEN_REFRESHED' && now - lastEventTimeRef.current < 2000) {
      return;
    }
    lastEventTimeRef.current = now;
    
    // Durante refresh, so atualizar se houver sessao valida
    // Evitar transicao user -> null -> user que causa flash
    if (event === 'TOKEN_REFRESHED' && !currentSession) {
      // Ignorar eventos de refresh sem sessao - pode ser transitorio
      return;
    }
    
    // Update state for any auth event
    setSession(currentSession);
    setUser(currentSession?.user ?? null);
    
    // So setar loading=false no evento INITIAL_SESSION ou quando realmente terminar
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      setLoading(false);
    }
    
    // ... resto do codigo
  }
);
```

### Mudanca 2: ProtectedRoute.tsx - Aguardar mais tempo durante transicoes

Adicionar um pequeno delay antes de redirecionar para evitar flashes durante refresh de token:

```typescript
// ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  // Dar um pequeno delay antes de decidir redirecionar
  // Isso evita flash durante refresh de token
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        setIsChecking(false);
      }, 100); // 100ms de grace period
      return () => clearTimeout(timer);
    }
  }, [loading, user]);

  if (loading || isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
```

### Mudanca 3: Index.tsx - Manter ultimo estado valido

Adicionar logica para manter o dashboard visivel durante recarregamentos curtos:

```typescript
// Index.tsx - adicionar estado para manter a ultima view valida
const [lastValidContent, setLastValidContent] = useState<React.ReactNode>(null);

// Se estiver carregando mas ja temos conteudo anterior, mostrar o anterior
if (authLoading || sectorLoading || settingsLoading) {
  if (lastValidContent) {
    return <>{lastValidContent}</>; // Manter tela anterior durante reload
  }
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
```

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/contexts/AuthContext.tsx` | Melhorar tratamento de eventos de refresh de token |
| `src/components/ProtectedRoute.tsx` | Adicionar grace period antes de redirecionar |
| `src/pages/Index.tsx` | (Opcional) Manter ultimo estado valido durante reloads |

---

## Resultado Esperado

1. A tela nao vai mais piscar/desaparecer durante refresh de token
2. O usuario nao sera redirecionado para /auth durante transicoes normais
3. A experiencia sera mais fluida em tablets e dispositivos moveis

---

## Secao Tecnica

### Por que isso acontece em tablets?

Tablets geralmente tem conexoes menos estaveis e podem ter delays maiores nas respostas da API. O token de sessao do Supabase tem validade limitada e precisa ser atualizado periodicamente. Durante esse refresh:

1. O Supabase emite um evento `TOKEN_REFRESHED`
2. Dependendo do timing, pode haver um momento onde a sessao esta sendo atualizada
3. O React re-renderiza os componentes
4. Se o timing for ruim, o ProtectedRoute detecta ausencia de usuario e redireciona

### Eventos do Supabase Auth

- `INITIAL_SESSION`: Primeira vez que a sessao e carregada
- `SIGNED_IN`: Usuario acabou de fazer login
- `SIGNED_OUT`: Usuario fez logout
- `TOKEN_REFRESHED`: Token foi atualizado (acontece periodicamente)
- `USER_UPDATED`: Dados do usuario foram atualizados

