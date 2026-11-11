import { Hono } from "hono"
import { home } from "./routes/home"
import { matchRoutes } from "./routes/match"
import { history } from "./routes/history"
import { players } from "./routes/players"

export type Bindings = { DB: D1Database }

export const app = new Hono<{ Bindings: Bindings }>()

app.get("/healthz", (c) => c.text("ok"))
app.route("/", home)
app.route("/", matchRoutes)
app.route("/", history)
app.route("/", players)

export default app
