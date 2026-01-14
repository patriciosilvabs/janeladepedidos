-- Criar função SECURITY DEFINER para listar usuários com roles (apenas para owners)
CREATE OR REPLACE FUNCTION public.get_users_with_roles()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
  role app_role,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ur.id,
    ur.user_id,
    au.email,
    ur.role,
    ur.created_at
  FROM public.user_roles ur
  JOIN auth.users au ON au.id = ur.user_id
  WHERE public.has_role(auth.uid(), 'owner')
  ORDER BY ur.created_at ASC;
$$;