/**
 * Job Monitor Page
 * Real-time monitoring of automation jobs with WebSocket updates
 */

import { useParams } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { Activity, CheckCircle, XCircle, Clock, Image, FileText, Tag } from 'lucide-react';

export default function JobMonitor() {
  const { jobId } = useParams<{ jobId: string }>();
  const {
    isConnected,
    progress,
    currentStage,
    status,
    screenshots,
    ocrResults,
    labels,
    error,
    results,
  } = useWebSocket(jobId);

  // Stage display names
  const stageNames: Record<string, string> = {
    pending: 'Pending',
    crawling: 'Crawling Website',
    'processing-ocr': 'Processing OCR',
    matching: 'Matching Products',
    rendering: 'Generating Labels',
    completed: 'Completed',
    failed: 'Failed',
  };

  // Status colors
  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-800',
    crawling: 'bg-blue-100 text-blue-800',
    'processing-ocr': 'bg-yellow-100 text-yellow-800',
    matching: 'bg-purple-100 text-purple-800',
    rendering: 'bg-indigo-100 text-indigo-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Job Monitor</h1>
              <p className="text-gray-600 mt-1">Job ID: {jobId}</p>
            </div>

            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-blue-500" />
              <div>
                <h2 className="text-xl font-semibold">Current Status</h2>
                <p className="text-sm text-gray-600">{stageNames[currentStage] || currentStage}</p>
              </div>
            </div>

            {/* Status Badge */}
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[status] || statusColors.pending}`}>
              {status.toUpperCase()}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mb-2">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-500 ease-out flex items-center justify-end px-2"
                style={{ width: `${progress}%` }}
              >
                {progress > 10 && (
                  <span className="text-white text-xs font-medium">{progress}%</span>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Completion Message */}
          {status === 'completed' && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">Job Completed Successfully!</p>
                <p className="text-sm text-green-700">
                  {progress?.productsProcessed || results?.summary?.totalProducts || 0} products processed, {progress?.labelsGenerated || results?.summary?.labelsGenerated || 0} labels generated
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Screenshots */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Image className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{screenshots.length}</p>
                <p className="text-sm text-gray-600">Screenshots</p>
              </div>
            </div>
          </div>

          {/* OCR Results */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <FileText className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{ocrResults.length}</p>
                <p className="text-sm text-gray-600">OCR Completed</p>
              </div>
            </div>
          </div>

          {/* Labels Generated */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Tag className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{labels.length}</p>
                <p className="text-sm text-gray-600">Labels Generated</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Updates Tabs */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button className="px-6 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
                Screenshots ({screenshots.length})
              </button>
              <button className="px-6 py-3 text-sm font-medium text-gray-600 hover:text-gray-900">
                OCR Results ({ocrResults.length})
              </button>
              <button className="px-6 py-3 text-sm font-medium text-gray-600 hover:text-gray-900">
                Labels ({labels.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Screenshots Grid */}
            {screenshots.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {screenshots.map((screenshot, index) => (
                  <div key={screenshot.screenshotId} className="group relative">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={screenshot.thumbnailUrl || screenshot.url}
                        alt={screenshot.productName || `Screenshot ${index + 1}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                      />
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 truncate">
                        {screenshot.productName || 'No name'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {new URL(screenshot.productUrl).pathname}
                      </p>
                    </div>

                    {/* Live Indicator */}
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      LIVE
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Waiting for screenshots...</p>
                <p className="text-sm text-gray-400">Screenshots will appear here in real-time</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
