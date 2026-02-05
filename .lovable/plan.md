

# Plano: Melhorar Destaque Visual do Primeiro Item FIFO

## Situação Atual

O código já implementa:
- Badge de sequência: `#1`, `#2`, `#3` (mas pequeno: `w-7 h-7`, `text-xs`)
- Escala do primeiro card: `scale-105` (5%)
- Sombra: `shadow-lg shadow-primary/20`

## Melhorias Propostas

### 1. Badge de Sequência Maior e Mais Visível

| Elemento | Atual | Proposto |
|----------|-------|----------|
| Tamanho | `w-7 h-7` (28px) | `w-9 h-9` (36px) |
| Fonte | `text-xs` | `text-base font-extrabold` |
| Posição | `-top-2 -left-2` | `-top-3 -left-3` |
| Badge #1 | Cor sólida | Animação de brilho (glow) |

### 2. Escala Maior para o Primeiro Card

| Elemento | Atual | Proposto |
|----------|-------|----------|
| Escala | `scale-105` (5%) | `scale-110` (10%) |
| Sombra | `shadow-lg` | `shadow-xl shadow-primary/30` |
| Z-index | `z-10` | `z-20` |

### 3. Fundo Diferenciado para o Primeiro Card

Adicionar um fundo levemente mais claro/destacado para o card #1:
- `bg-gradient-to-br from-primary/5 to-transparent`

---

## Arquivo a Modificar

`src/components/kds/KDSItemCard.tsx`

### Mudanças no Badge de Sequência (linhas 193-201)

```tsx
// ANTES
<div className={cn(
  "absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-lg",
  isFirstInQueue 
    ? "bg-primary text-primary-foreground" 
    : "bg-muted-foreground/80 text-background"
)}>
  #{queuePosition}
</div>

// DEPOIS
<div className={cn(
  "absolute -top-3 -left-3 rounded-full flex items-center justify-center font-extrabold shadow-xl",
  isFirstInQueue 
    ? "w-10 h-10 text-lg bg-primary text-primary-foreground ring-2 ring-primary/50 animate-pulse" 
    : "w-8 h-8 text-sm bg-muted-foreground/80 text-background"
)}>
  #{queuePosition}
</div>
```

### Mudanças no Container do Card (linhas 186-191)

```tsx
// ANTES
<div className={cn(
  "rounded-lg border-2 p-3 transition-all duration-300 relative",
  isFifoEnabled ? getUrgencyColor() : getDefaultStatusColor(),
  isFifoEnabled && isFirstInQueue && item.status === 'pending' && "scale-105 shadow-lg shadow-primary/20 z-10"
)}>

// DEPOIS
<div className={cn(
  "rounded-lg border-2 p-3 transition-all duration-300 relative",
  isFifoEnabled ? getUrgencyColor() : getDefaultStatusColor(),
  isFifoEnabled && isFirstInQueue && item.status === 'pending' && 
    "scale-110 shadow-xl shadow-primary/30 z-20 bg-gradient-to-br from-primary/10 to-transparent border-primary"
)}>
```

---

## Resultado Visual Esperado

```
Modo FIFO Ativado:

┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  ┌──────────────────────┐   ┌─────────────────┐   ┌──────────┐│
│  │ ╭───╮                │   │ ╭──╮            │   │ ╭──╮     ││
│  │ │ 1 │  (GRANDE)      │   │ │2 │ (pequeno)  │   │ │3 │     ││
│  │ ╰───╯                │   │ ╰──╯            │   │ ╰──╯     ││
│  │     #ML8X   6:42     │   │   #ML8Y  2:15   │   │ #ML8Z    ││
│  │                      │   │                 │   │          ││
│  │   Pizza Calabresa    │   │  Pizza Bacon    │   │ Pizza 4Q ││
│  │   ████████████ 100%  │   │  █████░░ 45%    │   │ ██░░ 15% ││
│  │                      │   │                 │   │          ││
│  │  [✨ INICIAR ✨]     │   │ [  INICIAR  ]   │   │[INICIAR] ││
│  │   (10% MAIOR)        │   │   (normal)      │   │ (normal) ││
│  └──────────────────────┘   └─────────────────┘   └──────────┘│
│   BORDA VERMELHA              BORDA AMARELA       BORDA VERDE │
│   + FUNDO GRADIENTE                                           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Resumo das Mudanças

| Elemento | Antes | Depois |
|----------|-------|--------|
| Badge #1 | 28px, `text-xs` | 40px, `text-lg`, pulsando |
| Badges #2+ | 28px, `text-xs` | 32px, `text-sm` |
| Escala Card #1 | 5% (`scale-105`) | 10% (`scale-110`) |
| Sombra Card #1 | `shadow-lg` | `shadow-xl` mais intensa |
| Fundo Card #1 | Igual aos outros | Gradiente sutil `from-primary/10` |
| Borda Card #1 | Cor do semáforo | `border-primary` |

