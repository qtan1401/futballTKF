import { Hono } from "hono"
import type { Bindings } from "../index"
import { ConflictError, createPlayer, hidePlayer, renamePlayer, ValidationError, type PlayerRow } from "../db"
import { Layout } from "../layout"

export const players = new Hono<{ Bindings: Bindings }>()

async function all(d1: D1Database): Promise<PlayerRow[]> {
  const r = await d1.prepare("SELECT * FROM players ORDER BY is_active DESC, lower(name), id").all<PlayerRow>()
  return r.results
}

async function render(c: import("hono").Context<{ Bindings: Bindings }>, error?: string, status: 200 | 400 | 409 = 200) {
  const list = await all(c.env.DB)
  c.status(status)
  return c.html(
    <Layout title="Thành viên" active="players">
      <h1>Thành viên</h1>
      {error ? <div class="flash error">{error}</div> : null}
      <form method="post" action="/players" class="panel">
        <label class="field"><span>Thêm thành viên</span><input name="name" placeholder="Tên" /></label>
        <button class="btn" type="submit">Thêm</button>
      </form>
      <div class="panel">
        {list.length === 0 ? <p class="muted">Chưa có thành viên nào.</p> : null}
        {list.map((p) => (
          <div class="row">
            {p.is_active ? (
              <form method="post" action={`/players/${p.id}/rename`} style="display:flex;gap:8px;flex:1">
                <input name="name" value={p.name} />
                <button class="btn secondary" style="width:auto;min-height:48px" type="submit">Đổi tên</button>
              </form>
            ) : (
              <span class="muted">{p.name} · đã ẩn</span>
            )}
            <form method="post" action={`/players/${p.id}/${p.is_active ? "hide" : "show"}`}>
              <button class="btn secondary" style="width:auto;min-height:48px" type="submit">{p.is_active ? "Ẩn" : "Hiện lại"}</button>
            </form>
          </div>
        ))}
      </div>
      <p class="muted">Người ngoài danh sách có thể đăng ký bằng tên khách ở trang trận.</p>
    </Layout>,
  )
}

players.get("/players", (c) => render(c))

players.post("/players", async (c) => {
  const body = await c.req.parseBody()
  try {
    await createPlayer(c.env.DB, typeof body.name === "string" ? body.name : "")
    return c.redirect("/players", 303)
  } catch (e) {
    if (e instanceof ConflictError) return render(c, e.message, 409)
    if (e instanceof ValidationError) return render(c, e.message, 400)
    throw e
  }
})

players.post("/players/:id/rename", async (c) => {
  const body = await c.req.parseBody()
  try {
    await renamePlayer(c.env.DB, Number(c.req.param("id")), typeof body.name === "string" ? body.name : "")
    return c.redirect("/players", 303)
  } catch (e) {
    if (e instanceof ConflictError) return render(c, e.message, 409)
    if (e instanceof ValidationError) return render(c, e.message, 400)
    throw e
  }
})

players.post("/players/:id/hide", async (c) => {
  await hidePlayer(c.env.DB, Number(c.req.param("id")), true)
  return c.redirect("/players", 303)
})
players.post("/players/:id/show", async (c) => {
  await hidePlayer(c.env.DB, Number(c.req.param("id")), false)
  return c.redirect("/players", 303)
})

players.get("/export", async (c) => {
  const d1 = c.env.DB
  const [p, m, s] = await Promise.all([
    d1.prepare("SELECT * FROM players ORDER BY id").all(),
    d1.prepare("SELECT * FROM matches ORDER BY kickoff_at").all(),
    d1.prepare("SELECT * FROM signups ORDER BY id").all(),
  ])
  c.header("content-disposition", 'attachment; filename="futball-tkf-export.json"')
  return c.json({ exported_at: new Date().toISOString(), players: p.results, matches: m.results, signups: s.results })
})
