import { env } from "cloudflare:test"
import { beforeEach, describe, expect, it } from "vitest"
import app from "../src/index"
import { createMatch, setResult } from "../src/db"
import { resetDb } from "./setup"

const req = (path: string) => app.request(path, undefined, env)
beforeEach(resetDb)

describe("/history", () => {
  it("trạng thái trống", async () => {
    const res = await req("/history")
    expect(res.status).toBe(200)
    expect(await res.text()).toContain("Chưa có trận nào")
  })
  it("hiện tỉ lệ thắng, KPI, chuỗi và danh sách", async () => {
    const days = ["10", "11", "12", "13"]
    const results = ["loss", "win", "win", "win"] as const
    for (let i = 0; i < 4; i++) {
      const m = await createMatch(env.DB, { format: 5, pitch: `Sân ${i}`, kickoff_at: `2020-11-${days[i]}T10:00:00.000Z` })
      await setResult(env.DB, m.id, { result: results[i], our_score: 2, their_score: 1 })
    }
    const html = await (await req("/history")).text()
    expect(html).toContain("75%")
    expect(html).toContain("Thắng")
    expect(html).toContain("Chuỗi")
    expect(html).toContain("3")
    expect(html).toContain("Sân 3")
  })
})
