

# Corrigir atraso visual do botao PRONTO no tablet

## Problema

Quando o usuario toca em "PRONTO" no tablet, o React troca o `<Button>` pelo `<Badge>` verde. Porem, navegadores em tablets mantem o estado de "hover/active" do toque anterior, o que pode bloquear o repaint ate que o usuario toque em outro lugar da tela.

## Solucao

Aplicar a cor verde via `style={{ backgroundColor }}` inline no Badge, em vez de depender apenas da classe Tailwind. Cores inline tem prioridade absoluta e forcam o navegador a repintar imediatamente, sem depender da resolucao de classes CSS.

Adicionalmente, adicionar um estado local `localReady` que e setado imediatamente ao clicar, para que a troca visual de Button para Badge aconteca instantaneamente no componente, sem esperar a resposta do servidor.

## Alteracoes

**Arquivo:** `src/components/kds/OvenItemRow.tsx`

1. Adicionar estado local `localReady`:
```tsx
const [localReady, setLocalReady] = useState(false);
```

2. Atualizar `alreadyReady` para incluir o estado local:
```tsx
const alreadyReady = localReady || isMarkedReady || item.status === 'ready';
```

3. Envolver `onMarkReady` para setar `localReady` imediatamente:
```tsx
const handleReady = () => {
  setLocalReady(true);
  onMarkReady();
};
```

4. Usar `style` inline no Badge verde para forcar repaint:
```tsx
<Badge 
  className="text-white shrink-0 text-lg px-4 py-1.5"
  style={{ backgroundColor: '#16a34a' }}
>
```

5. Atualizar o `onClick` do Button para usar `handleReady`.

