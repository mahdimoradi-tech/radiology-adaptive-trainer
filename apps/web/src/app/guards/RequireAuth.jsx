import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../../features/auth/hooks.js';
import { Spinner } from '../../components/ui/index.js';

export function RequireAuth() {
  const { data: user, isLoading } = useMe();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
