

# Ocultar Configuracoes de Modo KDS para Usuarios e Simplificar Header em Fullscreen

## Problema Identificado

1. **Abas "Por Item" / "Por Pedido"**: Usuarios comuns conseguem ver e alternar entre modos KDS, mas esta e uma decisao de negocio que deve ser controlada apenas pelo administrador.

2. **Header em modo fullscreen**: Atualmente mostra todas as informacoes (email, badges, botoes de configuracao, etc). O usuario pediu que em fullscreen apareca apenas o botao de fullscreen e informacoes dos pedidos.

## Solucao Proposta

### Parte 1: Modo KDS Controlado pelo Admin

**Adicionar campo `kds_default_mode` na tabela `app_settings`**

O admin configura qual modo os operadores KDS verao:
- `items` (Por Item) - padrao
- `orders` (Por Pedido)

**Logica:**
- Se usuario e admin/owner: mostra as abas para poder alternar
- Se usuario e operador comum: usa o modo definido nas configuracoes (sem abas)

### Parte 2: Header Simplificado em Fullscreen

**Quando em fullscreen:**
- Esconder: email do usuario, badges (Proprietario), botao de logout, configuracoes, perfil, simulador, refresh, setor
- Mostrar: apenas o botao de fullscreen (para sair do modo)

**Quando fora do fullscreen:**
- Mostrar tudo normalmente (comportamento atual)

---

## Mudancas Tecnicas

### 1. Migration SQL - Adicionar campo kds_default_mode

```sql
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS kds_default_mode text 
DEFAULT 'items' 
CHECK (kds_default_mode IN ('items', 'orders'));
```

### 2. Arquivo: `src/hooks/useSettings.ts`

Adicionar o novo campo na interface:

```typescript
export interface AppSettings {
  // ... campos existentes
  kds_default_mode: 'items' | 'orders';
}
```

### 3. Arquivo: `src/pages/Index.tsx`

- Buscar `settings.kds_default_mode`
- Se usuario e admin: mostrar abas e permitir alternar
- Se usuario nao e admin: usar o modo das configuracoes, sem abas

```typescript
const { isAdmin } = useAuth();
const { settings } = useSettings();

// Modo KDS: admin pode alternar, usuario usa o configurado
const effectiveKdsMode = isAdmin ? kdsMode : (settings?.kds_default_mode || 'items');
const showKdsTabs = isAdmin && isKDSSector;
```

### 4. Arquivo: `src/components/Header.tsx`

Receber prop `isFullscreen` e simplificar a exibicao:

```typescript
// Quando fullscreen, mostrar apenas o botao de sair
{isFullscreen ? (
  <Button onClick={toggleFullscreen} title="Sair da tela cheia">
    <Minimize />
  </Button>
) : (
  // Mostrar todos os elementos normalmente
  <>
    {user && (...)}
    {isAdmin && <OrderSimulator />}
    {isAdmin && <SettingsDialog />}
    <EditProfileDialog />
    <Button onClick={toggleFullscreen}>...</Button>
    <Button onClick={handleRefresh}>...</Button>
    <Button onClick={handleLogout}>...</Button>
  </>
)}
```

---

## Fluxo de Uso

```text
ADMIN abre Configuracoes
    |
    v
Define kds_default_mode = 'items' ou 'orders'
    |
    v
OPERADOR faz login
    |
    v
Index.tsx verifica: isAdmin?
    |           |
   SIM         NAO
    |           |
    v           v
Mostra       Usa modo das
abas         configuracoes
             (sem abas)
```

```text
USUARIO clica em Fullscreen
    |
    v
Header detecta isFullscreen = true
    |
    v
Esconde: email, badges, logout, config, perfil, refresh
    |
    v
Mostra: apenas botao Minimizar
    |
    v
Usuario clica em Minimizar
    |
    v
Volta ao modo normal com todos elementos
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| Database Migration | Adicionar `kds_default_mode` |
| `src/hooks/useSettings.ts` | Incluir novo campo na interface |
| `src/pages/Index.tsx` | Logica de abas apenas para admin |
| `src/components/Header.tsx` | Simplificar header em fullscreen |
| `src/components/SettingsDialog.tsx` | Adicionar opcao para configurar modo KDS |

---

## Comportamento Final

| Contexto | O que aparece |
|----------|---------------|
| Admin (normal) | Abas Por Item/Por Pedido + todos botoes |
| Admin (fullscreen) | Apenas botao Minimizar |
| Operador (normal) | Modo definido pelo admin + botoes basicos |
| Operador (fullscreen) | Apenas botao Minimizar |

