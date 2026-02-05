import { useState, useEffect } from 'react';
import { Printer, CheckCircle, XCircle, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePrintNode, PrintNodePrinter } from '@/hooks/usePrintNode';
import { useSettings } from '@/hooks/useSettings';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { toast } from 'sonner';

export function PrinterSettings() {
  const { settings, saveSettings } = useSettings();
  const { 
    printers, 
    onlinePrinters,
    isLoadingPrinters, 
    isTestingConnection,
    testConnection,
    refetchPrinters,
    printRaw,
    isPrinting,
  } = usePrintNode();

  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  const [printEnabled, setPrintEnabled] = useState(false);

  // Initialize from settings
  useEffect(() => {
    if (settings) {
      setSelectedPrinterId(settings.printnode_printer_id?.toString() || '');
      setPrintEnabled(settings.printnode_enabled || false);
    }
  }, [settings]);

  // Auto-save settings with debounce
  const debouncedSave = useDebouncedCallback(
    (updates: Partial<{ printnode_printer_id: number | null; printnode_enabled: boolean; printnode_dispatch_enabled: boolean }>) => {
      saveSettings.mutate(updates as any, {
        onSuccess: () => toast.success('Configuração salva', { duration: 2000 }),
        onError: () => toast.error('Erro ao salvar configuração'),
      });
    },
    500
  );

  const handleTestConnection = async () => {
    setConnectionStatus('idle');
    try {
      await testConnection();
      setConnectionStatus('success');
    } catch {
      setConnectionStatus('error');
    }
  };

  const handlePrinterChange = (value: string) => {
    setSelectedPrinterId(value);
    const printerId = value ? parseInt(value, 10) : null;
    debouncedSave({ printnode_printer_id: printerId });
  };

  const handleEnabledChange = (checked: boolean) => {
    setPrintEnabled(checked);
    debouncedSave({ printnode_enabled: checked });
  };

  const handleTestPrint = async () => {
    if (!selectedPrinterId) {
      toast.error('Selecione uma impressora primeiro');
      return;
    }

    const printerId = parseInt(selectedPrinterId, 10);
    const testContent = `
================================
    TESTE DE IMPRESSAO
================================

Buffer Logistico
Impressao via PrintNode

Data: ${new Date().toLocaleString('pt-BR')}

Impressora ID: ${printerId}
Status: OK

================================
`;

    try {
      await printRaw(printerId, testContent, 'Teste de Impressão');
      toast.success('Impressão de teste enviada!');
    } catch (error) {
      toast.error('Erro ao enviar impressão de teste');
    }
  };

  const selectedPrinter = printers.find(p => p.id.toString() === selectedPrinterId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            PrintNode
          </CardTitle>
          <CardDescription>
            Configure a impressão automática via PrintNode. Itens prontos serão enviados automaticamente para a impressora selecionada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Test */}
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={isTestingConnection}
            >
              {isTestingConnection ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Testar Conexão
                </>
              )}
            </Button>

            {connectionStatus === 'success' && (
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Conectado</span>
              </div>
            )}

            {connectionStatus === 'error' && (
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                <span className="text-sm">Erro na conexão</span>
              </div>
            )}
          </div>

          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Habilitar Impressão Automática</Label>
              <p className="text-sm text-muted-foreground">
                Quando ativo, itens marcados como prontos serão impressos automaticamente
              </p>
            </div>
            <Switch
              checked={printEnabled}
              onCheckedChange={handleEnabledChange}
            />
          </div>

          {/* Dispatch Print Enable/Disable */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Imprimir ao Marcar Pronto no Despacho</Label>
              <p className="text-sm text-muted-foreground">
                Quando ativo, um ticket será impresso automaticamente ao clicar em PRONTO no painel do forno
              </p>
            </div>
            <Switch
              checked={settings?.printnode_dispatch_enabled || false}
              onCheckedChange={(checked) => {
                debouncedSave({ printnode_dispatch_enabled: checked });
              }}
              disabled={!printEnabled}
            />
          </div>

          {/* Printer Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Impressora</Label>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => refetchPrinters()}
                disabled={isLoadingPrinters}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingPrinters ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            <Select value={selectedPrinterId} onValueChange={handlePrinterChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma impressora" />
              </SelectTrigger>
              <SelectContent>
                {printers.length === 0 ? (
                  <SelectItem value="none" disabled>
                    {isLoadingPrinters ? 'Carregando...' : 'Nenhuma impressora encontrada. Clique em Testar Conexão.'}
                  </SelectItem>
                ) : (
                  printers.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id.toString()}>
                      <div className="flex items-center gap-2">
                        {printer.state === 'online' ? (
                          <Wifi className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <WifiOff className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span>{printer.name}</span>
                        <span className="text-muted-foreground text-xs">
                          ({printer.computer.name})
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {selectedPrinter && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={selectedPrinter.state === 'online' ? 'default' : 'secondary'}>
                    {selectedPrinter.state === 'online' ? 'Online' : 'Offline'}
                  </Badge>
                  <span className="text-sm font-medium">{selectedPrinter.name}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Computador: {selectedPrinter.computer.name}</p>
                  <p>Descrição: {selectedPrinter.description}</p>
                  {selectedPrinter.capabilities?.color !== undefined && (
                    <p>Cor: {selectedPrinter.capabilities.color ? 'Sim' : 'Não'}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Test Print */}
          <div className="pt-4 border-t border-border/50">
            <Button
              variant="secondary"
              onClick={handleTestPrint}
              disabled={!selectedPrinterId || isPrinting}
            >
              {isPrinting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Teste
                </>
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground">
              <strong>Nota:</strong> Certifique-se de que o PrintNode Client está instalado e em execução
              no computador conectado à impressora. Baixe em{' '}
              <a 
                href="https://www.printnode.com/en/download" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                printnode.com/download
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
