/**
 * LanguageSwitcher Component Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import i18n from '../../i18n';

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    // Reset language to German before each test
    await i18n.changeLanguage('de');
  });

  describe('Rendering', () => {
    it('renders with German flag by default', () => {
      render(<LanguageSwitcher />);

      // Should show German flag
      expect(screen.getByRole('img', { name: /deutsch/i })).toBeInTheDocument();
    });

    it('renders language name in full mode', () => {
      render(<LanguageSwitcher />);

      expect(screen.getByText('Deutsch')).toBeInTheDocument();
    });

    it('renders only flag in compact mode', () => {
      render(<LanguageSwitcher compact />);

      // Flag should be visible
      expect(screen.getByRole('img')).toBeInTheDocument();
      // Language name should not be visible
      expect(screen.queryByText('Deutsch')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<LanguageSwitcher className="custom-class" />);

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Dropdown Interaction', () => {
    it('opens dropdown on click', async () => {
      render(<LanguageSwitcher />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('shows both language options when open', async () => {
      render(<LanguageSwitcher />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: /deutsch/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /english/i })).toBeInTheDocument();
      });
    });

    it('closes dropdown when clicking outside', async () => {
      render(
        <div>
          <LanguageSwitcher />
          <button data-testid="outside">Outside</button>
        </div>
      );

      // Open dropdown - use translated label "Sprache" (German for "Language")
      const button = screen.getByLabelText('Sprache');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Click outside
      fireEvent.mouseDown(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('closes dropdown after selecting a language', async () => {
      render(<LanguageSwitcher />);

      // Open dropdown
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Select English
      const englishOption = screen.getByRole('option', { name: /english/i });
      fireEvent.click(englishOption);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper aria attributes', () => {
      render(<LanguageSwitcher />);

      const button = screen.getByRole('button');
      // aria-label is translated, so check for "Sprache" (German)
      expect(button).toHaveAttribute('aria-label', 'Sprache');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('updates aria-expanded when dropdown opens', async () => {
      render(<LanguageSwitcher />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('marks current language as selected in listbox', async () => {
      render(<LanguageSwitcher />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const germanOption = screen.getByRole('option', { name: /deutsch/i });
        expect(germanOption).toHaveAttribute('aria-selected', 'true');

        const englishOption = screen.getByRole('option', { name: /english/i });
        expect(englishOption).toHaveAttribute('aria-selected', 'false');
      });
    });
  });
});
