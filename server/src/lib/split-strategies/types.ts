export type SplitLine = {
  userId: string;
  amountCents: number;
};

export type SplitStrategyContext = {
  amountCents: number;
  memberIds: string[];
  /** Reserved for strategy-specific input, e.g. per-member percentages or exact amounts. */
  metadata?: Record<string, unknown>;
};

export type SplitValidationResult = { valid: true } | { valid: false; error: string };

export interface SplitStrategy {
  readonly type: string;
  /** Display label — surfaced once there's a strategy picker in the UI. */
  readonly label: string;
  /**
   * Whether this strategy applies to the given input. Used by
   * `SplitStrategyRegistry.resolve()` to auto-detect the right strategy
   * from context alone (as opposed to `resolveByType`, which looks a
   * strategy up explicitly). Order of registration matters — the first
   * registered strategy whose `canHandle` returns true wins.
   */
  canHandle(context: SplitStrategyContext): boolean;
  /** Called before computeSplits by every call site — not enforced by the type system. */
  validate(context: SplitStrategyContext): SplitValidationResult;
  computeSplits(context: SplitStrategyContext): SplitLine[];
}
