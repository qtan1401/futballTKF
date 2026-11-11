import { env } from "cloudflare:test"
import { beforeEach, describe, expect, it } from "vitest"
import app from "../src/index"
import { listNotStarted } from "../src/db"
import { resetDb } from "./setup"

const req = (path: string, init?: RequestInit) => app.request(path, init, env)
const form = (data: Record<string, string>) => ({
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(data).toString(),
  redirect: "manual" as const,
})

beforeEach(resetDb)

describe("trang chủ & tạo trận", () => {
  it("GET / render được, có noindex và thanh điều hướng", async () => {
    const res = await req("/")
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain("noindex")
    expect(html).toContain("Lịch sử")
    expect(html).toContain("Thành viên")
  })
  it("GET /matches/new hiện form", async () => {
    const html = await (await req("/matches/new")).text()
    expect(html).toContain('name="pitch"')
    expect(html).toContain('name="kickoff"')
  })
  it("POST /matches hợp lệ → 303 /m/:id và lưu giờ UTC", async () => {
    const res = await req("/matches", form({ format: "7", pitch: "Sân A", kickoff: "2026-11-15T17:00" }))
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toMatch(/^\/m\/[a-z0-9]{10}$/)
    const [m] = await listNotStarted(env.DB)
    expect(m.kickoff_at).toBe("2026-11-15T10:00:00.000Z")
    expect(m.format).toBe(7)
  })
  it("POST /matches thiếu sân → 400 thông báo tiếng Việt", async () => {
    const res = await req("/matches", form({ format: "5", pitch: " ", kickoff: "2026-11-15T17:00" }))
    expect(res.status).toBe(400)
    expect(await res.text()).toContain("Chưa nhập sân")
  })
  it("trận sắp tới hiện ở trang chủ", async () => {
    await req("/matches", form({ format: "5", pitch: "Sân Z", kickoff: "2099-11-15T17:00" }))
    expect(await (await req("/")).text()).toContain("Sân Z")
  })
})
