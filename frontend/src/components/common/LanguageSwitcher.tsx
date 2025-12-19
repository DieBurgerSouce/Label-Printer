/**
 * Language Switcher Component
 * Dropdown to switch between supported languages
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_NAMES,
  LANGUAGE_FLAGS,
  changeLanguage,
  getCurrentLanguage,
  type SupportedLanguage,
} from '../../i18n';

interface LanguageSwitcherProps {
  /** Compact mode shows only flag */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

export function LanguageSwitcher({ compact = false, className = '' }: LanguageSwitcherProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(getCurrentLanguage());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle language change
  const handleLanguageChange = async (lang: SupportedLanguage) => {
    await changeLanguage(lang);
    setCurrentLang(lang);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg
          bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
          text-gray-700 dark:text-gray-200
          transition-colors duration-200
          focus:outline-none focus:ring-2 focus:ring-blue-500
        `}
        aria-label={t('common.language')}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="text-lg" role="img" aria-label={LANGUAGE_NAMES[currentLang]}>
          {LANGUAGE_FLAGS[currentLang]}
        </span>
        {!compact && (
          <>
            <span className="text-sm font-medium">{LANGUAGE_NAMES[currentLang]}</span>
            <svg
              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`
            absolute right-0 mt-2 py-1 w-40
            bg-white dark:bg-gray-800
            border border-gray-200 dark:border-gray-700
            rounded-lg shadow-lg
            z-50
          `}
          role="listbox"
          aria-label={t('common.language')}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => handleLanguageChange(lang)}
              className={`
                w-full flex items-center gap-3 px-4 py-2
                text-left text-sm
                hover:bg-gray-100 dark:hover:bg-gray-700
                transition-colors duration-150
                ${
                  currentLang === lang
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-200'
                }
              `}
              role="option"
              aria-selected={currentLang === lang}
            >
              <span className="text-lg" role="img" aria-hidden="true">
                {LANGUAGE_FLAGS[lang]}
              </span>
              <span className="font-medium">{LANGUAGE_NAMES[lang]}</span>
              {currentLang === lang && (
                <svg
                  className="w-4 h-4 ml-auto text-blue-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
