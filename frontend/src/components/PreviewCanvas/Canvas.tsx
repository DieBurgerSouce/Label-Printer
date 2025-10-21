/**
 * Live Preview Canvas with Konva.js
 * Provides interactive label preview with drag & drop
 */
import { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { usePrintStore } from '../../store/printStore';
import { useLabelStore } from '../../store/labelStore';
import { useUiStore } from '../../store/uiStore';
import { QRCodeElement } from './QRCodeElement';

interface CanvasProps {
  width?: number;
  height?: number;
  showGrid?: boolean;
  showRulers?: boolean;
}

interface LabelPosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export const Canvas = ({
  width = 800,
  height = 600,
  showGrid = true
}: CanvasProps) => {
  const stageRef = useRef<any>(null);
  const { layout } = usePrintStore();
  const { labels, selectedLabels: selectedLabelIds } = useLabelStore();
  const { zoom } = useUiStore();

  // Get actual label objects from IDs
  const selectedLabels = labels.filter(label => selectedLabelIds.includes(label.id));

  const [labelPositions, setLabelPositions] = useState<LabelPosition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedQrId, setSelectedQrId] = useState<string | null>(null);
  const { updateLabel } = useLabelStore();

  // Initialize label positions based on grid layout
  useEffect(() => {
    if (!layout || !selectedLabels.length) return;

    const { columns, rows, spacing, margins } = layout.gridLayout;
    const { width: pageWidth, height: pageHeight } = layout.paperFormat;

    // Calculate label dimensions
    const availableWidth = pageWidth - margins.left - margins.right - (spacing * (columns - 1));
    const availableHeight = pageHeight - margins.top - margins.bottom - (spacing * (rows - 1));

    const labelWidth = availableWidth / columns;
    const labelHeight = availableHeight / rows;

    const positions: LabelPosition[] = selectedLabels.map((label, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);

      return {
        id: label.id,
        x: margins.left + (col * (labelWidth + spacing)),
        y: margins.top + (row * (labelHeight + spacing)),
        width: labelWidth,
        height: labelHeight,
        rotation: 0,
      };
    });

    setLabelPositions(positions);
  }, [layout, selectedLabels]);

  // Handle label drag
  const handleDragEnd = (id: string) => (e: KonvaEventObject<DragEvent>) => {
    const newPositions = labelPositions.map(pos =>
      pos.id === id
        ? { ...pos, x: e.target.x(), y: e.target.y() }
        : pos
    );
    setLabelPositions(newPositions);
  };

  // Handle label selection
  const handleSelect = (id: string) => {
    setSelectedId(id === selectedId ? null : id);
  };

  // Handle rotation
  const handleRotate = (id: string, rotation: number) => {
    const newPositions = labelPositions.map(pos =>
      pos.id === id
        ? { ...pos, rotation }
        : pos
    );
    setLabelPositions(newPositions);
  };

  // Handle QR code drag
  const handleQRDragEnd = (labelId: string, newPosition: { x: number; y: number }) => {
    const label = selectedLabels.find(l => l.id === labelId);
    if (!label || !label.qrCode) return;

    updateLabel(labelId, {
      qrCode: {
        ...label.qrCode,
        position: newPosition,
      },
    });
  };

  // Handle QR code resize
  const handleQRResize = (labelId: string, newSize: number) => {
    const label = selectedLabels.find(l => l.id === labelId);
    if (!label || !label.qrCode) return;

    updateLabel(labelId, {
      qrCode: {
        ...label.qrCode,
        size: newSize,
      },
    });
  };

  // Render grid
  const renderGrid = () => {
    if (!showGrid || !layout) return null;

    const gridLines = [];
    const gridSize = 10; // mm

    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      gridLines.push(
        <Rect
          key={`v-${x}`}
          x={x}
          y={0}
          width={1}
          height={height}
          fill="#e0e0e0"
          listening={false}
        />
      );
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      gridLines.push(
        <Rect
          key={`h-${y}`}
          x={0}
          y={y}
          width={width}
          height={1}
          fill="#e0e0e0"
          listening={false}
        />
      );
    }

    return gridLines;
  };

  // Render QR codes
  const renderQRCodes = () => {
    return selectedLabels
      .filter(label => label.qrCode?.enabled && label.shopUrl)
      .map((label) => {
        const labelPos = labelPositions.find(p => p.id === label.id);
        if (!labelPos || !label.qrCode) return null;

        // Calculate absolute position (label position + QR offset)
        const absolutePosition = {
          x: labelPos.x + label.qrCode.position.x * 3.78, // Convert mm to pixels
          y: labelPos.y + label.qrCode.position.y * 3.78,
        };

        return (
          <QRCodeElement
            key={`qr-${label.id}`}
            url={label.shopUrl!}
            settings={{
              ...label.qrCode,
              position: absolutePosition,
            }}
            isSelected={selectedQrId === label.id}
            onSelect={() => setSelectedQrId(label.id === selectedQrId ? null : label.id)}
            onDragEnd={(newPos) => {
              // Convert back to relative position
              const relativePos = {
                x: (newPos.x - labelPos.x) / 3.78,
                y: (newPos.y - labelPos.y) / 3.78,
              };
              handleQRDragEnd(label.id, relativePos);
            }}
            onResize={(newSize) => handleQRResize(label.id, newSize)}
            scale={zoom}
          />
        );
      });
  };

  // Render labels
  const renderLabels = () => {
    return labelPositions.map((pos) => {
      const label = selectedLabels.find(l => l.id === pos.id);
      if (!label) return null;

      const isSelected = pos.id === selectedId;

      return (
        <Group
          key={pos.id}
          x={pos.x}
          y={pos.y}
          width={pos.width}
          height={pos.height}
          rotation={pos.rotation}
          draggable
          onDragEnd={handleDragEnd(pos.id)}
          onClick={() => handleSelect(pos.id)}
          onTap={() => handleSelect(pos.id)}
        >
          {/* Label background */}
          <Rect
            width={pos.width}
            height={pos.height}
            fill="white"
            stroke={isSelected ? '#3b82f6' : '#d1d5db'}
            strokeWidth={isSelected ? 3 : 1}
            shadowBlur={isSelected ? 10 : 5}
            shadowOpacity={0.3}
          />

          {/* Label content */}
          <Text
            text={label.productName}
            x={10}
            y={10}
            width={pos.width - 20}
            fontSize={16}
            fontFamily="Arial"
            fill="#000"
          />

          <Text
            text={`${label.priceInfo.price} ${label.priceInfo.currency}`}
            x={10}
            y={40}
            width={pos.width - 20}
            fontSize={24}
            fontFamily="Arial"
            fontStyle="bold"
            fill="#000"
          />

          {label.description && (
            <Text
              text={label.description}
              x={10}
              y={70}
              width={pos.width - 20}
              fontSize={12}
              fontFamily="Arial"
              fill="#666"
            />
          )}

          {/* Article number */}
          <Text
            text={`Art-Nr: ${label.articleNumber}`}
            x={10}
            y={pos.height - 25}
            width={pos.width - 20}
            fontSize={10}
            fontFamily="Arial"
            fill="#999"
          />
        </Group>
      );
    });
  };

  return (
    <div className="relative border border-gray-300 rounded-lg overflow-hidden bg-white">
      {/* Canvas controls info */}
      {selectedId && (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 z-10">
          <p className="text-sm font-medium text-gray-900 mb-2">Label Selected</p>
          <div className="space-y-2">
            <button
              onClick={() => handleRotate(selectedId, (labelPositions.find(p => p.id === selectedId)?.rotation || 0) + 90)}
              className="w-full px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Rotate 90°
            </button>
            <button
              onClick={() => setSelectedId(null)}
              className="w-full px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={zoom}
        scaleY={zoom}
      >
        {/* Grid layer */}
        <Layer>
          {renderGrid()}
        </Layer>

        {/* Labels layer */}
        <Layer>
          {renderLabels()}
        </Layer>

        {/* QR Codes layer */}
        <Layer>
          {renderQRCodes()}
        </Layer>

        {/* Cut marks layer */}
        {layout?.settings.showCutMarks && (
          <Layer>
            {/* Add cut marks implementation here */}
          </Layer>
        )}
      </Stage>
    </div>
  );
};
