/**
 * Re-export from harness/handoff.ts — the canonical source.
 * agents/ references are kept for backward compatibility with existing code and tests.
 */
export {
  type HandoffSource,
  type HandoffReport,
  type HandoffMindMap,
  type HandoffMetrics,
  type HandoffPhase,
  type HandoffDocument,
  type HandoffHistoryEntry,
  createHandoffDocument,
  saveHandoff,
  loadHandoff,
  listHandoffs,
  archiveHandoff,
  resetContext,
  recordEvaluation,
  createIterationHandoff,
  approveHandoff,
  rejectHandoff,
  extractReportMetrics,
  extractMindMapMetrics,
} from '../harness/handoff';
