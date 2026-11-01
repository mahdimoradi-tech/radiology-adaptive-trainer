import { useTranslation } from 'react-i18next';

/**
 * Language switcher toggle button between Persian (fa) and English (en)
 * @param {Object} props
 * @param {string} [props.className='']
 */
export function LanguageSwitcher({ className = '' }) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('en') ? 'en' : 'fa';
  const targetLang = currentLang === 'fa' ? 'en' : 'fa';
  const label = currentLang === 'fa' ? 'English' : 'فارسی';

  const handleToggle = () => {
    i18n.changeLanguage(targetLang);
    try {
      localStorage.setItem('rt_lang', targetLang);
    } catch {
      // Ignore localStorage errors in private browsing/sandboxes
    }
    document.documentElement.lang = targetLang;
    document.documentElement.dir = targetLang === 'fa' ? 'rtl' : 'ltr';
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`px-2.5 py-1 text-xs font-medium rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer ${className}`}
      aria-label={`تغییر زبان به ${label}`}
    >
      {label}
    </button>
  );
}
