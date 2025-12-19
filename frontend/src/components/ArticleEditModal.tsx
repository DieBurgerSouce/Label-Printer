/**
 * Article Edit Modal Component
 * A vertical modal for editing article details
 */

import { useState, useEffect } from 'react';
import { X, Save, Package, Tag, Euro, Link, Hash, FileText, AlertCircle } from 'lucide-react';
import type { Product } from '../services/api';
import { getImageUrl } from '../services/api';

interface ArticleEditModalProps {
  article: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (article: Product) => void;
}

export default function ArticleEditModal({
  article,
  isOpen,
  onClose,
  onSave,
}: ArticleEditModalProps) {
  const [formData, setFormData] = useState<Product | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (article) {
      setFormData({ ...article });
    }
  }, [article]);

  if (!isOpen || !formData) return null;

  const handleChange = (field: keyof Product, value: any) => {
    setFormData((prev) => (prev ? { ...prev, [field]: value } : null));
    // Clear error for this field
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleTieredPriceChange = (value: string) => {
    // Save the raw text for label formatting - this is what will be displayed on labels!
    handleChange('tieredPricesText', value);

    // Also parse to structured data for calculations (optional)
    const lines = value.split('\n').filter((line) => line.trim());
    const tieredPrices: any[] = [];

    lines.forEach((line) => {
      // More flexible parsing for various OCR formats
      // e.g., "ab 7 Stück: 190,92 EUR", "ab 24 Stück: 180,60 EUR", "10x = €5.50", "50: 4,50€"
      const match = line.match(
        /(?:ab\s*)?(\d+)\s*(?:Stück|x|Stk\.?)?.*?(\d+[,.]?\d*)\s*(?:€|EUR)?/i
      );
      if (match) {
        tieredPrices.push({
          quantity: parseInt(match[1]),
          price: parseFloat(match[2].replace(',', '.')),
        });
      }
    });

    handleChange('tieredPrices', tieredPrices);

    // If tiered prices text is provided, clear the regular price
    if (value.trim().length > 0) {
      handleChange('price', null);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData?.articleNumber) {
      newErrors.articleNumber = 'Artikelnummer ist erforderlich';
    }
    if (!formData?.productName) {
      newErrors.productName = 'Produktname ist erforderlich';
    }

    // Either regular price OR tiered prices required
    const hasTieredPrices =
      (formData?.tieredPrices && formData.tieredPrices.length > 0) ||
      (formData?.tieredPricesText && formData.tieredPricesText.trim().length > 0);
    const hasRegularPrice = formData?.price && formData.price > 0;

    if (!hasTieredPrices && !hasRegularPrice) {
      newErrors.price = 'Entweder Preis oder Staffelpreise erforderlich';
    }

    if (!formData?.sourceUrl) {
      newErrors.sourceUrl = 'Quell-URL ist erforderlich';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validate() || !formData) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      {/* Modal Container - Vertical Layout (taller than wide) */}
      <div className="bg-white rounded-xl shadow-2xl w-[550px] h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6" />
            <h2 className="text-xl font-bold">Artikel bearbeiten</h2>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Product Image */}
          {formData.imageUrl && (
            <div className="flex justify-center pb-4 border-b">
              <img
                src={getImageUrl(formData.imageUrl)}
                alt={formData.productName}
                className="max-w-full h-auto max-h-64 rounded-lg shadow-md object-contain"
                onError={(e) => {
                  e.currentTarget.src =
                    'https://via.placeholder.com/200x200?text=Bild+nicht+verfügbar';
                }}
              />
            </div>
          )}

          {/* Article Number */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Hash className="w-4 h-4" />
              Artikelnummer *
            </label>
            <input
              type="text"
              value={formData.articleNumber || ''}
              onChange={(e) => handleChange('articleNumber', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.articleNumber ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.articleNumber && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.articleNumber}
              </p>
            )}
          </div>

          {/* Product Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Tag className="w-4 h-4" />
              Produktname *
            </label>
            <input
              type="text"
              value={formData.productName || ''}
              onChange={(e) => handleChange('productName', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.productName ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.productName && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.productName}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <FileText className="w-4 h-4" />
              Beschreibung
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Produktbeschreibung..."
            />
          </div>

          {/* Price and Currency Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Base Price */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Euro className="w-4 h-4" />
                Basispreis
                {formData.tieredPrices && formData.tieredPrices.length > 0 && (
                  <span className="text-xs text-gray-500">(deaktiviert bei Staffelpreisen)</span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={formData.price || ''}
                  onChange={(e) => {
                    const value = e.target.value ? parseFloat(e.target.value) : null;
                    handleChange('price', value);
                    // If a regular price is entered, clear tiered prices
                    if (value && value > 0) {
                      handleChange('tieredPrices', []);
                      handleChange('tieredPricesText', '');
                    }
                  }}
                  placeholder="0.00"
                  className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.price ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <select
                  value={formData.currency || 'EUR'}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            {/* EAN */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                EAN / Barcode
              </label>
              <input
                type="text"
                value={formData.ean || ''}
                onChange={(e) => handleChange('ean', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="4260123456789"
              />
            </div>
          </div>

          {/* Tiered Prices */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">
              Staffelpreise
              <span className="text-gray-400 font-normal text-xs ml-2">(Format: Menge: Preis)</span>
              {formData.price && formData.price > 0 && (
                <span className="text-xs text-gray-500 ml-2">(deaktiviert bei Basispreis)</span>
              )}
            </label>
            <textarea
              value={formData.tieredPricesText || ''}
              onChange={(e) => handleTieredPriceChange(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="ab 7 Stück: 190,92 EUR&#10;ab 24 Stück: 180,60 EUR&#10;ab 50 Stück: 175,00 EUR"
            />
          </div>

          {/* Additional Info Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Kategorie</label>
              <input
                type="text"
                value={formData.category || ''}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Großbehälter"
              />
            </div>

            {/* Manufacturer */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Hersteller</label>
              <input
                type="text"
                value={formData.manufacturer || ''}
                onChange={(e) => handleChange('manufacturer', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Firmenich"
              />
            </div>
          </div>

          {/* Source URL */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Link className="w-4 h-4" />
              Shop URL
            </label>
            <input
              type="url"
              value={formData.sourceUrl || ''}
              onChange={(e) => handleChange('sourceUrl', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://shop.firmenich.de/..."
            />
          </div>

          {/* Status Toggles */}
          <div className="flex gap-6 p-4 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.verified || false}
                onChange={(e) => handleChange('verified', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Verifiziert</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.published || false}
                onChange={(e) => handleChange('published', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Veröffentlicht</span>
            </label>
          </div>

          {/* Meta Information */}
          {formData.ocrConfidence !== undefined && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">OCR Konfidenz:</span>{' '}
                {Math.round(formData.ocrConfidence * 100)}%
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-semibold">Erstellt:</span>{' '}
                {new Date(formData.createdAt).toLocaleString('de-DE')}
              </p>
            </div>
          )}
        </form>

        {/* Footer with Save Button */}
        <div className="border-t px-6 py-4 bg-gray-50 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium shadow-lg hover:shadow-xl transition-all"
          >
            <Save className="w-4 h-4" />
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
