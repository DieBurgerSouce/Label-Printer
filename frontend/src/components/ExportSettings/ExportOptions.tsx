/**
 * Advanced Export Options Component
 * Provides detailed export settings for PDF/PNG generation
 */
import { useState } from 'react';
import { Download, FileDown, Image as ImageIcon, Settings } from 'lucide-react';

export interface ExportConfig {
  format: 'pdf' | 'png' | 'jpeg';
  dpi: number;
  quality: number; // 1-100
  colorProfile: 'RGB' | 'CMYK';
  showCutMarks: boolean;
  bleed: number; // mm
  compression: boolean;
  embedFonts: boolean;
}

interface ExportOptionsProps {
  onExport: (config: ExportConfig) => void;
  isExporting?: boolean;
}

const dpiOptions = [
  { value: 72, label: '72 DPI (Screen)', description: 'For digital viewing' },
  { value: 150, label: '150 DPI (Draft)', description: 'Quick proofs' },
  { value: 300, label: '300 DPI (Print)', description: 'Standard printing' },
  { value: 600, label: '600 DPI (High Quality)', description: 'Professional printing' },
];

export const ExportOptions = ({ onExport, isExporting = false }: ExportOptionsProps) => {
  const [config, setConfig] = useState<ExportConfig>({
    format: 'pdf',
    dpi: 300,
    quality: 95,
    colorProfile: 'RGB',
    showCutMarks: true,
    bleed: 3,
    compression: true,
    embedFonts: true,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateConfig = (updates: Partial<ExportConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const handleExport = () => {
    onExport(config);
  };

  const getEstimatedSize = () => {
    const baseSize = config.format === 'pdf' ? 500 : 2000; // KB
    const dpiMultiplier = config.dpi / 300;
    const qualityMultiplier = config.quality / 100;
    const compressionDivisor = config.compression ? 2 : 1;

    const estimated = (baseSize * dpiMultiplier * qualityMultiplier) / compressionDivisor;
    return `~${Math.round(estimated)} KB`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Export Options</h3>
        <p className="text-sm text-gray-600">Configure export settings for optimal quality</p>
      </div>

      {/* Format Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Export Format
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => updateConfig({ format: 'pdf' })}
            className={`p-3 rounded-lg border-2 transition-colors ${
              config.format === 'pdf'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <FileDown className="w-5 h-5 mx-auto mb-1" />
            <span className="text-xs font-medium">PDF</span>
          </button>
          <button
            onClick={() => updateConfig({ format: 'png' })}
            className={`p-3 rounded-lg border-2 transition-colors ${
              config.format === 'png'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <ImageIcon className="w-5 h-5 mx-auto mb-1" />
            <span className="text-xs font-medium">PNG</span>
          </button>
          <button
            onClick={() => updateConfig({ format: 'jpeg' })}
            className={`p-3 rounded-lg border-2 transition-colors ${
              config.format === 'jpeg'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <ImageIcon className="w-5 h-5 mx-auto mb-1" />
            <span className="text-xs font-medium">JPEG</span>
          </button>
        </div>
      </div>

      {/* DPI Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Resolution (DPI)
        </label>
        <div className="space-y-2">
          {dpiOptions.map(option => (
            <label
              key={option.value}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                config.dpi === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="dpi"
                value={option.value}
                checked={config.dpi === option.value}
                onChange={() => updateConfig({ dpi: option.value })}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 text-sm">{option.label}</div>
                <div className="text-xs text-gray-600">{option.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Quality Slider (for PNG/JPEG) */}
      {(config.format === 'png' || config.format === 'jpeg') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quality: {config.quality}%
          </label>
          <input
            type="range"
            min="50"
            max="100"
            value={config.quality}
            onChange={(e) => updateConfig({ quality: parseInt(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Smaller file</span>
            <span>Better quality</span>
          </div>
        </div>
      )}

      {/* Advanced Options Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
      >
        <Settings className="w-4 h-4" />
        {showAdvanced ? 'Hide' : 'Show'} Advanced Options
      </button>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          {/* Color Profile */}
          {config.format === 'pdf' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color Profile
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => updateConfig({ colorProfile: 'RGB' })}
                  className={`p-2 rounded border-2 text-sm ${
                    config.colorProfile === 'RGB'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  RGB (Digital)
                </button>
                <button
                  onClick={() => updateConfig({ colorProfile: 'CMYK' })}
                  className={`p-2 rounded border-2 text-sm ${
                    config.colorProfile === 'CMYK'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  CMYK (Print)
                </button>
              </div>
            </div>
          )}

          {/* Cut Marks */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.showCutMarks}
              onChange={(e) => updateConfig({ showCutMarks: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Show cut marks</span>
          </label>

          {/* Bleed */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bleed: {config.bleed} mm
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={config.bleed}
              onChange={(e) => updateConfig({ bleed: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* PDF Options */}
          {config.format === 'pdf' && (
            <>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.compression}
                  onChange={(e) => updateConfig({ compression: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Enable compression</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.embedFonts}
                  onChange={(e) => updateConfig({ embedFonts: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Embed fonts</span>
              </label>
            </>
          )}
        </div>
      )}

      {/* Export Info */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2 text-sm">
          <div className="flex-1">
            <p className="font-medium text-blue-900">Estimated file size</p>
            <p className="text-blue-700">{getEstimatedSize()}</p>
          </div>
          <div className="text-right text-xs text-blue-600">
            {config.dpi} DPI · {config.format.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
      >
        {isExporting ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            Export {config.format.toUpperCase()}
          </>
        )}
      </button>
    </div>
  );
};
