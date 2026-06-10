/**
 * Re-export from harness/sprint-contract.ts — the canonical source.
 * agents/ references are kept for backward compatibility with existing code and tests.
 */
export {
  type ContractStatus,
  type ScoreDimension,
  type SprintContract,
  type NegotiationEntry,
  type RoundResult,
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
} from '../harness/sprint-contract';
