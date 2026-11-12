import { Outlet, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../components/ui/index.js';

export function PublicLayout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-slate-200 bg-white shadow-2xs">
        <Link
          to="/"
          className="text-base font-bold text-sky-700 hover:text-sky-800 transition-colors"
        >
          {t('app.name')}
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <Outlet />
      </main>

      <footer className="py-4 px-4 sm:px-6 text-center text-xs text-slate-600 border-t border-slate-200 bg-white">
        <p>{t('disclaimer.educational')}</p>
      </footer>
    </div>
  );
}
