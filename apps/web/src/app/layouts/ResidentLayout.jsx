import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMe, useLogout } from '../../features/auth/hooks.js';
import { LanguageSwitcher, Button } from '../../components/ui/index.js';

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
    `inline-flex items-center px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all ${
      isActive
        ? 'bg-sky-50 text-sky-900 border border-sky-200/90 shadow-2xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="px-4 md:px-6 h-16 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm sticky top-0 z-30 shadow-2xs flex items-center">
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 md:gap-6">
            {/* Mobile hamburger toggle button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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

            {/* Brand Logo & Name */}
            <NavLink
              to="/app"
              className="flex items-center gap-2.5 text-slate-900 group focus:outline-none"
            >
              <div className="w-9 h-9 rounded-xl bg-linear-to-br from-sky-500 to-sky-700 text-white flex items-center justify-center shadow-2xs group-hover:scale-102 transition-transform">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM12 9v6m-3-3h6"
                  />
                </svg>
              </div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 group-hover:text-sky-700 transition-colors">
                {t('app.name')}
              </span>
            </NavLink>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1.5 ms-2">
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

          {/* User & Utilities */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <LanguageSwitcher />

            <div className="hidden sm:block h-5 w-px bg-slate-200" aria-hidden="true" />

            {user && (
              <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs">
                <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center">
                  {user.displayName ? user.displayName.charAt(0) : 'ر'}
                </div>
                <span className="text-xs font-semibold text-slate-800">{user.displayName}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white text-sky-800 border border-sky-200 shadow-2xs">
                  {t('common.roleResident')}
                </span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              isLoading={logout.isPending}
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-700 hover:text-rose-700 hover:border-rose-300 hover:bg-rose-50/60 rounded-xl"
            >
              <svg
                className="w-3.5 h-3.5 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span>{t('nav.logout')}</span>
            </Button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-16 start-0 end-0 bg-white border-b border-slate-200 px-4 pt-3 pb-4 space-y-3 shadow-md z-30">
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
                  <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center">
                    {user.displayName ? user.displayName.charAt(0) : 'ر'}
                  </div>
                  <span className="text-xs font-semibold text-slate-800">{user.displayName}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white text-sky-800 border border-sky-200 shadow-2xs">
                    {t('common.roleResident')}
                  </span>
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

      <footer className="border-t border-slate-200 py-4 px-4 sm:px-6 text-center text-xs text-slate-600 bg-white">
        <p>{t('disclaimer.educational')}</p>
      </footer>
    </div>
  );
}
