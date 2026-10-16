/**
 * Soroban Contract Helper Types
 *
 * Shared TypeScript types and interfaces for contract interaction helpers.
 *
 * @module soroban/types
 */

import type { ActiveWalletAdapter } from "../walletAdapter";

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Configuration for contract write operations.
 */
export type ContractWriteConfig = {
  /** Contract ID (address) on the Stellar network */
  contractId: string;
  /** Method name to invoke on the contract */
  method: string;
  /** Method arguments (Soroban-compatible types) */
  args?: unknown[];
  /** Wallet adapter used to sign the transaction */
  wallet: ActiveWalletAdapter;
  /** Optional custom fee in stroops — skips auto gas estimation when set */
  fee?: string;
  /** Transaction timeout in seconds (default: 180) */
  timeout?: number;
};

/**
 * Configuration for contract read operations.
 */
export type ContractReadConfig = {
  /** Contract ID (address) on the Stellar network */
  contractId: string;
  /** Method name to call on the contract */
  method: string;
  /** Method arguments (Soroban-compatible types) */
  args?: unknown[];
  /** Optional parser to transform the raw RPC response into a typed value */
  parser?: <T>(raw: unknown) => T;
};

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Result from a contract write operation.
 */
export type ContractWriteResult = {
  /** Transaction hash */
  txHash: string;
  /** Estimated fee used in stroops */
  gasEstimate: number;
  /** Transaction status string returned by simulation */
  simulationStatus: string;
  /** Raw response from the RPC */
  raw?: unknown;
};

/**
 * Result from a contract read operation.
 */
export type ContractReadResult<T = unknown> = {
  /** Parsed data returned by the contract */
  data: T;
  /** Raw value from the RPC before parsing */
  raw?: unknown;
};

// ============================================================================
// GAS & SIMULATION TYPES
// ============================================================================

/**
 * Gas estimation result.
 */
export type GasEstimation = {
  /** Estimated total fee in stroops (base + resource) */
  fee: string;
  /** Estimated CPU instructions consumed */
  cpuInstructions?: number;
  /** Estimated memory bytes consumed */
  memoryBytes?: number;
};

/**
 * Transaction simulation result.
 */
export type SimulationResult = {
  /** Whether the simulation succeeded */
  success: boolean;
  /** Status string from the simulation response */
  status: string;
  /** Resource cost reported by simulation */
  cost?: {
    cpuInsns: string;
    memBytes: string;
  };
  /** Error message when simulation fails */
  error?: string;
  /** Raw simulation response */
  raw?: unknown;
};
