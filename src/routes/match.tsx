import { Hono } from "hono"
import { getCookie, setCookie, deleteCookie } from "hono/cookie"
import type { Context } from "hono"
import type { Bindings } from "../index"
import {
  addSignup, clearResult, ConflictError, getMatch, getPlayer, hideMatch, listActivePlayers, listSignups,
  removeSignup, setResult, updateMatch, ValidationError, type MatchRow, type PlayerRow, type SignupRow,
} from "../db"
import { countdownText, formatKickoffVN, formatLockTimeVN, parseLocalDatetimeVN, toLocalInputVN } from "../format"
import { canAddSignup, canEditMatchInfo, canEditResult, canEnterResult, canHideMatch, canRemoveSignup, phase } from "../rules"
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

      {canEnterResult(m, now) || canEditResult(m, now) ? (
        <form method="post" action={`/m/${m.id}/result`} class="panel">
          <h2 style="margin-top:0">{m.result ? "Sửa kết quả" : "Ghi kết quả"}</h2>
          <div style="display:flex;gap:8px">
            <label class="field" style="flex:1"><span>Ta</span>
              <input name="our_score" inputmode="numeric" value={m.our_score === null ? "" : String(m.our_score)} /></label>
            <label class="field" style="flex:1"><span>Đối thủ</span>
              <input name="their_score" inputmode="numeric" value={m.their_score === null ? "" : String(m.their_score)} /></label>
          </div>
          <p class="muted">Tỉ số không bắt buộc, nhưng phải nhập đủ cả hai hoặc bỏ trống cả hai.</p>
          <div style="display:flex;gap:8px">
            <button class="btn" name="result" value="win" type="submit">Thắng</button>
            <button class="btn secondary" name="result" value="loss" type="submit">Thua</button>
          </div>
        </form>
      ) : null}
      {m.result ? (
        <form method="post" action={`/m/${m.id}/result/clear`}>
          <button class="btn secondary" type="submit">Xoá kết quả</button>
        </form>
      ) : null}

      <h2>Danh sách ({signups.length})</h2>
      <div class="panel">
        {signups.length === 0 ? <p class="muted">Chưa ai đăng ký.</p> : null}
        {confirmed.map((s) => row(s, false))}
        {waiting.map((s) => row(s, true))}
      </div>

      <div style="display:flex;gap:8px;margin-top:16px">
        {canEditMatchInfo(m, now) ? <a class="btn secondary" href={`/m/${m.id}/edit`}>Sửa thông tin</a> : null}
        {canHideMatch(m, now) ? (
          <form method="post" action={`/m/${m.id}/hide`} style="flex:1">
            <button class="btn secondary" type="submit">Ẩn trận</button>
          </form>
        ) : null}
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

function EditForm(props: { m: MatchRow; error?: string; values?: Record<string, string> }) {
  const v = props.values ?? {
    format: String(props.m.format),
    pitch: props.m.pitch,
    kickoff: toLocalInputVN(props.m.kickoff_at),
    note: props.m.note ?? "",
  }
  return (
    <Layout title="Sửa trận" active="home">
      <h1>Sửa trận</h1>
      {props.error ? <div class="flash error">{props.error}</div> : null}
      <form method="post" action={`/m/${props.m.id}/edit`}>
        <div class="field"><span>Thể thức</span>
          <select name="format">
            <option value="5" selected={v.format !== "7"}>5v5 (10 chỗ)</option>
            <option value="7" selected={v.format === "7"}>7v7 (14 chỗ)</option>
          </select></div>
        <label class="field"><span>Sân</span><input name="pitch" value={v.pitch} /></label>
        <label class="field"><span>Giờ đá (giờ Việt Nam)</span><input type="datetime-local" name="kickoff" value={v.kickoff} /></label>
        <label class="field"><span>Ghi chú</span><input name="note" value={v.note} /></label>
        <button class="btn" type="submit">Lưu</button>
      </form>
    </Layout>
  )
}

function asInt(v: unknown): number | null {
  if (typeof v !== "string" || v.trim() === "") return null
  const n = Number(v)
  return Number.isInteger(n) ? n : NaN
}

matchRoutes.post("/m/:id/result", async (c) => {
  const m = await getMatch(c.env.DB, c.req.param("id"))
  if (!m) return c.text("Không tìm thấy trận", 404)
  const body = await c.req.parseBody()
  const now = Date.now()
  try {
    if (!canEnterResult(m, now) && !canEditResult(m, now)) throw new ConflictError("Chưa đến giờ đá nên chưa ghi được kết quả")
    if (body.result !== "win" && body.result !== "loss") throw new ValidationError("Chọn thắng hoặc thua")
    const our = asInt(body.our_score)
    const their = asInt(body.their_score)
    if (Number.isNaN(our) || Number.isNaN(their)) throw new ValidationError("Tỉ số phải là số nguyên không âm")
    await setResult(c.env.DB, m.id, { result: body.result, our_score: our, their_score: their })
    return c.redirect(`/m/${m.id}`, 303)
  } catch (e) {
    if (e instanceof ConflictError) return renderMatch(c, m, { error: e.message, status: 409 })
    if (e instanceof ValidationError) return renderMatch(c, m, { error: e.message, status: 400 })
    throw e
  }
})

matchRoutes.post("/m/:id/result/clear", async (c) => {
  const m = await getMatch(c.env.DB, c.req.param("id"))
  if (!m) return c.text("Không tìm thấy trận", 404)
  await clearResult(c.env.DB, m.id)
  return c.redirect(`/m/${m.id}`, 303)
})

matchRoutes.get("/m/:id/edit", async (c) => {
  const m = await getMatch(c.env.DB, c.req.param("id"))
  if (!m) return c.text("Không tìm thấy trận", 404)
  return c.html(<EditForm m={m} />)
})

matchRoutes.post("/m/:id/edit", async (c) => {
  const m = await getMatch(c.env.DB, c.req.param("id"))
  if (!m) return c.text("Không tìm thấy trận", 404)
  const body = await c.req.parseBody()
  const values = Object.fromEntries(
    ["format", "pitch", "kickoff", "note"].map((k) => [k, typeof body[k] === "string" ? (body[k] as string) : ""]),
  )
  try {
    if (!canEditMatchInfo(m, Date.now())) throw new ConflictError("Đã qua giờ khoá, không sửa được thông tin trận")
    const kickoff_at = parseLocalDatetimeVN(values.kickoff)
    if (!kickoff_at) throw new ValidationError("Giờ đá không hợp lệ")
    await updateMatch(c.env.DB, m.id, { format: Number(values.format), pitch: values.pitch, kickoff_at, note: values.note })
    return c.redirect(`/m/${m.id}`, 303)
  } catch (e) {
    if (e instanceof ConflictError) { c.status(409); return c.html(<EditForm m={m} error={e.message} values={values} />) }
    if (e instanceof ValidationError) { c.status(400); return c.html(<EditForm m={m} error={e.message} values={values} />) }
    throw e
  }
})

matchRoutes.post("/m/:id/hide", async (c) => {
  const m = await getMatch(c.env.DB, c.req.param("id"))
  if (!m) return c.text("Không tìm thấy trận", 404)
  try {
    await hideMatch(c.env.DB, m.id)
    return c.redirect("/", 303)
  } catch (e) {
    if (e instanceof ConflictError) return renderMatch(c, m, { error: e.message, status: 409 })
    throw e
  }
})
