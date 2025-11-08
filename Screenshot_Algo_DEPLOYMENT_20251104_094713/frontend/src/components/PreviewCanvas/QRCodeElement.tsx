/**
 * QR Code Element Component for Canvas
 * Renders a draggable/resizable QR code on the Konva canvas
 */
import { useEffect, useRef, useState } from 'react';
import { Group, Image as KonvaImage, Rect, Circle } from 'react-konva';
import type { QRCodeSettings } from '../../store/labelStore';

interface QRCodeElementProps {
  url: string;
  settings: QRCodeSettings;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (newPosition: { x: number; y: number }) => void;
  onResize: (newSize: number) => void;
  scale?: number;
}

export const QRCodeElement = ({
  url,
  settings,
  isSelected,
  onSelect,
  onDragEnd,
  onResize,
  scale = 1,
}: QRCodeElementProps) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const groupRef = useRef<any>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Convert QR code to image
  useEffect(() => {
    // Create a temporary container for the QR code
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    // Create a temporary canvas element
    const tempCanvas = document.createElement('canvas');
    container.appendChild(tempCanvas);

    // Render QR code using qrcode library
    import('qrcode').then((QRCode) => {
      const qrSize = Math.round(settings.size * 3.78); // Convert mm to pixels (96 DPI)

      QRCode.default.toCanvas(
        tempCanvas,
        url,
        {
          width: qrSize,
          margin: 1,
          errorCorrectionLevel: settings.errorCorrectionLevel,
        },
        (error) => {
          if (error) {
            console.error('QR Code generation error:', error);
            return;
          }

          // Convert canvas to image
          const img = new window.Image();
          img.src = tempCanvas.toDataURL();
          img.onload = () => {
            setImage(img);
            qrCanvasRef.current = tempCanvas;
          };
        }
      );
    });

    return () => {
      document.body.removeChild(container);
    };
  }, [url, settings.size, settings.errorCorrectionLevel]);

  const handleDragEnd = (e: any) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale
    node.scaleX(1);
    node.scaleY(1);

    onDragEnd({
      x: node.x() / scale,
      y: node.y() / scale,
    });

    // If scale changed, update size
    if (scaleX !== 1 || scaleY !== 1) {
      const newSize = settings.size * Math.max(scaleX, scaleY);
      onResize(newSize);
    }
  };

  const handleTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Keep aspect ratio
    const uniformScale = Math.max(scaleX, scaleY);

    // Reset scale
    node.scaleX(1);
    node.scaleY(1);

    // Update size
    const newSize = settings.size * uniformScale;
    onResize(newSize);
  };

  if (!image) return null;

  const sizeInPixels = settings.size * 3.78 * scale; // Convert mm to pixels with scale

  return (
    <Group
      ref={groupRef}
      x={settings.position.x * scale}
      y={settings.position.y * scale}
      draggable
      onDragEnd={handleDragEnd}
      onClick={onSelect}
      onTap={onSelect}
      onTransformEnd={handleTransformEnd}
    >
      {/* QR Code Image */}
      <KonvaImage
        image={image}
        width={sizeInPixels}
        height={sizeInPixels}
      />

      {/* Selection Border */}
      {isSelected && (
        <>
          <Rect
            width={sizeInPixels}
            height={sizeInPixels}
            stroke="#3b82f6"
            strokeWidth={2 / scale}
            dash={[10 / scale, 5 / scale]}
          />

          {/* Resize Handles */}
          <Circle
            x={sizeInPixels}
            y={sizeInPixels}
            radius={6 / scale}
            fill="#3b82f6"
            stroke="white"
            strokeWidth={2 / scale}
            draggable
            onDragMove={(e) => {
              const node = e.target;

              // Calculate new size based on handle position
              const newSize = Math.max(10, node.x() / scale / 3.78);
              onResize(newSize);

              // Reset handle position
              node.x(newSize * 3.78 * scale);
              node.y(newSize * 3.78 * scale);
            }}
          />
        </>
      )}
    </Group>
  );
};
