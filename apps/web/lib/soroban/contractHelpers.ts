/**
 * Soroban Contract Interaction Helpers — Re-export Barrel
 *
 * This file is the public surface of the soroban/contractHelpers module.
 * All implementation has been split into focused sub-modules:
 *
 *  - types.ts            — TypeScript types and interfaces
 *  - errors.ts           — Error normalization utilities
 *  - gasAndSimulation.ts — Gas estimation and transaction simulation
 *  - writeContract.ts    — Contract write operation
 *  - readContract.ts     — Contract read operation
 *  - polling.ts          — Transaction status polling
 *  - convenience.ts      — High-level helpers (writeContractAndWait, batchReadContracts)
 *
 * All existing imports from `@/lib/soroban/contractHelpers` continue to work
 * without modification.
 *
 * @module soroban/contractHelpers
 */

export { batchReadContracts, writeContractAndWait } from "./convenience";
export { normalizeContractError } from "./errors";
export { estimateGas, simulateTransaction } from "./gasAndSimulation";
export { pollTransactionStatus } from "./polling";
export { readContract } from "./readContract";
export type {
  ContractReadConfig,
  ContractReadResult,
  ContractWriteConfig,
  ContractWriteResult,
  GasEstimation,
  SimulationResult,
} from "./types";
export { writeContract } from "./writeContract";
