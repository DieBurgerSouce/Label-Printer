/**
 * Zoom Controls for Canvas
 */
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';

export const ZoomControls = () => {
  const { zoom, setZoom } = useUiStore();

  const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5];
  const currentIndex = zoomLevels.findIndex(z => z === zoom);

  const handleZoomIn = () => {
    const nextIndex = Math.min(currentIndex + 1, zoomLevels.length - 1);
    setZoom(zoomLevels[nextIndex]);
  };

  const handleZoomOut = () => {
    const prevIndex = Math.max(currentIndex - 1, 0);
    setZoom(zoomLevels[prevIndex]);
  };

  const handleFitToScreen = () => {
    setZoom(1);
  };

  return (
    <div className="flex items-center gap-2 bg-white rounded-lg shadow-md p-2 border border-gray-200">
      {/* Zoom Out */}
      <button
        onClick={handleZoomOut}
        disabled={currentIndex === 0}
        className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Zoom Out"
      >
        <ZoomOut className="w-5 h-5 text-gray-700" />
      </button>

      {/* Zoom Level Display */}
      <div className="px-3 py-1 bg-gray-50 rounded border border-gray-200 min-w-[80px] text-center">
        <span className="text-sm font-medium text-gray-900">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Zoom In */}
      <button
        onClick={handleZoomIn}
        disabled={currentIndex === zoomLevels.length - 1}
        className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Zoom In"
      >
        <ZoomIn className="w-5 h-5 text-gray-700" />
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-300" />

      {/* Fit to Screen */}
      <button
        onClick={handleFitToScreen}
        className="p-2 rounded hover:bg-gray-100"
        title="Fit to Screen (100%)"
      >
        <Maximize2 className="w-5 h-5 text-gray-700" />
      </button>
    </div>
  );
};
