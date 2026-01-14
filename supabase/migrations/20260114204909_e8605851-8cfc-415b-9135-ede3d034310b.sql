-- Tabela para armazenar convites pendentes
CREATE TABLE public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
    used_at TIMESTAMPTZ,
    CONSTRAINT unique_pending_invitation UNIQUE (email)
);

-- Habilitar RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Apenas owners podem gerenciar convites
CREATE POLICY "Owners can manage invitations"
ON public.invitations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Função pública para validar token (sem autenticação)
CREATE OR REPLACE FUNCTION public.validate_invitation_token(invitation_token UUID)
RETURNS TABLE (
  email TEXT,
  role app_role,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.email,
    i.role,
    (i.used_at IS NULL AND i.expires_at > now()) AS is_valid
  FROM public.invitations i
  WHERE i.token = invitation_token;
END;
$$;

-- Função para marcar convite como usado e atribuir role
CREATE OR REPLACE FUNCTION public.use_invitation(invitation_token UUID, new_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_role app_role;
BEGIN
  -- Buscar role do convite
  SELECT role INTO inv_role
  FROM public.invitations
  WHERE token = invitation_token
    AND used_at IS NULL
    AND expires_at > now();
  
  IF inv_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Marcar convite como usado
  UPDATE public.invitations
  SET used_at = now()
  WHERE token = invitation_token;
  
  -- Atualizar role do usuário (se for diferente de 'user')
  IF inv_role != 'user' THEN
    UPDATE public.user_roles
    SET role = inv_role
    WHERE user_id = new_user_id;
  END IF;
  
  RETURN TRUE;
END;
$$;