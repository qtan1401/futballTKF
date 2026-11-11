import { LOCK_MINUTES } from "./rules"

const VN_OFFSET_MS = 7 * 3600_000
const pad = (n: number) => String(n).padStart(2, "0")

/** "2026-11-15T17:00" (giờ VN) → ISO UTC; null nếu sai định dạng. */
export function parseLocalDatetimeVN(s: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s.trim())
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number)
  const ms = Date.UTC(y, mo - 1, d, h, mi) - VN_OFFSET_MS
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

function vn(iso: string): Date {
  return new Date(Date.parse(iso) + VN_OFFSET_MS)
}

export function formatKickoffVN(iso: string): string {
  const d = vn(iso)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} · ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`
}

export function formatLockTimeVN(iso: string): string {
  const d = new Date(Date.parse(iso) - LOCK_MINUTES * 60_000 + VN_OFFSET_MS)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** Giá trị cho <input type="datetime-local"> theo giờ VN. */
export function toLocalInputVN(iso: string): string {
  const d = vn(iso)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export function countdownText(iso: string, nowMs: number): string {
  const diff = Date.parse(iso) - nowMs
  if (diff <= 0) return "đã đến giờ"
  const mins = Math.floor(diff / 60_000)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (days > 0) return `còn ${days} ngày ${hours}g`
  if (hours > 0) return `còn ${hours}g ${pad(m)}p`
  return `còn ${Math.max(m, 1)}p`
}
