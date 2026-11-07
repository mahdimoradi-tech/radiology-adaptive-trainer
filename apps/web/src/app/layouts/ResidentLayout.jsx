import { Outlet, NavLink, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMe, useLogout } from '../../features/auth/hooks.js';
import { LanguageSwitcher, Badge, Button } from '../../components/ui/index.js';

export function ResidentLayout() {
  const { t } = useTranslation();
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate('/login', { replace: true });
  };

  const navLinkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="px-6 py-3 border-b border-slate-200 bg-white sticky top-0 z-10 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <span className="font-bold text-sky-700 text-base">{t('app.name')}</span>
            <nav className="flex items-center gap-1">
              <NavLink to="/app" end className={navLinkClass}>
                {t('nav.home')}
              </NavLink>
              <NavLink to="/app/tests" className={navLinkClass}>
                {t('nav.tests')}
              </NavLink>
              <NavLink to="/app/practice" className={navLinkClass}>
                {t('nav.practice')}
              </NavLink>
              <NavLink to="/app/progress" className={navLinkClass}>
                {t('nav.progress')}
              </NavLink>
              <NavLink to="/app/education" className={navLinkClass}>
                {t('nav.education')}
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {user && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700">{user.displayName}</span>
                <Badge variant="secondary">{t('common.roleResident')}</Badge>
              </div>
            )}
            <Button variant="outline" size="sm" isLoading={logout.isPending} onClick={handleLogout}>
              {t('nav.logout')}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        <Outlet />
      </main>

      <footer className="py-4 px-6 text-center text-xs text-slate-500 border-t border-slate-200 bg-white">
        <p>{t('disclaimer.educational')}</p>
      </footer>
    </div>
  );
}
