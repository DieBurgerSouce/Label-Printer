/**
 * Label Template Editor
 * Visual editor for creating custom label templates
 */

import { EditorCanvas } from '@/features/editor/components/EditorCanvas';
import { EditorPropertiesPanel } from '@/features/editor/components/EditorPropertiesPanel';
import { EditorSidebar } from '@/features/editor/components/EditorSidebar';
import { EditorToolbar } from '@/features/editor/components/EditorToolbar';
import { useLabelEditor } from '@/features/editor/hooks/useLabelEditor';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { articlesApi, renderingTemplateApi, templateApi } from '../services/api';
import { useUiStore } from '../store/uiStore';

export default function LabelTemplateEditor() {
  // const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useUiStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Use custom hook for editor state
  const {
    template,
    // setTemplate, // Unused
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
    updateTemplate
  } = useLabelEditor();

  // Local state for interaction
  const [articleSearch, setArticleSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  // Unused dragOffset prefixed with _
  const [_dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState<string | null>(null);
  const [initialResizeState, setInitialResizeState] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    elementX: number;
    elementY: number;
  } | null>(null);

  // Zoom options
  const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

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
      if (e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();

        const scaleBy = 1.05;
        setZoom(prevZoom => {
            const newZoom = e.deltaY < 0 ? prevZoom * scaleBy : prevZoom / scaleBy;
            return Math.max(0.25, Math.min(5, newZoom));
        });
      }
    };

    // Add event listener with passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [setZoom]);

  // Search for article by article number
  const searchArticle = async () => {
    if (!articleSearch.trim()) return;

    setSearching(true);
    try {
      const response = await articlesApi.getAll({ search: articleSearch, limit: 1 });
      if (response.data && response.data.length > 0) {
        setPreviewArticle(response.data[0]);
      } else {
        showToast({ type: 'warning', message: 'Artikel nicht gefunden!' });
        setPreviewArticle(null);
      }
    } catch (error) {
      console.error('Error searching article:', error);
      showToast({ type: 'error', message: 'Fehler beim Suchen des Artikels' });
    } finally {
      setSearching(false);
    }
  };

  // Handle background image upload
  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      updateTemplateSetting('backgroundImage', base64);
    };
    reader.readAsDataURL(file);
  };

  // Mouse Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    if (previewMode) return;
    e.stopPropagation();

    // Find the element
    const element = template.elements.find(el => el.id === id);
    if (!element) return;

    setSelectedElementId(id);
    setDragging(id);

    // Calculate offset relative to the scaled canvas
    // We need logic similar to original to ensure smooth dragging at different zooms
    // For simplicity here, we track initial mouse position vs element position
    // Note: The move handler needs to account for zoom
    setDragOffset({
      x: e.clientX, // Store initial mouse pos
      y: e.clientY
    });

    // Also store initial element pos
    setInitialResizeState({
        x: e.clientX,
        y: e.clientY,
        width: element.width,
        height: element.height,
        elementX: element.x,
        elementY: element.y
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, id: string, handle: string) => {
    e.stopPropagation();
    if (previewMode) return;

    const element = template.elements.find(el => el.id === id);
    if (!element) return;

    setResizing(handle);
    setSelectedElementId(id);
    setInitialResizeState({
      x: e.clientX,
      y: e.clientY,
      width: element.width,
      height: element.height,
      elementX: element.x,
      elementY: element.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (previewMode) return;

    if (dragging && initialResizeState) {
        const deltaX = (e.clientX - initialResizeState.x) / zoom;
        const deltaY = (e.clientY - initialResizeState.y) / zoom;

        updateElement(dragging, {
            x: Math.round(initialResizeState.elementX + deltaX),
            y: Math.round(initialResizeState.elementY + deltaY)
        });
    } else if (resizing && initialResizeState && selectedElementId) {
        const deltaX = (e.clientX - initialResizeState.x) / zoom;
        const deltaY = (e.clientY - initialResizeState.y) / zoom;

        const { width, height, elementX, elementY } = initialResizeState;
        let newX = elementX;
        let newY = elementY;
        let newWidth = width;
        let newHeight = height;

        if (resizing.includes('e')) newWidth = width + deltaX;
        if (resizing.includes('w')) {
            newWidth = width - deltaX;
            newX = elementX + deltaX;
        }
        if (resizing.includes('s')) newHeight = height + deltaY;
        if (resizing.includes('n')) {
            newHeight = height - deltaY;
            newY = elementY + deltaY;
        }

        // Enforce minimum size
        if (newWidth < 10) newWidth = 10;
        if (newHeight < 10) newHeight = 10;

        updateElement(selectedElementId, {
            x: Math.round(newX),
            y: Math.round(newY),
            width: Math.round(newWidth),
            height: Math.round(newHeight)
        });
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setResizing(null);
    setInitialResizeState(null);
  };

  // Actions
  const saveTemplate = async () => {
    try {
      if (template.id && template.id.length > 30) { // Naive check for UUID (new) vs ID
         // It's a new template (UUID) or existing?
         // This logic depends on how "new" vs "edit" is handled.
         // Assuming create if not saved before, update if has ID.
         // Actually backend handles ID.
         await templateApi.save(template);
      } else {
         await templateApi.update(template.id, template);
      }
      showToast({ type: 'success', message: 'Template gespeichert!' });
      queryClient.invalidateQueries({ queryKey: ['labelTemplates'] });
    } catch (error) {
      console.error('Error saving template:', error);
      showToast({ type: 'error', message: 'Fehler beim Speichern' });
    }
  };

  const handlePrintTemplate = () => {
      // In a real app this would open a print dialog
      showToast({ type: 'info', message: 'Druckvorschau wird geöffnet... (Mock)' });
  };

  const handleConvertToRenderingTemplate = async () => {
    if (!confirm('Dieses Template als Rendering-Template speichern?')) return;
    try {
      const response = await renderingTemplateApi.convert(template, `Converted - ${template.name}`);
      if (response.data) {
        showToast({ type: 'success', message: 'Erfolgreich konvertiert! Du kannst es jetzt im Rendering-Editor bearbeiten.' });
        // navigate('/rendering-templates'); // Optional: redirect
      }
    } catch (error) {
      console.error('Conversion error:', error);
      showToast({ type: 'error', message: 'Fehler bei der Konvertierung' });
    }
  };

  const handleExportPdf = async () => {
    if (!previewArticle) return;
    try {
        // Need ID to export. If unsaved, warn user?
        // We can check if template exists in DB or just use current state if API supports it.
        // The API `renderingTemplateApi.exportPdf` takes an ID.
        // So we might need to save first or use a "preview" endpoint.
        // For now assuming template exists or user has to save.
        if (template.id.length > 30) {
            showToast({ type: 'warning', message: 'Bitte speichere das Template zuerst.' });
            return;
        }
        const response = await renderingTemplateApi.exportPdf(template.id, previewArticle);
        if (response.data && response.data.pdf) {
            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${response.data.pdf}`;
            link.download = response.data.fileName;
            link.click();
        }
    } catch (error) {
        console.error('Export error:', error);
        showToast({ type: 'error', message: 'Fehler beim Export' });
    }
  };

  const hasOverride = (elementId: string): boolean => {
      return !!(previewArticle?.articleNumber &&
             template.articleOverrides?.[previewArticle.articleNumber]?.[elementId]);
  };

  const resetOverride = (elementId: string) => {
      if (!previewArticle?.articleNumber) return;

      const articleNumber = previewArticle.articleNumber;
      if (!template.articleOverrides?.[articleNumber]?.[elementId]) return;

      const newOverrides = { ...template.articleOverrides };
      const articleOverrides = { ...newOverrides[articleNumber] };
      delete articleOverrides[elementId];

      if (Object.keys(articleOverrides).length === 0) {
          delete newOverrides[articleNumber];
      } else {
          newOverrides[articleNumber] = articleOverrides;
      }

      updateTemplate({ articleOverrides: newOverrides });
  };

  const selectedElementData = selectedElementId ? getEffectiveElement(selectedElementId) : undefined;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <EditorToolbar
        template={template}
        onNameChange={(name) => updateTemplate({ name })}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToScreen={handleFitToScreen}
        zoomLevels={zoomLevels}
        previewMode={previewMode}
        onTogglePreviewMode={() => setPreviewMode(!previewMode)}
        onPrintTemplate={handlePrintTemplate}
        onConvertToRenderingTemplate={handleConvertToRenderingTemplate}
        onExportPdf={handleExportPdf}
        onSave={saveTemplate}
        previewArticle={previewArticle}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Element Toolbox */}
        {!previewMode && (
          <EditorSidebar
            onAddElement={addElement}
            articleSearch={articleSearch}
            onArticleSearchChange={setArticleSearch}
            onSearchArticle={searchArticle}
            searching={searching}
            previewArticle={previewArticle}
            selectedPrintLayoutId={selectedPrintLayoutId}
            onPrintLayoutChange={applyPrintLayout}
            template={template}
            onUpdateTemplateSetting={updateTemplateSetting}
            onUpdateTemplate={updateTemplate}
            fileInputRef={fileInputRef}
            onBackgroundImageUpload={handleBackgroundImageUpload}
          />
        )}

        {/* Canvas Area */}
        <EditorCanvas
          template={template}
          zoom={zoom}
          previewMode={previewMode}
          selectedElementId={selectedElementId}
          onSelectElement={(id, e) => handleMouseDown(e, id)}
          previewArticle={previewArticle}
          getEffectiveElement={getEffectiveElement}
          hasOverride={hasOverride}
          dragging={dragging}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onResizeMouseDown={handleResizeMouseDown}
          // setZoom={setZoom} // Removed
          canvasContainerRef={canvasContainerRef}
        />

        {/* Properties Panel */}
        {!previewMode && selectedElementData && (
          <EditorPropertiesPanel
            selectedElementData={selectedElementData}
            hasOverride={hasOverride}
            onResetOverride={resetOverride}
            onDeleteElement={deleteElement}
            previewArticle={previewArticle}
            onUpdateElement={updateElement}
          />
        )}
      </div>
    </div>
  );
}
