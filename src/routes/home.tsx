import { Hono } from "hono"
import type { Bindings } from "../index"
import {
  ConflictError, createMatch, listNotStarted, listPlayed, listSignups, ValidationError,
  type MatchRow,
} from "../db"
import { computeStats } from "../stats"
import { countdownText, formatKickoffVN, parseLocalDatetimeVN } from "../format"
import { phase } from "../rules"
import { Layout } from "../layout"

export const home = new Hono<{ Bindings: Bindings }>()

async function signedCount(d1: D1Database, id: string): Promise<number> {
  return (await listSignups(d1, id)).length
}

function CreateForm(props: { error?: string; values?: Record<string, string> }) {
  const v = props.values ?? {}
  return (
    <Layout title="Tạo trận" active="home">
      <h1>Tạo trận</h1>
      {props.error ? <div class="flash error">{props.error}</div> : null}
      <form method="post" action="/matches">
        <div class="field">
          <span>Thể thức</span>
          <select name="format">
            <option value="5" selected={v.format !== "7"}>5v5 (10 chỗ)</option>
            <option value="7" selected={v.format === "7"}>7v7 (14 chỗ)</option>
          </select>
        </div>
        <label class="field">
          <span>Sân</span>
          <input name="pitch" value={v.pitch ?? ""} placeholder="Tên sân" />
        </label>
        <label class="field">
          <span>Giờ đá (giờ Việt Nam)</span>
          <input type="datetime-local" name="kickoff" value={v.kickoff ?? ""} />
        </label>
        <label class="field">
          <span>Ghi chú</span>
          <input name="note" value={v.note ?? ""} />
        </label>
        <p class="muted">Đăng ký đóng trước giờ đá 60 phút.</p>
        <button class="btn" type="submit">Tạo trận</button>
      </form>
    </Layout>
  )
}

home.get("/", async (c) => {
  const d1 = c.env.DB
  const now = Date.now()
  const upcoming = await listNotStarted(d1)
  const played = await listPlayed(d1, 100)
  const stats = computeStats(played.map((m) => ({ result: m.result!, kickoff_at: m.kickoff_at })))
  const next = upcoming[0] as MatchRow | undefined
  const nextCount = next ? await signedCount(d1, next.id) : 0
  const recent = played.slice(0, 5)

  return c.html(
    <Layout title="Trận" active="home">
      <h1>Futball TKF</h1>
      {next ? (
        <a href={`/m/${next.id}`} style="text-decoration:none">
          <div class="hero">
            <div class="muted" style="color:inherit;opacity:.7">
              {formatKickoffVN(next.kickoff_at)} · {next.pitch} · {next.format}v{next.format}
            </div>
            <div class="big">{nextCount}/{next.format * 2}</div>
            <div class={`bar on-accent`} style="margin:12px 0">
              <i style={`width:${Math.min(100, (nextCount / (next.format * 2)) * 100)}%`} />
            </div>
            <div>
              {phase(next, now) === "OPEN" ? countdownText(new Date(Date.parse(next.kickoff_at) - 3600_000).toISOString(), now).replace("còn", "Đóng đăng ký sau") : "Đã khoá đăng ký"}
            </div>
          </div>
        </a>
      ) : (
        <div class="panel">
          <h2>Chưa có trận nào sắp tới</h2>
          <p class="muted">Tạo trận để mọi người đăng ký.</p>
        </div>
      )}
      <a class="btn" href="/matches/new">+ Tạo trận</a>

      {upcoming.length > 1 ? (
        <>
          <h2>Sắp tới</h2>
          <div class="panel">
            {upcoming.slice(1).map((m) => (
              <a class="row" href={`/m/${m.id}`} style="text-decoration:none">
                <span>{formatKickoffVN(m.kickoff_at)} · {m.pitch}</span>
                <span class="muted">{m.format}v{m.format}</span>
              </a>
            ))}
          </div>
        </>
      ) : null}

      <h2>Phong độ</h2>
      <div class="panel">
        {stats.total === 0 ? (
          <p class="muted">Chưa có trận nào được ghi kết quả.</p>
        ) : (
          <div class="row">
            <span><span class="win">{stats.wins} thắng</span> · <span class="loss">{stats.losses} thua</span></span>
            <span class="muted">{Math.round(stats.winRate * 100)}%</span>
          </div>
        )}
      </div>

      {recent.length > 0 ? (
        <>
          <h2>Gần đây</h2>
          <div class="panel">
            {recent.map((m) => (
              <a class="row" href={`/m/${m.id}`} style="text-decoration:none">
                <span>{formatKickoffVN(m.kickoff_at)} · {m.pitch}</span>
                <span class={m.result === "win" ? "win" : "loss"}>
                  {m.result === "win" ? "Thắng" : "Thua"}
                  {m.our_score !== null ? ` ${m.our_score}-${m.their_score}` : ""}
                </span>
              </a>
            ))}
          </div>
        </>
      ) : null}
    </Layout>,
  )
})

home.get("/matches/new", (c) => c.html(<CreateForm />))

home.post("/matches", async (c) => {
  const body = await c.req.parseBody()
  const values = Object.fromEntries(
    ["format", "pitch", "kickoff", "note"].map((k) => [k, typeof body[k] === "string" ? (body[k] as string) : ""]),
  )
  try {
    const kickoff_at = parseLocalDatetimeVN(values.kickoff)
    if (!kickoff_at) throw new ValidationError("Giờ đá không hợp lệ")
    const m = await createMatch(c.env.DB, {
      format: Number(values.format),
      pitch: values.pitch,
      kickoff_at,
      note: values.note,
    })
    return c.redirect(`/m/${m.id}`, 303)
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ConflictError) {
      c.status(400)
      return c.html(<CreateForm error={e.message} values={values} />)
    }
    throw e
  }
})
