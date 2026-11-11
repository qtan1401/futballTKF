import { customAlphabet } from "nanoid"
import { canHideMatch, canRemoveSignup, phase, type MatchCore } from "./rules"

export class ValidationError extends Error {}
export class ConflictError extends Error {}

export type PlayerRow = { id: number; name: string; is_active: number; created_at: string }
export type MatchRow = {
  id: string
  format: 5 | 7
  pitch: string
  kickoff_at: string
  result: "win" | "loss" | null
  our_score: number | null
  their_score: number | null
  note: string | null
  created_at: string
  updated_at: string | null
  deleted_at: string | null
}
export type SignupRow = {
  id: number
  match_id: string
  player_id: number | null
  guest_name: string | null
  is_late: number
  created_at: string
  name: string
}

const newId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10)

const nowIso = () => new Date().toISOString()
const isUnique = (e: unknown) => String(e).includes("UNIQUE")

// ---------- players ----------

export async function createPlayer(d1: D1Database, rawName: string): Promise<PlayerRow> {
  const name = rawName.trim()
  if (!name) throw new ValidationError("Tên không được để trống")
  try {
    const row = await d1
      .prepare("INSERT INTO players (name, created_at) VALUES (?, ?) RETURNING *")
      .bind(name, nowIso())
      .first<PlayerRow>()
    return row!
  } catch (e) {
    if (isUnique(e)) throw new ConflictError("Tên này đã có trong danh sách")
    throw e
  }
}

export async function renamePlayer(d1: D1Database, id: number, rawName: string): Promise<void> {
  const name = rawName.trim()
  if (!name) throw new ValidationError("Tên không được để trống")
  try {
    await d1.prepare("UPDATE players SET name = ? WHERE id = ?").bind(name, id).run()
  } catch (e) {
    if (isUnique(e)) throw new ConflictError("Tên này đã có trong danh sách")
    throw e
  }
}

export async function hidePlayer(d1: D1Database, id: number, hidden: boolean): Promise<void> {
  await d1.prepare("UPDATE players SET is_active = ? WHERE id = ?").bind(hidden ? 0 : 1, id).run()
}

export async function listActivePlayers(d1: D1Database): Promise<PlayerRow[]> {
  const r = await d1
    .prepare("SELECT * FROM players WHERE is_active = 1 ORDER BY lower(name), id")
    .all<PlayerRow>()
  return r.results
}

export async function getPlayer(d1: D1Database, id: number): Promise<PlayerRow | null> {
  return d1.prepare("SELECT * FROM players WHERE id = ?").bind(id).first<PlayerRow>()
}

// ---------- matches ----------

export type MatchInput = { format: number; pitch: string; kickoff_at: string; note?: string | null }

function validateMatch(input: MatchInput): { format: 5 | 7; pitch: string; kickoff_at: string; note: string | null } {
  if (input.format !== 5 && input.format !== 7) throw new ValidationError("Thể thức phải là 5v5 hoặc 7v7")
  const pitch = input.pitch.trim()
  if (!pitch) throw new ValidationError("Chưa nhập sân")
  const ms = Date.parse(input.kickoff_at)
  if (Number.isNaN(ms)) throw new ValidationError("Giờ đá không hợp lệ")
  const note = input.note?.trim() ? input.note.trim() : null
  return { format: input.format, pitch, kickoff_at: new Date(ms).toISOString(), note }
}

export async function createMatch(d1: D1Database, input: MatchInput): Promise<MatchRow> {
  const v = validateMatch(input)
  const row = await d1
    .prepare(
      "INSERT INTO matches (id, format, pitch, kickoff_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
    )
    .bind(newId(), v.format, v.pitch, v.kickoff_at, v.note, nowIso())
    .first<MatchRow>()
  return row!
}

export async function getMatch(d1: D1Database, id: string): Promise<MatchRow | null> {
  return d1.prepare("SELECT * FROM matches WHERE id = ? AND deleted_at IS NULL").bind(id).first<MatchRow>()
}

export async function updateMatch(d1: D1Database, id: string, input: MatchInput): Promise<void> {
  const v = validateMatch(input)
  await d1
    .prepare("UPDATE matches SET format = ?, pitch = ?, kickoff_at = ?, note = ?, updated_at = ? WHERE id = ?")
    .bind(v.format, v.pitch, v.kickoff_at, v.note, nowIso(), id)
    .run()
}

