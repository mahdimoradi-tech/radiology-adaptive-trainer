import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useMe, useLogout } from '../../features/auth/hooks.js';
import { LanguageSwitcher, Button } from '../../components/ui/index.js';

export function InstructorLayout() {
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
        ? 'bg-amber-50 text-amber-950 border border-amber-200/90 shadow-2xs'
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
              className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
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
              to="/instructor"
              className="flex items-center gap-2.5 text-slate-900 group focus:outline-none"
            >
              <div className="w-9 h-9 rounded-xl bg-linear-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-2xs group-hover:scale-102 transition-transform">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                  />
                </svg>
              </div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 group-hover:text-amber-800 transition-colors">
                {t('instructor.title')}
              </span>
            </NavLink>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1.5 ms-2">
              <NavLink to="/instructor" end className={navLinkClass}>
                {t('nav.home')}
              </NavLink>
              <NavLink to="/instructor/review" className={navLinkClass}>
                {t('nav.review')}
              </NavLink>
              <NavLink to="/instructor/residents" className={navLinkClass}>
                {t('nav.residents')}
              </NavLink>
              <NavLink to="/instructor/catalog" className={navLinkClass}>
                {t('nav.catalog')}
              </NavLink>
            </nav>
          </div>

          {/* User & Utilities */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <LanguageSwitcher />

            <div className="hidden sm:block h-5 w-px bg-slate-200" aria-hidden="true" />

            {user && (
              <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs">
                <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center">
                  {user.displayName ? user.displayName.charAt(0) : 'ا'}
                </div>
                <span className="text-xs font-semibold text-slate-800">{user.displayName}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white text-amber-800 border border-amber-200 shadow-2xs">
                  {t('common.roleInstructor')}
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
                to="/instructor"
                end
                className={navLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.home')}
              </NavLink>
              <NavLink
                to="/instructor/review"
                className={navLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.review')}
              </NavLink>
              <NavLink
                to="/instructor/residents"
                className={navLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.residents')}
              </NavLink>
              <NavLink
                to="/instructor/catalog"
                className={navLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.catalog')}
              </NavLink>
            </nav>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between sm:hidden">
              {user && (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center">
                    {user.displayName ? user.displayName.charAt(0) : 'ا'}
                  </div>
                  <span className="text-xs font-semibold text-slate-800">{user.displayName}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white text-amber-800 border border-amber-200 shadow-2xs">
                    {t('common.roleInstructor')}
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
