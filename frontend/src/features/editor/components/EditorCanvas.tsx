import type { Product } from '@/services/api';
import { getImageUrl } from '@/services/api';
import { DollarSign, ImageIcon, Plus, QrCode } from 'lucide-react';
import type { LabelElement, LabelTemplate } from '../types';
import { getDisplayContent, parseTieredPrices } from '../utils';

interface EditorCanvasProps {
  template: LabelTemplate;
  zoom: number;
  previewMode: boolean;
  selectedElementId: string | null;
  onSelectElement: (id: string, e: React.MouseEvent) => void;
  previewArticle: Product | null;
  getEffectiveElement: (id: string) => LabelElement | undefined;
  hasOverride: (id: string) => boolean;
  dragging: string | null;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onResizeMouseDown: (e: React.MouseEvent, id: string, handle: string) => void;
  // setZoom removed as unused
  canvasContainerRef: React.RefObject<HTMLDivElement>;
}

export function EditorCanvas({
  template,
  zoom,
  previewMode,
  selectedElementId,
  onSelectElement,
  previewArticle,
  getEffectiveElement,
  hasOverride,
  dragging,
  onMouseMove,
  onMouseUp,
  onResizeMouseDown,
  // setZoom, // unused
  canvasContainerRef
}: EditorCanvasProps) {

  // Mouse wheel zoom logic is in parent `LabelTemplateEditor`

  return (
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
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
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
                onMouseDown={(e) => onSelectElement(element.id, e)}
                className={`absolute ${
                  previewMode ? 'cursor-default' : 'cursor-move'
                } ${
                  selectedElementId === element.id && !previewMode
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
                {/* Content Wrapper */}
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
                        getDisplayContent(element, previewArticle)
                      )}
                    </div>
                  )}
                </div>

                {/* Resize Handles */}
                {selectedElementId === element.id && !previewMode && (
                  <>
                    <div
                      className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                      style={{ top: -8, left: -8, cursor: 'nwse-resize' }}
                      onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, element.id, 'nw'); }}
                    />
                    <div
                      className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                      style={{ top: -8, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' }}
                      onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, element.id, 'n'); }}
                    />
                    <div
                      className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                      style={{ top: -8, right: -8, cursor: 'nesw-resize' }}
                      onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, element.id, 'ne'); }}
                    />
                    <div
                      className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                      style={{ top: '50%', right: -8, transform: 'translateY(-50%)', cursor: 'ew-resize' }}
                      onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, element.id, 'e'); }}
                    />
                    <div
                      className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                      style={{ bottom: -8, right: -8, cursor: 'nwse-resize' }}
                      onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, element.id, 'se'); }}
                    />
                    <div
                      className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                      style={{ bottom: -8, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' }}
                      onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, element.id, 's'); }}
                    />
                    <div
                      className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                      style={{ bottom: -8, left: -8, cursor: 'nesw-resize' }}
                      onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, element.id, 'sw'); }}
                    />
                    <div
                      className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full hover:scale-125 transition-transform z-50"
                      style={{ top: '50%', left: -8, transform: 'translateY(-50%)', cursor: 'ew-resize' }}
                      onMouseDown={(e) => { e.stopPropagation(); onResizeMouseDown(e, element.id, 'w'); }}
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
  );
}
