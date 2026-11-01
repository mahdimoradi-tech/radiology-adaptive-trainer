import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fa from './locales/fa.json';
import en from './locales/en.json';

/**
 * Determine initial language from storage or default to 'fa'
 * @returns {'fa' | 'en'}
 */
export const getInitialLanguage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('rt_lang');
      if (saved === 'fa' || saved === 'en') {
        return saved;
      }
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return 'fa';
};

i18n.use(initReactI18next).init({
  resources: {
    fa: { translation: fa },
    en: { translation: en },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'fa',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
