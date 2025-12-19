/**
 * Live Preview Canvas with Konva.js
 * Provides interactive label preview with drag & drop
 *
 * Performance optimized with useCallback and useMemo
 */
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { usePrintStore } from '../../store/printStore';
import { useLabelStore } from '../../store/labelStore';
import { useUiStore } from '../../store/uiStore';
import { QRCodeElement } from './QRCodeElement';
import type { Label } from '../../types/label.types';

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

// Pixel to mm conversion factor
const PX_TO_MM = 3.78;

export const Canvas = ({ width = 800, height = 600, showGrid = true }: CanvasProps) => {
  const stageRef = useRef<any>(null);
  const { layout } = usePrintStore();
  const { labels, selectedLabels: selectedLabelIds, updateLabel } = useLabelStore();
  const { zoom, setZoom } = useUiStore();

  // Get actual label objects from IDs - memoized
  const selectedLabels = useMemo(
    () => labels.filter((label) => selectedLabelIds.includes(label.id)),
    [labels, selectedLabelIds]
  );

  const [labelPositions, setLabelPositions] = useState<LabelPosition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedQrId, setSelectedQrId] = useState<string | null>(null);

  // Initialize label positions based on grid layout
  useEffect(() => {
    if (!layout || !selectedLabels.length) return;

    const { columns, rows, spacing, margins } = layout.gridLayout;
    const { width: pageWidth, height: pageHeight } = layout.paperFormat;

    // Calculate label dimensions
    const availableWidth = pageWidth - margins.left - margins.right - spacing * (columns - 1);
    const availableHeight = pageHeight - margins.top - margins.bottom - spacing * (rows - 1);

    const labelWidth = availableWidth / columns;
    const labelHeight = availableHeight / rows;

    const positions: LabelPosition[] = selectedLabels.map((label, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);

      return {
        id: label.id,
        x: margins.left + col * (labelWidth + spacing),
        y: margins.top + row * (labelHeight + spacing),
        width: labelWidth,
        height: labelHeight,
        rotation: 0,
      };
    });

    setLabelPositions(positions);
  }, [layout, selectedLabels]);

  // Handle label drag - memoized with useCallback
  const handleDragEnd = useCallback((id: string, e: KonvaEventObject<DragEvent>) => {
    setLabelPositions((prev) =>
      prev.map((pos) => (pos.id === id ? { ...pos, x: e.target.x(), y: e.target.y() } : pos))
    );
  }, []);

  // Handle label selection - memoized
  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (id === prev ? null : id));
  }, []);

  // Handle rotation - memoized
  const handleRotate = useCallback((id: string, rotation: number) => {
    setLabelPositions((prev) => prev.map((pos) => (pos.id === id ? { ...pos, rotation } : pos)));
  }, []);

  // Handle QR code drag - memoized
  const handleQRDragEnd = useCallback(
    (labelId: string, newPosition: { x: number; y: number }) => {
      const label = selectedLabels.find((l) => l.id === labelId);
      if (!label || !label.qrCode) return;

      updateLabel(labelId, {
        qrCode: {
          ...label.qrCode,
          position: newPosition,
        },
      });
    },
    [selectedLabels, updateLabel]
  );

  // Handle QR code resize - memoized
  const handleQRResize = useCallback(
    (labelId: string, newSize: number) => {
      const label = selectedLabels.find((l) => l.id === labelId);
      if (!label || !label.qrCode) return;

      updateLabel(labelId, {
        qrCode: {
          ...label.qrCode,
          size: newSize,
        },
      });
    },
    [selectedLabels, updateLabel]
  );

  // Handle QR selection - memoized
  const handleQRSelect = useCallback((labelId: string) => {
    setSelectedQrId((prev) => (labelId === prev ? null : labelId));
  }, []);

  // Handle mouse wheel zoom - memoized
  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const scaleBy = 1.1;
      const oldScale = zoom;
      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

      // Clamp zoom between 0.25 and 5
      const clampedScale = Math.max(0.25, Math.min(5, newScale));
      setZoom(clampedScale);
    },
    [zoom, setZoom]
  );

  // Handle rotate button click - memoized
  const handleRotateClick = useCallback(() => {
    if (!selectedId) return;
    const currentPos = labelPositions.find((p) => p.id === selectedId);
    if (currentPos) {
      handleRotate(selectedId, (currentPos.rotation || 0) + 90);
    }
  }, [selectedId, labelPositions, handleRotate]);

  // Handle deselect click - memoized
  const handleDeselectClick = useCallback(() => {
    setSelectedId(null);
  }, []);

  // Render grid - memoized
  const gridElements = useMemo(() => {
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
  }, [showGrid, layout, width, height]);

  // Render labels - memoized
  const labelElements = useMemo(() => {
    return labelPositions.map((pos) => {
      const label = selectedLabels.find((l) => l.id === pos.id);
      if (!label) return null;

      return (
        <LabelGroup
          key={pos.id}
          pos={pos}
          label={label}
          isSelected={pos.id === selectedId}
          onDragEnd={handleDragEnd}
          onSelect={handleSelect}
        />
      );
    });
  }, [labelPositions, selectedLabels, selectedId, handleDragEnd, handleSelect]);

  // Render QR codes - memoized
  const qrElements = useMemo(() => {
    return selectedLabels
      .filter((label) => label.qrCode?.enabled && label.shopUrl)
      .map((label) => {
        const labelPos = labelPositions.find((p) => p.id === label.id);
        if (!labelPos || !label.qrCode) return null;

        // Calculate absolute position (label position + QR offset)
        const absolutePosition = {
          x: labelPos.x + label.qrCode.position.x * PX_TO_MM,
          y: labelPos.y + label.qrCode.position.y * PX_TO_MM,
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
            onSelect={() => handleQRSelect(label.id)}
            onDragEnd={(newPos) => {
              // Convert back to relative position
              const relativePos = {
                x: (newPos.x - labelPos.x) / PX_TO_MM,
                y: (newPos.y - labelPos.y) / PX_TO_MM,
              };
              handleQRDragEnd(label.id, relativePos);
            }}
            onResize={(newSize) => handleQRResize(label.id, newSize)}
            scale={zoom}
          />
        );
      });
  }, [
    selectedLabels,
    labelPositions,
    selectedQrId,
    zoom,
    handleQRSelect,
    handleQRDragEnd,
    handleQRResize,
  ]);

  return (
    <div className="relative border border-gray-300 rounded-lg overflow-hidden bg-white">
      {/* Canvas controls info */}
      {selectedId && (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 z-10">
          <p className="text-sm font-medium text-gray-900 mb-2">Label Selected</p>
          <div className="space-y-2">
            <button
              onClick={handleRotateClick}
              className="w-full px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Rotate 90°
            </button>
            <button
              onClick={handleDeselectClick}
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
        onWheel={handleWheel}
      >
        {/* Grid layer */}
        <Layer>{gridElements}</Layer>

        {/* Labels layer */}
        <Layer>{labelElements}</Layer>

        {/* QR Codes layer */}
        <Layer>{qrElements}</Layer>

        {/* Cut marks layer */}
        {layout?.settings.showCutMarks && <Layer>{/* Add cut marks implementation here */}</Layer>}
      </Stage>
    </div>
  );
};

/**
 * Memoized Label Group Component
 * Extracted to prevent re-renders of all labels when one changes
 */
interface LabelGroupProps {
  pos: LabelPosition;
  label: Label;
  isSelected: boolean;
  onDragEnd: (id: string, e: KonvaEventObject<DragEvent>) => void;
  onSelect: (id: string) => void;
}

const LabelGroup = ({ pos, label, isSelected, onDragEnd, onSelect }: LabelGroupProps) => {
  // Memoize handlers for this specific label
  const handleDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => onDragEnd(pos.id, e),
    [pos.id, onDragEnd]
  );

  const handleClick = useCallback(() => onSelect(pos.id), [pos.id, onSelect]);

  return (
    <Group
      x={pos.x}
      y={pos.y}
      width={pos.width}
      height={pos.height}
      rotation={pos.rotation}
      draggable
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
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
};
