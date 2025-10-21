/**
 * QR Code Settings Component
 * Configure QR code for product labels
 */
import { useState, useEffect } from 'react';
import { QrCode, Settings2 } from 'lucide-react';
import type { QRCodeSettings as QRCodeSettingsType } from '../../store/labelStore';

interface QRCodeSettingsProps {
  shopUrl?: string;
  qrCode?: QRCodeSettingsType;
  onUpdate: (updates: { shopUrl?: string; qrCode?: QRCodeSettingsType }) => void;
}

const DEFAULT_QR_SETTINGS: QRCodeSettingsType = {
  enabled: false,
  position: { x: 5, y: 5 }, // Top-left corner, 5mm offset
  size: 20, // 20mm default size
  errorCorrectionLevel: 'M', // Medium error correction
};

export const QRCodeSettings = ({ shopUrl, qrCode, onUpdate }: QRCodeSettingsProps) => {
  const [localShopUrl, setLocalShopUrl] = useState(shopUrl || '');
  const [settings, setSettings] = useState<QRCodeSettingsType>(
    qrCode || DEFAULT_QR_SETTINGS
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setLocalShopUrl(shopUrl || '');
    setSettings(qrCode || DEFAULT_QR_SETTINGS);
  }, [shopUrl, qrCode]);

  const handleUrlChange = (url: string) => {
    setLocalShopUrl(url);
    onUpdate({ shopUrl: url });
  };

  const handleToggle = (enabled: boolean) => {
    const newSettings = { ...settings, enabled };
    setSettings(newSettings);
    onUpdate({ qrCode: newSettings });
  };

  const handleSizeChange = (size: number) => {
    const newSettings = { ...settings, size };
    setSettings(newSettings);
    onUpdate({ qrCode: newSettings });
  };

  const handleErrorLevelChange = (level: 'L' | 'M' | 'Q' | 'H') => {
    const newSettings = { ...settings, errorCorrectionLevel: level };
    setSettings(newSettings);
    onUpdate({ qrCode: newSettings });
  };

  const handlePositionChange = (position: { x: number; y: number }) => {
    const newSettings = { ...settings, position };
    setSettings(newSettings);
    onUpdate({ qrCode: newSettings });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">QR Code</h3>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-gray-600">Enable</span>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
        </label>
      </div>

      {settings.enabled && (
        <>
          {/* Shop URL Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Shop URL
            </label>
            <input
              type="url"
              value={localShopUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://shop.example.com/product/123"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Customers can scan this QR code to visit the product page
            </p>
          </div>

          {/* QR Code Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Size: {settings.size}mm
            </label>
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={settings.size}
              onChange={(e) => handleSizeChange(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>10mm</span>
              <span>50mm</span>
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <Settings2 className="w-4 h-4" />
            {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
          </button>

          {showAdvanced && (
            <div className="space-y-4 pl-4 border-l-2 border-gray-200">
              {/* Error Correction Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Error Correction Level
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['L', 'M', 'Q', 'H'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => handleErrorLevelChange(level)}
                      className={`px-3 py-2 text-sm rounded-lg border ${
                        settings.errorCorrectionLevel === level
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {settings.errorCorrectionLevel === 'L' && 'Low (~7% recovery)'}
                  {settings.errorCorrectionLevel === 'M' && 'Medium (~15% recovery)'}
                  {settings.errorCorrectionLevel === 'Q' && 'Quality (~25% recovery)'}
                  {settings.errorCorrectionLevel === 'H' && 'High (~30% recovery)'}
                </p>
              </div>

              {/* Initial Position */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Position (adjustable on canvas)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">X (mm)</label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={settings.position.x}
                      onChange={(e) =>
                        handlePositionChange({
                          ...settings.position,
                          x: Number(e.target.value),
                        })
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Y (mm)</label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={settings.position.y}
                      onChange={(e) =>
                        handlePositionChange({
                          ...settings.position,
                          y: Number(e.target.value),
                        })
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Position Presets */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Position
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handlePositionChange({ x: 5, y: 5 })}
                    className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Top Left
                  </button>
                  <button
                    onClick={() => handlePositionChange({ x: 45, y: 5 })}
                    className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Top Right
                  </button>
                  <button
                    onClick={() => handlePositionChange({ x: 5, y: 45 })}
                    className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Bottom Left
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Position can be fine-tuned by dragging on the canvas
                </p>
              </div>
            </div>
          )}

          {/* Preview Info */}
          {localShopUrl && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>Preview:</strong> QR code will link to:<br />
                <span className="break-all">{localShopUrl}</span>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
