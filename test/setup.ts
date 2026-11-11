import { env } from "cloudflare:test"

export async function resetDb(): Promise<void> {
  await env.DB.prepare("DELETE FROM signups").run()
  await env.DB.prepare("DELETE FROM matches").run()
  await env.DB.prepare("DELETE FROM players").run()
}
