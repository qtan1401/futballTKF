import { env } from "cloudflare:test"
import { beforeEach, describe, expect, it } from "vitest"
import app from "../src/index"
import { createMatch, createPlayer, addSignup, listActivePlayers, hidePlayer } from "../src/db"
import { resetDb } from "./setup"

const req = (path: string, init?: RequestInit) => app.request(path, init, env)
const post = (data: Record<string, string>) => ({
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(data).toString(),
  redirect: "manual" as const,
})
beforeEach(resetDb)

describe("/players", () => {
  it("thêm thành viên, trùng tên → 409, rỗng → 400", async () => {
    expect((await req("/players", post({ name: "An" }))).status).toBe(303)
    expect((await req("/players", post({ name: " an " }))).status).toBe(409)
    expect((await req("/players", post({ name: " " }))).status).toBe(400)
    expect(await (await req("/players")).text()).toContain("An")
  })
  it("đổi tên và ẩn/hiện lại", async () => {
    const p = await createPlayer(env.DB, "An")
    await req(`/players/${p.id}/rename`, post({ name: "Anh" }))
    expect((await listActivePlayers(env.DB))[0].name).toBe("Anh")
    await req(`/players/${p.id}/hide`, post({}))
    expect(await listActivePlayers(env.DB)).toHaveLength(0)
    const html = await (await req("/players")).text()
    expect(html).toContain("đã ẩn")
    await req(`/players/${p.id}/show`, post({}))
    expect(await listActivePlayers(env.DB)).toHaveLength(1)
  })
})

describe("/export", () => {
  it("xuất JSON gồm players (cả người đã ẩn), matches, signups", async () => {
    const a = await createPlayer(env.DB, "An")
    const b = await createPlayer(env.DB, "Bình")
    const m = await createMatch(env.DB, { format: 5, pitch: "Sân A", kickoff_at: "2099-11-15T10:00:00.000Z" })
    await addSignup(env.DB, m.id, { player_id: a.id }, Date.now())
    await hidePlayer(env.DB, b.id, true)
    const res = await req("/export")
    expect(res.headers.get("content-type")).toContain("application/json")
    const j = (await res.json()) as { players: unknown[]; matches: unknown[]; signups: unknown[] }
    expect(j.players).toHaveLength(2)
    expect(j.matches).toHaveLength(1)
    expect(j.signups).toHaveLength(1)
  })
})
