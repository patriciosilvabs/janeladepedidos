

## Regra: Atualizar APP_VERSION em toda alteracao

### Objetivo

Garantir que **qualquer** modificacao no codigo — por menor que seja — sempre inclua um incremento automatico do `APP_VERSION` em `src/lib/version.ts`. Isso permite que os operadores confirmem visualmente nos tablets se estao rodando a versao mais recente.

### O que sera feito

Nenhuma alteracao de codigo e necessaria. O arquivo `src/lib/version.ts` ja existe e funciona corretamente. A mudanca e **comportamental**:

**A partir de agora, toda resposta minha que modifique qualquer arquivo do projeto incluira obrigatoriamente um incremento do patch version em `src/lib/version.ts`.**

Regra de incremento:
- Correcoes e ajustes pequenos: incrementa o patch (ex: `v1.0.9` -> `v1.0.10`)
- Funcionalidades novas: incrementa o minor (ex: `v1.0.10` -> `v1.1.0`)
- Mudancas grandes/breaking: incrementa o major (ex: `v1.1.0` -> `v2.0.0`)

### Acao imediata

Como a ultima alteracao (correcao do buffer para pedidos nao-delivery) nao atualizou a versao, vou atualizar agora de `v1.0.8` para `v1.0.9`.

### Secao tecnica

Arquivo afetado: `src/lib/version.ts`

```text
Antes:  export const APP_VERSION = 'v1.0.8';
Depois: export const APP_VERSION = 'v1.0.9';
```

Nenhuma outra alteracao necessaria — o Header ja exibe `APP_VERSION` dinamicamente.

