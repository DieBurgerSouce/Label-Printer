import { Check } from 'lucide-react';

export type PaperFormat = 'A3' | 'A4' | 'A5' | 'Letter' | 'Custom';

interface FormatOption {
  id: PaperFormat;
  name: string;
  dimensions: string;
  width: number;
  height: number;
  popular?: boolean;
}

const formats: FormatOption[] = [
  { id: 'A4', name: 'A4', dimensions: '210 × 297 mm', width: 210, height: 297, popular: true },
  { id: 'A3', name: 'A3', dimensions: '297 × 420 mm', width: 297, height: 420 },
  { id: 'A5', name: 'A5', dimensions: '148 × 210 mm', width: 148, height: 210 },
  {
    id: 'Letter',
    name: 'Letter',
    dimensions: '8.5 × 11 in',
    width: 215.9,
    height: 279.4,
    popular: true,
  },
  { id: 'Custom', name: 'Custom', dimensions: 'Custom size', width: 0, height: 0 },
];

interface FormatSelectorProps {
  selectedFormat: PaperFormat;
  onFormatChange: (format: PaperFormat) => void;
  customWidth?: number;
  customHeight?: number;
  onCustomSizeChange?: (width: number, height: number) => void;
}

export default function FormatSelector({
  selectedFormat,
  onFormatChange,
  customWidth,
  customHeight,
  onCustomSizeChange,
}: FormatSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Paper Format</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {formats.map((format) => (
            <button
              key={format.id}
              onClick={() => onFormatChange(format.id)}
              className={`relative p-4 border-2 rounded-lg text-left transition-all ${
                selectedFormat === format.id
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-300 hover:border-gray-400 bg-white'
              }`}
            >
              {selectedFormat === format.id && (
                <div className="absolute top-2 right-2">
                  <Check className="w-5 h-5 text-primary-600" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-semibold text-gray-900 flex items-center gap-2">
                  {format.name}
                  {format.popular && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                      Popular
                    </span>
                  )}
                </span>
                <span className="text-sm text-gray-600 mt-1">{format.dimensions}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Size Inputs */}
      {selectedFormat === 'Custom' && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-300">
          <h4 className="font-medium text-gray-900 mb-3">Custom Dimensions</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Width (mm)</label>
              <input
                type="number"
                value={customWidth || ''}
                onChange={(e) => onCustomSizeChange?.(Number(e.target.value), customHeight || 0)}
                className="input w-full"
                placeholder="210"
                min="50"
                max="1000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Height (mm)</label>
              <input
                type="number"
                value={customHeight || ''}
                onChange={(e) => onCustomSizeChange?.(customWidth || 0, Number(e.target.value))}
                className="input w-full"
                placeholder="297"
                min="50"
                max="1000"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
