/**
 * Print Preview Page
 * Shows how labels will look when printed on the selected paper format
 */

import { useEffect, useState } from 'react';
import { usePrintStore } from '../store/printStore';
import { useLabelStore } from '../store/labelStore';
import { useUiStore } from '../store/uiStore';
import { bulkPrintService } from '../services/bulkPrintService';
import { Printer, Download, Settings, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getLayoutById } from '../data/printLayouts';
import { articlesApi, getImageUrl, type Product } from '../services/api';
import { QRCodeSVG } from 'qrcode.react';
import { findMatchingTemplate } from '../utils/templateMatcher';
import type { LabelTemplate } from '../types/template.types';

export default function PrintPreview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { layout, setPaperFormat, setGridConfig } = usePrintStore();
  const { labels, selectedLabels: selectedLabelIds } = useLabelStore();
  const { showToast } = useUiStore();

  const [articles, setArticles] = useState<Product[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<LabelTemplate[]>([]);
  const [loadedTemplate, setLoadedTemplate] = useState<LabelTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);

  const selectedLabels = labels.filter((label) => selectedLabelIds.includes(label.id));

  // Load templates and articles
  useEffect(() => {
    const loadTemplateAndArticles = async () => {
      const templateId = searchParams.get('templateId');

      try {
        // Load all templates from localStorage or API
        const savedTemplates = JSON.parse(localStorage.getItem('labelTemplates') || '[]');
        setAvailableTemplates(savedTemplates);

        // If templateId is provided, use that specific template for layout
        const template = templateId
          ? savedTemplates.find((t: any) => t.id === templateId)
          : savedTemplates.find((t: any) => t.printLayoutId); // Fallback to first template with print layout

        if (template && template.printLayoutId) {
          setLoadedTemplate(template);

          // Load the print layout
          const printLayout = getLayoutById(template.printLayoutId);
          if (printLayout) {
            // Update the print store with the layout from template
            setPaperFormat({
              type: printLayout.paperFormat as any,
              width: printLayout.paperWidthMm,
              height: printLayout.paperHeightMm,
              orientation: 'portrait',
            });

            setGridConfig({
              columns: printLayout.columns,
              rows: printLayout.rows,
              spacing: printLayout.gutterHorizontalMm,
              margins: {
                top: printLayout.marginTopMm,
                right: printLayout.marginRightMm,
                bottom: printLayout.marginBottomMm,
                left: printLayout.marginLeftMm,
              },
            });

            // Load articles from API - get as many as grid slots
            const totalSlots = printLayout.columns * printLayout.rows;
            const response = await articlesApi.getAll({ limit: totalSlots });

            if (response.data) {
              setArticles(response.data);
            }
          }
        }
      } catch (error) {
        console.error('Error loading template and articles:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTemplateAndArticles();
  }, [searchParams, setPaperFormat, setGridConfig]);

  const handleBulkPrint = async (action: 'download' | 'print') => {
    const articlesToDisplay = loadedTemplate ? articles : selectedLabels;
    const labelIds = articlesToDisplay.map((item) => item.id);

    if (labelIds.length === 0) {
      showToast({ type: 'warning', message: 'Keine Labels zum Drucken verfügbar' });
      return;
    }

    setIsPrinting(true);

    try {
      const result = await bulkPrintService.exportAsPDF({
        labelIds,
        layout,
        action,
      });

      if (!result.success) {
        showToast({ type: 'error', message: `Fehler: ${result.error}` });
      }
    } catch (error) {
      console.error('Print error:', error);
      showToast({ type: 'error', message: 'Fehler beim Drucken' });
    } finally {
      setIsPrinting(false);
    }
  };

  // Convert mm to pixels for display (using 96 DPI for screen)
  const mmToPx = (mm: number) => (mm * 96) / 25.4;

  // Scale factor to fit paper on screen
  const scaleFactor = 0.5; // 50% of actual size for comfortable viewing

  const paperWidthPx = mmToPx(layout.paperFormat.width) * scaleFactor;
  const paperHeightPx = mmToPx(layout.paperFormat.height) * scaleFactor;

  const { columns, rows, spacing, margins } = layout.gridLayout;

  // Calculate label dimensions
  const availableWidth =
    layout.paperFormat.width - margins.left - margins.right - spacing * (columns - 1);
  const availableHeight =
    layout.paperFormat.height - margins.top - margins.bottom - spacing * (rows - 1);

  const labelWidthMm = availableWidth / columns;
  const labelHeightMm = availableHeight / rows;

  const labelWidthPx = mmToPx(labelWidthMm) * scaleFactor;
  const labelHeightPx = mmToPx(labelHeightMm) * scaleFactor;

  // Generate grid positions for labels with articles
  const gridPositions = [];
  const articlesToDisplay = loadedTemplate ? articles : selectedLabels;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const index = row * columns + col;
      if (index < articlesToDisplay.length) {
        const x = margins.left + col * (labelWidthMm + spacing);
        const y = margins.top + row * (labelHeightMm + spacing);

        const item = articlesToDisplay[index];
        gridPositions.push({
          article: item,
          x: mmToPx(x) * scaleFactor,
          y: mmToPx(y) * scaleFactor,
        });
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Druckvorschau</h1>
              <p className="text-sm text-gray-600">
                {layout.paperFormat.type}{' '}
                {layout.paperFormat.orientation === 'landscape' ? 'Querformat' : 'Hochformat'} -{' '}
                {columns}x{rows} Raster
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/print')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Einstellungen
            </button>
            <button
              onClick={() => handleBulkPrint('download')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              disabled={isPrinting || articlesToDisplay.length === 0}
            >
              <Download className="w-4 h-4" />
              {isPrinting ? 'Exportiert...' : 'PDF herunterladen'}
            </button>
            <button
              onClick={() => handleBulkPrint('print')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
              disabled={isPrinting || articlesToDisplay.length === 0}
            >
              <Printer className="w-4 h-4" />
              {isPrinting ? 'Druckt...' : `${articlesToDisplay.length} Labels drucken`}
            </button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
        <div className="flex items-center gap-8 text-sm">
          <div>
            <span className="text-gray-600">Papierformat:</span>
            <span className="ml-2 font-semibold text-gray-900">
              {layout.paperFormat.type} ({layout.paperFormat.width} × {layout.paperFormat.height}{' '}
              mm)
            </span>
          </div>
          <div>
            <span className="text-gray-600">Raster:</span>
            <span className="ml-2 font-semibold text-gray-900">
              {columns} Spalten × {rows} Reihen
            </span>
          </div>
          <div>
            <span className="text-gray-600">{loadedTemplate ? 'Artikel' : 'Labels'}:</span>
            <span className="ml-2 font-semibold text-gray-900">
              {articlesToDisplay.length} von {columns * rows} Plätzen
            </span>
          </div>
          {loadedTemplate && (
            <div>
              <span className="text-gray-600">Template:</span>
              <span className="ml-2 font-semibold text-gray-900">{loadedTemplate.name}</span>
            </div>
          )}
          <div>
            <span className="text-gray-600">Label-Größe:</span>
            <span className="ml-2 font-semibold text-gray-900">
              {labelWidthMm.toFixed(1)} × {labelHeightMm.toFixed(1)} mm
            </span>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="p-8 flex items-center justify-center">
        <div className="relative">
          {/* Paper */}
          <div
            className="bg-white shadow-2xl relative"
            style={{
              width: paperWidthPx,
              height: paperHeightPx,
              border: '1px solid #d1d5db',
            }}
          >
            {/* Margins visualization */}
            <div
              className="absolute border border-dashed border-gray-300"
              style={{
                top: mmToPx(margins.top) * scaleFactor,
                left: mmToPx(margins.left) * scaleFactor,
                right: mmToPx(margins.right) * scaleFactor,
                bottom: mmToPx(margins.bottom) * scaleFactor,
              }}
            />

            {/* Cut marks */}
            {layout.settings.showCutMarks && (
              <>
                {/* Corner cut marks */}
                <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-gray-400" />
                <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-gray-400" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-gray-400" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-gray-400" />
              </>
            )}

            {/* Grid lines (optional) */}
            {Array.from({ length: rows + 1 }).map((_, rowIndex) => {
              const y =
                margins.top +
                rowIndex * (labelHeightMm + spacing) -
                (rowIndex > 0 ? spacing / 2 : 0);
              return (
                <div
                  key={`h-${rowIndex}`}
                  className="absolute border-t border-gray-200"
                  style={{
                    top: mmToPx(y) * scaleFactor,
                    left: mmToPx(margins.left) * scaleFactor,
                    right: mmToPx(margins.right) * scaleFactor,
                  }}
                />
              );
            })}

            {Array.from({ length: columns + 1 }).map((_, colIndex) => {
              const x =
                margins.left +
                colIndex * (labelWidthMm + spacing) -
                (colIndex > 0 ? spacing / 2 : 0);
              return (
                <div
                  key={`v-${colIndex}`}
                  className="absolute border-l border-gray-200"
                  style={{
                    left: mmToPx(x) * scaleFactor,
                    top: mmToPx(margins.top) * scaleFactor,
                    bottom: mmToPx(margins.bottom) * scaleFactor,
                  }}
                />
              );
            })}

            {/* Labels */}
            {gridPositions.map((pos, index) => {
              const article = pos.article as Product; // Type assertion - we know these are Products from articles array
              const productName = article.productName || 'Produkt';
              const price = article.price || 0;
              const currency = article.currency || 'EUR';
              const articleNumber = article.articleNumber || 'N/A';
              const imageUrl = article.imageUrl || article.thumbnailUrl;
              const description = article.description || '';
              const sourceUrl = article.sourceUrl || '';
              const tieredPrices = article.tieredPrices || [];
              const tieredPricesText = article.tieredPricesText || '';

              // Check if "auf anfrage"
              const isAufAnfrage =
                tieredPricesText.toLowerCase().includes('auf anfrage') ||
                tieredPricesText.toLowerCase().includes('preis auf anfrage');

              // ✅ AUTO-MATCH: Find the correct template for this article
              const matchedTemplate = findMatchingTemplate(article, availableTemplates);

              // Check if the matched template is for tiered prices
              // by checking if the template's rules contain priceType: 'tiered'
              const isTieredTemplate =
                matchedTemplate?.rules?.conditions?.some(
                  (condition) => condition.field === 'priceType' && condition.value === 'tiered'
                ) || false;

              // Determine which template to use based on the matched template
              const showTieredTemplate = isTieredTemplate;

              return (
                <div
                  key={index}
                  className="absolute bg-white border border-gray-300 shadow-sm overflow-hidden"
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: labelWidthPx,
                    height: labelHeightPx,
                  }}
                >
                  {/* Label Content */}
                  <div className="p-2 h-full flex flex-col text-xs">
                    {/* Top Section: Image + Product Info */}
                    <div className="flex gap-2 mb-2">
                      {/* Product Image */}
                      {imageUrl && (
                        <div className="flex-shrink-0" style={{ width: '35%' }}>
                          <img
                            src={getImageUrl(imageUrl)}
                            alt={productName}
                            className="w-full h-20 object-contain border border-gray-200 rounded"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      {/* Product Name + Price/Tiered Prices */}
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-bold text-gray-900 text-xs leading-tight mb-1"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {productName}
                        </div>

                        {showTieredTemplate ? (
                          // Staffelpreis Template
                          <div className="mt-1">
                            {isAufAnfrage ? (
                              <div className="text-orange-600 font-semibold text-xs">
                                Auf Anfrage
                              </div>
                            ) : tieredPrices.length > 0 ? (
                              <div className="text-[10px] text-gray-700 space-y-0.5">
                                {tieredPrices.slice(0, 3).map((tier: any, i: number) => {
                                  const tierPrice =
                                    typeof tier.price === 'string'
                                      ? parseFloat(tier.price)
                                      : tier.price;
                                  return (
                                    <div key={i} className="flex justify-between">
                                      <span className="text-gray-600">
                                        {i === 0 ? `Bis ${tier.quantity}` : `Ab ${tier.quantity}`}:
                                      </span>
                                      <span className="font-semibold">
                                        {tierPrice ? tierPrice.toFixed(2) : '-'} {currency}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div
                                className="text-[10px] text-gray-600 whitespace-pre-line"
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {tieredPricesText}
                              </div>
                            )}
                          </div>
                        ) : (
                          // Normal Template - just price
                          <div className="text-base font-bold text-blue-600 mt-1">
                            {isAufAnfrage ? (
                              <span className="text-orange-600 text-xs">Auf Anfrage</span>
                            ) : typeof price === 'number' && price > 0 ? (
                              `${price.toFixed(2)} ${currency}`
                            ) : (
                              <span className="text-gray-500 text-xs">-</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* QR Code */}
                      {sourceUrl && (
                        <div className="flex-shrink-0">
                          <QRCodeSVG
                            value={sourceUrl}
                            size={labelWidthPx * 0.15}
                            level="M"
                            includeMargin={false}
                            fgColor="#1e293b"
                          />
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {description && (
                      <div
                        className="text-[10px] text-gray-600 mb-2"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {description}
                      </div>
                    )}

                    {/* Bottom: Article Number */}
                    <div className="mt-auto text-gray-500 text-[9px] pt-1 border-t border-gray-200">
                      Art-Nr: {articleNumber}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Empty slots or loading indication */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <p className="text-lg font-semibold">Lade Artikel...</p>
                </div>
              </div>
            )}

            {!loading && gridPositions.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <p className="text-lg font-semibold">Keine Artikel verfügbar</p>
                  <p className="text-sm mt-2">Keine Artikel in der Datenbank gefunden</p>
                </div>
              </div>
            )}
          </div>

          {/* Paper info */}
          <div className="mt-4 text-center text-sm text-gray-600">
            Ansicht: 50% der Originalgröße
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
          }
        }
      `}</style>
    </div>
  );
}
