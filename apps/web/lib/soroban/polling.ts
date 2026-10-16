/**
 * Soroban Transaction Status Polling
 *
 * Polls the Soroban RPC until a transaction is confirmed or times out.
 *
 * @module soroban/polling
 */

import Server from "@stellar/stellar-sdk";

import { getSorobanRpcUrl } from "./client";
import { withErrorHandling } from "./errors";
import { createServer } from "./writeContract";

// ============================================================================
// TRANSACTION POLLING
// ============================================================================

/**
 * Polls the Soroban RPC until the transaction is confirmed or times out.
 *
 * - Handles `mock_tx_` prefixed hashes used in development.
 * - Uses the SDK's `getTransaction` method when available, falling back to a
 *   raw JSON-RPC call.
 *
 * @param txHash  Transaction hash returned by `writeContract`
 * @param options Optional polling configuration
 *
 * @example
 * ```ts
 * const result = await writeContract({ ... })
 * await pollTransactionStatus(result.txHash)
 * console.log("Confirmed!")
 * ```
 */
export async function pollTransactionStatus(
  txHash: string,
  options?: {
    /** Maximum number of poll attempts (default: 15) */
    maxAttempts?: number;
    /** Delay between attempts in ms (default: 2000) */
    pollInterval?: number;
    /** Called before each poll attempt */
    onPoll?: (attempt: number) => void;
  }
): Promise<boolean> {
  const { maxAttempts = 15, pollInterval = 2000, onPoll } = options ?? {};

  return withErrorHandling(async () => {
    // Development mock transactions resolve instantly
    if (txHash.startsWith("mock_tx_")) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return true;
    }

    const server = createServer();
    const maybeServer = server as Server & {
      getTransaction?: (hash: string) => Promise<{ status?: string }>;
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      onPoll?.(attempt);

      try {
        let status: string | undefined;

        if (typeof maybeServer.getTransaction === "function") {
          const res = (await maybeServer.getTransaction(txHash)) as {
            status?: string;
          };
          status = res?.status;
        } else {
          const rpcRes = (await fetch(getSorobanRpcUrl(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getTransaction",
              params: { hash: txHash },
            }),
          }).then((r) => r.json())) as { result?: { status?: string } };

          status = rpcRes?.result?.status;
        }

        if (status && status !== "NOT_FOUND" && status !== "PENDING") {
          if (status === "SUCCESS") return true;
          throw new Error(`Transaction failed with status: ${status}`);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("Transaction failed")) {
          throw error;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Transaction polling timed out after ${maxAttempts} attempts`);
  }, "Transaction polling failed");
}
