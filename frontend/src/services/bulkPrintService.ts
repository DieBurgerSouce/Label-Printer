/**
 * Bulk Print Service
 * Handles bulk PDF export and printing
 */
import { printApi } from './api';
import type { PrintLayout } from '../store/printStore';

export interface BulkPrintOptions {
  labelIds: string[];
  layout: PrintLayout;
  action: 'download' | 'print'; // Download PDF or Open Print Dialog
}

export interface BulkPrintResult {
  success: boolean;
  url?: string;
  error?: string;
  labelCount: number;
}

export class BulkPrintService {
  /**
   * Export multiple labels as single PDF
   */
  async exportAsPDF(options: BulkPrintOptions): Promise<BulkPrintResult> {
    const { labelIds, layout, action } = options;

    if (labelIds.length === 0) {
      return {
        success: false,
        error: 'No labels selected',
        labelCount: 0,
      };
    }

    try {
      // Call API to generate PDF
      const blob = await printApi.exportPDF(layout, labelIds);

      // Create object URL
      const url = URL.createObjectURL(blob);

      // Perform action
      if (action === 'download') {
        this.downloadPDF(url, labelIds.length);
      } else if (action === 'print') {
        this.printPDF(url);
      }

      return {
        success: true,
        url,
        labelCount: labelIds.length,
      };
    } catch (error) {
      console.error('Bulk print failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        labelCount: labelIds.length,
      };
    }
  }

  /**
   * Download PDF file
   */
  private downloadPDF(url: string, labelCount: number): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = `labels-${labelCount}-${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up URL after download
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Open print dialog with PDF
   */
  private printPDF(url: string): void {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;

    document.body.appendChild(iframe);

    iframe.onload = () => {
      iframe.contentWindow?.print();

      // Clean up after print dialog closes
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 1000);
    };
  }

  /**
   * Check if browser supports PDF printing
   */
  canPrint(): boolean {
    return typeof window.print === 'function';
  }
}

// Singleton instance
export const bulkPrintService = new BulkPrintService();
