import { Hono } from "hono"

export type Bindings = { DB: D1Database }

export const app = new Hono<{ Bindings: Bindings }>()

app.get("/healthz", (c) => c.text("ok"))

export default app
