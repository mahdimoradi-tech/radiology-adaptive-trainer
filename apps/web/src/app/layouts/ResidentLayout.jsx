import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMe, useLogout } from '../../features/auth/hooks.js';
import { LanguageSwitcher, Badge, Button } from '../../components/ui/index.js';

export function ResidentLayout() {
  const { t } = useTranslation();
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate('/login', { replace: true });
  };

  const navLinkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-sky-50 text-sky-800 font-semibold shadow-2xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="px-4 md:px-6 py-3 border-b border-slate-200 bg-white sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 md:gap-6">
            {/* Mobile hamburger toggle button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              aria-label={t('nav.toggleMenu')}
              aria-expanded={mobileMenuOpen}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>

            <span className="font-bold text-sky-700 text-base">{t('app.name')}</span>
            <nav className="hidden md:flex items-center gap-1">
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

          <div className="flex items-center gap-2 md:gap-3">
            <LanguageSwitcher />
            {user && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700">{user.displayName}</span>
                <Badge variant="secondary">{t('common.roleResident')}</Badge>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              isLoading={logout.isPending}
              onClick={handleLogout}
              className="hidden sm:inline-flex"
            >
              {t('nav.logout')}
            </Button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 pt-3 pb-2 mt-3 space-y-3">
            <nav className="flex flex-col space-y-1">
              <NavLink
                to="/app"
                end
                className={navLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.home')}
              </NavLink>
              <NavLink
                to="/app/tests"
                className={navLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.tests')}
              </NavLink>
              <NavLink
                to="/app/practice"
                className={navLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.practice')}
              </NavLink>
              <NavLink
                to="/app/progress"
                className={navLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.progress')}
              </NavLink>
              <NavLink
                to="/app/education"
                className={navLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.education')}
              </NavLink>
            </nav>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between sm:hidden">
              {user && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700">{user.displayName}</span>
                  <Badge variant="secondary">{t('common.roleResident')}</Badge>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                isLoading={logout.isPending}
                onClick={handleLogout}
              >
                {t('nav.logout')}
              </Button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        <Outlet />
      </main>

      <footer className="py-4 px-4 sm:px-6 text-center text-xs text-slate-600 border-t border-slate-200 bg-white">
        <p>{t('disclaimer.educational')}</p>
      </footer>
    </div>
  );
}
