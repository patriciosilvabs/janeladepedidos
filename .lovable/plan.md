
# Plano: Remover Destaque e Animações dos Cards

## Objetivo

1. Todos os cards devem ter o **mesmo tamanho** - remover destaque especial do primeiro card
2. O número de posição na fila (#1, #2, etc) **não deve ter animação** e **não pode ser transparente**

---

## Mudanças Propostas

**Arquivo**: `src/components/kds/KDSItemCard.tsx`

### 1. Remover Destaque do Primeiro Card (linha 190-191)

```tsx
// ANTES
isFifoEnabled && isFirstInQueue && item.status === 'pending' && 
  "scale-110 shadow-xl shadow-primary/30 z-20 bg-gradient-to-br from-primary/10 to-transparent border-primary"

// DEPOIS
// Remover completamente esta linha - todos os cards terão o mesmo tamanho
```

### 2. Badge de Posição Sem Animação e Sem Transparência (linhas 195-202)

```tsx
// ANTES
<div className={cn(
  "absolute -top-3 -left-3 rounded-full flex items-center justify-center font-extrabold shadow-xl",
  isFirstInQueue 
    ? "w-10 h-10 text-lg bg-primary text-primary-foreground ring-2 ring-primary/50 animate-pulse" 
    : "w-8 h-8 text-sm bg-muted-foreground/80 text-background"
)}>
  #{queuePosition}
</div>

// DEPOIS
<div className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold bg-primary text-primary-foreground shadow-lg">
  #{queuePosition}
</div>
```

---

## Mudanças Detalhadas

| Elemento | Antes | Depois |
|----------|-------|--------|
| Primeiro card | `scale-110` (10% maior) | Tamanho normal |
| Primeiro card | `shadow-xl shadow-primary/30` | Sem sombra extra |
| Primeiro card | `bg-gradient-to-br` | Sem gradiente |
| Badge #1 | `animate-pulse` | Sem animação |
| Badge #1 | `w-10 h-10 text-lg` | `w-8 h-8 text-sm` (igual aos outros) |
| Badge #2+ | `bg-muted-foreground/80` (transparente) | `bg-primary` (sólido) |
| Todos os badges | Tamanhos diferentes | Mesmo tamanho |

---

## Resultado Visual

```text
ANTES:                           DEPOIS:
+--------------------+           +------------------+
| #1 (GRANDE, PULSE) |           | #1               |
|    CARD MAIOR      |           |                  |
|    com sombra      |           | Pizza Calabresa  |
|    e gradiente     |           |                  |
+--------------------+           | [INICIAR]        |
+------------------+             +------------------+
| #2 (pequeno,     |             | #2               |
|    transparente) |             |                  |
| Pizza Queijos    |             | Pizza Queijos    |
| [INICIAR]        |             |                  |
+------------------+             | [INICIAR]        |
                                 +------------------+

Todos os cards iguais, badges sólidos sem animação
```

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/kds/KDSItemCard.tsx` | Remover scale/shadow do primeiro card, uniformizar badges |
