import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Apply direction and lang attributes to documentElement
 * @param {string} [language='fa']
 * @returns {{ dir: 'rtl' | 'ltr', lang: 'fa' | 'en' }}
 */
export function applyDirection(language = 'fa') {
  const isEn = language?.startsWith('en');
  const dir = isEn ? 'ltr' : 'rtl';
  const lang = isEn ? 'en' : 'fa';

  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
  }

  return { dir, lang };
}

/**
 * React hook that binds the document's dir and lang to the active i18n language
 * @returns {{ dir: 'rtl' | 'ltr', lang: 'fa' | 'en', isRtl: boolean }}
 */
export function useDirection() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'fa';
  const { dir, lang } = applyDirection(currentLang);

  useEffect(() => {
    applyDirection(currentLang);
  }, [currentLang]);

  return {
    dir,
    lang,
    isRtl: dir === 'rtl',
  };
}
