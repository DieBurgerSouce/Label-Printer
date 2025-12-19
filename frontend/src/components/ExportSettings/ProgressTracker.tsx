/**
 * Export Progress Tracker
 * Shows progress for batch export operations
 */
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export interface ExportJob {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  error?: string;
}

interface ProgressTrackerProps {
  jobs: ExportJob[];
  onCancel?: () => void;
}

export const ProgressTracker = ({ jobs, onCancel }: ProgressTrackerProps) => {
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j) => j.status === 'completed').length;
  const failedJobs = jobs.filter((j) => j.status === 'failed').length;
  const overallProgress = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Export Progress</h3>
          <p className="text-sm text-gray-600">
            {completedJobs} of {totalJobs} completed
            {failedJobs > 0 && ` · ${failedJobs} failed`}
          </p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Overall Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
          <span>Overall Progress</span>
          <span>{Math.round(overallProgress)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Job List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {jobs.map((job) => (
          <div
            key={job.id}
            className={`p-3 rounded-lg border ${
              job.status === 'completed'
                ? 'bg-green-50 border-green-200'
                : job.status === 'failed'
                  ? 'bg-red-50 border-red-200'
                  : job.status === 'processing'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Status Icon */}
              <div className="mt-0.5">
                {job.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                {job.status === 'failed' && <XCircle className="w-5 h-5 text-red-600" />}
                {job.status === 'processing' && (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                )}
                {job.status === 'pending' && (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                )}
              </div>

              {/* Job Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 truncate">{job.name}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {job.status === 'processing' && `${job.progress}%`}
                    {job.status === 'completed' && 'Done'}
                    {job.status === 'failed' && 'Failed'}
                    {job.status === 'pending' && 'Pending'}
                  </span>
                </div>

                {/* Progress Bar for Processing */}
                {job.status === 'processing' && (
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}

                {/* Error Message */}
                {job.status === 'failed' && job.error && (
                  <p className="text-xs text-red-600 mt-1">{job.error}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {completedJobs === totalJobs && totalJobs > 0 && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-900">
            ✓ All exports completed successfully!
          </p>
        </div>
      )}
    </div>
  );
};
