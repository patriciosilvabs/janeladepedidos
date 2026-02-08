
# Remover o bloco "Forno" que envolve os cards

## Problema

O painel do forno esta envolto em um `Card` com header ("Forno", icone de fogo, badge de contagem, botao de audio) e borda laranja. Isso consome espaco visual desnecessario no tablet.

## Solucao

Remover o wrapper `Card`/`CardHeader`/`CardContent` do `OvenTimerPanel`, renderizando os cards dos itens diretamente em um `div` simples com spacing. O botao de audio sera mantido discretamente no canto, pois controla funcionalidade real (alerta sonoro).

## Detalhe Tecnico

**Arquivo:** `src/components/kds/OvenTimerPanel.tsx`

Substituir a estrutura atual:

```
<Card className="border-orange-500/30 ...">
  <CardHeader>
    <Flame /> Forno <Badge>1</Badge>
    <Button audio />
  </CardHeader>
  <CardContent className="space-y-4">
    {items...}
  </CardContent>
</Card>
```

Por uma estrutura simples:

```
<div className="space-y-4">
  {sectorId && <CancellationAlert />}
  {items...}
</div>
```

O botao de audio e o badge de contagem que estavam no header serao removidos da visualizacao (a funcionalidade de audio continua ativa internamente com o estado `audioEnabled` que ja tem default `true`). Os imports de `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Flame`, `Volume2`, `VolumeX`, `Badge` e `Button` que ficarem sem uso serao removidos.