export async function listNotStarted(d1: D1Database): Promise<MatchRow[]> {
  const r = await d1
    .prepare("SELECT * FROM matches WHERE deleted_at IS NULL AND result IS NULL ORDER BY kickoff_at ASC")
    .all<MatchRow>()
  return r.results
}

export async function listPlayed(d1: D1Database, limit = 100): Promise<MatchRow[]> {
  const r = await d1
    .prepare(
      "SELECT * FROM matches WHERE deleted_at IS NULL AND result IS NOT NULL ORDER BY kickoff_at DESC LIMIT ?",
    )
    .bind(limit)
    .all<MatchRow>()
  return r.results
}

export async function setResult(
  d1: D1Database,
  id: string,
  r: { result: "win" | "loss"; our_score?: number | null; their_score?: number | null },
): Promise<void> {
  const our = r.our_score ?? null
  const their = r.their_score ?? null
  if ((our === null) !== (their === null)) throw new ValidationError("Nhập đủ cả hai tỉ số hoặc bỏ trống cả hai")
  if (our !== null && (!Number.isInteger(our) || !Number.isInteger(their) || our < 0 || their! < 0))
    throw new ValidationError("Tỉ số phải là số nguyên không âm")
  await d1
    .prepare("UPDATE matches SET result = ?, our_score = ?, their_score = ?, updated_at = ? WHERE id = ?")
    .bind(r.result, our, their, nowIso(), id)
    .run()
}

export async function clearResult(d1: D1Database, id: string): Promise<void> {
  await d1
    .prepare("UPDATE matches SET result = NULL, our_score = NULL, their_score = NULL, updated_at = ? WHERE id = ?")
    .bind(nowIso(), id)
    .run()
}

export async function hideMatch(d1: D1Database, id: string): Promise<void> {
  const m = await getMatch(d1, id)
  if (!m) return
  if (!canHideMatch(m, Date.now())) throw new ConflictError("Trận đã có kết quả, không thể ẩn")
  await d1.prepare("UPDATE matches SET deleted_at = ? WHERE id = ?").bind(nowIso(), id).run()
}

// ---------- signups ----------

export async function listSignups(d1: D1Database, matchId: string): Promise<SignupRow[]> {
  const r = await d1
    .prepare(
      `SELECT s.*, COALESCE(p.name, s.guest_name) AS name
       FROM signups s LEFT JOIN players p ON p.id = s.player_id
       WHERE s.match_id = ?
       ORDER BY s.is_late ASC, s.created_at ASC, s.id ASC`,
    )
    .bind(matchId)
    .all<SignupRow>()
  return r.results
}

export async function addSignup(
  d1: D1Database,
  matchId: string,
  who: { player_id?: number; guest_name?: string },
  nowMs: number,
): Promise<SignupRow> {
  const m = await getMatch(d1, matchId)
  if (!m) throw new ValidationError("Không tìm thấy trận")
  const p = phase(m as MatchCore, nowMs)
  if (p === "LOCKED") throw new ConflictError("Trận đã chốt kết quả")
  const guest = who.guest_name?.trim() || null
  if (who.player_id == null && !guest) throw new ValidationError("Thiếu tên người đăng ký")
  try {
    const row = await d1
      .prepare(
        "INSERT INTO signups (match_id, player_id, guest_name, is_late, created_at) VALUES (?, ?, ?, ?, ?) RETURNING *",
      )
      .bind(matchId, who.player_id ?? null, who.player_id == null ? guest : null, p === "OPEN" ? 0 : 1, new Date(nowMs).toISOString())
      .first<SignupRow>()
    return row!
  } catch (e) {
    if (isUnique(e)) throw new ConflictError("Đã đăng ký rồi")
    throw e
  }
}

export async function removeSignup(d1: D1Database, matchId: string, signupId: number, nowMs: number): Promise<void> {
  const m = await getMatch(d1, matchId)
  if (!m) throw new ValidationError("Không tìm thấy trận")
  if (!canRemoveSignup(m as MatchCore, nowMs)) throw new ConflictError("Đã qua giờ khoá, không thể bỏ tên")
  await d1.prepare("DELETE FROM signups WHERE id = ? AND match_id = ?").bind(signupId, matchId).run()
}

