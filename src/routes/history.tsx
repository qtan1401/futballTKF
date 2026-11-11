import { Hono } from "hono"
import type { Bindings } from "../index"
import { listPlayed } from "../db"
import { computeStats } from "../stats"
import { formatKickoffVN } from "../format"
import { Layout } from "../layout"

export const history = new Hono<{ Bindings: Bindings }>()

history.get("/history", async (c) => {
  const played = await listPlayed(c.env.DB, 500)
  const stats = computeStats(played.map((m) => ({ result: m.result!, kickoff_at: m.kickoff_at })))

  if (stats.total === 0) {
    return c.html(
      <Layout title="Lịch sử" active="history">
        <h1>Lịch sử</h1>
        <div class="panel">
          <h2 style="margin-top:0">Chưa có trận nào</h2>
          <p class="muted">Kết quả các trận đã đá sẽ hiện ở đây.</p>
        </div>
      </Layout>,
    )
  }

  const pct = Math.round(stats.winRate * 100)
  const form = played.slice(0, 8).reverse()
  const byFormat = ([5, 7] as const).map((f) => {
    const list = played.filter((m) => m.format === f)
    const s = computeStats(list.map((m) => ({ result: m.result!, kickoff_at: m.kickoff_at })))
    return { f, s }
  })

  return c.html(
    <Layout title="Lịch sử" active="history">
      <h1>Lịch sử</h1>
      <div class="hero">
        <div class="big">{pct}%</div>
        <div style="opacity:.8">tỉ lệ thắng · {stats.total} trận</div>
        <div class="bar on-accent" style="margin-top:12px"><i style={`width:${pct}%`} /></div>
      </div>

      <div class="panel">
        <div class="row"><span class="muted">Thắng</span><span class="win num">{stats.wins}</span></div>
        <div class="row"><span class="muted">Thua</span><span class="loss num">{stats.losses}</span></div>
        <div class="row">
          <span class="muted">Chuỗi hiện tại</span>
          <span class={`num ${stats.currentStreak?.type === "win" ? "win" : "loss"}`}>
            {stats.currentStreak ? `${stats.currentStreak.count} ${stats.currentStreak.type === "win" ? "thắng" : "thua"}` : "—"}
          </span>
        </div>
      </div>

      <h2>Phong độ gần đây</h2>
      <div class="panel" style="display:flex;gap:6px;align-items:flex-end;height:96px">
        {form.map((m) => (
          <div
            style={`flex:1;border-radius:6px;height:${m.result === "win" ? 72 : 36}px;background:${m.result === "win" ? "var(--win)" : "var(--loss)"}`}
            title={formatKickoffVN(m.kickoff_at)}
          />
        ))}
      </div>

      <h2>Theo thể thức</h2>
      <div class="panel">
        {byFormat.map(({ f, s }) => (
          <div class="row">
            <span>{f}v{f}</span>
            <span class="muted num">{s.total === 0 ? "—" : `${s.wins}/${s.total} thắng · ${Math.round(s.winRate * 100)}%`}</span>
          </div>
        ))}
      </div>

      <h2>Tất cả trận</h2>
      <div class="panel">
        {played.map((m) => (
          <a class="row" href={`/m/${m.id}`} style="text-decoration:none">
            <span>{formatKickoffVN(m.kickoff_at)} · {m.pitch}</span>
            <span class={m.result === "win" ? "win" : "loss"}>
              {m.result === "win" ? "Thắng" : "Thua"}
              {m.our_score !== null ? ` ${m.our_score}-${m.their_score}` : ""}
            </span>
          </a>
        ))}
      </div>
    </Layout>,
  )
})
