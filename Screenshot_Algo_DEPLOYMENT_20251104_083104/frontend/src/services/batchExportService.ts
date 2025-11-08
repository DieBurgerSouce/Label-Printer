/**
 * Batch Export Service
 * Handles batch processing of label exports with progress tracking
 */
// import { printApi } from './api'; // Will be used when API is integrated
import type { ExportConfig } from '../components/ExportSettings';
import type { ExportJob } from '../components/ExportSettings';
import type { PriceLabel } from '../store/labelStore';

interface BatchExportOptions {
  labels: PriceLabel[];
  config: ExportConfig;
  onProgress?: (jobs: ExportJob[]) => void;
  onComplete?: (results: ExportResult[]) => void;
  onError?: (error: Error) => void;
}

export interface ExportResult {
  labelId: string;
  success: boolean;
  url?: string;
  error?: string;
}

export class BatchExportService {
  private jobs: ExportJob[] = [];
  private results: ExportResult[] = [];
  private isRunning = false;
  private cancelled = false;

  /**
   * Export multiple labels with progress tracking
   */
  async exportBatch(options: BatchExportOptions): Promise<ExportResult[]> {
    const { labels, config, onProgress, onComplete, onError } = options;

    // Reset state
    this.jobs = [];
    this.results = [];
    this.isRunning = true;
    this.cancelled = false;

    // Create jobs
    this.jobs = labels.map(label => ({
      id: label.id,
      name: `${label.productName} (${label.articleNumber})`,
      status: 'pending' as const,
      progress: 0,
    }));

    // Notify initial progress
    onProgress?.(this.jobs);

    try {
      // Process jobs sequentially to avoid overloading
      for (let i = 0; i < this.jobs.length; i++) {
        if (this.cancelled) {
          break;
        }

        const job = this.jobs[i];
        const label = labels[i];

        // Update job status
        job.status = 'processing';
        onProgress?.(this.jobs);

        try {
          // Simulate export (in real implementation, call API)
          const result = await this.exportSingleLabel(label, config, (progress) => {
            job.progress = progress;
            onProgress?.(this.jobs);
          });

          // Success
          job.status = 'completed';
          job.progress = 100;
          this.results.push({
            labelId: label.id,
            success: true,
            url: result,
          });
        } catch (error) {
          // Failed
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : 'Export failed';
          this.results.push({
            labelId: label.id,
            success: false,
            error: job.error,
          });
        }

        onProgress?.(this.jobs);
      }

      this.isRunning = false;
      onComplete?.(this.results);
      return this.results;
    } catch (error) {
      this.isRunning = false;
      const err = error instanceof Error ? error : new Error('Batch export failed');
      onError?.(err);
      throw err;
    }
  }

  /**
   * Export a single label
   */
  private async exportSingleLabel(
    label: PriceLabel,
    config: ExportConfig,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    // Simulate progress
    onProgress?.(10);
    await this.delay(200);

    onProgress?.(30);
    await this.delay(200);

    // Call actual export API
    try {
      // Future: Call the API with export data
      // const exportData = {
      //   layout: { ... },
      //   format: config.format,
      // };
      // const blob = await printApi.export(exportData);
      // const url = URL.createObjectURL(blob);

      onProgress?.(60);

      // For now, simulate
      await this.delay(500);
      onProgress?.(90);

      await this.delay(200);
      onProgress?.(100);

      // Return mock URL
      return `export-${label.id}.${config.format}`;
    } catch (error) {
      throw new Error(`Failed to export ${label.productName}: ${error}`);
    }
  }

  /**
   * Cancel the running batch export
   */
  cancel() {
    this.cancelled = true;
    this.isRunning = false;
  }

  /**
   * Check if batch export is running
   */
  isExporting(): boolean {
    return this.isRunning;
  }

  /**
   * Get current jobs
   */
  getJobs(): ExportJob[] {
    return this.jobs;
  }

  /**
   * Get results
   */
  getResults(): ExportResult[] {
    return this.results;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Download all successful exports as a ZIP (future enhancement)
   */
  async downloadAsZip(results: ExportResult[]): Promise<void> {
    const successfulExports = results.filter(r => r.success && r.url);

    if (successfulExports.length === 0) {
      throw new Error('No successful exports to download');
    }

    // In real implementation, create ZIP using JSZip
    // For now, download individually
    for (const result of successfulExports) {
      if (result.url) {
        const link = document.createElement('a');
        link.href = result.url;
        link.download = result.url;
        link.click();
        await this.delay(100); // Small delay between downloads
      }
    }
  }
}

// Singleton instance
export const batchExportService = new BatchExportService();
