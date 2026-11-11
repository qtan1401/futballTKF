import { expect, test } from "vitest"
import { app } from "../src/index"

test("GET /healthz trả 200 và 'ok'", async () => {
  const res = await app.request("/healthz")
  expect(res.status).toBe(200)
  expect(await res.text()).toBe("ok")
})
