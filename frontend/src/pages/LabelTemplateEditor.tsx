/**
 * Label Template Editor
 * Visual editor for creating custom label templates
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Eye,
  Plus,
  Trash2,
  Type,
  Image as ImageIcon,
  DollarSign,
  Hash,
  QrCode,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Printer,
  Upload
} from 'lucide-react';
import { articlesApi, templateApi, getImageUrl, type Product } from '../services/api';
import {
  PRINT_LAYOUTS,
  calculateLabelSize,
  mmToPx,
  pxToMm,
  getLayoutById
} from '../data/printLayouts';
import TemplateRuleBuilder from '../components/TemplateRuleBuilder/TemplateRuleBuilder';
import type { TemplateRule } from '../types/template.types';

interface TableConfig {
  headerBg: string;
  headerColor: string;
  headerFontSize: number;
  headerFontWeight: 'normal' | 'bold';
  headerAlign: 'left' | 'center' | 'right';
  rowBg: string;
  rowAlternateBg: string;
  rowColor: string;
  rowFontSize: number;
  rowAlign: 'left' | 'center' | 'right';
  borderColor: string;
  borderWidth: number;
  cellPadding: number;
}

interface LabelElement {
  id: string;
  type: 'text' | 'freeText' | 'image' | 'price' | 'priceTable' | 'articleNumber' | 'qrCode' | 'description';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  align?: 'left' | 'center' | 'right';
  tableConfig?: TableConfig;
  originalWidth?: number;  // For scaling elements proportionally
  originalHeight?: number;
  // Separate styling for label/prefix (e.g., "Artikelnummer:")
  labelFontSize?: number;
  labelFontWeight?: 'normal' | 'bold';
  labelColor?: string;
}

interface TemplateSettings {
  backgroundColor: string;
  backgroundImage?: string; // base64 or URL
  backgroundImageOpacity: number;
  defaultFontFamily: string;
  defaultFontColor: string;
  defaultFontSize: number;
  borderEnabled: boolean;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  padding: number;
}

interface LabelTemplate {
  id: string;
  name: string;
  width: number;  // in pixels (for canvas display)
  height: number; // in pixels (for canvas display)
  widthMm?: number;  // in millimeters (for print)
  heightMm?: number; // in millimeters (for print)
  printLayoutId?: string;  // selected print layout ID
  printLayoutName?: string;  // display name of print layout (e.g. "A3 Grid - 2×4")
  printLayoutColumns?: number;  // number of columns in print layout
  printLayoutRows?: number;  // number of rows in print layout
  elements: LabelElement[];
  settings: TemplateSettings;

  // Template Rules for Auto-Matching
  rules?: TemplateRule;
  autoMatchEnabled: boolean;

  // Article-specific overrides
  // Allows customizing element properties per article without creating multiple templates
  // Structure: { [articleNumber]: { [elementId]: Partial<LabelElement> } }
  articleOverrides?: {
    [articleNumber: string]: {
      [elementId: string]: Partial<LabelElement>;
    };
  };
}

export default function LabelTemplateEditor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Load template from sessionStorage if editing
  const loadInitialTemplate = (): LabelTemplate => {
    const editingTemplateStr = sessionStorage.getItem('editingTemplate');
    if (editingTemplateStr) {
      try {
        const loadedTemplate = JSON.parse(editingTemplateStr);
        sessionStorage.removeItem('editingTemplate'); // Clear after loading
        return loadedTemplate;
      } catch (error) {
        console.error('Error loading template from sessionStorage:', error);
      }
    }

    // Default new template
    return {
      id: crypto.randomUUID(),
      name: 'Neues Label Template',
      width: 400,
      height: 300,
      elements: [],
      settings: {
        backgroundColor: '#ffffff',
        backgroundImageOpacity: 0.5,
        defaultFontFamily: 'Arial',
        defaultFontColor: '#000000',
        defaultFontSize: 14,
        borderEnabled: true,
        borderColor: '#d1d5db',
        borderWidth: 1,
        borderRadius: 0,
        shadowEnabled: false,
        shadowColor: '#000000',
        shadowBlur: 5,
        padding: 0
      },
      autoMatchEnabled: false,
      rules: undefined
    };
  };

  const [template, setTemplate] = useState<LabelTemplate>(loadInitialTemplate);

  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Drag & Drop state
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // Resize state
  type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
  const [resizing, setResizing] = useState<{ id: string; handle: ResizeHandle } | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number; elementX: number; elementY: number } | null>(null);

  // Preview with real data
  const [previewArticle, setPreviewArticle] = useState<Product | null>(null);
  const [articleSearch, setArticleSearch] = useState('');
  const [searching, setSearching] = useState(false);

  // Print layout
  const [selectedPrintLayoutId, setSelectedPrintLayoutId] = useState<string>('');

  // Zoom state
  const [zoom, setZoom] = useState<number>(1.5);
  const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5];
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addElement = (type: LabelElement['type']) => {
    const defaultWidth = type === 'priceTable' ? 400 : 200;
    const defaultHeight = type === 'image' ? 100 : type === 'priceTable' ? 150 : 30;

    const newElement: LabelElement = {
      id: crypto.randomUUID(),
      type,
      x: 50,
      y: 50 + (template.elements.length * 30),
      width: defaultWidth,
      height: defaultHeight,
      originalWidth: defaultWidth,
      originalHeight: defaultHeight,
      content: getDefaultContent(type),
      fontSize: 14,
      fontWeight: 'normal',
      color: '#000000',
      align: 'left',
      tableConfig: type === 'priceTable' ? {
        headerBg: '#e5e7eb',
        headerColor: '#000000',
        headerFontSize: 14,
        headerFontWeight: 'bold',
        headerAlign: 'left',
        rowBg: '#ffffff',
        rowAlternateBg: '#f9fafb',
        rowColor: '#000000',
        rowFontSize: 12,
        rowAlign: 'left',
        borderColor: '#d1d5db',
        borderWidth: 1,
        cellPadding: 8
      } : undefined
    };

    setTemplate(prev => ({
      ...prev,
      elements: [...prev.elements, newElement]
    }));
    setSelectedElement(newElement.id);
  };

  const getDefaultContent = (type: LabelElement['type']): string => {
    switch (type) {
      case 'text': return '{{Produktname}}';
      case 'freeText': return 'Text eingeben...';
      case 'price': return '{{Preis}}';
      case 'priceTable': return '{{Staffelpreise}}';
      case 'articleNumber': return '{{Artikelnummer}}';
      case 'description': return '{{Beschreibung}}';
      case 'qrCode': return '{{QR-Code}}';
      case 'image': return '{{Produktbild}}';
      default: return '';
    }
  };

  const updateElement = (id: string, updates: Partial<LabelElement>) => {
    // If an article is selected, save changes to articleOverrides
    // Otherwise, update the template element directly
    if (previewArticle?.articleNumber) {
      setTemplate(prev => {
        const articleOverrides = prev.articleOverrides || {};
        const articleNumber = previewArticle.articleNumber;
        const elementOverrides = articleOverrides[articleNumber] || {};

        return {
          ...prev,
          articleOverrides: {
            ...articleOverrides,
            [articleNumber]: {
              ...elementOverrides,
              [id]: {
                ...(elementOverrides[id] || {}),
                ...updates
              }
            }
          }
        };
      });
    } else {
      // No article selected: update template directly
      setTemplate(prev => ({
        ...prev,
        elements: prev.elements.map(el =>
          el.id === id ? { ...el, ...updates } : el
        )
      }));
    }
  };

  // Get effective element data (template + article overrides)
  const getEffectiveElement = (elementId: string): LabelElement | undefined => {
    const templateElement = template.elements.find(el => el.id === elementId);
    if (!templateElement) return undefined;

    // If no article selected or no overrides, return template element
    if (!previewArticle?.articleNumber || !template.articleOverrides) {
      return templateElement;
    }

    const overrides = template.articleOverrides[previewArticle.articleNumber]?.[elementId];
    if (!overrides) return templateElement;

    // Merge template element with overrides
    return { ...templateElement, ...overrides };
  };

  // Check if element has article-specific overrides
  const hasOverride = (elementId: string): boolean => {
    if (!previewArticle?.articleNumber || !template.articleOverrides) return false;
    return !!template.articleOverrides[previewArticle.articleNumber]?.[elementId];
  };

  // Reset element to template default (remove overrides)
  const resetOverride = (elementId: string) => {
    if (!previewArticle?.articleNumber) return;

    setTemplate(prev => {
      if (!prev.articleOverrides) return prev;

      const articleNumber = previewArticle.articleNumber;
      const articleOverrides = { ...prev.articleOverrides };

      if (articleOverrides[articleNumber]) {
        const elementOverrides = { ...articleOverrides[articleNumber] };
        delete elementOverrides[elementId];

        // If no more overrides for this article, remove article entry
        if (Object.keys(elementOverrides).length === 0) {
          delete articleOverrides[articleNumber];
        } else {
          articleOverrides[articleNumber] = elementOverrides;
        }
      }

      return {
        ...prev,
        articleOverrides: Object.keys(articleOverrides).length > 0 ? articleOverrides : undefined
      };
    });
  };

  const deleteElement = (id: string) => {
    setTemplate(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== id)
    }));
    if (selectedElement === id) {
      setSelectedElement(null);
    }
  };

  // Drag & Drop handlers
  const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
    if (previewMode) return;
    e.stopPropagation();
    setDragging(elementId);
    setDragStart({ x: e.clientX, y: e.clientY });
    setSelectedElement(elementId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle resizing
    if (resizing) {
      handleResizeMouseMove(e);
      return;
    }

    // Handle dragging
    if (!dragging || !dragStart) return;

    const dx = (e.clientX - dragStart.x) / zoom;
    const dy = (e.clientY - dragStart.y) / zoom;

    // IMPORTANT: Use effective element (with overrides) instead of template element
    const element = getEffectiveElement(dragging);
    if (!element) return;

    updateElement(dragging, {
      x: Math.max(0, Math.min(template.width - element.width, element.x + dx)),
      y: Math.max(0, Math.min(template.height - element.height, element.y + dy))
    });

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setDragging(null);
    setDragStart(null);
    setResizing(null);
    setResizeStart(null);
  };

  // Resize handlers
  const handleResizeMouseDown = (e: React.MouseEvent, elementId: string, handle: ResizeHandle) => {
    if (previewMode) return;
    e.stopPropagation();

    const element = template.elements.find(el => el.id === elementId);
    if (!element) return;

    setResizing({ id: elementId, handle });
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: element.width,
      height: element.height,
      elementX: element.x,
      elementY: element.y
    });
    setSelectedElement(elementId);
  };

  const handleResizeMouseMove = (e: React.MouseEvent) => {
    if (!resizing || !resizeStart) return;

    const dx = (e.clientX - resizeStart.x) / zoom;
    const dy = (e.clientY - resizeStart.y) / zoom;

    const element = template.elements.find(el => el.id === resizing.id);
    if (!element) return;

    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;
    let newX = resizeStart.elementX;
    let newY = resizeStart.elementY;

    // Handle different resize directions
    const handle = resizing.handle;

    // Horizontal resizing
    if (handle.includes('e')) {
      newWidth = Math.max(20, resizeStart.width + dx);
    } else if (handle.includes('w')) {
      const widthChange = -dx;
      newWidth = Math.max(20, resizeStart.width + widthChange);
      newX = resizeStart.elementX - widthChange;
    }

    // Vertical resizing
    if (handle.includes('s')) {
      newHeight = Math.max(20, resizeStart.height + dy);
    } else if (handle.includes('n')) {
      const heightChange = -dy;
      newHeight = Math.max(20, resizeStart.height + heightChange);
      newY = resizeStart.elementY - heightChange;
    }

    // Constrain to canvas bounds
    newX = Math.max(0, Math.min(template.width - newWidth, newX));
    newY = Math.max(0, Math.min(template.height - newHeight, newY));
    newWidth = Math.min(template.width - newX, newWidth);
    newHeight = Math.min(template.height - newY, newHeight);

    updateElement(resizing.id, {
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight
    });
  };

  // Apply print layout
  const applyPrintLayout = (layoutId: string) => {
    if (!layoutId) {
      // "Custom" selected - clear layout
      setSelectedPrintLayoutId('');
      setTemplate(prev => ({
        ...prev,
        printLayoutId: undefined,
        printLayoutName: undefined,
        printLayoutColumns: undefined,
        printLayoutRows: undefined,
        widthMm: undefined,
        heightMm: undefined
      }));
      return;
    }

    const layout = getLayoutById(layoutId);
    if (!layout) return;

    const { widthMm, heightMm } = calculateLabelSize(layout);
    const widthPx = mmToPx(widthMm);
    const heightPx = mmToPx(heightMm);

    setSelectedPrintLayoutId(layoutId);
    setTemplate(prev => ({
      ...prev,
      width: widthPx,
      height: heightPx,
      widthMm,
      heightMm,
      printLayoutId: layoutId,
      printLayoutName: layout.name,
      printLayoutColumns: layout.columns,
      printLayoutRows: layout.rows
    }));
  };

  const saveTemplate = async () => {
    try {
      console.log('Saving template to backend:', template);

      // Check if template exists by trying to load it
      let exists = false;
      try {
        await templateApi.getById(template.id);
        exists = true;
      } catch (error) {
        // Template doesn't exist yet
      }

      // Save or update template via API
      if (exists) {
        await templateApi.update(template.id, template);
        console.log('Template updated successfully');
      } else {
        await templateApi.save(template);
        console.log('Template saved successfully');
      }

      // Invalidate React Query cache to reload templates
      queryClient.invalidateQueries({ queryKey: ['labelTemplates'] });

      alert('Template erfolgreich gespeichert!');
      navigate('/templates'); // Navigate to templates page to see the saved template
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Fehler beim Speichern des Templates!');
    }
  };

  const handlePrintTemplate = () => {
    if (!template.printLayoutId) {
      alert('Bitte wählen Sie zuerst ein Drucklayout aus!');
      return;
    }

    // Navigate to print preview with template
    navigate(`/print?templateId=${template.id}`);
  };

  // Handle background image upload
  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setTemplate(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          backgroundImage: base64
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  const updateTemplateSetting = <K extends keyof TemplateSettings>(
    key: K,
    value: TemplateSettings[K]
  ) => {
    setTemplate(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [key]: value
      }
    }));
  };

  // Search for article by article number
  const searchArticle = async () => {
    if (!articleSearch.trim()) return;

    setSearching(true);
    try {
      const response = await articlesApi.getAll({ search: articleSearch, limit: 1 });
      if (response.data && response.data.length > 0) {
        setPreviewArticle(response.data[0]);
      } else {
        alert('Artikel nicht gefunden!');
        setPreviewArticle(null);
      }
    } catch (error) {
      console.error('Error searching article:', error);
      alert('Fehler beim Suchen des Artikels');
    } finally {
      setSearching(false);
    }
  };

  // Parse tiered prices - prefer structured data over OCR text
  const parseTieredPrices = (article: any): { quantity: string; price: string }[] => {
    // First, try to use structured tieredPrices if available
    if (article?.tieredPrices && Array.isArray(article.tieredPrices) && article.tieredPrices.length > 0) {
      return article.tieredPrices.map((tier: any, i: number) => {
        const price = typeof tier.price === 'string' ? parseFloat(tier.price) : tier.price;
        const prefix = i === 0 ? 'Bis' : 'Ab';
        return {
          quantity: `${prefix} ${tier.quantity}`,
          price: `${price ? price.toFixed(2).replace('.', ',')} €` : '-'
        };
      });
    }

    // Fallback to parsing tieredPricesText, but clean it first
    if (article?.tieredPricesText) {
      const lines = article.tieredPricesText
        .split('\n')
        .filter(line => {
          // Clean up OCR garbage
          return line.trim() &&
                 !line.includes('©') &&
                 !line.includes('Service') &&
                 !line.includes('Hilfe') &&
                 !line.includes('Goooe') &&
                 !line.includes('eingeben');
        });

      const rows: { quantity: string; price: string }[] = [];

      lines.forEach(line => {
        // Match patterns like "ab 7 Stück: 190,92 EUR" or "Bis 593 28,49 €"
        const match = line.match(/^(ab|bis)\s+(\d+).*?([0-9,]+)\s*(?:€|EUR)/i);
        if (match) {
          const prefix = match[1].toLowerCase() === 'ab' ? 'Ab' : 'Bis';
          const quantity = `${prefix} ${match[2]}`;
          const price = `${match[3]} €`;
          rows.push({ quantity, price });
        }
      });

      return rows;
    }

    return [];
  };

  // Replace placeholder with real data
  const getCurrencySymbol = (currencyCode: string): string => {
    const currencyMap: { [key: string]: string } = {
      'EUR': '€',
      'USD': '$',
      'GBP': '£',
      'CHF': 'CHF',
      'JPY': '¥',
    };
    return currencyMap[currencyCode] || currencyCode;
  };

  const getDisplayContent = (element: LabelElement): string => {
    // Helper: Check if content is a placeholder
    const isPlaceholder = (content: string): boolean => {
      return !content || content.startsWith('{{') || content === 'Überschrift...' || content.trim() === '';
    };

    // If no article selected, show placeholder or custom content
    if (!previewArticle) {
      switch (element.type) {
        case 'text':
          return element.content || '{{Produktname}}';
        case 'description':
          return element.content || '{{Beschreibung}}';
        case 'price':
          return element.content || '{{Preis}}';
        case 'articleNumber':
          return element.content || '{{Artikelnummer}}';
        default:
          return element.content;
      }
    }

    // Article selected - decide between custom content and product data
    switch (element.type) {
      case 'articleNumber':
        // Always show article number from product
        return previewArticle.articleNumber ? `Artikelnummer: ${previewArticle.articleNumber}` : (element.content || '{{Artikelnummer}}');

      case 'price':
        // If custom content exists (not placeholder), use it
        if (!isPlaceholder(element.content)) {
          return element.content;
        }
        // Otherwise show product price
        if (previewArticle.price) {
          const currencySymbol = getCurrencySymbol(previewArticle.currency || 'EUR');
          return `${previewArticle.price.toFixed(2).replace('.', ',')} ${currencySymbol}`;
        }
        return element.content || '{{Preis}}';

      case 'description':
        // If custom content exists (not placeholder), use it
        if (!isPlaceholder(element.content)) {
          return element.content;
        }
        // Otherwise show product description
        return previewArticle.description || element.content || '{{Beschreibung}}';

      case 'text':
        // IMPORTANT: If custom content exists (not placeholder), use it!
        // This allows article-specific custom headings
        if (!isPlaceholder(element.content)) {
          return element.content;
        }
        // Otherwise show product name
        return previewArticle.productName || element.content || '{{Produktname}}';

      case 'freeText':
        // Always show the static content entered by user (never replace with product data)
        return element.content;

      default:
        return element.content;
    }
  };

  // Zoom handlers
  const handleZoomIn = () => {
    const currentIndex = zoomLevels.findIndex(z => z === zoom);
    const nextIndex = Math.min(currentIndex + 1, zoomLevels.length - 1);
    setZoom(zoomLevels[nextIndex]);
  };

  const handleZoomOut = () => {
    const currentIndex = zoomLevels.findIndex(z => z === zoom);
    const prevIndex = Math.max(currentIndex - 1, 0);
    setZoom(zoomLevels[prevIndex]);
  };

  const handleFitToScreen = () => {
    setZoom(1);
  };

  // Mouse wheel zoom with native event listener
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent default scrolling behavior
      e.preventDefault();
      e.stopPropagation();

      const scaleBy = 1.05;
      setZoom(prevZoom => {
        const newZoom = e.deltaY < 0 ? prevZoom * scaleBy : prevZoom / scaleBy;
        return Math.max(0.25, Math.min(5, newZoom));
      });
    };

    // Add event listener with passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Get selected element with article-specific overrides applied
  const selectedElementData = selectedElement ? getEffectiveElement(selectedElement) : undefined;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={template.name}
            onChange={e => setTemplate(prev => ({ ...prev, name: e.target.value }))}
            className="text-xl font-bold border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Zoom Controls */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-200">
            <button
              onClick={handleZoomOut}
              disabled={zoom === zoomLevels[0]}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4 text-gray-700" />
            </button>

            <div className="px-3 py-1 bg-white rounded border border-gray-200 min-w-[70px] text-center">
              <span className="text-sm font-medium text-gray-900">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <button
              onClick={handleZoomIn}
              disabled={zoom === zoomLevels[zoomLevels.length - 1]}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4 text-gray-700" />
            </button>

            <div className="w-px h-5 bg-gray-300" />

            <button
              onClick={handleFitToScreen}
              className="p-1 rounded hover:bg-gray-200"
              title="Fit to Screen (100%)"
            >
              <Maximize2 className="w-4 h-4 text-gray-700" />
            </button>
          </div>

          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              previewMode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Eye className="w-4 h-4" />
            {previewMode ? 'Bearbeiten' : 'Vorschau'}
          </button>

          {template.printLayoutId && (
            <button
              onClick={handlePrintTemplate}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Druckvorschau
            </button>
          )}

          <button
            onClick={saveTemplate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Speichern
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Element Toolbox */}
        {!previewMode && (
          <div className="w-64 bg-white border-r p-4 overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-3">Elemente hinzufügen</h3>

            <div className="space-y-2">
              <button
                onClick={() => addElement('text')}
                className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-left"
              >
                <Type className="w-4 h-4" />
                Überschrift
              </button>

              <button
                onClick={() => addElement('freeText')}
                className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-left"
              >
                <Type className="w-4 h-4" />
                Text
              </button>

              <button
                onClick={() => addElement('articleNumber')}
                className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-left"
              >
                <Hash className="w-4 h-4" />
                Artikelnummer
              </button>

              <button
                onClick={() => addElement('price')}
                className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-left"
              >
                <DollarSign className="w-4 h-4" />
                Preis
              </button>

              <button
                onClick={() => addElement('priceTable')}
                className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-left"
              >
                <DollarSign className="w-4 h-4" />
                Staffelpreise-Tabelle
              </button>

              <button
                onClick={() => addElement('description')}
                className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-left"
              >
                <Type className="w-4 h-4" />
                Beschreibung
              </button>

              <button
                onClick={() => addElement('image')}
                className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-left"
              >
                <ImageIcon className="w-4 h-4" />
                Produktbild
              </button>

              <button
                onClick={() => addElement('qrCode')}
                className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-left"
              >
                <QrCode className="w-4 h-4" />
                QR-Code
              </button>
            </div>

            {/* Preview with Real Data */}
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold text-gray-900 mb-3">Live-Vorschau</h3>
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  💡 <strong>Tipp:</strong> Gib eine Artikelnummer ein, um echte Produktdaten anzuzeigen. Änderungen an Elementen werden dann <span className="font-semibold">nur für diesen Artikel</span> gespeichert!
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-600">Artikelnummer</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={articleSearch}
                    onChange={e => setArticleSearch(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && searchArticle()}
                    placeholder="z.B. 3806"
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    disabled={searching}
                  />
                  <button
                    onClick={searchArticle}
                    disabled={searching || !articleSearch.trim()}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>

                {previewArticle && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                    <p className="font-semibold text-green-900">
                      ✓ {previewArticle.productName}
                    </p>
                    <p className="text-green-700">
                      Artikel: {previewArticle.articleNumber}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Template Settings */}
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold text-gray-900 mb-3">Label-Größe</h3>

              <div className="space-y-3">
                {/* Print Layout Selector */}
                <div>
                  <label className="text-sm text-gray-600">Drucklayout</label>
                  <select
                    value={selectedPrintLayoutId}
                    onChange={e => applyPrintLayout(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    <option value="">Benutzerdefiniert</option>
                    <optgroup label="Standard-Etiketten">
                      {PRINT_LAYOUTS.filter(l => l.category === 'standard').map(layout => (
                        <option key={layout.id} value={layout.id}>
                          {layout.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="A4 Raster">
                      {PRINT_LAYOUTS.filter(l => l.category === 'grid-a4').map(layout => (
                        <option key={layout.id} value={layout.id}>
                          {layout.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="A3 Raster">
                      {PRINT_LAYOUTS.filter(l => l.category === 'grid-a3').map(layout => (
                        <option key={layout.id} value={layout.id}>
                          {layout.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  {selectedPrintLayoutId && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                      <p className="font-semibold text-green-900">
                        ✓ {template.printLayoutName}
                      </p>
                      {template.widthMm && template.heightMm && (
                        <p className="text-green-700 mt-1">
                          Label: {template.widthMm.toFixed(1)} × {template.heightMm.toFixed(1)} mm
                        </p>
                      )}
                      {template.printLayoutColumns && template.printLayoutRows && (
                        <p className="text-green-700">
                          Raster: {template.printLayoutColumns} × {template.printLayoutRows}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Manual Size Inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm text-gray-600">
                      Breite {template.widthMm ? `(${template.widthMm.toFixed(1)}mm)` : '(px)'}
                    </label>
                    <input
                      type="number"
                      value={template.width}
                      onChange={e => {
                        const newWidth = parseInt(e.target.value);
                        setTemplate(prev => ({
                          ...prev,
                          width: newWidth,
                          widthMm: selectedPrintLayoutId ? pxToMm(newWidth) : undefined
                        }));
                      }}
                      className="w-full px-3 py-1 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">
                      Höhe {template.heightMm ? `(${template.heightMm.toFixed(1)}mm)` : '(px)'}
                    </label>
                    <input
                      type="number"
                      value={template.height}
                      onChange={e => {
                        const newHeight = parseInt(e.target.value);
                        setTemplate(prev => ({
                          ...prev,
                          height: newHeight,
                          heightMm: selectedPrintLayoutId ? pxToMm(newHeight) : undefined
                        }));
                      }}
                      className="w-full px-3 py-1 border rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Template Settings */}
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold text-gray-900 mb-3">Template-Einstellungen</h3>

              <div className="space-y-3">
                {/* Background Color */}
                <div>
                  <label className="text-sm text-gray-600">Hintergrundfarbe</label>
                  <input
                    type="color"
                    value={template.settings.backgroundColor}
                    onChange={e => updateTemplateSetting('backgroundColor', e.target.value)}
                    className="w-full h-10 border rounded"
                  />
                </div>

                {/* Background Image */}
                <div>
                  <label className="text-sm text-gray-600">Hintergrundbild</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundImageUpload}
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Hochladen
                    </button>
                    {template.settings.backgroundImage && (
                      <button
                        onClick={() => updateTemplateSetting('backgroundImage', undefined)}
                        className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm"
                      >
                        Entfernen
                      </button>
                    )}
                  </div>
                  {template.settings.backgroundImage && (
                    <div className="mt-2">
                      <label className="text-xs text-gray-600">Deckkraft</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={template.settings.backgroundImageOpacity}
                        onChange={e => updateTemplateSetting('backgroundImageOpacity', parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <span className="text-xs text-gray-500">
                        {Math.round(template.settings.backgroundImageOpacity * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Default Font */}
                <div>
                  <label className="text-sm text-gray-600">Standard-Schriftart</label>
                  <select
                    value={template.settings.defaultFontFamily}
                    onChange={e => updateTemplateSetting('defaultFontFamily', e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Georgia">Georgia</option>
                  </select>
                </div>

                {/* Default Font Color */}
                <div>
                  <label className="text-sm text-gray-600">Standard-Schriftfarbe</label>
                  <input
                    type="color"
                    value={template.settings.defaultFontColor}
                    onChange={e => updateTemplateSetting('defaultFontColor', e.target.value)}
                    className="w-full h-10 border rounded"
                  />
                </div>

                {/* Default Font Size */}
                <div>
                  <label className="text-sm text-gray-600">Standard-Schriftgröße</label>
                  <input
                    type="number"
                    value={template.settings.defaultFontSize}
                    onChange={e => updateTemplateSetting('defaultFontSize', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>

                {/* Border Settings */}
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <input
                      type="checkbox"
                      checked={template.settings.borderEnabled}
                      onChange={e => updateTemplateSetting('borderEnabled', e.target.checked)}
                      className="rounded"
                    />
                    Rahmen anzeigen
                  </label>

                  {template.settings.borderEnabled && (
                    <div className="ml-6 space-y-2">
                      <div>
                        <label className="text-xs text-gray-600">Rahmenfarbe</label>
                        <input
                          type="color"
                          value={template.settings.borderColor}
                          onChange={e => updateTemplateSetting('borderColor', e.target.value)}
                          className="w-full h-8 border rounded"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-600">Breite (px)</label>
                          <input
                            type="number"
                            value={template.settings.borderWidth}
                            onChange={e => updateTemplateSetting('borderWidth', parseInt(e.target.value))}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Rundung (px)</label>
                          <input
                            type="number"
                            value={template.settings.borderRadius}
                            onChange={e => updateTemplateSetting('borderRadius', parseInt(e.target.value))}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Shadow Settings */}
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <input
                      type="checkbox"
                      checked={template.settings.shadowEnabled}
                      onChange={e => updateTemplateSetting('shadowEnabled', e.target.checked)}
                      className="rounded"
                    />
                    Schatten anzeigen
                  </label>

                  {template.settings.shadowEnabled && (
                    <div className="ml-6 space-y-2">
                      <div>
                        <label className="text-xs text-gray-600">Schattenfarbe</label>
                        <input
                          type="color"
                          value={template.settings.shadowColor}
                          onChange={e => updateTemplateSetting('shadowColor', e.target.value)}
                          className="w-full h-8 border rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Unschärfe (px)</label>
                        <input
                          type="number"
                          value={template.settings.shadowBlur}
                          onChange={e => updateTemplateSetting('shadowBlur', parseInt(e.target.value))}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Padding */}
                <div>
                  <label className="text-sm text-gray-600">Innenabstand (px)</label>
                  <input
                    type="number"
                    value={template.settings.padding}
                    onChange={e => updateTemplateSetting('padding', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Template Rules Section */}
            <div className="mt-6 pt-6 border-t">
              <TemplateRuleBuilder
                rule={template.rules}
                onChange={(newRule) => setTemplate(prev => ({
                  ...prev,
                  rules: newRule,
                  autoMatchEnabled: newRule.enabled
                }))}
              />
            </div>
          </div>
        )}

        {/* Canvas Area */}
        <div
          className="flex-1 bg-gray-100 overflow-auto"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            position: 'relative'
          }}
        >
          {/* Zoom Container - captures wheel events */}
          <div
            ref={canvasContainerRef}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              transition: 'transform 0.1s ease-out',
              cursor: 'default'
            }}
          >
            {/* Label Canvas */}
            <div
              className="shadow-2xl relative select-none"
              style={{
                width: template.width,
                height: template.height,
                backgroundColor: template.settings.backgroundColor,
                border: template.settings.borderEnabled
                  ? `${template.settings.borderWidth}px solid ${template.settings.borderColor}`
                  : '1px solid #e5e7eb',
                borderRadius: `${template.settings.borderRadius}px`,
                boxShadow: template.settings.shadowEnabled
                  ? `0 0 ${template.settings.shadowBlur}px ${template.settings.shadowColor}`
                  : 'none',
                padding: `${template.settings.padding}px`,
                backgroundImage: template.settings.backgroundImage
                  ? `url(${template.settings.backgroundImage})`
                  : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Background image overlay for opacity */}
              {template.settings.backgroundImage && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundColor: template.settings.backgroundColor,
                    opacity: 1 - template.settings.backgroundImageOpacity,
                    borderRadius: `${template.settings.borderRadius}px`,
                  }}
                />
              )}
              {template.elements.map(templateElement => {
                // Get effective element (template + article-specific overrides)
                const element = getEffectiveElement(templateElement.id) || templateElement;

                return (
                <div
                  key={element.id}
                  onMouseDown={(e) => handleMouseDown(e, element.id)}
                  className={`absolute ${
                    previewMode ? 'cursor-default' : 'cursor-move'
                  } ${
                    selectedElement === element.id && !previewMode
                      ? hasOverride(element.id)
                        ? 'ring-2 ring-orange-500'  // Selected + Override = Orange
                        : 'ring-2 ring-blue-500'    // Selected only = Blue
                      : hasOverride(element.id)
                        ? 'ring-1 ring-orange-400'  // Override only = Thin Orange
                        : ''
                  } ${
                    dragging === element.id ? 'opacity-80' : ''
                  }`}
                  style={{
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    height: element.height,
                    fontSize: element.fontSize,
                    fontWeight: element.fontWeight,
                    color: element.color,
                    textAlign: element.align,
                    padding: '4px',
                    userSelect: previewMode ? 'text' : 'none'
                  }}
                >
                  {/* Content Wrapper - blocks all pointer events in edit mode */}
                  <div
                    className="w-full h-full"
                    style={{
                      pointerEvents: previewMode ? 'auto' : 'none',
                      position: 'relative'
                    }}
                  >
                  {element.type === 'image' ? (
                    previewArticle && previewArticle.imageUrl ? (
                      <img
                        src={getImageUrl(previewArticle.imageUrl)}
                        alt={previewArticle.productName}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-400 text-xs">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )
                  ) : element.type === 'qrCode' ? (
                    previewArticle && previewArticle.sourceUrl ? (
                      <div className="w-full h-full bg-white flex items-center justify-center p-1">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(previewArticle.sourceUrl)}`}
                          alt="QR Code"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-400 text-xs">
                        <QrCode className="w-8 h-8" />
                      </div>
                    )
                  ) : element.type === 'priceTable' ? (
                    previewArticle && (previewArticle.tieredPricesText || (previewArticle.tieredPrices && previewArticle.tieredPrices.length > 0)) ? (
                      <div
                        className="w-full h-full"
                        style={{
                          transformOrigin: 'top left',
                          transform: `scale(${element.width / (element.originalWidth || element.width)}, ${element.height / (element.originalHeight || element.height)})`
                        }}
                      >
                        <table
                          style={{
                            width: element.originalWidth || element.width,
                            height: element.originalHeight || element.height,
                            borderCollapse: 'collapse',
                            borderColor: element.tableConfig?.borderColor,
                            borderWidth: element.tableConfig?.borderWidth
                          }}
                        >
                          <thead>
                            <tr>
                              <th
                                style={{
                                  backgroundColor: element.tableConfig?.headerBg,
                                  color: element.tableConfig?.headerColor,
                                  fontSize: element.tableConfig?.headerFontSize,
                                  fontWeight: element.tableConfig?.headerFontWeight,
                                  padding: element.tableConfig?.cellPadding,
                                  border: `${element.tableConfig?.borderWidth}px solid ${element.tableConfig?.borderColor}`,
                                  textAlign: element.tableConfig?.headerAlign
                                }}
                              >
                                Menge
                              </th>
                              <th
                                style={{
                                  backgroundColor: element.tableConfig?.headerBg,
                                  color: element.tableConfig?.headerColor,
                                  fontSize: element.tableConfig?.headerFontSize,
                                  fontWeight: element.tableConfig?.headerFontWeight,
                                  padding: element.tableConfig?.cellPadding,
                                  border: `${element.tableConfig?.borderWidth}px solid ${element.tableConfig?.borderColor}`,
                                  textAlign: element.tableConfig?.headerAlign
                                }}
                              >
                                Einheit
                              </th>
                              <th
                                style={{
                                  backgroundColor: element.tableConfig?.headerBg,
                                  color: element.tableConfig?.headerColor,
                                  fontSize: element.tableConfig?.headerFontSize,
                                  fontWeight: element.tableConfig?.headerFontWeight,
                                  padding: element.tableConfig?.cellPadding,
                                  border: `${element.tableConfig?.borderWidth}px solid ${element.tableConfig?.borderColor}`,
                                  textAlign: element.tableConfig?.headerAlign
                                }}
                              >
                                Preis
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {parseTieredPrices(previewArticle).map((row, idx) => (
                              <tr key={idx}>
                                <td
                                  style={{
                                    backgroundColor: idx % 2 === 0 ? element.tableConfig?.rowBg : element.tableConfig?.rowAlternateBg,
                                    color: element.tableConfig?.rowColor,
                                    fontSize: element.tableConfig?.rowFontSize,
                                    padding: element.tableConfig?.cellPadding,
                                    border: `${element.tableConfig?.borderWidth}px solid ${element.tableConfig?.borderColor}`,
                                    textAlign: element.tableConfig?.rowAlign
                                  }}
                                >
                                  {row.quantity}
                                </td>
                                <td
                                  style={{
                                    backgroundColor: idx % 2 === 0 ? element.tableConfig?.rowBg : element.tableConfig?.rowAlternateBg,
                                    color: element.tableConfig?.rowColor,
                                    fontSize: element.tableConfig?.rowFontSize,
                                    padding: element.tableConfig?.cellPadding,
                                    border: `${element.tableConfig?.borderWidth}px solid ${element.tableConfig?.borderColor}`,
                                    textAlign: element.tableConfig?.rowAlign
                                  }}
                                >
                                  Stück
                                </td>
                                <td
                                  style={{
                                    backgroundColor: idx % 2 === 0 ? element.tableConfig?.rowBg : element.tableConfig?.rowAlternateBg,
                                    color: element.tableConfig?.rowColor,
                                    fontSize: element.tableConfig?.rowFontSize,
                                    padding: element.tableConfig?.cellPadding,
                                    border: `${element.tableConfig?.borderWidth}px solid ${element.tableConfig?.borderColor}`,
                                    textAlign: element.tableConfig?.rowAlign
                                  }}
                                >
                                  {row.price}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-400 text-xs">
                        <div className="text-center">
                          <DollarSign className="w-6 h-6 mx-auto mb-1" />
                          <div className="text-xs">Staffelpreise-Tabelle</div>
                        </div>
                      </div>
                    )
                  ) : (
                    <div
                      className="w-full h-full overflow-hidden"
                      style={{
                        transformOrigin: 'top left',
                        transform: element.originalWidth && element.originalHeight
                          ? `scale(${element.width / element.originalWidth}, ${element.height / element.originalHeight})`
                          : 'none',
                        width: element.originalWidth || element.width,
                        height: element.originalHeight || element.height
                      }}
                    >
                      {element.type === 'articleNumber' && previewArticle?.articleNumber ? (
                        <>
                          <span style={{
                            fontSize: element.labelFontSize || element.fontSize,
                            fontWeight: element.labelFontWeight || 'normal',
                            color: element.labelColor || element.color
                          }}>
                            Artikelnummer:{' '}
                          </span>
                          <span style={{
                            fontSize: element.fontSize,
                            fontWeight: element.fontWeight,
                            color: element.color
                          }}>
                            {previewArticle.articleNumber}
                          </span>
                        </>
                      ) : (
                        getDisplayContent(element)
                      )}
                    </div>
                  )}
                  </div>
                  {/* End Content Wrapper */}

                  {/* Resize Handles */}
                  {selectedElement === element.id && !previewMode && (
                    <>
                      {/* Corner handles */}
                      <div
                        className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                        style={{ top: -8, left: -8, cursor: 'nwse-resize' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeMouseDown(e, element.id, 'nw');
                        }}
                      />
                      <div
                        className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                        style={{ top: -8, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeMouseDown(e, element.id, 'n');
                        }}
                      />
                      <div
                        className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                        style={{ top: -8, right: -8, cursor: 'nesw-resize' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeMouseDown(e, element.id, 'ne');
                        }}
                      />
                      <div
                        className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                        style={{ top: '50%', right: -8, transform: 'translateY(-50%)', cursor: 'ew-resize' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeMouseDown(e, element.id, 'e');
                        }}
                      />
                      <div
                        className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                        style={{ bottom: -8, right: -8, cursor: 'nwse-resize' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeMouseDown(e, element.id, 'se');
                        }}
                      />
                      <div
                        className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                        style={{ bottom: -8, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeMouseDown(e, element.id, 's');
                        }}
                      />
                      <div
                        className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                        style={{ bottom: -8, left: -8, cursor: 'nesw-resize' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeMouseDown(e, element.id, 'sw');
                        }}
                      />
                      <div
                        className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                        style={{ top: '50%', left: -8, transform: 'translateY(-50%)', cursor: 'ew-resize' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeMouseDown(e, element.id, 'w');
                        }}
                      />
                    </>
                  )}
                </div>
                );
              })}

              {template.elements.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Plus className="w-12 h-12 mx-auto mb-2" />
                    <p>Füge Elemente aus der linken Sidebar hinzu</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Properties Panel */}
        {!previewMode && selectedElementData && (
          <div className="w-80 bg-white border-l p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Eigenschaften</h3>
                {hasOverride(selectedElementData.id) && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium">
                    Angepasst
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                {hasOverride(selectedElementData.id) && (
                  <button
                    onClick={() => resetOverride(selectedElementData.id)}
                    className="px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded"
                    title="Zurück zu Template-Werten"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={() => deleteElement(selectedElementData.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Info Banner for Article-Specific Overrides */}
            {hasOverride(selectedElementData.id) && (
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="text-orange-600 mt-0.5">ℹ️</div>
                  <div className="flex-1 text-xs text-orange-800">
                    <p className="font-semibold mb-1">Artikel-spezifische Anpassung</p>
                    <p>Diese Änderungen gelten nur für <span className="font-mono font-semibold">{previewArticle?.articleNumber}</span>. Das Template bleibt für andere Artikel unverändert.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Content */}
              {selectedElementData.type === 'text' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Überschrift
                  </label>
                  <input
                    type="text"
                    value={selectedElementData.content}
                    onChange={e => updateElement(selectedElementData.id, { content: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Leer = Produktname | Text eingeben = Custom"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Leer lassen = Produktname wird automatisch eingefügt. Text eingeben = Eigene Überschrift
                    {previewArticle && ` (Artikel: ${previewArticle.articleNumber})`}
                  </p>
                </div>
              )}

              {selectedElementData.type === 'freeText' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Freier Text
                  </label>
                  <textarea
                    value={selectedElementData.content}
                    onChange={e => updateElement(selectedElementData.id, { content: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={3}
                    placeholder="z.B. Scannen & im Shop ansehen"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Dieser Text wird immer genau so angezeigt (keine automatischen Produktdaten)
                  </p>
                </div>
              )}

              {/* Position */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">X</label>
                  <input
                    type="number"
                    value={selectedElementData.x}
                    onChange={e => updateElement(selectedElementData.id, { x: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Y</label>
                  <input
                    type="number"
                    value={selectedElementData.y}
                    onChange={e => updateElement(selectedElementData.id, { y: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {/* Size */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Breite</label>
                  <input
                    type="number"
                    value={selectedElementData.width}
                    onChange={e => updateElement(selectedElementData.id, { width: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Höhe</label>
                  <input
                    type="number"
                    value={selectedElementData.height}
                    onChange={e => updateElement(selectedElementData.id, { height: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {/* Special Styling for articleNumber (Label + Value) */}
              {selectedElementData.type === 'articleNumber' && (
                <>
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Label ("Artikelnummer:")</h4>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Schriftgröße</label>
                        <input
                          type="number"
                          value={selectedElementData.labelFontSize || selectedElementData.fontSize}
                          onChange={e => updateElement(selectedElementData.id, { labelFontSize: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Schriftstärke</label>
                        <select
                          value={selectedElementData.labelFontWeight || 'normal'}
                          onChange={e => updateElement(selectedElementData.id, { labelFontWeight: e.target.value as 'normal' | 'bold' })}
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          <option value="normal">Normal</option>
                          <option value="bold">Fett</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Farbe</label>
                        <input
                          type="color"
                          value={selectedElementData.labelColor || selectedElementData.color}
                          onChange={e => updateElement(selectedElementData.id, { labelColor: e.target.value })}
                          className="w-full h-10 border rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Wert (z.B. "1138")</h4>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Schriftgröße</label>
                        <input
                          type="number"
                          value={selectedElementData.fontSize}
                          onChange={e => updateElement(selectedElementData.id, { fontSize: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Schriftstärke</label>
                        <select
                          value={selectedElementData.fontWeight}
                          onChange={e => updateElement(selectedElementData.id, { fontWeight: e.target.value as 'normal' | 'bold' })}
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          <option value="normal">Normal</option>
                          <option value="bold">Fett</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Farbe</label>
                        <input
                          type="color"
                          value={selectedElementData.color}
                          onChange={e => updateElement(selectedElementData.id, { color: e.target.value })}
                          className="w-full h-10 border rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ausrichtung
                    </label>
                    <select
                      value={selectedElementData.align}
                      onChange={e => updateElement(selectedElementData.id, { align: e.target.value as 'left' | 'center' | 'right' })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="left">Links</option>
                      <option value="center">Zentriert</option>
                      <option value="right">Rechts</option>
                    </select>
                  </div>
                </>
              )}

              {/* Font Settings (for other text elements) */}
              {selectedElementData.type !== 'image' && selectedElementData.type !== 'qrCode' && selectedElementData.type !== 'articleNumber' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Schriftgröße
                    </label>
                    <input
                      type="number"
                      value={selectedElementData.fontSize}
                      onChange={e => updateElement(selectedElementData.id, { fontSize: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Schriftstärke
                    </label>
                    <select
                      value={selectedElementData.fontWeight}
                      onChange={e => updateElement(selectedElementData.id, { fontWeight: e.target.value as 'normal' | 'bold' })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Fett</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Farbe
                    </label>
                    <input
                      type="color"
                      value={selectedElementData.color}
                      onChange={e => updateElement(selectedElementData.id, { color: e.target.value })}
                      className="w-full h-10 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ausrichtung
                    </label>
                    <select
                      value={selectedElementData.align}
                      onChange={e => updateElement(selectedElementData.id, { align: e.target.value as 'left' | 'center' | 'right' })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="left">Links</option>
                      <option value="center">Zentriert</option>
                      <option value="right">Rechts</option>
                    </select>
                  </div>
                </>
              )}

              {/* Table Configuration (for priceTable) */}
              {selectedElementData.type === 'priceTable' && selectedElementData.tableConfig && (
                <>
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold text-gray-900 mb-3">Tabellen-Design</h4>

                    {/* Header Styling */}
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Header-Zeile</p>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-600">Hintergrundfarbe</label>
                          <input
                            type="color"
                            value={selectedElementData.tableConfig.headerBg}
                            onChange={e => updateElement(selectedElementData.id, {
                              tableConfig: { ...selectedElementData.tableConfig!, headerBg: e.target.value }
                            })}
                            className="w-full h-8 border rounded"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Textfarbe</label>
                          <input
                            type="color"
                            value={selectedElementData.tableConfig.headerColor}
                            onChange={e => updateElement(selectedElementData.id, {
                              tableConfig: { ...selectedElementData.tableConfig!, headerColor: e.target.value }
                            })}
                            className="w-full h-8 border rounded"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-600">Schriftgröße</label>
                            <input
                              type="number"
                              value={selectedElementData.tableConfig.headerFontSize}
                              onChange={e => updateElement(selectedElementData.id, {
                                tableConfig: { ...selectedElementData.tableConfig!, headerFontSize: parseInt(e.target.value) }
                              })}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600">Schriftstärke</label>
                            <select
                              value={selectedElementData.tableConfig.headerFontWeight}
                              onChange={e => updateElement(selectedElementData.id, {
                                tableConfig: { ...selectedElementData.tableConfig!, headerFontWeight: e.target.value as 'normal' | 'bold' }
                              })}
                              className="w-full px-2 py-1 border rounded text-sm"
                            >
                              <option value="normal">Normal</option>
                              <option value="bold">Fett</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Textausrichtung</label>
                          <select
                            value={selectedElementData.tableConfig.headerAlign}
                            onChange={e => updateElement(selectedElementData.id, {
                              tableConfig: { ...selectedElementData.tableConfig!, headerAlign: e.target.value as 'left' | 'center' | 'right' }
                            })}
                            className="w-full px-2 py-1 border rounded text-sm"
                          >
                            <option value="left">Links</option>
                            <option value="center">Zentriert</option>
                            <option value="right">Rechts</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Row Styling */}
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Daten-Zeilen</p>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-600">Hintergrund (gerade)</label>
                          <input
                            type="color"
                            value={selectedElementData.tableConfig.rowBg}
                            onChange={e => updateElement(selectedElementData.id, {
                              tableConfig: { ...selectedElementData.tableConfig!, rowBg: e.target.value }
                            })}
                            className="w-full h-8 border rounded"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Hintergrund (ungerade)</label>
                          <input
                            type="color"
                            value={selectedElementData.tableConfig.rowAlternateBg}
                            onChange={e => updateElement(selectedElementData.id, {
                              tableConfig: { ...selectedElementData.tableConfig!, rowAlternateBg: e.target.value }
                            })}
                            className="w-full h-8 border rounded"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Textfarbe</label>
                          <input
                            type="color"
                            value={selectedElementData.tableConfig.rowColor}
                            onChange={e => updateElement(selectedElementData.id, {
                              tableConfig: { ...selectedElementData.tableConfig!, rowColor: e.target.value }
                            })}
                            className="w-full h-8 border rounded"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Schriftgröße</label>
                          <input
                            type="number"
                            value={selectedElementData.tableConfig.rowFontSize}
                            onChange={e => updateElement(selectedElementData.id, {
                              tableConfig: { ...selectedElementData.tableConfig!, rowFontSize: parseInt(e.target.value) }
                            })}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Textausrichtung</label>
                          <select
                            value={selectedElementData.tableConfig.rowAlign}
                            onChange={e => updateElement(selectedElementData.id, {
                              tableConfig: { ...selectedElementData.tableConfig!, rowAlign: e.target.value as 'left' | 'center' | 'right' }
                            })}
                            className="w-full px-2 py-1 border rounded text-sm"
                          >
                            <option value="left">Links</option>
                            <option value="center">Zentriert</option>
                            <option value="right">Rechts</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Border & Spacing */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Rahmen & Abstand</p>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-600">Rahmenfarbe</label>
                          <input
                            type="color"
                            value={selectedElementData.tableConfig.borderColor}
                            onChange={e => updateElement(selectedElementData.id, {
                              tableConfig: { ...selectedElementData.tableConfig!, borderColor: e.target.value }
                            })}
                            className="w-full h-8 border rounded"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-600">Rahmenbreite</label>
                            <input
                              type="number"
                              value={selectedElementData.tableConfig.borderWidth}
                              onChange={e => updateElement(selectedElementData.id, {
                                tableConfig: { ...selectedElementData.tableConfig!, borderWidth: parseInt(e.target.value) }
                              })}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600">Zellen-Padding</label>
                            <input
                              type="number"
                              value={selectedElementData.tableConfig.cellPadding}
                              onChange={e => updateElement(selectedElementData.id, {
                                tableConfig: { ...selectedElementData.tableConfig!, cellPadding: parseInt(e.target.value) }
                              })}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
