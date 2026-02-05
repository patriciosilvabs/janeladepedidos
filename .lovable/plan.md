
# Plano: Integrar Impressão Silenciosa com QZ Tray

## O que é QZ Tray?

O QZ Tray é um aplicativo Java que permite que páginas web imprimam diretamente em impressoras locais **sem abrir a janela de diálogo do navegador**. Ideal para operações de cozinha onde a impressão precisa ser instantânea.

---

## Situação Atual

O sistema já possui impressão funcionando no `OvenTimerPanel.tsx`, mas usa `window.open()` + `window.print()` que:
- Abre uma nova janela
- Exibe o diálogo de impressão do navegador
- Requer interação manual

---

## Arquitetura da Solução

```text
+----------------+       WebSocket        +-------------+
|  Navegador     | <-------------------> |  QZ Tray    |
|  (React App)   |    (wss://localhost)  | (Instalado  |
|                |                        |  no PC)     |
+----------------+                        +------+------+
                                                 |
                                                 | USB/Rede
                                                 v
                                          +-------------+
                                          | Impressora  |
                                          | Térmica     |
                                          +-------------+
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/lib/qzTray.ts` | **Criar** | Serviço de conexão e impressão com QZ Tray |
| `src/hooks/useQZTray.ts` | **Criar** | Hook React para gerenciar estado da conexão |
| `src/components/PrinterSettings.tsx` | **Criar** | UI para selecionar impressora e testar |
| `src/components/SettingsDialog.tsx` | **Modificar** | Adicionar aba "Impressão" |
| `src/components/kds/OvenTimerPanel.tsx` | **Modificar** | Substituir impressão do navegador por QZ Tray |
| `public/qz-tray.js` | **Criar** | Biblioteca JavaScript do QZ Tray |
| `index.html` | **Modificar** | Carregar script do QZ Tray |

---

## Detalhes Técnicos

### 1. Biblioteca QZ Tray (`public/qz-tray.js`)
Copiar a biblioteca oficial do QZ Tray para o projeto (arquivo público que será carregado no HTML).

### 2. Serviço de Impressão (`src/lib/qzTray.ts`)

```typescript
// Funções principais:
- connect(): Conectar ao QZ Tray local
- disconnect(): Desconectar
- getPrinters(): Listar impressoras disponíveis
- printReceipt(printerName, content): Imprimir comanda
- getConnectionStatus(): Verificar se está conectado
```

### 3. Hook React (`src/hooks/useQZTray.ts`)

```typescript
// Estados gerenciados:
- isConnected: boolean
- printers: string[]
- selectedPrinter: string | null
- isLoading: boolean
- error: string | null

// Funções expostas:
- connect()
- disconnect()
- refreshPrinters()
- printReceipt(item: OrderItemWithOrder)
- setSelectedPrinter(name: string)
```

### 4. Configurações de Impressão

Adicionar na tabela `app_settings`:
- `qz_printer_name`: Nome da impressora selecionada
- `qz_print_enabled`: Habilitar/desabilitar impressão silenciosa

### 5. Fluxo de Impressão no KDS

```text
1. Operador clica "PRONTO" no OvenTimerPanel
2. Sistema chama markItemReady()
3. Se QZ Tray conectado e configurado:
   - Envia comanda diretamente para impressora
   - Sem janelas, sem diálogos
4. Se QZ Tray não disponível:
   - Fallback para impressão atual (window.print())
```

---

## Formato da Comanda (ESC/POS)

Para impressoras térmicas, usaremos comandos ESC/POS:

```text
================================
        #180706302
     PIZZARIA CENTRAL
================================

2x PIZZA CALABRESA G
   • 1/2 Calabresa
   • 1/2 Mussarela

BORDA: #Cheddar

⚠️ OBS: SEM CEBOLA

--------------------------------
Cliente: JOÃO SILVA
Bairro: Manaíra
--------------------------------
        05/02/2026 14:30
================================
```

---

## Pré-requisitos do Usuário

Antes de usar, o usuário precisa:
1. Baixar e instalar o QZ Tray em: https://qz.io/download/
2. Executar o QZ Tray (ícone na bandeja do sistema)
3. Configurar a impressora no painel de Configurações do app

---

## Interface de Configuração

Nova aba "Impressão" nas Configurações:

```text
┌─────────────────────────────────────────┐
│ 🖨️ Configuração de Impressão           │
├─────────────────────────────────────────┤
│                                         │
│ Status: ● Conectado ao QZ Tray          │
│                                         │
│ Impressora: [Dropdown com lista]    ▼   │
│                                         │
│ [🔄 Atualizar Lista] [🧪 Imprimir Teste]│
│                                         │
│ ☑️ Imprimir automaticamente ao marcar   │
│    item como pronto                     │
│                                         │
│ ─────────────────────────────────────   │
│ ⚠️ Pré-requisitos:                      │
│ 1. Instale o QZ Tray: qz.io/download    │
│ 2. Execute o aplicativo                 │
│ 3. Permita a conexão quando solicitado  │
└─────────────────────────────────────────┘
```

---

## Migração de Banco de Dados

```sql
-- Adicionar colunas de configuração de impressão
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS qz_printer_name text,
ADD COLUMN IF NOT EXISTS qz_print_enabled boolean DEFAULT false;
```

---

## Tratamento de Erros

| Cenário | Comportamento |
|---------|---------------|
| QZ Tray não instalado | Mostra aviso na UI, usa fallback |
| QZ Tray fechado | Tenta reconectar, fallback se falhar |
| Impressora offline | Notifica usuário, tenta fallback |
| Erro de impressão | Log + toast de erro, permite retry |

---

## Benefícios

1. **Impressão instantânea** - Sem cliques extras
2. **Sem janelas popup** - Experiência limpa
3. **Suporte a múltiplas impressoras** - Configurável
4. **Fallback automático** - Sempre funciona
5. **Comandos ESC/POS** - Layout otimizado para térmicas

