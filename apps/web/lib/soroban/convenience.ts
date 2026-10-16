/**
 * Soroban Convenience Helpers
 *
 * High-level helpers that compose the lower-level contract interaction
 * primitives into common usage patterns.
 *
 * @module soroban/convenience
 */

import type { StellarError } from "../stellarErrors";
import { normalizeContractError } from "./errors";
import { pollTransactionStatus } from "./polling";
import { readContract } from "./readContract";
import type {
  ContractReadConfig,
  ContractReadResult,
  ContractWriteConfig,
  ContractWriteResult,
} from "./types";
import { writeContract } from "./writeContract";

// ============================================================================
// CONVENIENCE HELPERS
// ============================================================================

/**
 * Submits a contract write and waits for on-chain confirmation in one call.
 *
 * @example
 * ```ts
 * const result = await writeContractAndWait({
 *   contractId: "CCONTRACT...",
 *   method: "create_hunt",
 *   args: [title, description, startTime, endTime],
 *   wallet: getActiveWalletAdapter(),
 * })
 * // Transaction confirmed when this resolves
 * ```
 */
export async function writeContractAndWait(
  config: ContractWriteConfig,
  pollOptions?: Parameters<typeof pollTransactionStatus>[1]
): Promise<ContractWriteResult> {
  const result = await writeContract(config);
  await pollTransactionStatus(result.txHash, pollOptions);
  return result;
}

/**
 * Reads multiple contract values in parallel, isolating failures so a single
 * RPC error does not abort the whole batch.
 *
 * @example
 * ```ts
 * const results = await batchReadContracts([
 *   { contractId: "C1...", method: "get_balance" },
 *   { contractId: "C2...", method: "get_status" },
 * ])
 * results.forEach((r) => {
 *   if ("data" in r) console.log(r.data)
 *   else console.error(r.error.message)
 * })
 * ```
 */
export async function batchReadContracts<T = unknown>(
  configs: ContractReadConfig[]
): Promise<Array<ContractReadResult<T> | { error: StellarError }>> {
  return Promise.all(
    configs.map(async (cfg) => {
      try {
        return await readContract<T>(cfg);
      } catch (error) {
        return { error: normalizeContractError(error) };
      }
    })
  );
}
