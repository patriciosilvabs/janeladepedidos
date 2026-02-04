

# Correção: Tela em Branco no Login de Usuário KDS

## Problema Identificado

Ao fazer login com uma conta de usuário KDS (ex: `user-a@domhelderpizzaria.com.br`), a tela fica em branco sem mostrar a interface do KDS.

**Causa Raiz:** No componente `KDSItemsDashboard.tsx`, linha 16:
```tsx
const kdsSectors = useMemo(
  () => sectors.filter((s) => s.view_type === 'kds'),
  [sectors]
);
```

O `sectors` pode ser `undefined` enquanto a query está carregando. O `useMemo` é executado antes do check de `isLoading`, causando o erro `Cannot read properties of undefined (reading 'filter')`.

---

## Solucao

Adicionar null-safety check no `useMemo`:

**Arquivo:** `src/components/kds/KDSItemsDashboard.tsx`

```typescript
// Linha 15-18 - ANTES:
const kdsSectors = useMemo(
  () => sectors.filter((s) => s.view_type === 'kds'),
  [sectors]
);

// DEPOIS:
const kdsSectors = useMemo(
  () => sectors?.filter((s) => s.view_type === 'kds') ?? [],
  [sectors]
);
```

---

## Fluxo Corrigido

```text
1. Usuario KDS faz login
2. Index.tsx busca sector do usuario via useUserSector()
3. userSector.view_type === 'kds' -> renderiza KDSItemsDashboard
4. useSectors() retorna sectors = undefined enquanto carrega
5. kdsSectors = sectors?.filter(...) ?? [] -> retorna array vazio (sem crash)
6. isLoading = true -> mostra loader
7. Quando sectors carrega, kdsSectors e calculado com dados reais
8. Interface KDS aparece corretamente
```

---

## Beneficios

- Interface KDS carrega corretamente para usuarios vinculados a setores KDS
- Evita crashes durante o carregamento inicial
- Padroniza o null-safety em todo o projeto

