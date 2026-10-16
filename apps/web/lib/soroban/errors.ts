/**
 * Soroban Contract Error Utilities
 *
 * Normalizes any thrown value from a contract operation into a structured
 * `StellarError`.
 *
 * @module soroban/errors
 */

import { parseStellarError, type StellarError } from "../stellarErrors";

// ============================================================================
// ERROR NORMALIZATION
// ============================================================================

/**
 * Normalizes any thrown value from a contract operation into a structured
 * `StellarError`, optionally prefixed with a context label.
 */
export function normalizeContractError(error: unknown, context?: string): StellarError {
  const stellarError = parseStellarError(error);
  if (!context) return stellarError;
  return { ...stellarError, message: `${context}: ${stellarError.message}` };
}

/**
 * Runs `operation` and re-throws any error as a normalized `StellarError`
 * with the supplied context prefix.
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw normalizeContractError(error, context);
  }
}
