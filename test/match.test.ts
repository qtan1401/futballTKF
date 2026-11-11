import { env } from "cloudflare:test"
import { beforeEach, describe, expect, it } from "vitest"
import app from "../src/index"
import { createMatch, createPlayer, listSignups } from "../src/db"
import { resetDb } from "./setup"

const req = (path: string, init?: RequestInit) => app.request(path, init, env)
const post = (data: Record<string, string>, cookie?: string) => ({
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded", ...(cookie ? { cookie } : {}) },
  body: new URLSearchParams(data).toString(),
  redirect: "manual" as const,
})
const FUTURE = "2099-11-15T10:00:00.000Z"
const PAST = "2020-11-15T10:00:00.000Z"

beforeEach(resetDb)

async function setup(kickoff = FUTURE, format = 5) {
  const m = await createMatch(env.DB, { format, pitch: "Sân A", kickoff_at: kickoff })
  const p = await createPlayer(env.DB, "An")
  return { m, p }
}

describe("trang trận", () => {
  it("404 khi không có trận", async () => {
    expect((await req("/m/khongtonta1")).status).toBe(404)
  })
  it("hiển thị sân, chỗ trống và danh sách người chơi", async () => {
    const { m } = await setup()
    const html = await (await req(`/m/${m.id}`)).text()
    expect(html).toContain("Sân A")
    expect(html).toContain("0/10")
    expect(html).toContain("An")
  })
  it("đăng ký → 303, đặt cookie tkf_me HttpOnly, hiện tên trong danh sách", async () => {
    const { m, p } = await setup()
    const res = await req(`/m/${m.id}/signup`, post({ player_id: String(p.id) }))
    expect(res.status).toBe(303)
    const cookie = res.headers.get("set-cookie") ?? ""
    expect(cookie).toContain(`tkf_me=${p.id}`)
    expect(cookie.toLowerCase()).toContain("httponly")
    expect(await listSignups(env.DB, m.id)).toHaveLength(1)
  })
  it("đăng ký lần hai → 409", async () => {
    const { m, p } = await setup()
    await req(`/m/${m.id}/signup`, post({ player_id: String(p.id) }))
    const res = await req(`/m/${m.id}/signup`, post({ player_id: String(p.id) }))
    expect(res.status).toBe(409)
  })
  it("đủ chỗ thì người sau vào danh sách chờ", async () => {
    const { m } = await setup()
    for (let i = 0; i < 11; i++) {
      const pl = await createPlayer(env.DB, `P${i}`)
      await req(`/m/${m.id}/signup`, post({ player_id: String(pl.id) }))
    }
    const html = await (await req(`/m/${m.id}`)).text()
    expect(html).toContain("10/10")
    expect(html).toContain("chờ")
  })
  it("bỏ tên trước giờ khoá thì được", async () => {
    const { m, p } = await setup()
    await req(`/m/${m.id}/signup`, post({ player_id: String(p.id) }))
    const [s] = await listSignups(env.DB, m.id)
    const res = await req(`/m/${m.id}/leave`, post({ signup_id: String(s.id) }))
    expect(res.status).toBe(303)
    expect(await listSignups(env.DB, m.id)).toHaveLength(0)
  })
  it("sau giờ khoá: đăng ký vẫn được, đánh dấu muộn; bỏ tên bị từ chối", async () => {
    const { m, p } = await setup(new Date(Date.now() + 30 * 60_000).toISOString())
    await req(`/m/${m.id}/signup`, post({ player_id: String(p.id) }))
    const [s] = await listSignups(env.DB, m.id)
    expect(s.is_late).toBe(1)
    expect((await req(`/m/${m.id}/leave`, post({ signup_id: String(s.id) }))).status).toBe(409)
    expect(await (await req(`/m/${m.id}`)).text()).toContain("muộn")
  })
  it("khách đăng ký bằng tên", async () => {
    const { m } = await setup()
    const res = await req(`/m/${m.id}/signup`, post({ guest_name: "Khách Hùng" }))
    expect(res.status).toBe(303)
    expect(await (await req(`/m/${m.id}`)).text()).toContain("Khách Hùng")
  })
  it("trận quá khứ chưa kết quả vẫn mở trang; trận đã có kết quả từ chối đăng ký", async () => {
    const { m, p } = await setup(PAST)
    expect((await req(`/m/${m.id}`)).status).toBe(200)
    await env.DB.prepare("UPDATE matches SET result='win' WHERE id=?").bind(m.id).run()
    expect((await req(`/m/${m.id}/signup`, post({ player_id: String(p.id) }))).status).toBe(409)
  })
})
