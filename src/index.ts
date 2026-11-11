import { Hono } from "hono"
import { home } from "./routes/home"
import { matchRoutes } from "./routes/match"

export type Bindings = { DB: D1Database }

export const app = new Hono<{ Bindings: Bindings }>()

app.get("/healthz", (c) => c.text("ok"))
app.route("/", home)
app.route("/", matchRoutes)

export default app
