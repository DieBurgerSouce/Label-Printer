/**
 * i18n Configuration
 * Internationalization setup with i18next
 * Supports German (de) and English (en)
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import de from './locales/de.json';
import en from './locales/en.json';

// Available languages
export const SUPPORTED_LANGUAGES = ['de', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Language display names
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  de: 'Deutsch',
  en: 'English',
};

// Language flags (emoji)
export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  de: '🇩🇪',
  en: '🇬🇧',
};

// Resources
const resources = {
  de: { translation: de },
  en: { translation: en },
};

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'de',
    defaultNS: 'translation',

    // Language detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React already escapes
    },

    // React options
    react: {
      useSuspense: true,
    },
  });

/**
 * Change the current language
 */
export function changeLanguage(lng: SupportedLanguage): Promise<void> {
  return i18n.changeLanguage(lng).then(() => {
    // Store preference
    localStorage.setItem('i18nextLng', lng);
  });
}

/**
 * Get current language
 */
export function getCurrentLanguage(): SupportedLanguage {
  const current = i18n.language;
  if (SUPPORTED_LANGUAGES.includes(current as SupportedLanguage)) {
    return current as SupportedLanguage;
  }
  // Return base language if region code (e.g., 'de-DE' -> 'de')
  const base = current.split('-')[0];
  if (SUPPORTED_LANGUAGES.includes(base as SupportedLanguage)) {
    return base as SupportedLanguage;
  }
  return 'de';
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(lng: string): lng is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lng as SupportedLanguage);
}

export default i18n;
