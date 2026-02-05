import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PrintNodeComputer {
  id: number;
  name: string;
  inet: string | null;
  inet6: string | null;
  hostname: string | null;
  version: string | null;
  jre: string | null;
  createTimestamp: string;
  state: 'connected' | 'disconnected';
}

export interface PrintNodePrinter {
  id: number;
  computer: PrintNodeComputer;
  name: string;
  description: string;
  capabilities: {
    bins?: string[];
    collate?: boolean;
    color?: boolean;
    copies?: number;
    dpis?: string[];
    duplex?: boolean;
    papers?: Record<string, [number, number]>;
  } | null;
  default: boolean | null;
  createTimestamp: string;
  state: 'online' | 'offline';
}

export interface PrintNodeAccount {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  credits: number;
  numComputers: number;
  totalPrints: number;
  state: string;
}

async function callPrintNodeApi(action: string, options?: { method?: string; body?: object; params?: Record<string, string> }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Não autenticado');
  }

  const params = new URLSearchParams({ action });
  if (options?.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      params.append(key, value);
    });
  }

  const response = await supabase.functions.invoke('printnode', {
    body: options?.body,
    method: options?.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Handle the invoke response
  if (response.error) {
    throw new Error(response.error.message || 'Erro na API PrintNode');
  }

  return response.data;
}

// Use fetch with the full URL for query params support
async function callPrintNodeApiWithParams(action: string, options?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; body?: object; params?: Record<string, string> }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Não autenticado');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const params = new URLSearchParams({ action });
  if (options?.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      params.append(key, value);
    });
  }

  const url = `${supabaseUrl}/functions/v1/printnode?${params.toString()}`;
  
  const fetchOptions: RequestInit = {
    method: options?.method || 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  };

  if (options?.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(errorData.error || `Erro ${response.status}`);
  }

  return response.json();
}

export function usePrintNode() {
  const queryClient = useQueryClient();
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Fetch account info (whoami)
  const { data: account, isLoading: isLoadingAccount, refetch: refetchAccount } = useQuery<PrintNodeAccount>({
    queryKey: ['printnode', 'account'],
    queryFn: () => callPrintNodeApiWithParams('whoami'),
    enabled: false, // Only fetch on demand
    retry: false,
  });

  // Fetch printers
  const { 
    data: printers = [], 
    isLoading: isLoadingPrinters,
    refetch: refetchPrinters,
    error: printersError,
  } = useQuery<PrintNodePrinter[]>({
    queryKey: ['printnode', 'printers'],
    queryFn: () => callPrintNodeApiWithParams('printers'),
    enabled: false, // Only fetch on demand
    retry: false,
    staleTime: 60000, // 1 minute
  });

  // Test connection
  const testConnection = useCallback(async () => {
    setIsTestingConnection(true);
    try {
      const data = await callPrintNodeApiWithParams('whoami');
      toast.success(`Conectado como ${data.email}`);
      // Refresh printers after successful connection
      await refetchPrinters();
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao conectar';
      toast.error(`Erro: ${message}`);
      throw error;
    } finally {
      setIsTestingConnection(false);
    }
  }, [refetchPrinters]);

  // Print mutation
  const printMutation = useMutation({
    mutationFn: async (params: {
      printerId: number;
      title: string;
      content: string;
      contentType?: 'raw_base64' | 'pdf_base64' | 'pdf_uri';
      options?: object;
    }) => {
      return callPrintNodeApiWithParams('print', {
        method: 'POST',
        body: params,
      });
    },
    onSuccess: (data) => {
      console.log('Print job submitted:', data);
    },
    onError: (error) => {
      console.error('Print error:', error);
      toast.error(`Erro ao imprimir: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    },
  });

  // Helper to print raw text (ESC/POS commands or plain text)
  const printRaw = useCallback(async (printerId: number, content: string, title?: string) => {
    // Convert string to base64
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    return printMutation.mutateAsync({
      printerId,
      title: title || 'Raw Print',
      content: base64Content,
      contentType: 'raw_base64',
    });
  }, [printMutation]);

  // Helper to print PDF from base64
  const printPdf = useCallback(async (printerId: number, base64Pdf: string, title?: string) => {
    return printMutation.mutateAsync({
      printerId,
      title: title || 'PDF Print',
      content: base64Pdf,
      contentType: 'pdf_base64',
    });
  }, [printMutation]);

  return {
    // Data
    account,
    printers,
    onlinePrinters: printers.filter(p => p.state === 'online'),
    
    // Loading states
    isLoadingAccount,
    isLoadingPrinters,
    isTestingConnection,
    isPrinting: printMutation.isPending,
    
    // Errors
    printersError,
    
    // Actions
    testConnection,
    refetchPrinters,
    printRaw,
    printPdf,
    print: printMutation.mutateAsync,
  };
}
