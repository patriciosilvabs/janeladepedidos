-- Criar tabela de grupos de entrega
CREATE TABLE public.delivery_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_lat DOUBLE PRECISION NOT NULL,
    center_lng DOUBLE PRECISION NOT NULL,
    order_count INTEGER NOT NULL DEFAULT 1,
    max_orders INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    dispatched_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'dispatched'))
);

-- Criar tabela de pedidos
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT UNIQUE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    address TEXT NOT NULL,
    neighborhood TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'waiting_buffer', 'dispatched')),
    group_id UUID REFERENCES public.delivery_groups(id),
    items JSONB,
    total_amount DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    ready_at TIMESTAMP WITH TIME ZONE,
    dispatched_at TIMESTAMP WITH TIME ZONE
);

-- Criar índices para performance (200+ pedidos/dia)
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_group_id ON public.orders(group_id);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_delivery_groups_status ON public.delivery_groups(status);

-- Habilitar RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_groups ENABLE ROW LEVEL SECURITY;

-- Políticas públicas para o webhook e dashboard (sem autenticação por enquanto)
CREATE POLICY "Allow all operations on orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on delivery_groups" ON public.delivery_groups FOR ALL USING (true) WITH CHECK (true);

-- Habilitar realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_groups;