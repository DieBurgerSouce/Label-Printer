/**
 * Automation Services Module
 * Re-exports all automation-related utilities
 */

export {
  emitJobCreated,
  emitJobUpdated,
  emitJobCompleted,
  emitJobFailed,
  emitLabelGenerated,
  calculateOverallProgress,
} from './ws-notifier';
