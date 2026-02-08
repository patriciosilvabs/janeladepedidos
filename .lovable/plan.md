

# Adicionar aba "Painel do Forno" para administradores

## Problema

Administradores/proprietarios sem setor fixo so veem duas abas: "Despacho" e "KDS Producao". O "Painel do Forno" (DispatchDashboard) so aparece para usuarios vinculados a um setor do tipo `dispatch`, impedindo que o proprietario monitore o forno diretamente.

## Solucao

Adicionar uma terceira aba "Forno" no header para administradores, permitindo acesso ao DispatchDashboard sem precisar estar vinculado a um setor de despacho.

```text
ANTES:
[ Despacho ] [ KDS Producao ]

DEPOIS:
[ Despacho ] [ KDS Producao ] [ Forno ]
```

## Detalhes Tecnicos

### Arquivo: `src/pages/Index.tsx`

1. Expandir o tipo do estado `mainView` de `'dashboard' | 'kds'` para `'dashboard' | 'kds' | 'dispatch'`
2. Adicionar uma terceira aba "Forno" no bloco `showMainViewTabs` com o valor `'dispatch'`
3. No bloco de renderizacao condicional, quando `mainView === 'dispatch'`, renderizar o componente `<DispatchDashboard />`

### Nenhuma outra alteracao necessaria

- O componente `DispatchDashboard` ja existe e funciona de forma independente
- O `OvenTimerPanel` dentro dele ja busca todos os itens `in_oven` sem filtro de setor
- Nenhuma migracao SQL ou alteracao de backend necessaria
