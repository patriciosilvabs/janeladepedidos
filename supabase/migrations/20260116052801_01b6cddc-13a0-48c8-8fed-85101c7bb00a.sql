-- Drop and recreate get_users_with_roles function to include sector_id
DROP FUNCTION IF EXISTS public.get_users_with_roles();

CREATE FUNCTION public.get_users_with_roles()
RETURNS TABLE(id uuid, user_id uuid, email text, role app_role, sector_id uuid, created_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ur.id,
    ur.user_id,
    au.email,
    ur.role,
    ur.sector_id,
    ur.created_at
  FROM public.user_roles ur
  JOIN auth.users au ON au.id = ur.user_id
  WHERE public.has_role(auth.uid(), 'owner')
  ORDER BY ur.created_at ASC;
$$;