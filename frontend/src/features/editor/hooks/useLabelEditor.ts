import { calculateLabelSize, getLayoutById, mmToPx } from '@/data/printLayouts';
import type { Product } from '@/services/api';
import { useState } from 'react';
import type { LabelElement, LabelTemplate, TemplateSettings } from '../types';

export function useLabelEditor() {
  const [template, setTemplate] = useState<LabelTemplate>(() => {
    // Load template from sessionStorage if editing
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
  });

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<Product | null>(null);
  const [zoom, setZoom] = useState<number>(1.5);
  const [selectedPrintLayoutId, setSelectedPrintLayoutId] = useState<string>('');

  // Helper to update template safely
  const updateTemplate = (updates: Partial<LabelTemplate> | ((prev: LabelTemplate) => Partial<LabelTemplate>)) => {
    setTemplate(prev => {
      const newValues = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...newValues };
    });
  };

  // Element Management
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
    setSelectedElementId(newElement.id);
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
    if (previewArticle?.articleNumber) {
      setTemplate(prev => {
        const articleOverrides = prev.articleOverrides || {};
        const articleNumber = previewArticle.articleNumber!; // Non-null assertion safer here
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
      // Direct template update
      setTemplate(prev => ({
        ...prev,
        elements: prev.elements.map(el =>
          el.id === id ? { ...el, ...updates } : el
        )
      }));
    }
  };

  const deleteElement = (id: string) => {
    setTemplate(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== id)
    }));
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
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

  const applyPrintLayout = (layoutId: string) => {
    if (!layoutId) {
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

  // Get effective element (handling overrides)
  const getEffectiveElement = (elementId: string): LabelElement | undefined => {
    const templateElement = template.elements.find(el => el.id === elementId);
    if (!templateElement) return undefined;

    if (!previewArticle?.articleNumber || !template.articleOverrides) {
      return templateElement;
    }

    const overrides = template.articleOverrides[previewArticle.articleNumber]?.[elementId];
    if (!overrides) return templateElement;

    return { ...templateElement, ...overrides };
  };

  return {
    template,
    setTemplate,
    selectedElementId,
    setSelectedElementId,
    previewMode,
    setPreviewMode,
    previewArticle,
    setPreviewArticle,
    zoom,
    setZoom,
    selectedPrintLayoutId,
    applyPrintLayout,
    addElement,
    updateElement,
    deleteElement,
    updateTemplateSetting,
    getEffectiveElement,
    updateTemplate,
  };
}
