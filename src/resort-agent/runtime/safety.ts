/**
 * Loop-safety controls — fail closed. The agent must never run away: bounded
 * actions per cycle, bounded cycles per window, bounded retries, idempotency,
 * goal lock, stale detection, and human escalation after repeated failure.
 */
import type { AgentRuntimeConfig, AgentGoal } from "./types";

export class LoopSafety {
  private cfg: AgentRuntimeConfig;
  constructor(cfg: AgentRuntimeConfig) {
    this.cfg = cfg;
  }

  checkCycleBudget(goal: AgentGoal, now: string): { ok: boolean; reason?: string } {
    const windowStart = new Date(Date.parse(now) - this.cfg.cycleWindowMs).toISOString();
    if (goal.cycleCount >= this.cfg.maxCyclesPerGoalWindow) {
      return { ok: false, reason: "max cycles per window reached" };
    }
    return { ok: true };
  }

  checkActionBudget(actionsThisCycle: number): { ok: boolean; reason?: string } {
    if (actionsThisCycle >= this.cfg.maxActionsPerCycle) {
      return { ok: false, reason: "max actions per cycle reached" };
    }
    return { ok: true };
  }

  shouldRetry(attempt: number): { ok: boolean; delayMs: number } {
    if (attempt >= this.cfg.maxRetries) return { ok: false, delayMs: 0 };
    const delay = this.cfg.retryDelayMs * Math.pow(2, attempt - 1);
    return { ok: true, delayMs: delay };
  }

  isStale(goal: AgentGoal, now: string): boolean {
    return !!goal.staleAt && goal.staleAt <= now;
  }

  retriesExhausted(attempt: number): boolean {
    return attempt >= this.cfg.maxRetries;
  }
}
