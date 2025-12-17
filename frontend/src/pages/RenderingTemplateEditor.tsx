/**
 * Rendering Template Editor
 * Visual editor for creating server-side rendering templates
 * Uses /api/templates (separate from label-templates)
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Eye,
  Plus,
  Trash2,
  ArrowLeft,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { renderingTemplateApi, articlesApi, type Product } from '../services/api';
import { useUiStore } from '../store/uiStore';

interface TemplateLayer {
  id: string;
  type: 'text' | 'image' | 'shape' | 'barcode';
  name: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  visible: boolean;
}

interface TemplateDimensions {
  width: number;
  height: number;
  unit: 'px' | 'mm';
  dpi: number;
}

interface RenderingTemplate {
  id?: string;
  name: string;
  description?: string;
  version: string;
  dimensions: TemplateDimensions;
  layers: TemplateLayer[];
  fieldStyles: any[];
  formattingOptions: any;
  globalStyles: any;
  variables: any[];
  settings: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export default function RenderingTemplateEditor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useUiStore();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const [template, setTemplate] = useState<RenderingTemplate>({
    name: 'New Rendering Template',
    description: '',
    version: '1.0.0',
    dimensions: {
      width: 400,
      height: 300,
      unit: 'px',
      dpi: 300
    },
    layers: [],
    fieldStyles: [],
    formattingOptions: {},
    globalStyles: {},
    variables: [],
    settings: {}
  });

  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [testArticle, setTestArticle] = useState<Product | null>(null);

  // Load template if editing
  useEffect(() => {
    if (editId) {
      loadTemplate(editId);
    }
  }, [editId]);

  // Load test article for preview
  useEffect(() => {
    loadTestArticle();
  }, []);

  const loadTemplate = async (id: string) => {
    try {
      const response = await renderingTemplateApi.getById(id);
      if (response.success && response.data) {
        setTemplate((response.data as any).template);
      }
    } catch (error) {
      console.error('Failed to load template:', error);
      showToast({ type: 'error', message: 'Fehler beim Laden des Templates!' });
    }
  };

  const loadTestArticle = async () => {
    try {
      const response = await articlesApi.getAll({ limit: 1 });
      if (response.data && response.data.length > 0) {
        setTestArticle(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to load test article:', error);
    }
  };

  const addLayer = (type: TemplateLayer['type']) => {
    const newLayer: TemplateLayer = {
      id: crypto.randomUUID(),
      type,
      name: `${type}-${template.layers.length + 1}`,
      content: getDefaultContent(type),
      x: 50,
      y: 50 + (template.layers.length * 40),
      width: type === 'image' ? 100 : 200,
      height: type === 'image' ? 100 : 40,
      fontSize: 16,
      fontWeight: 'normal',
      color: '#000000',
      backgroundColor: type === 'shape' ? '#e5e7eb' : 'transparent',
      visible: true
    };

    setTemplate(prev => ({
      ...prev,
      layers: [...prev.layers, newLayer]
    }));
    setSelectedLayer(newLayer.id);
  };

  const getDefaultContent = (type: TemplateLayer['type']): string => {
    switch (type) {
      case 'text': return '{{productName}}';
      case 'image': return '{{imageUrl}}';
      case 'shape': return '';
      case 'barcode': return '{{articleNumber}}';
      default: return '';
    }
  };

  const updateLayer = (id: string, updates: Partial<TemplateLayer>) => {
    setTemplate(prev => ({
      ...prev,
      layers: prev.layers.map(layer =>
        layer.id === id ? { ...layer, ...updates } : layer
      )
    }));
  };

  const deleteLayer = (id: string) => {
    setTemplate(prev => ({
      ...prev,
      layers: prev.layers.filter(layer => layer.id !== id)
    }));
    if (selectedLayer === id) {
      setSelectedLayer(null);
    }
  };

  const saveTemplate = async () => {
    try {
      setSaving(true);

      if (editId || template.id) {
        // Update existing template
        await renderingTemplateApi.update(editId || template.id!, template);
        showToast({ type: 'success', message: 'Template erfolgreich aktualisiert!' });
      } else {
        // Create new template
        const response = await renderingTemplateApi.create(template);
        if (response.success && response.data) {
          setTemplate((response.data as any).template);
        }
        showToast({ type: 'success', message: 'Template erfolgreich erstellt!' });
      }

      queryClient.invalidateQueries({ queryKey: ['renderingTemplates'] });
      navigate('/rendering-templates');
    } catch (error: any) {
      console.error('Failed to save template:', error);

      let errorMessage = 'Fehler beim Speichern des Templates!';
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      showToast({ type: 'error', message: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  const renderPreview = async () => {
    if (!template.id && !editId) {
      showToast({ type: 'warning', message: 'Bitte speichern Sie das Template zuerst!' });
      return;
    }

    try {
      const data = testArticle || {
        productName: 'Test Product',
        articleNumber: '12345',
        price: 99.99
      };

      const blob = await renderingTemplateApi.renderImage(
        editId || template.id!,
        data
      );

      const url = URL.createObjectURL(blob);
      setPreviewImage(url);
    } catch (error) {
      console.error('Failed to render preview:', error);
      showToast({ type: 'error', message: 'Fehler beim Rendern der Vorschau!' });
    }
  };

  const selectedLayerData = template.layers.find(l => l.id === selectedLayer);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/rendering-templates')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={template.name}
            onChange={e => setTemplate(prev => ({ ...prev, name: e.target.value }))}
            className="text-xl font-bold border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2"
          />
        </div>

        <div className="flex items-center gap-3">
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

          {(editId || template.id) && (
            <button
              onClick={renderPreview}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <ImageIcon className="w-4 h-4" />
              Render Vorschau
            </button>
          )}

          <button
            onClick={saveTemplate}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Layer Toolbox */}
        {!previewMode && (
          <div className="w-64 bg-white border-r p-4 overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-3">Layer hinzufügen</h3>

            <div className="space-y-2 mb-6">
              <button
                onClick={() => addLayer('text')}
                className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-left"
              >
                <FileText className="w-4 h-4" />
                Text Layer
              </button>

              <button
                onClick={() => addLayer('image')}
                className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-left"
              >
                <ImageIcon className="w-4 h-4" />
                Image Layer
              </button>

              <button
                onClick={() => addLayer('shape')}
                className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-left"
              >
                <Plus className="w-4 h-4" />
                Shape Layer
              </button>
            </div>

            {/* Layer List */}
            <div className="border-t pt-4">
              <h3 className="font-semibold text-gray-900 mb-3">Layer ({template.layers.length})</h3>

              <div className="space-y-1">
                {template.layers.map((layer) => (
                  <div
                    key={layer.id}
                    onClick={() => setSelectedLayer(layer.id)}
                    className={`p-2 rounded cursor-pointer flex items-center justify-between ${
                      selectedLayer === layer.id ? 'bg-blue-100 border border-blue-500' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">{layer.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayer(layer.id, { visible: !layer.visible });
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      {layer.visible ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Template Settings */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-semibold text-gray-900 mb-3">Template-Größe</h3>

              <div className="space-y-2">
                <div>
                  <label className="text-sm text-gray-600">Breite (px)</label>
                  <input
                    type="number"
                    value={template.dimensions.width}
                    onChange={e => setTemplate(prev => ({
                      ...prev,
                      dimensions: { ...prev.dimensions, width: parseInt(e.target.value) }
                    }))}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600">Höhe (px)</label>
                  <input
                    type="number"
                    value={template.dimensions.height}
                    onChange={e => setTemplate(prev => ({
                      ...prev,
                      dimensions: { ...prev.dimensions, height: parseInt(e.target.value) }
                    }))}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600">DPI</label>
                  <input
                    type="number"
                    value={template.dimensions.dpi}
                    onChange={e => setTemplate(prev => ({
                      ...prev,
                      dimensions: { ...prev.dimensions, dpi: parseInt(e.target.value) }
                    }))}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600">Beschreibung</label>
                  <textarea
                    value={template.description || ''}
                    onChange={e => setTemplate(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm"
                    rows={3}
                    placeholder="Template-Beschreibung..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Canvas Area */}
        <div className="flex-1 bg-gray-100 overflow-auto flex items-center justify-center p-10">
          {previewImage ? (
            <div className="bg-white p-4 rounded-lg shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Rendered Preview</h3>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Schließen
                </button>
              </div>
              <img src={previewImage} alt="Rendered template" className="max-w-full" />
            </div>
          ) : (
            <div
              className="bg-white shadow-2xl relative"
              style={{
                width: template.dimensions.width,
                height: template.dimensions.height,
                border: '1px solid #e5e7eb'
              }}
            >
              {/* Render layers */}
              {template.layers
                .filter(layer => layer.visible)
                .map(layer => (
                  <div
                    key={layer.id}
                    onClick={() => !previewMode && setSelectedLayer(layer.id)}
                    className={`absolute ${
                      !previewMode && selectedLayer === layer.id
                        ? 'ring-2 ring-blue-500'
                        : ''
                    } ${!previewMode ? 'cursor-pointer' : ''}`}
                    style={{
                      left: layer.x,
                      top: layer.y,
                      width: layer.width,
                      height: layer.height,
                      fontSize: layer.fontSize,
                      fontWeight: layer.fontWeight,
                      color: layer.color,
                      backgroundColor: layer.backgroundColor,
                      padding: '4px',
                      overflow: 'hidden'
                    }}
                  >
                    {layer.type === 'text' && (
                      <div>{layer.content || 'Text Layer'}</div>
                    )}
                    {layer.type === 'image' && (
                      <div className="w-full h-full bg-gray-100 border border-gray-300 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    {layer.type === 'shape' && (
                      <div className="w-full h-full" />
                    )}
                  </div>
                ))}

              {template.layers.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Plus className="w-12 h-12 mx-auto mb-2" />
                    <p>Füge Layer aus der linken Sidebar hinzu</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Properties Panel */}
        {!previewMode && selectedLayerData && (
          <div className="w-80 bg-white border-l p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Layer Eigenschaften</h3>
              <button
                onClick={() => deleteLayer(selectedLayerData.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={selectedLayerData.name}
                  onChange={e => updateLayer(selectedLayerData.id, { name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={selectedLayerData.content}
                  onChange={e => updateLayer(selectedLayerData.id, { content: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="z.B. {{productName}}, {{price}}, etc."
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 Verwende {'{{variableName}}'} für dynamische Daten
                </p>
              </div>

              {/* Position */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">X</label>
                  <input
                    type="number"
                    value={selectedLayerData.x}
                    onChange={e => updateLayer(selectedLayerData.id, { x: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Y</label>
                  <input
                    type="number"
                    value={selectedLayerData.y}
                    onChange={e => updateLayer(selectedLayerData.id, { y: parseInt(e.target.value) })}
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
                    value={selectedLayerData.width}
                    onChange={e => updateLayer(selectedLayerData.id, { width: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Höhe</label>
                  <input
                    type="number"
                    value={selectedLayerData.height}
                    onChange={e => updateLayer(selectedLayerData.id, { height: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {/* Text Styling (for text layers) */}
              {selectedLayerData.type === 'text' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Schriftgröße</label>
                    <input
                      type="number"
                      value={selectedLayerData.fontSize}
                      onChange={e => updateLayer(selectedLayerData.id, { fontSize: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Schriftstärke</label>
                    <select
                      value={selectedLayerData.fontWeight}
                      onChange={e => updateLayer(selectedLayerData.id, { fontWeight: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Fett</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Textfarbe</label>
                    <input
                      type="color"
                      value={selectedLayerData.color}
                      onChange={e => updateLayer(selectedLayerData.id, { color: e.target.value })}
                      className="w-full h-10 border rounded-lg"
                    />
                  </div>
                </>
              )}

              {/* Background Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hintergrundfarbe</label>
                <input
                  type="color"
                  value={selectedLayerData.backgroundColor || '#ffffff'}
                  onChange={e => updateLayer(selectedLayerData.id, { backgroundColor: e.target.value })}
                  className="w-full h-10 border rounded-lg"
                />
              </div>

              {/* Visibility */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedLayerData.visible}
                    onChange={e => updateLayer(selectedLayerData.id, { visible: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Sichtbar</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
