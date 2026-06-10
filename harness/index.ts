/**
 * Harness Framework — Barrel Export
 *
 * Generic, reusable harness for iterative quality feedback loops.
 * Application-agnostic: operates through IJudge and IReportGenerator interfaces.
 */

export type {
  IJudge,
  IReportGenerator,
  JudgeResult,
  GeneratedReport,
  GenerationMetrics,
  GenerationResult,
  GenerationInput,
} from './types';

export {
  type HandoffDocument,
  type HandoffPhase,
  type HandoffReport,
  type HandoffMindMap,
  type HandoffMetrics,
  type HandoffSource,
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
} from './handoff';

export {
  type SprintContract,
  type ScoreDimension,
  type ContractStatus,
  type RoundResult,
  type NegotiationEntry,
  proposeContract,
  adjustContract,
  activateContract,
  saveContract,
  loadContract,
  listContracts,
  calculateWeightedScore,
  checkHardThresholds,
  recordRoundResult,
  getBestRound,
  contractSummary,
} from './sprint-contract';

export {
  type LoopState,
  type LoopStatus,
  type LoopRound,
  type LoopNextResult,
  startLoop,
  loopNext,
  loopApprove,
  loopCancel,
  loadLoop,
  listLoops,
  saveLoop,
  loopSummary,
} from './feedback-loop';
