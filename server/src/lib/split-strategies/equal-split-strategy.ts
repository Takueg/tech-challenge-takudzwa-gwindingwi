import type { SplitLine, SplitStrategy, SplitStrategyContext, SplitValidationResult } from "./types.js";

/**
 * Splits an amount evenly across members. Leftover cents (when the amount
 * doesn't divide evenly) go to the first N members in list order.
 */
export class EqualSplitStrategy implements SplitStrategy {
  readonly type = "equal";
  readonly label = "Split equally";

  canHandle(context: SplitStrategyContext): boolean {
    return !context.metadata || Object.keys(context.metadata).length === 0;
  }

  validate({ memberIds }: SplitStrategyContext): SplitValidationResult {
    if (memberIds.length === 0) return { valid: false, error: "Can't split an expense between no members" };
    return { valid: true };
  }

  computeSplits({ amountCents, memberIds }: SplitStrategyContext): SplitLine[] {
    const share = Math.floor(amountCents / memberIds.length);
    const remainder = amountCents - share * memberIds.length;
    return memberIds.map((userId, i) => ({
      userId,
      amountCents: share + (i < remainder ? 1 : 0),
    }));
  }
}
