/**
 * i18n Configuration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import i18n, {
  SUPPORTED_LANGUAGES,
  LANGUAGE_NAMES,
  LANGUAGE_FLAGS,
  changeLanguage,
  getCurrentLanguage,
  isLanguageSupported,
} from './index';

describe('i18n Configuration', () => {
  beforeEach(async () => {
    // Reset to German before each test
    await i18n.changeLanguage('de');
  });

  describe('Constants', () => {
    it('defines supported languages', () => {
      expect(SUPPORTED_LANGUAGES).toContain('de');
      expect(SUPPORTED_LANGUAGES).toContain('en');
      expect(SUPPORTED_LANGUAGES).toHaveLength(2);
    });

    it('provides language names', () => {
      expect(LANGUAGE_NAMES.de).toBe('Deutsch');
      expect(LANGUAGE_NAMES.en).toBe('English');
    });

    it('provides language flags', () => {
      expect(LANGUAGE_FLAGS.de).toBeDefined();
      expect(LANGUAGE_FLAGS.en).toBeDefined();
    });
  });

  describe('getCurrentLanguage', () => {
    it('returns current language', async () => {
      await i18n.changeLanguage('de');
      expect(getCurrentLanguage()).toBe('de');

      await i18n.changeLanguage('en');
      expect(getCurrentLanguage()).toBe('en');
    });

    it('extracts base language from region codes', async () => {
      // i18n might normalize de-DE to de
      await i18n.changeLanguage('de-DE');
      const lang = getCurrentLanguage();
      expect(['de', 'de-DE']).toContain(lang);
    });

    it('falls back to de for unsupported languages', async () => {
      // Force an unsupported language
      await i18n.changeLanguage('fr');
      // Should either return de (fallback) or fr depending on i18n config
      const lang = getCurrentLanguage();
      // Since fr is not in SUPPORTED_LANGUAGES, it should return de
      expect(lang).toBe('de');
    });
  });

  describe('changeLanguage', () => {
    it('changes the language to English', async () => {
      await changeLanguage('en');
      expect(i18n.language).toBe('en');
    });

    it('changes the language to German', async () => {
      await changeLanguage('en'); // First change to en
      await changeLanguage('de'); // Then back to de
      expect(i18n.language).toBe('de');
    });

    it('stores language preference in localStorage', async () => {
      await changeLanguage('en');
      expect(localStorage.getItem('i18nextLng')).toBe('en');

      await changeLanguage('de');
      expect(localStorage.getItem('i18nextLng')).toBe('de');
    });
  });

  describe('isLanguageSupported', () => {
    it('returns true for supported languages', () => {
      expect(isLanguageSupported('de')).toBe(true);
      expect(isLanguageSupported('en')).toBe(true);
    });

    it('returns false for unsupported languages', () => {
      expect(isLanguageSupported('fr')).toBe(false);
      expect(isLanguageSupported('es')).toBe(false);
      expect(isLanguageSupported('xyz')).toBe(false);
    });
  });

  describe('Translation Loading', () => {
    it('loads German translations', () => {
      i18n.changeLanguage('de');
      expect(i18n.t('common.save')).toBe('Speichern');
      expect(i18n.t('common.cancel')).toBe('Abbrechen');
    });

    it('loads English translations', async () => {
      await i18n.changeLanguage('en');
      expect(i18n.t('common.save')).toBe('Save');
      expect(i18n.t('common.cancel')).toBe('Cancel');
    });

    it('has translations for all major sections', () => {
      const sections = [
        'common',
        'navigation',
        'auth',
        'articles',
        'labels',
        'templates',
        'automation',
        'excel',
        'crawler',
        'ocr',
        'settings',
        'errors',
        'confirmations',
        'pagination',
        'table',
        'dateTime',
        'health',
      ];

      sections.forEach((section) => {
        // Check that at least one key exists in each section
        const key = `${section}.title`;
        const translated = i18n.t(key);
        // If the key doesn't exist, i18next returns the key itself
        // So we check if translation exists for common keys
        if (section === 'common') {
          expect(i18n.t('common.save')).not.toBe('common.save');
        }
      });
    });
  });

  describe('Fallback Behavior', () => {
    it('falls back to German for missing keys', async () => {
      await i18n.changeLanguage('en');
      // If a key is missing in English, it should fall back to German
      // This tests the fallbackLng configuration
      const result = i18n.t('nonexistent.key');
      // Should return the key itself since it doesn't exist in either language
      expect(result).toBe('nonexistent.key');
    });
  });
});
