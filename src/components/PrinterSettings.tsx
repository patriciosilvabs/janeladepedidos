import { useState } from 'react';
import { Printer, RefreshCw, CheckCircle, XCircle, Loader2, WifiOff, ExternalLink, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQZTray } from '@/hooks/useQZTray';
import { usePrintJobQueue } from '@/hooks/usePrintJobQueue';
import { cn } from '@/lib/utils';
import { isQZLoaded } from '@/lib/qzTray';

export function PrinterSettings() {
  const {
    isConnected,
    isConnecting,
    printers,
    selectedPrinter,
    isEnabled,
    isReceiverEnabled,
    error,
    connect,
    disconnect,
    refreshPrinters,
    printTestPage,
    setSelectedPrinter,
    setEnabled,
    setReceiverEnabled,
  } = useQZTray();

  // Initialize print job queue listener when receiver mode is enabled
  usePrintJobQueue({
    enabled: isReceiverEnabled,
    printerName: selectedPrinter,
    isQZConnected: isConnected,
  });

  const [isPrinting, setIsPrinting] = useState(false);

  const qzLoaded = isQZLoaded();

  const handleConnect = async () => {
    try {
      if (isConnected) {
        await disconnect();
      } else {
        await connect();
      }
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleTestPrint = async () => {
    setIsPrinting(true);
    try {
      await printTestPage();
    } catch (err) {
      // Error handled in hook
    } finally {
      setIsPrinting(false);
    }
  };

  const handleRefresh = async () => {
    await refreshPrinters();
  };

  const handlePrinterChange = async (value: string) => {
    await setSelectedPrinter(value);
  };

  const handleEnabledChange = async (checked: boolean) => {
    await setEnabled(checked);
  };

  const handleReceiverChange = async (checked: boolean) => {
    await setReceiverEnabled(checked);
  };

  return (
    <div className="space-y-6">
      {/* Header with status */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30">
        <div className="space-y-0.5">
          <Label className="text-base font-medium flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Impressão Silenciosa (QZ Tray)
          </Label>
          <p className="text-sm text-muted-foreground">
            Imprime comandas diretamente na impressora térmica sem diálogo
          </p>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={handleEnabledChange}
        />
      </div>

      {/* QZ Tray not loaded warning */}
      {!qzLoaded && isEnabled && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-start gap-3">
            <WifiOff className="h-5 w-5 text-amber-500 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                QZ Tray não detectado
              </p>
              <p className="text-sm text-muted-foreground">
                Para usar impressão silenciosa, você precisa:
              </p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Baixar e instalar o QZ Tray</li>
                <li>Executar o aplicativo (ícone na bandeja)</li>
                <li>Recarregar esta página</li>
              </ol>
              <a
                href="https://qz.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
              >
                <ExternalLink className="h-3 w-3" />
                Baixar QZ Tray
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Settings when enabled */}
      {isEnabled && qzLoaded && (
        <div className="space-y-4">
          {/* Connection status */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-3 w-3 rounded-full",
                isConnected ? "bg-primary" : "bg-destructive"
              )} />
              <span className="text-sm font-medium">
                {isConnecting
                  ? 'Conectando...' 
                  : isConnected 
                    ? 'Conectado ao QZ Tray' 
                    : 'Desconectado'}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isConnected ? (
                'Desconectar'
              ) : (
                'Conectar'
              )}
            </Button>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          )}

          {/* Printer selection */}
          {isConnected && (
            <>
              <div className="space-y-2">
                <Label>Impressora</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedPrinter || ''}
                    onValueChange={handlePrinterChange}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione uma impressora" />
                    </SelectTrigger>
                    <SelectContent>
                      {printers.length === 0 ? (
                        <SelectItem value="_empty" disabled>
                          Nenhuma impressora encontrada
                        </SelectItem>
                      ) : (
                        printers.map((printer) => (
                          <SelectItem key={printer} value={printer}>
                            {printer}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRefresh}
                    title="Atualizar lista"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Test print button */}
              {selectedPrinter && (
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={handleTestPrint}
                    disabled={isPrinting}
                  >
                    {isPrinting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Imprimindo...
                      </>
                    ) : (
                      <>
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir Teste
                      </>
                    )}
                  </Button>
                  
                  {selectedPrinter && (
                    <div className="flex items-center gap-2 text-primary">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">Impressora configurada</span>
                    </div>
                  )}
                </div>
              )}
              {/* Remote receiver toggle */}
              {selectedPrinter && (
                <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium flex items-center gap-2">
                        <Radio className="h-4 w-4 text-primary" />
                        Receptor de Impressão Remota
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Recebe comandos de impressão de tablets e outras bancadas
                      </p>
                    </div>
                    <Switch
                      checked={isReceiverEnabled}
                      onCheckedChange={handleReceiverChange}
                    />
                  </div>
                  {isReceiverEnabled && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-primary">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      Escutando jobs de impressão remota...
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Fallback info */}
      <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
        <p className="text-sm text-muted-foreground">
          <strong>Fallback automático:</strong> Se o QZ Tray não estiver disponível 
          ou a impressão falhar, o sistema usará automaticamente a impressão do 
          navegador (com diálogo).
        </p>
      </div>

      {/* Remote printing info */}
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-sm text-muted-foreground">
          <strong>Impressão Remota:</strong> Tablets e bancadas sem impressora enviam
          automaticamente para a fila. Este computador, quando configurado como
          "Receptor", processa e imprime os comandos recebidos.
        </p>
      </div>

      {/* Prerequisites */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-muted-foreground">Pré-requisitos</Label>
        <div className="p-4 rounded-lg border border-dashed border-border/50 space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <span className="font-mono text-primary">1.</span>
            <span>
              Instale o QZ Tray em{' '}
              <a
                href="https://qz.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                qz.io/download
              </a>
            </span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <span className="font-mono text-primary">2.</span>
            <span>Execute o aplicativo (aparece na bandeja do sistema)</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <span className="font-mono text-primary">3.</span>
            <span>Permita a conexão quando solicitado pelo navegador</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <span className="font-mono text-primary">4.</span>
            <span>Configure a impressora térmica nesta tela</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <span className="font-mono text-primary">5.</span>
            <span>Ative "Receptor" para receber impressões de tablets</span>
          </div>
        </div>
      </div>
    </div>
  );
}
