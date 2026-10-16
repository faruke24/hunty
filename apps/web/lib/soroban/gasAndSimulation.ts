/**
 * Soroban Gas Estimation and Transaction Simulation
 *
 * Utilities for estimating gas fees and simulating transactions before
 * submission to validate they will succeed under the current network state.
 *
 * @module soroban/gasAndSimulation
 */

import Server, { type Transaction } from "@stellar/stellar-sdk";

import { withErrorHandling } from "./errors";
import { withSorobanRpcRetry } from "./rpcRetry";
import type { GasEstimation, SimulationResult } from "./types";

// ============================================================================
// GAS ESTIMATION
// ============================================================================

/**
 * Estimates the fee for a contract transaction by running a simulation.
 *
 * Returns `{ fee, cpuInstructions, memoryBytes }`.  Falls back to a
 * conservative default (100 100 stroops) when `simulateTransaction` is
 * unavailable on the server instance.
 *
 * @param server      Soroban RPC server instance
 * @param transaction The transaction to estimate
 */
export async function estimateGas(
  server: Server,
  transaction: Transaction
): Promise<GasEstimation> {
  return withErrorHandling(async () => {
    const maybeServer = server as Server & {
      simulateTransaction?: (tx: Transaction) => Promise<{
        minResourceFee?: string;
        cost?: { cpuInsns?: string; memBytes?: string };
      }>;
    };

    if (typeof maybeServer.simulateTransaction !== "function") {
      return { fee: "100100" }; // conservative fallback
    }

    const simulation = await withSorobanRpcRetry(
      () => maybeServer.simulateTransaction(transaction),
      { timeoutMs: 10000, maxAttempts: 2 }
    );

    const BASE_FEE = 100;
    const resourceFee = simulation?.minResourceFee
      ? parseInt(simulation.minResourceFee, 10)
      : 100000;
    const fee = (BASE_FEE + resourceFee).toString();

    return {
      fee,
      cpuInstructions: simulation?.cost?.cpuInsns
        ? parseInt(simulation.cost.cpuInsns, 10)
        : undefined,
      memoryBytes: simulation?.cost?.memBytes ? parseInt(simulation.cost.memBytes, 10) : undefined,
    };
  }, "Gas estimation failed");
}

// ============================================================================
// TRANSACTION SIMULATION
// ============================================================================

/**
 * Simulates a contract transaction before submission to validate that it
 * will succeed under the current network state.
 *
 * Returns `{ success, status, cost?, error?, raw? }`.
 * When the server does not expose `simulateTransaction` an optimistic
 * success is returned so callers are not blocked in non-Soroban environments.
 *
 * @param server      Soroban RPC server instance
 * @param transaction The transaction to simulate
 */
export async function simulateTransaction(
  server: Server,
  transaction: Transaction
): Promise<SimulationResult> {
  return withErrorHandling(async () => {
    const maybeServer = server as Server & {
      simulateTransaction?: (tx: Transaction) => Promise<{
        status?: string;
        error?: string;
        cost?: { cpuInsns?: string; memBytes?: string };
      }>;
    };

    if (typeof maybeServer.simulateTransaction !== "function") {
      return { success: true, status: "SIMULATION_NOT_AVAILABLE" };
    }

    const result = await withSorobanRpcRetry(() => maybeServer.simulateTransaction(transaction), {
      timeoutMs: 10000,
      maxAttempts: 2,
    });

    const success = !result?.error && result?.status !== "FAILED";

    return {
      success,
      status: result?.status ?? "UNKNOWN",
      cost: result?.cost
        ? {
            cpuInsns: result.cost.cpuInsns ?? "0",
            memBytes: result.cost.memBytes ?? "0",
          }
        : undefined,
      error: result?.error,
      raw: result,
    };
  }, "Transaction simulation failed");
}
