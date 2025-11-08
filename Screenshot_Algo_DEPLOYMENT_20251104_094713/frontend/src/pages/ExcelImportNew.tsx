/**
 * Excel Import with Dynamic Mapping
 * Multi-step wizard for importing Excel data with configurable field mappings
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { articlesApi, type ExcelPreviewData, type MatchColumnConfig, type FieldMapping, type ExcelImportConfig, type ExcelImportResult } from '../services/api';
import { useUiStore } from '../store/uiStore';

type Step = 1 | 2 | 3 | 4;

interface ValidField {
  field: string;
  description: string;
  type: string;
}

export default function ExcelImportNew() {
  const navigate = useNavigate();
  const { showToast } = useUiStore();

  // State
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ExcelPreviewData | null>(null);
  const [matchColumn, setMatchColumn] = useState<MatchColumnConfig>({
    type: 'auto',
    value: ''
  });
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [validFields, setValidFields] = useState<ValidField[]>([]);
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Load valid fields on mount
  useEffect(() => {
    articlesApi.getValidExcelFields().then(response => {
      if (response.data) {
        setValidFields(response.data);
      }
    }).catch(error => {
      console.error('Failed to load valid fields:', error);
    });
  }, []);

  // ========================================
  // STEP 1: FILE UPLOAD & PREVIEW
  // ========================================

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      showToast({
        type: 'error',
        message: 'Bitte wähle eine Excel-Datei (.xlsx oder .xls)'
      });
      return;
    }

    setFile(selectedFile);
    setIsUploading(true);

    try {
      const response = await articlesApi.excelPreview(selectedFile);
      if (response.success && response.data) {
        setPreviewData(response.data);
        setCurrentStep(2);

        // Try auto-detection for match column
        const articleNumberPatterns = ['artikelnummer', 'article number', 'art-nr', 'sku'];
        const autoDetected = response.data.headers.findIndex(h =>
          articleNumberPatterns.some(pattern => h.toLowerCase().includes(pattern))
        );

        if (autoDetected !== -1) {
          setMatchColumn({
            type: 'auto',
            value: response.data.headers[autoDetected]
          });
        }

        showToast({
          type: 'success',
          message: 'Excel-Datei erfolgreich geladen!'
        });
      }
    } catch (error: any) {
      showToast({
        type: 'error',
        message: error.response?.data?.error || 'Fehler beim Laden der Datei'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  // ========================================
  // STEP 2: MATCH COLUMN CONFIGURATION
  // ========================================

  const handleMatchColumnChange = (type: 'index' | 'header' | 'auto', value: string) => {
    setMatchColumn({ type, value });
  };

  const proceedToStep3 = () => {
    if (!matchColumn.value && matchColumn.type !== 'auto') {
      showToast({
        type: 'error',
        message: 'Bitte wähle eine Spalte für die Artikelnummer'
      });
      return;
    }

    // Initialize default mappings based on common field names
    const defaultMappings: FieldMapping[] = [];

    if (previewData) {
      previewData.headers.forEach((header, index) => {
        const lowerHeader = header.toLowerCase();
        const columnLetter = previewData.columnIndices[index];

        // Skip match column
        if (matchColumn.type === 'header' && header === matchColumn.value) return;
        if (matchColumn.type === 'index' && columnLetter === matchColumn.value) return;

        // Map common fields
        if (lowerHeader.includes('beschreibung') || lowerHeader.includes('description')) {
          defaultMappings.push({ excelColumn: columnLetter, dbField: 'description', type: 'index' });
        } else if (lowerHeader.includes('preis') || lowerHeader.includes('price')) {
          defaultMappings.push({ excelColumn: columnLetter, dbField: 'price', type: 'index' });
        } else if (lowerHeader.includes('kategorie') || lowerHeader.includes('category')) {
          defaultMappings.push({ excelColumn: columnLetter, dbField: 'category', type: 'index' });
        } else if (lowerHeader.includes('hersteller') || lowerHeader.includes('manufacturer')) {
          defaultMappings.push({ excelColumn: columnLetter, dbField: 'manufacturer', type: 'index' });
        } else if (lowerHeader.includes('produktname') || lowerHeader.includes('product name')) {
          defaultMappings.push({ excelColumn: columnLetter, dbField: 'productName', type: 'index' });
        }
      });
    }

    setFieldMappings(defaultMappings);
    setCurrentStep(3);
  };

  // ========================================
  // STEP 3: FIELD MAPPINGS
  // ========================================

  const addFieldMapping = () => {
    setFieldMappings([...fieldMappings, { excelColumn: '', dbField: '', type: 'index' }]);
  };

  const updateFieldMapping = (index: number, field: keyof FieldMapping, value: string) => {
    const updated = [...fieldMappings];
    updated[index] = { ...updated[index], [field]: value };
    setFieldMappings(updated);
  };

  const removeFieldMapping = (index: number) => {
    setFieldMappings(fieldMappings.filter((_, i) => i !== index));
  };

  const proceedToStep4 = () => {
    if (fieldMappings.length === 0) {
      showToast({
        type: 'error',
        message: 'Bitte wähle mindestens ein Feld zum Überschreiben aus'
      });
      return;
    }

    // Validate all mappings have both columns and fields selected
    const invalid = fieldMappings.some(m => !m.excelColumn || !m.dbField);
    if (invalid) {
      showToast({
        type: 'error',
        message: 'Bitte fülle alle Feld-Mappings aus oder entferne unvollständige'
      });
      return;
    }

    setCurrentStep(4);
  };

  // ========================================
  // STEP 4: IMPORT EXECUTION
  // ========================================

  const executeImport = async () => {
    if (!file) return;

    setIsImporting(true);

    try {
      const config: ExcelImportConfig = {
        matchColumn,
        fieldMappings,
        startRow: 2 // Skip header row
      };

      const response = await articlesApi.excelImport(file, config);

      if (response.success && response.data) {
        setImportResult(response.data);
        showToast({
          type: 'success',
          message: `Import erfolgreich! ${response.data.updatedArticles} Artikel aktualisiert.`
        });
      }
    } catch (error: any) {
      showToast({
        type: 'error',
        message: error.response?.data?.error || 'Fehler beim Import'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setFile(null);
    setPreviewData(null);
    setMatchColumn({ type: 'auto', value: '' });
    setFieldMappings([]);
    setImportResult(null);
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Excel-Import (Dynamisch)</h1>
          <p className="text-gray-600 mt-1">
            Importiere Excel-Daten mit konfigurierbarem Feld-Mapping
          </p>
        </div>
        <button
          onClick={() => navigate('/articles')}
          className="px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          Zurück zur Artikelliste
        </button>
      </div>

      {/* Step Indicator */}
      <div className="card">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                  currentStep >= step
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {currentStep > step ? <CheckCircle2 className="w-6 h-6" /> : step}
              </div>
              <div className="ml-3 flex-1">
                <p className={`text-sm font-medium ${
                  currentStep >= step ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step === 1 && 'Excel hochladen'}
                  {step === 2 && 'Artikelnummer-Spalte'}
                  {step === 3 && 'Felder zuordnen'}
                  {step === 4 && 'Import starten'}
                </p>
              </div>
              {step < 4 && (
                <ArrowRight className={`w-5 h-5 mx-2 ${
                  currentStep > step ? 'text-blue-600' : 'text-gray-400'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: File Upload & Preview */}
      {currentStep === 1 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Schritt 1: Excel-Datei hochladen</h2>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
            onClick={() => document.getElementById('file-input')?.click()}
          >
            {isUploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-600">Excel wird geladen...</p>
              </div>
            ) : (
              <>
                <FileSpreadsheet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Datei hier ablegen oder klicken zum Auswählen
                </p>
                <p className="text-sm text-gray-500">
                  Unterstützte Formate: .xlsx, .xls (max. 10MB)
                </p>
              </>
            )}
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Step 2: Match Column Configuration */}
      {currentStep === 2 && previewData && (
        <div className="card space-y-6">
          <h2 className="text-xl font-semibold">Schritt 2: Artikelnummer-Spalte auswählen</h2>

          <p className="text-gray-600">
            Diese Spalte wird verwendet, um Artikel in der Datenbank zu finden und zu aktualisieren.
          </p>

          {/* Preview Table */}
          <div className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
            <p className="text-sm font-medium text-gray-700 mb-2">Vorschau (erste 5 Zeilen):</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-200">
                  {previewData.columnIndices.map((col, i) => (
                    <th key={i} className="border border-gray-300 px-2 py-1 text-left">
                      <div className="font-mono font-bold">{col}</div>
                      <div className="text-xs text-gray-600">{previewData.headers[i]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.rows.slice(0, 5).map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-100">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="border border-gray-300 px-2 py-1">
                        {String(cell || '').substring(0, 30)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-2">
              Gesamt: {previewData.totalRows} Zeilen
            </p>
          </div>

          {/* Match Column Selection */}
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input
                type="radio"
                checked={matchColumn.type === 'index'}
                onChange={() => handleMatchColumnChange('index', previewData.columnIndices[0])}
                className="w-4 h-4"
              />
              <span className="font-medium">Nach Spalte (A, B, C...)</span>
            </label>
            {matchColumn.type === 'index' && (
              <select
                value={matchColumn.value}
                onChange={(e) => handleMatchColumnChange('index', e.target.value)}
                className="ml-7 px-3 py-2 border rounded-lg"
              >
                {previewData.columnIndices.map((col) => (
                  <option key={col} value={col}>
                    {col} - {previewData.headers[previewData.columnIndices.indexOf(col)]}
                  </option>
                ))}
              </select>
            )}

            <label className="flex items-center space-x-3">
              <input
                type="radio"
                checked={matchColumn.type === 'header'}
                onChange={() => handleMatchColumnChange('header', previewData.headers[0])}
                className="w-4 h-4"
              />
              <span className="font-medium">Nach Header-Name</span>
            </label>
            {matchColumn.type === 'header' && (
              <select
                value={matchColumn.value}
                onChange={(e) => handleMatchColumnChange('header', e.target.value)}
                className="ml-7 px-3 py-2 border rounded-lg"
              >
                {previewData.headers.map((header, i) => (
                  <option key={i} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            )}

            <label className="flex items-center space-x-3">
              <input
                type="radio"
                checked={matchColumn.type === 'auto'}
                onChange={() => setMatchColumn({ type: 'auto', value: matchColumn.value || '' })}
                className="w-4 h-4"
              />
              <span className="font-medium">Auto-Detect</span>
            </label>
            {matchColumn.type === 'auto' && matchColumn.value && (
              <p className="ml-7 text-sm text-green-600 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Gefunden: {matchColumn.value}
              </p>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </button>
            <button
              onClick={proceedToStep3}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              Weiter
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Field Mappings */}
      {currentStep === 3 && previewData && (
        <div className="card space-y-6">
          <h2 className="text-xl font-semibold">Schritt 3: Felder zuordnen</h2>

          <p className="text-gray-600">
            Wähle aus, welche Excel-Spalten in welche Datenbank-Felder übernommen werden sollen.
          </p>

          {/* Field Mappings */}
          <div className="space-y-3">
            {fieldMappings.map((mapping, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <label className="text-xs text-gray-600 mb-1 block">Excel-Spalte</label>
                  <select
                    value={mapping.excelColumn}
                    onChange={(e) => updateFieldMapping(index, 'excelColumn', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Wählen...</option>
                    {previewData.columnIndices.map((col, i) => (
                      <option key={col} value={col}>
                        {col} - {previewData.headers[i]}
                      </option>
                    ))}
                  </select>
                </div>

                <ArrowRight className="w-5 h-5 text-gray-400 mt-6" />

                <div className="flex-1">
                  <label className="text-xs text-gray-600 mb-1 block">Datenbank-Feld</label>
                  <select
                    value={mapping.dbField}
                    onChange={(e) => updateFieldMapping(index, 'dbField', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Wählen...</option>
                    {validFields.map((field) => (
                      <option key={field.field} value={field.field}>
                        {field.description} ({field.type})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => removeFieldMapping(index)}
                  className="mt-6 p-2 text-red-600 hover:bg-red-50 rounded"
                  title="Entfernen"
                >
                  <AlertCircle className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Mapping Button */}
          <button
            onClick={addFieldMapping}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Weitere Spalte hinzufügen
          </button>

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </button>
            <button
              onClick={proceedToStep4}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              Weiter
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Import Execution */}
      {currentStep === 4 && (
        <div className="card space-y-6">
          <h2 className="text-xl font-semibold">Schritt 4: Import starten</h2>

          {/* Summary */}
          {!importResult && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-blue-900">Zusammenfassung:</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Excel-Zeilen: {previewData?.totalRows}</li>
                <li>• Match-Spalte: {matchColumn.type === 'auto' ? `${matchColumn.value} (Auto)` : matchColumn.value}</li>
                <li>• Zu aktualisierende Felder: {fieldMappings.length}</li>
                {fieldMappings.map((m, i) => (
                  <li key={i} className="ml-4">
                    - {m.excelColumn} → {validFields.find(f => f.field === m.dbField)?.description}
                  </li>
                ))}
              </ul>
              <div className="bg-yellow-50 border border-yellow-300 rounded p-3 mt-3">
                <p className="text-sm text-yellow-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Achtung: Existierende Daten werden überschrieben!
                </p>
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card bg-green-50 border-green-200">
                  <p className="text-sm text-green-600">Aktualisiert</p>
                  <p className="text-3xl font-bold text-green-900">{importResult.updatedArticles}</p>
                </div>
                <div className="card bg-blue-50 border-blue-200">
                  <p className="text-sm text-blue-600">Gematcht</p>
                  <p className="text-3xl font-bold text-blue-900">{importResult.matchedArticles}</p>
                </div>
                <div className="card bg-gray-50 border-gray-200">
                  <p className="text-sm text-gray-600">Übersprungen</p>
                  <p className="text-3xl font-bold text-gray-900">{importResult.skippedArticles}</p>
                </div>
                <div className="card bg-red-50 border-red-200">
                  <p className="text-sm text-red-600">Fehler</p>
                  <p className="text-3xl font-bold text-red-900">{importResult.errors.length}</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-semibold text-red-900 mb-2">Fehler:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importResult.errors.slice(0, 10).map((error, i) => (
                      <p key={i} className="text-sm text-red-800">
                        Zeile {error.row}: {error.message}
                      </p>
                    ))}
                    {importResult.errors.length > 10 && (
                      <p className="text-sm text-red-700 font-medium">
                        ... und {importResult.errors.length - 10} weitere Fehler
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t">
            <button
              onClick={() => setCurrentStep(3)}
              disabled={isImporting || !!importResult}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </button>

            {!importResult ? (
              <button
                onClick={executeImport}
                disabled={isImporting}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Importiere...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Import starten
                  </>
                )}
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={resetWizard}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Neuer Import
                </button>
                <button
                  onClick={() => navigate('/articles')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Zur Artikelliste
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
