import type { SplitLine, SplitStrategy, SplitStrategyContext } from "./types.js";
import { EqualSplitStrategy } from "./equal-split-strategy.js";

/**
 * Central place to look up a split strategy. Register additional
 * strategies here as they're implemented (percentage, exact amounts, shares).
 *
 * Two ways to get a strategy out:
 *  - `resolveByType` — explicit lookup by `type`, for call sites that
 *    already know which strategy they want.
 *  - `resolve` — auto-detects the right strategy from the input shape via
 *    each strategy's `canHandle`, for call sites that don't. Registration
 *    order matters here: the first match wins, so a newly registered
 *    strategy needs to be registered ahead of anything whose `canHandle`
 *    might also match its input.
 */
export class SplitStrategyRegistry {
  private strategies: SplitStrategy[] = [];

  register(strategy: SplitStrategy): void {
    this.strategies.push(strategy);
  }

  resolveByType(type: string): SplitStrategy {
    const strategy = this.strategies.find((s) => s.type === type);
    if (!strategy) throw new Error(`Unknown split strategy: ${type}`);
    return strategy;
  }

  resolve(context: SplitStrategyContext): SplitStrategy {
    const strategy = this.strategies.find((s) => s.canHandle(context));
    if (!strategy) throw new Error("No registered split strategy can handle this input");
    return strategy;
  }

  /** Validates, then computes. Production code splits through here so validation can't be skipped. */
  split(type: string, context: SplitStrategyContext): SplitLine[] {
    const strategy = this.resolveByType(type);
    const validation = strategy.validate(context);
    if (!validation.valid) throw new Error(validation.error);
    return strategy.computeSplits(context);
  }
}

export const splitStrategyRegistry = new SplitStrategyRegistry();
splitStrategyRegistry.register(new EqualSplitStrategy());
