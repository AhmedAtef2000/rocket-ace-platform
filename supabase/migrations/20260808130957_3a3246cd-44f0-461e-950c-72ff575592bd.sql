
REVOKE EXECUTE ON FUNCTION public.has_permission(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_admin_role(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_admin_role(UUID, TEXT) TO service_role;
REVOKE SELECT ON public.admin_roles, public.permissions, public.role_permissions FROM authenticated;
