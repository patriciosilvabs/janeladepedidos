-- Remover o check constraint existente
ALTER TABLE sectors DROP CONSTRAINT IF EXISTS sectors_view_type_check;

-- Adicionar novo constraint com 'dispatch' incluído
ALTER TABLE sectors 
ADD CONSTRAINT sectors_view_type_check 
CHECK (view_type IN ('kds', 'management', 'dispatch'));

-- Atualizar setor DESPACHO existente para usar o novo tipo
UPDATE sectors 
SET view_type = 'dispatch' 
WHERE UPPER(name) = 'DESPACHO';