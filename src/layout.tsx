import type { Child } from "hono/jsx"
import { CSS } from "./style"

export type Tab = "home" | "history" | "players" | ""

export function Layout(props: { title: string; active?: Tab; children?: Child }) {
  const a = props.active ?? ""
  return (
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>{props.title} · Futball TKF</title>
        <style>{CSS}</style>
      </head>
      <body>
        {props.children}
        <nav class="nav">
          <a href="/" class={a === "home" ? "active" : ""}>Trận</a>
          <a href="/history" class={a === "history" ? "active" : ""}>Lịch sử</a>
          <a href="/players" class={a === "players" ? "active" : ""}>Thành viên</a>
          <a href="/export">Xuất JSON</a>
        </nav>
      </body>
    </html>
  )
}
