import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ru from './locales/ru.json';

let savedLanguage = 'en';
try {
  savedLanguage = localStorage.getItem('language') || 'en';
} catch {
  // localStorage may be unavailable in some environments (SSR, strict privacy settings)
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: savedLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem('language', lng);
  } catch {
    // ignore
  }
});

export default i18n;
