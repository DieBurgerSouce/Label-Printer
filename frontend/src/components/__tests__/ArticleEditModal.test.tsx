/**
 * ArticleEditModal Component Tests
 * Tests form rendering, validation, and user interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArticleEditModal from '../ArticleEditModal';
import type { Product } from '../../services/api';

// Mock article for testing
const mockArticle: Product = {
  id: 'test-123',
  articleNumber: 'ABC-001',
  productName: 'Test Product',
  description: 'A test product description',
  price: 29.99,
  currency: 'EUR',
  imageUrl: 'https://example.com/image.jpg',
  sourceUrl: 'https://shop.example.com/product/123',
  ean: '1234567890123',
  category: 'Test Category',
  manufacturer: 'Test Manufacturer',
  verified: false,
  published: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('ArticleEditModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when modal is closed', () => {
    it('does not render anything when isOpen is false', () => {
      render(
        <ArticleEditModal
          article={mockArticle}
          isOpen={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      expect(screen.queryByText('Artikel bearbeiten')).not.toBeInTheDocument();
    });

    it('does not render when article is null', () => {
      render(
        <ArticleEditModal article={null} isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />
      );

      expect(screen.queryByText('Artikel bearbeiten')).not.toBeInTheDocument();
    });
  });

  describe('when modal is open', () => {
    it('renders the modal with article data', () => {
      render(
        <ArticleEditModal
          article={mockArticle}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Artikel bearbeiten')).toBeInTheDocument();
      expect(screen.getByDisplayValue('ABC-001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Product')).toBeInTheDocument();
      expect(screen.getByDisplayValue('29.99')).toBeInTheDocument();
    });

    it('renders all form fields', () => {
      render(
        <ArticleEditModal
          article={mockArticle}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Required fields
      expect(screen.getByText(/Artikelnummer/)).toBeInTheDocument();
      expect(screen.getByText(/Produktname/)).toBeInTheDocument();

      // Optional fields
      expect(screen.getByText('Beschreibung')).toBeInTheDocument();
      expect(screen.getAllByText(/Basispreis/).length).toBeGreaterThan(0);
      expect(screen.getByText('EAN / Barcode')).toBeInTheDocument();
      expect(screen.getByText('Staffelpreise')).toBeInTheDocument();
      expect(screen.getByText('Kategorie')).toBeInTheDocument();
      expect(screen.getByText('Hersteller')).toBeInTheDocument();
      expect(screen.getByText('Shop URL')).toBeInTheDocument();
    });

    it('displays checkboxes for verified and published', () => {
      render(
        <ArticleEditModal
          article={mockArticle}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Verifiziert')).toBeInTheDocument();
      expect(screen.getByText('Veröffentlicht')).toBeInTheDocument();
    });
  });

  describe('form interactions', () => {
    it('updates field values on input change', async () => {
      const user = userEvent.setup();

      render(
        <ArticleEditModal
          article={mockArticle}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const articleNumberInput = screen.getByDisplayValue('ABC-001');
      await user.clear(articleNumberInput);
      await user.type(articleNumberInput, 'NEW-123');

      expect(screen.getByDisplayValue('NEW-123')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ArticleEditModal
          article={mockArticle}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const closeButton = screen.getByText('Abbrechen');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when X button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ArticleEditModal
          article={mockArticle}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Find the X button (first button in header area)
      const xButton = screen.getByRole('button', { name: '' });
      await user.click(xButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('form validation', () => {
    it('shows error when article number is empty', async () => {
      const user = userEvent.setup();

      render(
        <ArticleEditModal
          article={{ ...mockArticle, articleNumber: '' }}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByText('Speichern');
      await user.click(saveButton);

      expect(screen.getByText('Artikelnummer ist erforderlich')).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('shows error when product name is empty', async () => {
      const user = userEvent.setup();

      render(
        <ArticleEditModal
          article={{ ...mockArticle, productName: '' }}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByText('Speichern');
      await user.click(saveButton);

      expect(screen.getByText('Produktname ist erforderlich')).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('prevents save when neither price nor tiered prices provided', async () => {
      const user = userEvent.setup();

      render(
        <ArticleEditModal
          article={{ ...mockArticle, price: null, tieredPrices: [], tieredPricesText: '' }}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByText('Speichern');
      await user.click(saveButton);

      // Component validates but doesn't display price error message - just prevents save
      // The price input gets red border styling (border-red-500)
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('form submission', () => {
    it('calls onSave with updated article when form is valid', async () => {
      const user = userEvent.setup();

      render(
        <ArticleEditModal
          article={mockArticle}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByText('Speichern');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledTimes(1);
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          articleNumber: 'ABC-001',
          productName: 'Test Product',
          price: 29.99,
        })
      );
    });
  });

  describe('tiered prices', () => {
    it('parses tiered prices from text input', async () => {
      const user = userEvent.setup();

      render(
        <ArticleEditModal
          article={{ ...mockArticle, price: null, tieredPrices: [], tieredPricesText: '' }}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Find the tiered prices textarea
      const tieredPricesTextarea = screen.getByPlaceholderText(/ab 7 Stück/);
      await user.type(tieredPricesTextarea, 'ab 10 Stück: 45,99 EUR');

      const saveButton = screen.getByText('Speichern');
      await user.click(saveButton);

      // Should call onSave with parsed tiered prices
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          tieredPricesText: 'ab 10 Stück: 45,99 EUR',
          tieredPrices: expect.arrayContaining([
            expect.objectContaining({ quantity: 10, price: 45.99 }),
          ]),
        })
      );
    });

    it('clears price when tiered prices are entered', async () => {
      const user = userEvent.setup();

      render(
        <ArticleEditModal
          article={mockArticle}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Enter tiered prices
      const tieredPricesTextarea = screen.getByPlaceholderText(/ab 7 Stück/);
      await user.type(tieredPricesTextarea, 'ab 10 Stück: 45,99 EUR');

      const saveButton = screen.getByText('Speichern');
      await user.click(saveButton);

      // Price should be cleared
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          price: null,
        })
      );
    });
  });

  describe('currency selection', () => {
    it('allows changing currency', async () => {
      const user = userEvent.setup();

      render(
        <ArticleEditModal
          article={mockArticle}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const currencySelect = screen.getByDisplayValue('EUR');
      await user.selectOptions(currencySelect, 'USD');

      const saveButton = screen.getByText('Speichern');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'USD',
        })
      );
    });
  });

  describe('checkboxes', () => {
    it('toggles verified checkbox', async () => {
      const user = userEvent.setup();

      render(
        <ArticleEditModal
          article={mockArticle}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const verifiedCheckbox = screen.getByRole('checkbox', { name: /Verifiziert/ });
      expect(verifiedCheckbox).not.toBeChecked();

      await user.click(verifiedCheckbox);
      expect(verifiedCheckbox).toBeChecked();

      const saveButton = screen.getByText('Speichern');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          verified: true,
        })
      );
    });

    it('toggles published checkbox', async () => {
      const user = userEvent.setup();

      render(
        <ArticleEditModal
          article={mockArticle}
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const publishedCheckbox = screen.getByRole('checkbox', { name: /Veröffentlicht/ });
      expect(publishedCheckbox).toBeChecked(); // Initially true in mock

      await user.click(publishedCheckbox);
      expect(publishedCheckbox).not.toBeChecked();

      const saveButton = screen.getByText('Speichern');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          published: false,
        })
      );
    });
  });
});
