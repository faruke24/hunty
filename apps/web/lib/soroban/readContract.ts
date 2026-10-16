/**
 * Soroban Contract Read Operation
 *
 * Reads data from a Soroban contract using the JSON-RPC
 * `invokeContractFunction` method, with automatic retry and type-safe
 * custom parsers.
 *
 * @module soroban/readContract
 */

import { getSorobanRpcUrl } from "./client";
import { withErrorHandling } from "./errors";
import { withSorobanRpcRetry } from "./rpcRetry";
import type { ContractReadConfig, ContractReadResult } from "./types";

// ============================================================================
// CONTRACT READ
// ============================================================================

/**
 * Reads data from a Soroban contract using the JSON-RPC `invokeContractFunction`
 * method, with automatic retry and a type-safe custom parser.
 *
 * @example
 * ```ts
 * type Progress = { hunt_id: number; player: string; completed: boolean }
 *
 * const { data } = await readContract<Progress>({
 *   contractId: "CCONTRACT...",
 *   method: "get_player_progress",
 *   args: [huntId, playerAddress],
 *   parser: (raw) => raw as Progress,
 * })
 * ```
 */
export async function readContract<T = unknown>(
  config: ContractReadConfig
): Promise<ContractReadResult<T>> {
  const { contractId, method, args = [], parser } = config;

  return withErrorHandling(async () => {
    const rpcUrl = getSorobanRpcUrl();

    const response = await withSorobanRpcRetry(
      async () => {
        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "invokeContractFunction",
            params: {
              contractId,
              function: method,
              args: args.map(String),
            },
          }),
        });
        if (!res.ok) {
          throw new Error(`RPC request failed with status ${res.status}`);
        }
        return res.json() as Promise<{
          result?: unknown;
          error?: { message?: string };
        }>;
      },
      { timeoutMs: 10000, maxAttempts: 3 }
    );

    if (response.error) {
      throw new Error(response.error.message ?? "Contract read failed");
    }

    const data = parser ? parser<T>(response.result) : (response.result as T);

    return { data, raw: response.result };
  }, `Contract read failed [${method}]`);
}
