import { env } from "cloudflare:test"
import { beforeEach, describe, expect, it } from "vitest"
import {
  addSignup, clearResult, ConflictError, createMatch, createPlayer, getMatch,
  hidePlayer, hideMatch, listActivePlayers, listNotStarted, listPlayed, listSignups,
  removeSignup, renamePlayer, setResult, updateMatch, ValidationError,
} from "../src/db"
import { resetDb } from "./setup"

const KICK = "2026-11-15T10:00:00.000Z"
const kickMs = Date.parse(KICK)
const early = kickMs - 3 * 3600_000
const late = kickMs - 30 * 60_000
const db = () => env.DB

async function newMatch(format = 5, kickoff = KICK) {
  return createMatch(db(), { format, pitch: "Sân A", kickoff_at: kickoff })
}

beforeEach(resetDb)

describe("players", () => {
  it("tạo, liệt kê, đổi tên, ẩn", async () => {
    const a = await createPlayer(db(), "  An ")
    await createPlayer(db(), "Bình")
    expect((await listActivePlayers(db())).map((p) => p.name)).toEqual(["An", "Bình"])
    await renamePlayer(db(), a.id, "Anh")
    await hidePlayer(db(), a.id, true)
    expect((await listActivePlayers(db())).map((p) => p.name)).toEqual(["Bình"])
    await hidePlayer(db(), a.id, false)
    expect(await listActivePlayers(db())).toHaveLength(2)
  })
  it("tên trùng (không phân biệt hoa thường) bị chặn; tên rỗng bị chặn", async () => {
    await createPlayer(db(), "An")
    await expect(createPlayer(db(), " an ")).rejects.toBeInstanceOf(ConflictError)
    await expect(createPlayer(db(), "  ")).rejects.toBeInstanceOf(ValidationError)
  })
})

describe("matches", () => {
  it("tạo trận hợp lệ, id nanoid 10 ký tự thường", async () => {
    const m = await newMatch(7)
    expect(m.id).toMatch(/^[a-z0-9_-]{10}$/)
    expect(m.format).toBe(7)
    expect((await getMatch(db(), m.id))?.pitch).toBe("Sân A")
  })
  it("validate format, pitch, kickoff", async () => {
    await expect(createMatch(db(), { format: 6, pitch: "A", kickoff_at: KICK })).rejects.toBeInstanceOf(ValidationError)
    await expect(createMatch(db(), { format: 5, pitch: " ", kickoff_at: KICK })).rejects.toBeInstanceOf(ValidationError)
    await expect(createMatch(db(), { format: 5, pitch: "A", kickoff_at: "xx" })).rejects.toBeInstanceOf(ValidationError)
  })
  it("updateMatch đổi thông tin", async () => {
    const m = await newMatch()
    await updateMatch(db(), m.id, { format: 7, pitch: "Sân B", kickoff_at: KICK, note: "mang áo trắng" })
    const g = await getMatch(db(), m.id)
    expect([g?.format, g?.pitch, g?.note]).toEqual([7, "Sân B", "mang áo trắng"])
  })
  it("listNotStarted tăng dần theo giờ; listPlayed giảm dần; trận ẩn bị loại", async () => {
    const a = await newMatch(5, "2026-11-16T10:00:00.000Z")
    const b = await newMatch(5, "2026-11-15T10:00:00.000Z")
    expect((await listNotStarted(db())).map((m) => m.id)).toEqual([b.id, a.id])
    await setResult(db(), b.id, { result: "win" })
    await setResult(db(), a.id, { result: "loss" })
    expect((await listPlayed(db(), 10)).map((m) => m.id)).toEqual([a.id, b.id])
    await clearResult(db(), a.id)
    await hideMatch(db(), a.id)
    expect((await listNotStarted(db())).map((m) => m.id)).toEqual([])
  })
  it("hideMatch từ chối trận đã có kết quả", async () => {
    const m = await newMatch()
    await setResult(db(), m.id, { result: "win" })
    await expect(hideMatch(db(), m.id)).rejects.toBeInstanceOf(ConflictError)
  })
})

describe("result", () => {
  it("tỉ số phải cùng có hoặc cùng không", async () => {
    const m = await newMatch()
    await expect(setResult(db(), m.id, { result: "win", our_score: 3 })).rejects.toBeInstanceOf(ValidationError)
    await expect(setResult(db(), m.id, { result: "win", our_score: -1, their_score: 0 })).rejects.toBeInstanceOf(ValidationError)
    await setResult(db(), m.id, { result: "win", our_score: 3, their_score: 1 })
    const g = await getMatch(db(), m.id)
    expect([g?.result, g?.our_score, g?.their_score]).toEqual(["win", 3, 1])
  })
  it("clearResult xoá kết quả và tỉ số", async () => {
    const m = await newMatch()
    await setResult(db(), m.id, { result: "loss", our_score: 0, their_score: 2 })
    await clearResult(db(), m.id)
    const g = await getMatch(db(), m.id)
    expect([g?.result, g?.our_score, g?.their_score]).toEqual([null, null, null])
  })
})

describe("signups", () => {
  it("đăng ký trước giờ khoá: is_late = 0; sau giờ khoá: is_late = 1", async () => {
    const m = await newMatch()
    const p = await createPlayer(db(), "An")
    const q = await createPlayer(db(), "Bình")
    await addSignup(db(), m.id, { player_id: p.id }, early)
    await addSignup(db(), m.id, { player_id: q.id }, late)
    const s = await listSignups(db(), m.id)
    expect(s.map((x) => [x.name, x.is_late])).toEqual([["An", 0], ["Bình", 1]])
  })
  it("không đăng ký trùng; khách có tên riêng", async () => {
    const m = await newMatch()
    const p = await createPlayer(db(), "An")
    await addSignup(db(), m.id, { player_id: p.id }, early)
    await expect(addSignup(db(), m.id, { player_id: p.id }, early)).rejects.toBeInstanceOf(ConflictError)
    await addSignup(db(), m.id, { guest_name: "Khách 1" }, early)
    expect((await listSignups(db(), m.id)).map((x) => x.name)).toEqual(["An", "Khách 1"])
  })
  it("trận đã có kết quả (LOCKED) từ chối đăng ký", async () => {
    const m = await newMatch()
    const p = await createPlayer(db(), "An")
    await setResult(db(), m.id, { result: "win" })
    await expect(addSignup(db(), m.id, { player_id: p.id }, early)).rejects.toBeInstanceOf(ConflictError)
  })
  it("bỏ tên chỉ được trước giờ khoá", async () => {
    const m = await newMatch()
    const p = await createPlayer(db(), "An")
    const s = await addSignup(db(), m.id, { player_id: p.id }, early)
    await expect(removeSignup(db(), m.id, s.id, late)).rejects.toBeInstanceOf(ConflictError)
    await removeSignup(db(), m.id, s.id, early)
    expect(await listSignups(db(), m.id)).toHaveLength(0)
  })
  it("thứ tự: đăng ký đúng hạn trước, đăng ký muộn sau", async () => {
    const m = await newMatch()
    const a = await createPlayer(db(), "An")
    const b = await createPlayer(db(), "Bình")
    await addSignup(db(), m.id, { player_id: a.id }, late)
    await addSignup(db(), m.id, { player_id: b.id }, early)
    expect((await listSignups(db(), m.id)).map((x) => x.name)).toEqual(["Bình", "An"])
  })
})
