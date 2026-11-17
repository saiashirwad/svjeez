/**
 * A turn's bounds: model calls (steps) and compiles in one turn, model calls in a session, a turn's wall time, and the
 * longest message a person may send.
 */
export const LIMITS = {
  steps: 24,
  compiles: 10,
  calls: 150,
  ms: 10 * 60_000,
  message: 2000,
} as const;
