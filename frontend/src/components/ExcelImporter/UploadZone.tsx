import { Upload, FileSpreadsheet, X, CheckCircle } from 'lucide-react';
import { useCallback, useState } from 'react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  uploadProgress?: number;
}

export default function UploadZone({
  onFileSelect,
  isUploading = false,
  uploadProgress = 0,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (isValidFile(file)) {
          setSelectedFile(file);
          onFileSelect(file);
        }
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        if (isValidFile(file)) {
          setSelectedFile(file);
          onFileSelect(file);
        }
      }
    },
    [onFileSelect]
  );

  const isValidFile = (file: File): boolean => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    return validExtensions.includes(fileExtension);
  };

  const clearFile = () => {
    setSelectedFile(null);
  };

  return (
    <div className="card">
      {selectedFile && !isUploading ? (
        // File selected
        <div className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="font-medium text-green-900">{selectedFile.name}</p>
              <p className="text-sm text-green-700">{(selectedFile.size / 1024).toFixed(2)} KB</p>
            </div>
          </div>
          <button
            onClick={clearFile}
            className="p-2 text-green-700 hover:bg-green-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : isUploading ? (
        // Uploading
        <div className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Uploading...</span>
            <span className="text-sm font-medium text-primary-600">{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : (
        // Upload zone
        <div
          onDragEnter={handleDragIn}
          onDragLeave={handleDragOut}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg transition-all ${
            isDragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-400'
          }`}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <div className="py-12 px-6 text-center">
            <div className="mb-4 flex justify-center">
              {isDragging ? (
                <Upload className="w-16 h-16 text-primary-600 animate-bounce" />
              ) : (
                <FileSpreadsheet className="w-16 h-16 text-gray-400" />
              )}
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isDragging ? 'Drop file here' : 'Upload Excel File'}
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              Drag and drop your Excel file here, or click to browse
            </p>

            <button className="btn-primary inline-flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Choose File
            </button>

            <p className="text-xs text-gray-500 mt-4">
              Supported formats: .xlsx, .xls, .csv (Max 50MB)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
