import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, Role } from '../store/auth';

export function RoleRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!hasRole(...roles)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export function RedirectByRole() {
  const { user, loading, hasRole } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  // Home: jefes/RRHH/dueño → histórico de equipo; colaboradores → histórico personal.
  if (hasRole('JEFE', 'RRHH', 'DUENO')) return <Navigate to="/historico-equipo" replace />;
  return <Navigate to="/historico" replace />;
}
