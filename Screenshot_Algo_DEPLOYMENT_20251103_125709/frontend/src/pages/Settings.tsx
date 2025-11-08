import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  Printer,
  Info,
  Save,
  RotateCcw,
} from 'lucide-react';
import { useUiStore } from '../store/uiStore';

type SettingsTab = 'general' | 'storage' | 'print' | 'about';

export default function Settings() {
  const { showToast } = useUiStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // General Settings
  const [appName, setAppName] = useState('Label Printer WebApp');
  const [language, setLanguage] = useState('en');
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light');
  const [autoSave, setAutoSave] = useState(true);

  // Storage Settings
  const [storagePath, setStoragePath] = useState('/data/labels');
  const [cachePath, setCachePath] = useState('/data/cache');
  const [maxFileSize, setMaxFileSize] = useState(50);
  const [autoCleanup, setAutoCleanup] = useState(true);
  const [cleanupDays, setCleanupDays] = useState(30);

  // Print Settings
  const [defaultDpi, setDefaultDpi] = useState(300);
  const [defaultFormat, setDefaultFormat] = useState<'A4' | 'A3' | 'Letter'>('A4');
  const [showCutMarks, setShowCutMarks] = useState(true);
  const [maxLabelsPerPage, setMaxLabelsPerPage] = useState(50);
  const [enableBatchProcessing, setEnableBatchProcessing] = useState(true);

  const handleSaveSettings = () => {
    // TODO: Save settings to backend/localStorage
    showToast({
      type: 'success',
      message: 'Settings saved successfully',
    });
  };

  const handleResetSettings = () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) return;

    // Reset to defaults
    setAppName('Label Printer WebApp');
    setLanguage('en');
    setTheme('light');
    setAutoSave(true);
    setStoragePath('/data/labels');
    setCachePath('/data/cache');
    setMaxFileSize(50);
    setAutoCleanup(true);
    setCleanupDays(30);
    setDefaultDpi(300);
    setDefaultFormat('A4');
    setShowCutMarks(true);
    setMaxLabelsPerPage(50);
    setEnableBatchProcessing(true);

    showToast({
      type: 'info',
      message: 'Settings reset to defaults',
    });
  };

  const tabs = [
    { id: 'general' as const, name: 'General', icon: SettingsIcon },
    { id: 'storage' as const, name: 'Storage', icon: Database },
    { id: 'print' as const, name: 'Print', icon: Printer },
    { id: 'about' as const, name: 'About', icon: Info },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Configure your application preferences</p>
        </div>

        <div className="flex gap-3">
          <button onClick={handleResetSettings} className="btn-secondary flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Reset to Defaults
          </button>
          <button onClick={handleSaveSettings} className="btn-primary flex items-center gap-2">
            <Save className="w-5 h-5" />
            Save Settings
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* General Settings */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Application Name
                  </label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="input w-full"
                    placeholder="Label Printer WebApp"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="input w-full"
                  >
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                    <option value="fr">Français</option>
                    <option value="es">Español</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Theme
                  </label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'auto')}
                    className="input w-full"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">Auto (System)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Choose how the app should look
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoSave"
                    checked={autoSave}
                    onChange={(e) => setAutoSave(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <label htmlFor="autoSave" className="text-sm text-gray-700">
                    Enable auto-save
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Storage Settings */}
        {activeTab === 'storage' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Storage Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Storage Path
                  </label>
                  <input
                    type="text"
                    value={storagePath}
                    onChange={(e) => setStoragePath(e.target.value)}
                    className="input w-full"
                    placeholder="/data/labels"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Directory where labels and images are stored
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cache Path
                  </label>
                  <input
                    type="text"
                    value={cachePath}
                    onChange={(e) => setCachePath(e.target.value)}
                    className="input w-full"
                    placeholder="/data/cache"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Directory for temporary and cached files
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Maximum File Size (MB)
                  </label>
                  <input
                    type="number"
                    value={maxFileSize}
                    onChange={(e) => setMaxFileSize(Number(e.target.value))}
                    className="input w-full"
                    min="1"
                    max="500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum size for uploaded files
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoCleanup"
                    checked={autoCleanup}
                    onChange={(e) => setAutoCleanup(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <label htmlFor="autoCleanup" className="text-sm text-gray-700">
                    Enable automatic cleanup
                  </label>
                </div>

                {autoCleanup && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cleanup After (days)
                    </label>
                    <input
                      type="number"
                      value={cleanupDays}
                      onChange={(e) => setCleanupDays(Number(e.target.value))}
                      className="input w-full"
                      min="1"
                      max="365"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Delete cached files older than this many days
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Storage Stats */}
            <div className="card bg-blue-50 border-2 border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-3">Storage Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-blue-700">Total Labels</p>
                  <p className="text-2xl font-bold text-blue-900">0</p>
                </div>
                <div>
                  <p className="text-sm text-blue-700">Storage Used</p>
                  <p className="text-2xl font-bold text-blue-900">0 MB</p>
                </div>
                <div>
                  <p className="text-sm text-blue-700">Cache Size</p>
                  <p className="text-2xl font-bold text-blue-900">0 MB</p>
                </div>
                <div>
                  <p className="text-sm text-blue-700">Available Space</p>
                  <p className="text-2xl font-bold text-blue-900">∞</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Print Settings */}
        {activeTab === 'print' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Print Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default DPI
                  </label>
                  <select
                    value={defaultDpi}
                    onChange={(e) => setDefaultDpi(Number(e.target.value))}
                    className="input w-full"
                  >
                    <option value="72">72 DPI (Screen)</option>
                    <option value="150">150 DPI (Draft)</option>
                    <option value="300">300 DPI (Standard)</option>
                    <option value="600">600 DPI (High Quality)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Default resolution for print output
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Paper Format
                  </label>
                  <select
                    value={defaultFormat}
                    onChange={(e) => setDefaultFormat(e.target.value as 'A4' | 'A3' | 'Letter')}
                    className="input w-full"
                  >
                    <option value="A3">A3 (297 × 420 mm)</option>
                    <option value="A4">A4 (210 × 297 mm)</option>
                    <option value="A5">A5 (148 × 210 mm)</option>
                    <option value="Letter">Letter (8.5 × 11 in)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Maximum Labels per Page
                  </label>
                  <input
                    type="number"
                    value={maxLabelsPerPage}
                    onChange={(e) => setMaxLabelsPerPage(Number(e.target.value))}
                    className="input w-full"
                    min="1"
                    max="200"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum number of labels that can fit on one page
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="showCutMarks"
                    checked={showCutMarks}
                    onChange={(e) => setShowCutMarks(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <label htmlFor="showCutMarks" className="text-sm text-gray-700">
                    Show cut marks by default
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="enableBatchProcessing"
                    checked={enableBatchProcessing}
                    onChange={(e) => setEnableBatchProcessing(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <label htmlFor="enableBatchProcessing" className="text-sm text-gray-700">
                    Enable batch processing
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* About */}
        {activeTab === 'about' && (
          <div className="space-y-6">
            <div className="card">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-primary-600 rounded-full mx-auto flex items-center justify-center">
                  <Printer className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{appName}</h2>
                  <p className="text-gray-600 mt-1">Version 1.0.0</p>
                </div>
                <p className="text-gray-700 max-w-2xl mx-auto">
                  A flexible web application for creating and managing price labels with Excel
                  import, customizable templates, and configurable print layouts.
                </p>
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Features</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  Excel import for product descriptions
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  Screenshot extraction for price labels
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  Flexible print layouts (A3, A4, A5, Letter, Custom)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  Configurable grid layouts (1×1 to 10×20)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  Template system for label designs
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  Batch operations and multi-select
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  PDF/PNG export
                </li>
              </ul>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">System Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Frontend</p>
                  <p className="font-medium text-gray-900">React 19 + TypeScript</p>
                </div>
                <div>
                  <p className="text-gray-600">Styling</p>
                  <p className="font-medium text-gray-900">Tailwind CSS v4</p>
                </div>
                <div>
                  <p className="text-gray-600">State Management</p>
                  <p className="font-medium text-gray-900">Zustand</p>
                </div>
                <div>
                  <p className="text-gray-600">HTTP Client</p>
                  <p className="font-medium text-gray-900">Axios + React Query</p>
                </div>
                <div>
                  <p className="text-gray-600">Build Tool</p>
                  <p className="font-medium text-gray-900">Vite 7</p>
                </div>
                <div>
                  <p className="text-gray-600">Icons</p>
                  <p className="font-medium text-gray-900">Lucide React</p>
                </div>
              </div>
            </div>

            <div className="card bg-gray-50">
              <p className="text-sm text-gray-600 text-center">
                © 2025 Label Printer WebApp. All rights reserved.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
