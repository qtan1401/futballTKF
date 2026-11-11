import { env } from "cloudflare:test"
import { beforeEach, describe, expect, it } from "vitest"
import app from "../src/index"
import { createMatch, getMatch, listNotStarted } from "../src/db"
import { resetDb } from "./setup"

const req = (path: string, init?: RequestInit) => app.request(path, init, env)
const post = (data: Record<string, string>) => ({
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(data).toString(),
  redirect: "manual" as const,
})
const FUTURE = "2099-11-15T10:00:00.000Z"
const PAST = "2020-11-15T10:00:00.000Z"
const mk = (k: string) => createMatch(env.DB, { format: 5, pitch: "Sân A", kickoff_at: k })

beforeEach(resetDb)

describe("kết quả", () => {
  it("chưa đến giờ đá thì không nhập được kết quả", async () => {
    const m = await mk(FUTURE)
    expect((await req(`/m/${m.id}/result`, post({ result: "win" }))).status).toBe(409)
  })
  it("nhập thắng kèm tỉ số", async () => {
    const m = await mk(PAST)
    const res = await req(`/m/${m.id}/result`, post({ result: "win", our_score: "3", their_score: "1" }))
    expect(res.status).toBe(303)
    const g = await getMatch(env.DB, m.id)
    expect([g?.result, g?.our_score, g?.their_score]).toEqual(["win", 3, 1])
  })
  it("tỉ số nhập một nửa → 400", async () => {
    const m = await mk(PAST)
    expect((await req(`/m/${m.id}/result`, post({ result: "loss", our_score: "2", their_score: "" }))).status).toBe(400)
  })
  it("không có tỉ số vẫn lưu", async () => {
    const m = await mk(PAST)
    await req(`/m/${m.id}/result`, post({ result: "loss", our_score: "", their_score: "" }))
    expect((await getMatch(env.DB, m.id))?.result).toBe("loss")
  })
  it("sửa kết quả và xoá kết quả", async () => {
    const m = await mk(PAST)
    await req(`/m/${m.id}/result`, post({ result: "win", our_score: "1", their_score: "0" }))
    await req(`/m/${m.id}/result`, post({ result: "loss", our_score: "0", their_score: "2" }))
    expect((await getMatch(env.DB, m.id))?.result).toBe("loss")
    await req(`/m/${m.id}/result/clear`, post({}))
    expect((await getMatch(env.DB, m.id))?.result).toBeNull()
  })
})

describe("sửa & ẩn trận", () => {
  it("GET /m/:id/edit có form điền sẵn", async () => {
    const m = await mk(FUTURE)
    const html = await (await req(`/m/${m.id}/edit`)).text()
    expect(html).toContain("Sân A")
    expect(html).toContain("2099-11-15T17:00")
  })
  it("POST /m/:id/edit đổi thông tin trước giờ khoá", async () => {
    const m = await mk(FUTURE)
    const res = await req(`/m/${m.id}/edit`, post({ format: "7", pitch: "Sân B", kickoff: "2099-11-16T18:00", note: "x" }))
    expect(res.status).toBe(303)
    const g = await getMatch(env.DB, m.id)
    expect([g?.format, g?.pitch, g?.kickoff_at]).toEqual([7, "Sân B", "2099-11-16T11:00:00.000Z"])
  })
  it("sau giờ khoá không sửa được thông tin", async () => {
    const m = await mk(PAST)
    expect((await req(`/m/${m.id}/edit`, post({ format: "5", pitch: "Z", kickoff: "2099-11-16T18:00" }))).status).toBe(409)
  })
  it("ẩn trận chưa có kết quả → trận biến khỏi danh sách; không ẩn được trận có kết quả", async () => {
    const a = await mk(FUTURE)
    expect((await req(`/m/${a.id}/hide`, post({}))).status).toBe(303)
    expect(await listNotStarted(env.DB)).toHaveLength(0)
    const b = await mk(PAST)
    await req(`/m/${b.id}/result`, post({ result: "win" }))
    expect((await req(`/m/${b.id}/hide`, post({}))).status).toBe(409)
  })
})
