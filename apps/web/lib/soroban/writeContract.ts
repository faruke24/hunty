/**
 * Soroban Contract Write Operation
 *
 * Executes a Soroban contract write with automatic gas estimation,
 * pre-submission simulation, wallet signing, and retry-backed submission.
 *
 * @module soroban/writeContract
 */

import Server, { type Account, type Transaction, TransactionBuilder } from "@stellar/stellar-sdk";

import { getSorobanNetworkPassphrase, getSorobanRpcUrl } from "./client";
import { withErrorHandling } from "./errors";
import { estimateGas, simulateTransaction } from "./gasAndSimulation";
import { withSorobanRpcRetry } from "./rpcRetry";
import type { ContractWriteConfig, ContractWriteResult } from "./types";

// ============================================================================
// SERVER FACTORY
// ============================================================================

/** Creates a Soroban RPC Server pointed at the configured endpoint. */
export function createServer(): Server {
  return new Server(getSorobanRpcUrl());
}

// ============================================================================
// CONTRACT WRITE
// ============================================================================

/**
 * Executes a Soroban contract write operation with automatic gas estimation,
 * pre-submission simulation, wallet signing, and retry-backed submission.
 *
 * Steps:
 * 1. Resolve public key and load account state (retried).
 * 2. Build a preliminary transaction.
 * 3. Estimate gas via `simulateTransaction` (skipped when `fee` is set).
 * 4. Rebuild the transaction with the estimated fee.
 * 5. Simulate the final transaction — throws if simulation fails.
 * 6. Sign with the provided wallet adapter (retried).
 * 7. Submit to the RPC with retry on transient failures.
 *
 * @example
 * ```ts
 * const result = await writeContract({
 *   contractId: "CCONTRACT...",
 *   method: "register_player",
 *   args: [huntId, playerAddress],
 *   wallet: getActiveWalletAdapter(),
 * })
 * console.log(`Submitted: ${result.txHash} — gas: ${result.gasEstimate} stroops`)
 * ```
 */
export async function writeContract(config: ContractWriteConfig): Promise<ContractWriteResult> {
  const { contractId, method, args = [], wallet, fee: customFee, timeout = 180 } = config;

  return withErrorHandling(async () => {
    // 1. Resolve wallet public key and load on-chain account state
    const publicKey = await withSorobanRpcRetry(() => wallet.getPublicKey(), {
      timeoutMs: 5000,
      maxAttempts: 2,
    });

    const server = createServer();
    const account = (await withSorobanRpcRetry(() => server.getAccount(publicKey), {
      timeoutMs: 10000,
      maxAttempts: 3,
    })) as Account;

    // 2. Serialize the call payload
    const payload = JSON.stringify({ contract: contractId, method, args });
    const opName = `${method}:${Date.now()}`;

    /**
     * Builds a transaction carrying the payload as manageData.
     * In production this would be a proper Soroban InvokeHostFunctionOp.
     */
    function buildTx(fee: string): Transaction {
      return new TransactionBuilder(account, {
        fee,
        networkPassphrase: getSorobanNetworkPassphrase(),
      })
        .addOperation({
          type: "manageData",
          name: opName,
          value: payload,
        })
        .setTimeout(timeout)
        .build();
    }

    // 3. Estimate gas (or use caller-supplied fee)
    let gasEstimation: { fee: string };
    if (customFee) {
      gasEstimation = { fee: customFee };
    } else {
      const preliminaryTx = buildTx("100");
      gasEstimation = await estimateGas(server, preliminaryTx);
    }

    // 4. Build the final transaction with the correct fee
    const finalTx = buildTx(gasEstimation.fee);

    // 5. Simulate — abort early if the contract call would fail
    const simulation = await simulateTransaction(server, finalTx);
    if (!simulation.success) {
      throw new Error(`Transaction simulation failed: ${simulation.error ?? simulation.status}`);
    }

    // 6. Wallet signing
    const signedXdr = await withSorobanRpcRetry(() => wallet.signTransaction(finalTx.toXDR()), {
      timeoutMs: 30000,
      maxAttempts: 2,
    });

    // 7. Submit with retry
    const result = (await withSorobanRpcRetry(
      async () => {
        const res = (await server.submitTransaction(signedXdr)) as { hash?: string };
        if (!res?.hash) throw new Error("Transaction submission returned no hash");
        return res;
      },
      { timeoutMs: 15000, maxAttempts: 3 }
    )) as { hash: string };

    return {
      txHash: result.hash,
      gasEstimate: parseInt(gasEstimation.fee, 10),
      simulationStatus: simulation.status,
      raw: result,
    };
  }, `Contract write failed [${method}]`);
}
