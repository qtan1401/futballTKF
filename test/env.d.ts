import type { Bindings } from "../src/index"

declare module "cloudflare:test" {
  interface ProvidedEnv extends Bindings {
    TEST_MIGRATIONS: { name: string; queries: string[] }[]
  }
}
