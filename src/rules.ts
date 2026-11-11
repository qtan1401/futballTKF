export const LOCK_MINUTES = 60

/** Lõi trận đủ cho mọi quyết định; không cần join. */
export type MatchCore = { kickoff_at: string; result: "win" | "loss" | null }

/**
 * OPEN: trước giờ khoá. LATE: từ giờ khoá tới khi có kết quả.
 * LOCKED: đã có kết quả.
 */
export type Phase = "OPEN" | "LATE" | "LOCKED"

const LOCK_MS = LOCK_MINUTES * 60 * 1000

function lockAtMs(m: MatchCore): number {
  return Date.parse(m.kickoff_at) - LOCK_MS
}

export function phase(m: MatchCore, nowMs: number): Phase {
  if (m.result !== null) return "LOCKED"
  return nowMs < lockAtMs(m) ? "OPEN" : "LATE"
}

export function canAddSignup(m: MatchCore, nowMs: number): { allowed: boolean; late: boolean } {
  const p = phase(m, nowMs)
  if (p === "LOCKED") return { allowed: false, late: false }
  return { allowed: true, late: p !== "OPEN" }
}

export function canRemoveSignup(m: MatchCore, nowMs: number): boolean {
  return phase(m, nowMs) === "OPEN"
}

export function canEditMatchInfo(m: MatchCore, nowMs: number): boolean {
  return phase(m, nowMs) === "OPEN"
}

export function canEnterResult(m: MatchCore, nowMs: number): boolean {
  return m.result === null && nowMs >= Date.parse(m.kickoff_at)
}

export function canEditResult(m: MatchCore, _nowMs: number): boolean {
  return m.result !== null
}

export function canHideMatch(m: MatchCore, _nowMs: number): boolean {
  return m.result === null
}
