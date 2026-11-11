import { env } from "cloudflare:test"
import { beforeEach, describe, expect, it } from "vitest"
import { resetDb } from "./setup"

const ISO = "2026-11-15T10:00:00.000Z"

async function insertPlayer(name: string) {
  return env.DB.prepare("INSERT INTO players (name, created_at) VALUES (?1, ?2)").bind(name, ISO).run()
}

async function insertMatch(overrides: Partial<Record<string, unknown>> = {}) {
  const row = {
    id: "m1234567ab",
    format: 7,
    pitch: "K34",
    kickoff_at: ISO,
    result: null,
    our_score: null,
    their_score: null,
    ...overrides,
  }
  return env.DB.prepare(
    "INSERT INTO matches (id, format, pitch, kickoff_at, result, our_score, their_score, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
  )
    .bind(row.id, row.format, row.pitch, row.kickoff_at, row.result, row.our_score, row.their_score, ISO)
    .run()
}

describe("schema D1 đúng spec §9", () => {
  beforeEach(async () => {
    await resetDb()
  })

  it("chặn trùng tên thành viên (khác hoa/thường, thừa khoảng trắng)", async () => {
    await insertPlayer("An")
    await expect(insertPlayer("  an ")).rejects.toThrow()
  })

  it("result chỉ nhận 'win' hoặc 'loss'", async () => {
    await expect(insertMatch({ result: "draw" })).rejects.toThrow()
  })

  it("format khác 5 và 7 bị từ chối", async () => {
    await expect(insertMatch({ format: 6 })).rejects.toThrow()
  })

  it("kickoff_at thiếu bị từ chối", async () => {
    await expect(insertMatch({ kickoff_at: null })).rejects.toThrow()
  })

  it("tỷ số nửa vời (chỉ our_score) bị từ chối", async () => {
    await expect(insertMatch({ our_score: 3, their_score: null })).rejects.toThrow()
  })

  it("cho phép tỷ số bằng nhau 2-2 với result='win'", async () => {
    await expect(insertMatch({ result: "win", our_score: 2, their_score: 2 })).resolves.toBeDefined()
  })

  it("một người chỉ đăng ký một lần trong một trận", async () => {
    await insertPlayer("An")
    const player = await env.DB.prepare("SELECT id FROM players WHERE name = 'An'").first<{ id: number }>()
    await insertMatch()
    const signup = (playerId: number) =>
      env.DB.prepare("INSERT INTO signups (match_id, player_id, created_at) VALUES (?1, ?2, ?3)")
        .bind("m1234567ab", playerId, ISO)
        .run()
    await expect(signup(player!.id)).resolves.toBeDefined()
    await expect(signup(player!.id)).rejects.toThrow()
  })
})
