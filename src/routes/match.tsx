import { Hono } from "hono"
import { getCookie, setCookie, deleteCookie } from "hono/cookie"
import type { Context } from "hono"
import type { Bindings } from "../index"
import {
  addSignup, ConflictError, getMatch, getPlayer, listActivePlayers, listSignups, removeSignup,
  ValidationError, type MatchRow, type PlayerRow, type SignupRow,
} from "../db"
import { countdownText, formatKickoffVN, formatLockTimeVN } from "../format"
import { canAddSignup, canRemoveSignup, phase } from "../rules"
import { Layout } from "../layout"

export const matchRoutes = new Hono<{ Bindings: Bindings }>()

type Ctx = Context<{ Bindings: Bindings }>
const COOKIE = "tkf_me"

export async function getMe(c: Ctx): Promise<PlayerRow | null> {
  const raw = getCookie(c, COOKIE)
  const id = raw ? Number(raw) : NaN
  if (!Number.isInteger(id)) return null
  const p = await getPlayer(c.env.DB, id)
  return p && p.is_active ? p : null
}
export function setMeCookie(c: Ctx, playerId: number) {
  setCookie(c, COOKIE, String(playerId), { httpOnly: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 365 })
}
export function clearMeCookie(c: Ctx) {
  deleteCookie(c, COOKIE, { path: "/" })
}

export async function renderMatch(
  c: Ctx,
  m: MatchRow,
  opts: { error?: string; status?: 200 | 400 | 409 } = {},
) {
  const now = Date.now()
  const [signups, players, me] = await Promise.all([
    listSignups(c.env.DB, m.id),
    listActivePlayers(c.env.DB),
    getMe(c),
  ])
  const slots = m.format * 2
  const p = phase(m, now)
  const confirmed = signups.slice(0, slots)
  const waiting = signups.slice(slots)
  const taken = new Set(signups.map((s) => s.player_id))
  const mine = me ? signups.find((s) => s.player_id === me.id) : undefined
  const add = canAddSignup(m, now)
  const canLeave = canRemoveSignup(m, now)
  const free = Math.max(0, slots - confirmed.length)

  const row = (s: SignupRow, wait: boolean) => (
    <div class="row">
      <span>
        {s.name}
        {s.is_late ? <span class="late"> · muộn</span> : null}
        {wait ? <span class="muted"> · chờ</span> : null}
      </span>
      {canLeave && s.id === mine?.id ? (
        <form method="post" action={`/m/${m.id}/leave`}>
          <input type="hidden" name="signup_id" value={String(s.id)} />
          <button class="btn secondary" style="min-height:36px;padding:6px 12px;width:auto" type="submit">Bỏ tên</button>
        </form>
      ) : null}
    </div>
  )

  c.status(opts.status ?? 200)
  return c.html(
    <Layout title={`${m.pitch} · ${formatKickoffVN(m.kickoff_at)}`} active="home">
      <a href="/" class="muted">← Trận</a>
      <h1>{m.pitch}</h1>
      <div class="muted">{formatKickoffVN(m.kickoff_at)} · {m.format}v{m.format}</div>
      {m.note ? <p>{m.note}</p> : null}
      {opts.error ? <div class="flash error">{opts.error}</div> : null}

      <div class="hero">
        <div class="big">{confirmed.length}/{slots}</div>
        <div class="bar on-accent" style="margin:12px 0">
          <i style={`width:${Math.min(100, (confirmed.length / slots) * 100)}%`} />
        </div>
        <div>
          {m.result ? "Đã có kết quả" : free > 0 ? `${free} chỗ còn lại` : `Đủ người · ${waiting.length} chờ`}
        </div>
        <div style="opacity:.7;margin-top:4px">
          {p === "OPEN"
            ? `Đóng đăng ký lúc ${formatLockTimeVN(m.kickoff_at)} (${countdownText(new Date(Date.parse(m.kickoff_at) - 3600_000).toISOString(), now)})`
            : p === "LATE"
              ? "Đã qua giờ khoá: vẫn đăng ký được, sẽ đánh dấu muộn"
              : "Trận đã chốt"}
        </div>
      </div>

      {m.result ? (
        <div class="panel">
          <span class={m.result === "win" ? "win" : "loss"}>{m.result === "win" ? "Thắng" : "Thua"}</span>
          {m.our_score !== null ? <span class="num"> {m.our_score} – {m.their_score}</span> : null}
        </div>
      ) : null}

      {add.allowed && !mine ? (
        <form method="post" action={`/m/${m.id}/signup`} class="panel">
          {me ? (
            <>
              <input type="hidden" name="player_id" value={String(me.id)} />
              <button class="btn" type="submit">Tôi tham gia ({me.name})</button>
            </>
          ) : (
            <>
              <label class="field">
                <span>Bạn là ai?</span>
                <select name="player_id">
                  <option value="">Chọn tên…</option>
                  {players.filter((pl) => !taken.has(pl.id)).map((pl) => (
                    <option value={String(pl.id)}>{pl.name}</option>
                  ))}
                </select>
              </label>
              <button class="btn" type="submit">Tôi tham gia</button>
              <label class="field">
                <span>Hoặc đăng ký tên khách</span>
                <input name="guest_name" placeholder="Tên khách" />
              </label>
              <button class="btn secondary" type="submit">Đăng ký khách</button>
            </>
          )}
        </form>
      ) : null}

      <h2>Danh sách ({signups.length})</h2>
      <div class="panel">
        {signups.length === 0 ? <p class="muted">Chưa ai đăng ký.</p> : null}
        {confirmed.map((s) => row(s, false))}
        {waiting.map((s) => row(s, true))}
      </div>
    </Layout>,
  )
}

matchRoutes.get("/m/:id", async (c) => {
  const m = await getMatch(c.env.DB, c.req.param("id"))
  if (!m) return c.text("Không tìm thấy trận", 404)
  return renderMatch(c, m)
})

matchRoutes.post("/m/:id/signup", async (c) => {
  const m = await getMatch(c.env.DB, c.req.param("id"))
  if (!m) return c.text("Không tìm thấy trận", 404)
  const body = await c.req.parseBody()
  const pid = typeof body.player_id === "string" && body.player_id ? Number(body.player_id) : undefined
  const guest = typeof body.guest_name === "string" ? body.guest_name : undefined
  try {
    if (pid !== undefined) {
      const pl = await getPlayer(c.env.DB, pid)
      if (!pl || !pl.is_active) throw new ValidationError("Không tìm thấy người chơi")
      await addSignup(c.env.DB, m.id, { player_id: pid }, Date.now())
      setMeCookie(c, pid)
    } else {
      await addSignup(c.env.DB, m.id, { guest_name: guest }, Date.now())
    }
    return c.redirect(`/m/${m.id}`, 303)
  } catch (e) {
    if (e instanceof ConflictError) return renderMatch(c, m, { error: e.message, status: 409 })
    if (e instanceof ValidationError) return renderMatch(c, m, { error: e.message, status: 400 })
    throw e
  }
})

matchRoutes.post("/m/:id/leave", async (c) => {
  const m = await getMatch(c.env.DB, c.req.param("id"))
  if (!m) return c.text("Không tìm thấy trận", 404)
  const body = await c.req.parseBody()
  try {
    await removeSignup(c.env.DB, m.id, Number(body.signup_id), Date.now())
    return c.redirect(`/m/${m.id}`, 303)
  } catch (e) {
    if (e instanceof ConflictError) return renderMatch(c, m, { error: e.message, status: 409 })
    if (e instanceof ValidationError) return renderMatch(c, m, { error: e.message, status: 400 })
    throw e
  }
})
