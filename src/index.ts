import { Hono } from "hono"
import { home } from "./routes/home"

export type Bindings = { DB: D1Database }

export const app = new Hono<{ Bindings: Bindings }>()

app.get("/healthz", (c) => c.text("ok"))
app.route("/", home)

export default app
