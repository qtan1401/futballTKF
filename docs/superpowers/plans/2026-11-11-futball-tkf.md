# Futball TKF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web nội bộ cho đội bóng, không tài khoản: mọi người tự đăng ký ghi tên trước giờ bóng lăn 1 giờ, ghi kết quả thắng/thua, lịch sử vĩnh viễn trên Cloudflare Workers + D1.

**Architecture:** Một Worker với Hono vừa render HTML server-side vừa nhận POST; dữ liệu trong D1 (SQLite). Logic nghiệp vụ tách thành hai module thuần (`rules.ts`, `stats.ts`) để unit test không cần server; route chỉ là lớp mỏng: nhận request → gọi rules/db → render.

**Tech Stack:** TypeScript strict, Hono, Cloudflare Workers, D1, vitest + `@cloudflare/vitest-pool-workers`, nanoid, CSS thuần.

**Spec:** `docs/superpowers/specs/2026-11-11-futball-tkf-design.md` — kế hoạch này căn cứ vào đó; đọc cả hai trước khi code.

## Global Constraints

- UI và commit message tiếng Việt; tên hàm/biến/code tiếng Anh.
- Thời gian **lưu UTC** ISO 8601, **hiển thị múi giờ Asia/Ho_Chi_Minh (UTC+7)**.
- Giờ khoá = `kickoff_at − 60 phút`, quyết định bởi **giờ server** (`Date.now()`), không tin giờ client.
- Slot mềm: 10 chỗ cho format 5, 14 chỗ cho format 7 (tức `format * 2`); vượt vào danh sách chờ.
- Kết quả chỉ `'win' | 'loss'`, bắt buộc; tỷ số (`our_score`, `their_score`) tuỳ chọn, **nhập cả hai hoặc không nhập cả hai**.
- Không xoá cứng: trận ẩn = `deleted_at` (chỉ được ẩn trận **chưa có kết quả**), thành viên ẩn = `is_active = 0`.
- Không đăng nhập; cookie `tkf_me` chỉ ghi player id người dùng hiện tại.
- Đã có kết quả: khoá hẳn thêm/bỏ tên; kết quả vẫn sửa/xoá được; trận không ẩn được.
- Dependencies chỉ được có: `hono`, `nanoid`; dev: `wrangler`, `vitest`, `@cloudflare/vitest-pool-workers`, `@cloudflare/workers-types`, TypeScript. Không thêm thư viện CSS/framework.
- TypeScript `strict: true`.

## Review Focus

Năm loại đầu vào/thất bại dễ làm người dùng thật gặp sự cố; mỗi dòng đã có test pin ở task tương ứng:

1. **Nhầm múi giờ khi tạo trận**: trận người dùng chọn "17:00" giờ Việt phải lưu đúng `10:00:00.000Z` và hiển thị lại đúng 17:00. Test pin ở Task 6 (`parseLocalDatetimeVN`, `formatKickoffVN` và test POST tạo trận).
2. **Biên T-60′ lệch 1 phút**: đúng tại `lockAt` phải chặn bỏ tên; 1 ms trước đó vẫn được. Test pin ở Task 3.
3. **Ai có link cũng phá dữ liệu**: bỏ tên người khác, ẩn trận đã có kết quả, nhập kết quả nhiều phần (chỉ 1 bên có tỷ số) phải bị server từ chối bất kể client gửi gì. Test pin ở Task 7 và Task 8.
4. **Trùng tên "An" vs " an " làm lịch sử vô nghĩa**: chèn thành viên trùng (khác hoa/thường, thừa khoảng trắng) phải bị từ chối. Test pin ở Task 2 và Task 10.
5. **Trang rỗng** (chưa có trận, chưa có thành viên, không có kết quả) phải render không crash và hiện thông báo "Chưa có…". Test pin ở Task 6, Task 9, Task 10.

---

## File Structure

```
A:\Futball TKF\
├── package.json
├── wrangler.jsonc          # binding DB (D1), migrations_dir
├── tsconfig.json
├── vitest.config.ts
├── migrations/
│   └── 0001_init.sql       # schema đúng spec §9
├── src/
│   ├── index.ts            # Hono app, mount router, error handler
│   ├── rules.ts            # phase/permission thuần
│   ├── stats.ts            # thống kê thuần
│   ├── db.ts               # truy vấn D1
│   ├── format.ts           # ngày giờ, múi giờ VN
│   ├── layout.tsx          # <html>, nav, CSS
│   ├── style.ts            # CSS dạng chuỗi, import vào layout
│   └── routes/
│       ├── home.tsx        # GET /, GET /matches/new, POST /matches
│       ├── match.tsx       # GET /m/:id, signup/leave, result, edit, hide
│       ├── history.tsx     # GET /history
│       ├── players.tsx     # GET /players + CRUD thành viên
│       └── export.ts       # GET /export
└── test/
    ├── prepare.ts          # applyD1Migrations một lần
    ├── setup.ts            # resetDb() chạy trước mỗi test
    ├── helpers.ts          # seedMatch, seedPlayers...
    ├── smoke.test.ts
    ├── schema.test.ts
    ├── rules.test.ts
    ├── stats.test.ts
    ├── db.test.ts
    ├── format.test.ts
    ├── home.test.ts
    ├── match.test.ts
    ├── result.test.ts
    ├── history.test.ts
    └── players.test.ts
```

**Nhắc mọi implementer trước khi code:** bảng `matches` **không** có trường đối thủ; `signups` **không** có trường đội. Schema đúng từng cột của spec §9; test đi từng constraint một như spec §13.

**Quy ước test:** chạy trên `@cloudflare/vitest-pool-workers` (cấu hình cụ thể ở Task 1). Test tích hợp gọi worker bằng `SELF.fetch`; D1 test DB đã áp migration sẵn. Mỗi task bắt đầu bằng viết test phải FAIL trước khi có code.

---

### Task 1: Scaffold Worker + pipeline test

**Files:**
- Create: `package.json`, `wrangler.jsonc`, `tsconfig.json`, `vitest.config.ts`, `test/prepare.ts`, `test/setup.ts`, `src/index.ts`
- Test: `test/smoke.test.ts`

**Interfaces:**
- Produces: `src/index.ts` export `default app` (Hono) và `export const app`; Worker có binding `env.DB: D1Database`; `test/setup.ts` export `resetDb(): Promise<void>` mà mọi test sau dùng.

- [ ] **Step 1: `git init`, tạo `.gitignore` (node_modules, .wrangler, .dev.vars)**

- [ ] **Step 2: Tạo `package.json`** — scripts: `dev` `wrangler dev`, `test` `vitest run`, `deploy` `wrangler deploy`, `tsc` `tsc --noEmit`, `db:migrate:local` `wrangler d1 migrations apply tkf --local`; devDeps như Global Constraints, deps `hono`, `nanoid`.

- [ ] **Step 3: Tạo `wrangler.jsonc`** — nội dung cố định:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "futball-tkf",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "tkf",
      "database_id": "local-placeholder",
      "migrations_dir": "migrations"
    }
  ]
}
```

- [ ] **Step 4: `vitest.config.ts` + `test/prepare.ts`** — theo docs chính thức của `@cloudflare/vitest-pool-workers`:

```ts
// vitest.config.ts
import path from "node:path"
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config"

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"), "v1")
  return {
    test: {
      setupFiles: ["./test/prepare.ts"],
      poolOptions: {
        workers: {
          wrangler: { configPath: "wrangler.jsonc" },
          bindings: { TEST_MIGRATIONS: migrations },
        },
      },
    },
  }
})

// test/prepare.ts
import { applyD1Migrations, env } from "cloudflare:test"
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
```

- [ ] **Step 5: `test/setup.ts`** — export `resetDb()` = `DELETE FROM signups; DELETE FROM matches; DELETE FROM players;` (dùng prepared statements); `tsconfig.json`: `"jsx": "react-jsx"`, `"jsxImportSource": "hono/jsx"`, `strict`.

- [ ] **Step 6: Viết test fail đầu tiên trong `test/smoke.test.ts`**

```ts
import { expect, test } from "vitest"
import { app } from "../src/index"

test("GET /healthz trả 200 và 'ok'", async () => {
  const res = await app.request("/healthz")
  expect(res.status).toBe(200)
  expect(await res.text()).toBe("ok")
})
```

- [ ] **Step 7: `npm test` → FAIL với lỗi "route chưa có"; nếu FAIL vì config sai thì sửa cấu hình ngay trong Task này, không khất sang Task sau**

- [ ] **Step 8: `src/index.ts`: `export const app = new Hono()`, thêm `app.get("/healthz", c => c.text("ok"))`, `export default app`; không gắn route nào khác ở đây**

- [ ] **Step 9: `npm test` → PASS**

- [ ] **Step 10: Commit `"chore: scaffold worker + pipeline test"`**

---

### Task 2: Schema D1 (migration 0001) + test constraint

**Files:**
- Create: `migrations/0001_init.sql`
- Test: `test/schema.test.ts`

**Interfaces:**
- Produces: 3 bảng đúng spec §9 (đúng từng tên cột); mọi task sau query trên đó.

- [ ] **Step 1: Viết test trước trong `test/schema.test.ts`** — mỗi test một constraint, chèn bằng SQL thô:

```ts
it("chặn trùng tên (khác hoa/thường, thừa khoảng trắng)", async () => {
  await env.DB.prepare("INSERT INTO players (name, created_at) VALUES (?1, ?2)").bind("An", ISO).run()
  const dup = env.DB.prepare("INSERT INTO players (name, created_at) VALUES (?1, ?2)").bind("  an ", ISO).run()
  await expect(dup).rejects.toThrow()
})
it("result chỉ nhận 'win'/'loss'", async () => { /* expect(result='draw').rejects.toThrow() */ })
it("format khác 5 và 7 bị từ chối", async () => { /* expect(rejects) */ })
it("kickoff_at thiếu bị từ chối", async () => { /* NOT NULL → expect(rejects) */ })
it("tỷ số nửa vời (chỉ our_score hoặc chỉ their_score) bị từ chối", async () => { /* CHECK both-or-neither → expect(rejects) */ })
it("cho phép tỷ số bằng nhau (2-2) với result='win'", async () => { /* expect(resolves) */ })
it("một người chỉ đăng ký một lần trong một trận (UNIQUE match_id+player_id)", async () => { /* seed player + match, chèn signup lần 1 resolves, lần 2 rejects */ })
```

- [ ] **Step 2: `npm test` → FAIL (bảng chưa tồn tại)**

- [ ] **Step 3: Viết `migrations/0001_init.sql` — copy nguyên khối SQL trong spec §9, thêm đúng một index `CREATE INDEX matches_kickoff ON matches (kickoff_at ASC)`. Không thêm/bớt cột, không đổi Constraint hay tên cột.**

- [ ] **Step 4: `npm test` → PASS**

- [ ] **Step 5: `npm run db:migrate:local` để dev sau này sẵn sàng; Commit `"feat: schema d1 lịch sử trận đấu"`**

---

### Task 3: `rules.ts` — phase và permission (thuần, unit test)

**Files:**
- Create: `src/rules.ts`
- Test: `test/rules.test.ts`

**Interfaces:**
- Produces (routes Task 6–8 import đúng tên):

```ts
export const LOCK_MINUTES = 60

/** match core đủ cho mọi decision; không cần join */
export type MatchCore = { kickoff_at: string; result: "win" | "loss" | null }

export type Phase = "OPEN" | "LATE" | "LOCKED"
/** OPEN: now < lockAt. LATE: lockAt ≤ now AND result == null. LOCKED: result != null */
export function phase(m: MatchCore, nowMs: number): Phase

/** Luôn cho thêm trừ LOCKED; late = phase !== "OPEN" */
export function canAddSignup(m: MatchCore, nowMs: number): { allowed: boolean; late: boolean }
/** Chỉ OPEN */
export function canRemoveSignup(m: MatchCore, nowMs: number): boolean
/** now < lockAt && result == null */
export function canEditMatchInfo(m: MatchCore, nowMs: number): boolean
/** now ≥ kickoff && result == null (lưu ý: còn mở cả với trận đã qua chưa ai nhập, tức back-fill) */
export function canEnterResult(m: MatchCore, nowMs: number): boolean
/** result != null — sửa/xoá kết quả cho phép bất kỳ lúc nào */
export function canEditResult(m: MatchCore, nowMs: number): boolean
/** Chỉ khi result == null (trận đã đá không ẩn được) */
export function canHideMatch(m: MatchCore, nowMs: number): boolean
```

Chốt: tổng cộng 7 hàm; mọi giờ là `nowMs` được truyền vào, **không** gọi `Date.now()` bên trong.

- [ ] **Step 1: `test/rules.test.ts`** (mỗi case có assertion rõ ràng):

```ts
const kickoff = "2026-11-15T10:00:00.000Z"       // 17:00 giờ Việt
const lockMs = Date.parse(kickoff) - 60 * 60 * 1000

it("đúng biên T-60′: 1ms trước khóa bỏ tên được; đúng giờ khóa thì không", () => {
  const m = { kickoff_at: kickoff, result: null }
  expect(canRemoveSignup(m, lockMs - 1)).toBe(true)
  expect(canRemoveSignup(m, lockMs)).toBe(false)
})
it("trước khóa: thêm được và không muộn", () => { /* canAddSignup(m, lockMs-1) = {allowed:true, late:false} */ })
it("từ khóa tới kickoff: thêm được nhưng muộn", () => {
  const m = { kickoff_at: kickoff, result: null }
  expect(canAddSignup(m, lockMs)).toEqual({ allowed: true, late: true })
  expect(canAddSignup(m, Date.parse(kickoff) - 1)).toEqual({ allowed: true, late: true })
})
it("sau kickoff nhưng chưa có kết quả: vẫn thêm muộn", () => { /* allowed true, late true */ })
it("đã có kết quả → khóa hẳn, không thêm không bỏ", () => {
  const m = { kickoff_at: kickoff, result: "win" }
  expect(canAddSignup(m, Date.parse("2027-01-01"))).toEqual({ allowed: false, late: false })
  expect(canRemoveSignup(m, Date.parse("2027-01-01"))).toBe(false)
})
it("đã có kết quả: kết quả vẫn sửa được, trận không ẩn được", () => {
  const m = { kickoff_at: kickoff, result: "win" }
  expect(canEditResult(m, Date.parse("2027-01-01"))).toBe(true)
  expect(canHideMatch(m, Date.parse("2027-01-01"))).toBe(false)
})
it("nhập kết quả chỉ từ giờ bóng lăn; trận đã qua chưa ai nhập vẫn back-fill được", () => {
  const m = { kickoff_at: kickoff, result: null }
  expect(canEnterResult(m, Date.parse(kickoff) - 1)).toBe(false)
  expect(canEnterResult(m, Date.parse(kickoff))).toBe(true)
})
it("sửa thông tin trận chỉ trước giờ khóa", () => {
  const m = { kickoff_at: kickoff, result: null }
  expect(canEditMatchInfo(m, lockMs - 1)).toBe(true)
  expect(canEditMatchInfo(m, lockMs)).toBe(false)
})
```

- [ ] **Step 2: `npm test` → FAIL**

- [ ] **Step 3: Implement theo signature; hàm thuần, không import db/route, không dùng `Date.now()` bên trong**

- [ ] **Step 4: `npm test` → PASS**

- [ ] **Step 5: Commit `"feat: quy tắc khóa và quyền đăng ký (unit)"`**

---

### Task 4: `stats.ts` — thống kê (thuần, unit test)

**Files:**
- Create: `src/stats.ts`
- Test: `test/stats.test.ts`

**Interfaces:**
- Produces:

```ts
export type StatMatch = { result: "win" | "loss"; kickoff_at: string }

/** Caller đã lọc deleted_at IS NULL AND result IS NOT NULL trước khi đưa vào */
export function computeStats(list: StatMatch[]): {
  total: number
  wins: number
  losses: number
  winRate: number          // wins / total, giá trị 0..1
  currentStreak: { type: "win" | "loss"; count: number } | null   // đếm lùi từ trận mới nhất
}
```

- [ ] **Step 1: `test/stats.test.ts`** (ít nhất, mỗi case một assertion):

```ts
it("tổng, thắng, thua, tỷ lệ đúng", () => {
  // seed 10 trận: 6 win, 4 loss trong đó 2 trận mới nhất là win
  // → total 10, wins 6, losses 4, winRate 0.6, currentStreak { type:"win", count:2 }
})
it("chuỗi hiện tại dừng khi đổi loại kết quả", () => {
  // thứ tự kickoff ASC: win, loss, win (win mới nhất) → currentStreak { type:"win", count:1 }
})
it("danh sách rỗng → total 0, winRate 0, currentStreak null", () => { /* ... */ })
it("kết quả không phụ thuộc thứ tự input", () => { /* đảo mảng cho random — cùng kết quả vì dùng kickoff_at */ })
```

- [ ] **Step 2: `npm test` → FAIL**

- [ ] **Step 3: Implement (thuần, không import db/route)**

- [ ] **Step 4: `npm test` → PASS**

- [ ] **Step 5: Commit `"feat: thống kê thuần thắng-thua"`**

---

### Task 5: `db.ts` — data layer D1

**Files:**
- Create: `src/db.ts`
- Test: `test/db.test.ts`

**Interfaces:**
- Consumes: schema Task 2; `rules.ts` chỉ để tính cờ `late`.
- Produces (routes dùng đúng tên; tham `d1: D1Database` là tham số đầu tiên):

```ts
type PlayerRow  = { id: number; name: string; is_active: number; created_at: string }
type MatchRow   = { id: string; format: 5 | 7; pitch: string; kickoff_at: string;
                    result: "win" | "loss" | null; our_score: number | null; their_score: number | null;
                    note: string | null; created_at: string; updated_at: string | null; deleted_at: string | null }
type SignupRow  = { id: number; match_id: string; player_id: number | null; guest_name: string | null;
                    is_late: number; created_at: string }

export class ValidationError extends Error {}
export class ConflictError extends Error {}

export function createPlayer(d1, name: string): Promise<PlayerRow>
export function renamePlayer(d1, id: number, name: string): Promise<void>
export function hidePlayer(d1, id: number): Promise<void>
export function listActivePlayers(d1): Promise<PlayerRow[]>
export function getPlayer(d1, id: number): Promise<PlayerRow | null>

export function createMatch(d1, input: {
  format: number; pitch: string; kickoff_at: string; note?: string
}): Promise<MatchRow>
// format ∉ {5,7} | pitch trống (trim trước khi kiểm) | kickoff_at parse ra NaN → ValidationError; id = nanoid(10)

export function getMatch(d1, id: string): Promise<MatchRow | null>
export function updateMatch(d1, id: string, input: {
  format?: number; pitch?: string; kickoff_at?: string; note?: string
}): Promise<void>   // validate y như createMatch; updated_at = now
export function listNotStarted(d1): Promise<MatchRow[]>   // deleted_at null, result null, ORDER BY kickoff_at ASC
export function listPlayed(d1, limit: number): Promise<MatchRow[]>  // result not null, ORDER BY kickoff_at DESC

export function listSignups(d1, matchId: string): Promise<(SignupRow & { player_name: string | null })[]>
// LEFT JOIN players; ORDER BY is_late ASC, created_at ASC — người muộn xuống cuối, mỗi nhóm theo thứ tự thời gian đăng ký

export function addSignup(d1, matchId: string,
  who: { player_id: number } | { guest_name: string }, nowMs: number): Promise<SignupRow>
// tính phase(match, nowMs): LOCKED → ConflictError; LATE/is_late=1, OPEN/is_late=0

export function removeSignup(d1, matchId: string, signupId: number): Promise<void>
export function setResult(d1, matchId: string, r: { result: "win" | "loss";
  our_score?: number; their_score?: number }): Promise<void>
// chỉ một bên có tỷ số → ValidationError; có tỷ số → updated_at = now; CHECK both-or-neither

export function clearResult(d1, matchId: string): Promise<void>  // result/score/updated_at về NULL
export function hideMatch(d1, matchId: string): Promise<void>    // set deleted_at = now (guard ở route, Task 8)
```

- [ ] **Step 1: `test/db.test.ts`** (mỗi test một hành vi; chạy `resetDb()` trước mỗi test qua `beforeEach`):

```ts
it("createMatch: format sai / pitch trống / kickoff_at sai định dạng → ValidationError", /* ... */)
it("createMatch trả về MatchRow với id nanoid đúng độ dài 10 và format đã chuẩn hóa (5 hoặc 7)", /* ... */)
it("createPlayer chặn '  an  ' khi 'An' có sẵn (ConflictError, chuẩn hoá lower+trim)", /* ... */)
it("addSignup trước giờ khóa → is_late 0", /* dùng nowMs trước lockAt */)
it("addSignup sau giờ khóa nhưng chưa có kết quả → is_late 1", /* ... */)
it("addSignup khi đã có kết quả → ConflictError", /* ... */)
it("setResult: chỉ một bên có tỷ số → ValidationError; cả hai → resolves", /* ... */)
it("clearResult → getMatch trả result null", /* ... */)
it("listSignups: người muộn xuống cuối, mỗi nhóm theo thời gian đăng ký", /* seed is_late 0,1,0 → thứ tự [0,0,1] */)
it("updateMatch trước giờ: chỉ đổi pitch, giữ nguyên id/kickoff khi không truyền", /* ... */)
```

- [ ] **Step 2: `npm test` → FAIL**

- [ ] **Step 3: Implement — dùng prepared statements của D1; không ORM. Bọc SQL `UNIQUE constraint failed` → `ConflictError` (dựa thông tin lỗi từ SQLITE). Chuẩn hoá tên là `lower(trim(name))` khi INSERT/UPDATE/rename.**

- [ ] **Step 4: `npm test` → PASS**

- [ ] **Step 5: Commit `"feat: data layer d1"`**

---

### Task 6: `format.ts` + layout + trang chủ + tạo trận

**Files:**
- Create: `src/format.ts`, `src/layout.tsx`, `src/style.ts`, `src/routes/home.tsx`
- Modify: `src/index.ts` (mount `home`, error handler chung → phản hồi 400 flash tiếng Việt)
- Test: `test/format.test.ts`, `test/home.test.ts`

**Interfaces:**
- Consumes: `db.ts` (listNotStarted, listPlayed, createMatch); `layout.tsx` chứa nav dùng chung cho mọi task render.
- Produces:

```ts
// src/format.ts
export function formatKickoffVN(isoUtc: string): string          // "Chủ nhật 15/11 · 17:00"
export function formatLockTimeVN(isoUtcKickoff: string): string  // giờ khóa → "16:00"
export function countdownText(kickoffIso: string, nowMs: number): string  // "còn 42 phút" / "đã chốt" / "đang đá"
export function parseLocalDatetimeVN(input: string): string      // "2026-11-15T17:00" (múi giờ +07) → ISO UTC

// src/routes/home.tsx
export const homeRoutes: Hono   // mount tại: GET /, GET /matches/new, POST /matches
```

- [ ] **Step 1: `test/format.test.ts`** — pin Review Focus #1:

```ts
it("2026-11-15T10:00:00.000Z hiển thị 17:00 giờ Việt", () => {
  expect(formatKickoffVN("2026-11-15T10:00:00.000Z")).toContain("17:00")
})
it("parse '2026-11-15T17:00' (giờ VN) ra UTC 10:00", () => {
  expect(parseLocalDatetimeVN("2026-11-15T17:00")).toBe("2026-11-15T10:00:00.000Z")
})
```

- [ ] **Step 2: `test/home.test.ts`**:

```ts
it("trang rỗng không crash, hiện thông báo 'Chưa có trận nào' + CTA 'Tạo trận'", async () => { /* status 200 */ })
it("trận sắp tới (listNotStarted) nằm trên, trận đã đá (listPlayed) nằm dưới", /* seed qua db rồi assert thứ tự */)
it("POST /matches format=9 → 400 kèm thông báo lỗi tiếng Việt dễ hiểu", /* ... */)
it("POST /matches hợp lệ → 303 về /m/:id", async () => { /* assert Location header */ })
it("POST /matches với 17:00 giờ VN → row trong db kickoff_at = '2026-11-15T10:00:00.000Z'", /* Review Focus #1 */)
```

- [ ] **Step 3: `npm test` → FAIL**

- [ ] **Step 4: Implement** — `GET /`: mục "Sắp tới / chưa có kết quả" (`listNotStarted`) và "Đã đá" (`listPlayed(10)`) như phác thảo spec §10; `GET /matches/new` form: `format` (radio 5v5 / 7v7), `pitch`, `kickoff_at` (datetime-local), `note`; POST chuyển giờ bằng `parseLocalDatetimeVN`, gọi `createMatch`, redirect 303 tới `/m/:id`. Layout đưa `<meta name="robots" content="noindex">` vào `<head>`; mọi route render dùng chung layout với nav "Trận / Lịch sử / Thành viên / Xuất JSON" (link `/history`, `/players`, `/export` chưa có trang — các task sau bắt). CSS: mobile-first ở `src/style.ts` export const CSS, chèn qua `<style>{CSS}</style>`; nút to dễ bấm, chữ đủ lớn đọc được ngoài nắng.

- [ ] **Step 5: `npm test` → PASS; `wrangler dev --local` boot được, mở http://localhost:8787/ thấy form chạy (kiểm tra bằng tay, không cần screenshot)**

- [ ] **Step 6: Commit `"feat: trang chủ + tạo trận + format thời gian"`**

---

### Task 7: Chi tiết trận + đăng ký / bỏ đăng ký (+ cookie `tkf_me`)

**Files:**
- Create: `src/routes/match.tsx`
- Modify: `src/index.ts` (mount), `test/helpers.ts` (seedMatchWithSignups)
- Test: `test/match.test.ts`

**Interfaces:**
- Consumes: `db.ts`, `rules.ts` (phase/canAddSignup/canRemoveSignup/canEditMatchInfo), `format.ts`, `layout.tsx`.
- Produces: routes `GET /m/:id`, `POST /m/:id/signup` (body `player_id` hoặc `guest_name`), `POST /m/:id/leave` (chỉ bỏ chính mình — chặn người khác); helper `getMe(c, db): Promise<PlayerRow | null>` đọc cookie `tkf_me`; `setMeCookie` / `clearMeCookie` với `HttpOnly; Path=/; Max-Age=31536000 (hoặc 0); SameSite=Lax`.

- [ ] **Step 1: `test/match.test.ts`** — trọng tâm bảo vệ dữ liệu (Review Focus #3):

```ts
it("GET /m/:id render thông tin trận + đếm ngược + danh sách mỗi người 1 hàng", /* seed qua db, assert */)
it("trước giờ khóa: tự thêm tên mình (player_id) → 303, có trong list, cookie tkf_me set", /* ... */)
it("trước giờ khóa: khách (guest_name='Hải') thêm được", /* ... */)
it("tự bỏ tên mình trước giờ khóa → 303, biến mất, cookie bị clear (Max-Age=0)", /* ... */)
it("SAU giờ khóa: bỏ tên (kể cả mình) → 403", /* ... */)
it("SAU giờ khóa: thêm → is_late=1, hiện badge 'muộn'", /* assert DOM chứa "muộn" */)
it("đã có kết quả: thêm và bỏ đều bị từ chối 409", /* ... */)
it("bỏ tên người KHÁC luôn 403 bất kể trước/sau giờ khóa", /* tkf_me=A, target signup=B */)
it("đăng ký trùng player_id → thông báo lỗi rõ ràng, không cho đăng ký lần thứ hai", /* assert message */)
it("slot đầy (ví dụ 15 người trận format 7): người 15 hiện ở danh sách chờ kèm nhãn 'chờ'", /* waitlist = chỉ số ≥ format*2 */)
```

- [ ] **Step 2: `npm test` → FAIL**

- [ ] **Step 3: Implement** — header trận (thông tin + giờ khoá + đếm ngược), danh sách (kèm nhãn muộn + phần danh sách chờ), nút "+ Thêm tôi" mở dropdown chọn tên thành viên + ô tên khách. Các POST kiểm quyền **toàn bộ bằng `rules.ts`**, không viết lại phép tính riêng ở route; và route luôn tin cookie `tkf_me` để biết "mình là ai", không tin nội dung body khi bỏ tên.

- [ ] **Step 4: `npm test` → PASS**

- [ ] **Step 5: Commit `"feat: chi tiết trận + đăng ký tự phục vụ + tkf_me"`**

---

### Task 8: Kết quả thắng/thua + sửa trận + ẩn trận

**Files:**
- Modify: `src/routes/match.tsx`, `test/helpers.ts`
- Test: `test/result.test.ts`

**Interfaces:**
- Produces: routes `POST /m/:id/result` (body `result`, `our_score?`, `their_score?`), `POST /m/:id/result/delete`, `POST /m/:id/edit` (body giống create-match; chỉ cho phép khi `canEditMatchInfo() === true`), `POST /m/:id/hide`.

- [ ] **Step 1: `test/result.test.ts`** — pin Review Focus #3:

```ts
it("trước giờ bóng lăn: POST kết quả → 409", /* ... */)
it("từ giờ bóng lăn: 'win' + 3-2 → 303; db có result='win', our=3, their=2, updated_at set", /* ... */)
it("từ giờ bóng lăn: tỷ số bằng nhau 2-2 kèm 'loss' vẫn lưu được (không có trường đội thắng riêng)", /* ... */)
it("chỉ nhập our_score=3 → 400 kèm thông báo tiếng Việt", /* ... */)
it("sửa kết quả bất kỳ lúc nào được phép (kể cả sau nhiều ngày)", /* ... */)
it("xoá kết quả → result=null; sau đó thêm muộn lại được phép (is_late=1)", /* ... */)
it("POST /m/:id/edit: trước giờ khóa đổi pitch thành công; sau giờ khóa → 403", /* canEditMatchInfo */)
it("hide trận chưa có kết quả → 303, giao danh sách trang chủ; hide trận đã có kết quả → 409, vẫn nằm trên trang chủ", /* ... */)
```

- [ ] **Step 2: `npm test` → FAIL**

- [ ] **Step 3: Implement** — form kết quả (radio Thắng/Thua + 2 input số tuỳ chọn) chỉ hiện khi `now >= kickoff`; nút "Xoá kết quả" hiện khi `result != null`; "Sửa trận" hiện khi `canEditMatchInfo`; dùng `canEnterResult / canEditResult / canHideMatch / canEditMatchInfo`, không viết lại logic phép tính.

- [ ] **Step 4: `npm test` → PASS**

- [ ] **Step 5: Commit `"feat: nhập/xoá kết quả + sửa trận + ẩn trận"`**

---

### Task 9: Lịch sử + thống kê

**Files:**
- Create: `src/routes/history.tsx`
- Modify: `src/index.ts` (mount)
- Test: `test/history.test.ts`

**Interfaces:**
- Consumes: `db.listPlayed(d1, Infinity)`, `computeStats` (Task 4), `format.ts`.
- Produces: route `GET /history`.

- [ ] **Step 1: `test/history.test.ts`:**

```ts
it("hiện số liệu lớn: tổng / thắng / thua / tỷ lệ / chuỗi hiện tại", /* seed 5 trận có kết quả; assert text có "3 thắng", "2 thua", "60%" */)
it("bảng trận có cột kết quả hiện 'Thắng'/'Thua' kèm màu phân biệt (class khác nhau)", /* assert class */)
it("danh sách rỗng → thông báo 'Chưa có trận nào được ghi lại' không crash", /* ... */)
it("trận quá giờ nhưng chưa nhập kết quả KHÔNG xuất hiện ở đây (nó nằm ở trang chủ mục chưa có kết quả)", /* ... */)
```

- [ ] **Step 2: `npm test` → FAIL**

- [ ] **Step 3: Implement** — `listPlayed(d1, Infinity)` rồi truyền qua `computeStats` cho số lớn; bảng render với cột kết quả. `currentStreak` lấy sẵn từ `computeStats`, không tính lại.

- [ ] **Step 4: `npm test` → PASS**

- [ ] **Step 5: Commit `"feat: lịch sử + thống kê"`**

---

### Task 10: Thành viên + trang `/export`

**Files:**
- Create: `src/routes/players.tsx`, `src/routes/export.ts`
- Modify: `src/index.ts` (mount)
- Test: `test/players.test.ts`

**Interfaces:**
- Consumes: `db.ts`, `layout.tsx`.
- Produces: routes `GET /players`, `POST /players`, `POST /players/:id/rename`, `POST /players/:id/hide`, `GET /export`.

- [ ] **Step 1: `test/players.test.ts`:**

```ts
it("GET /players danh sách rỗng → 'Chưa có thành viên' + form thêm (Review Focus #5)", /* ... */)
it("thêm 'An' ok; thêm '  an  ' → thông báo 'Tên này đã có trong danh sách' (bắt ConflictError)", /* ... */)
it("rename đổi tên; đổi trùng → thông báo, tên giữ nguyên", /* ... */)
it("hide: biến mất khỏi dropdown đăng ký ở trang trận (assert select options ở /m/:id)", /* ... */)
it("GET /export → JSON đúng shape { players, matches, signups }, Content-Type application/json", /* ... */)
it("GET /export với DB rỗng → mảng rỗng, status 200", /* ... */)
```

- [ ] **Step 2: `npm test` → FAIL**

- [ ] **Step 3: Implement** — chuẩn hoá tên đã nằm ở db (lower+trim); ở route chỉ cần bắt `ConflictError` và flash đúng câu thông báo. `/export` xuất cả 3 bảng **kể cả thành viên đã ẩn** (dữ liệu backup phải đầy đủ).

- [ ] **Step 4: `npm test` → PASS**

- [ ] **Step 5: Commit `"feat: danh sách thành viên + backup JSON"`**

---

### Task 11: README + chạy local + kiểm thử cuối

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: README là nguồn duy nhất của hướng dẫn setup/deploy/backup — thao tác vận hành không cần hỏi ai.

- [ ] **Step 1: `README.md`** — gồm: cách chạy local (`npm install`, `npm run db:migrate:local`, `npm run dev` tại http://localhost:8787), cách deploy (`wrangler login`, `wrangler d1 create tkf` rồi **thay `database_id` thật vào `wrangler.jsonc`**, `wrangler d1 migrations apply tkf --remote`, `npm run deploy`), backup (`GET /export` định kỳ, D1 Time Travel khi cần khôi phục), và ghi chú các ràng buộc nghiệp vụ (khoá 60′, slot 10/14, không xoá cứng, không lưu đối thủ). Toàn bộ README viết tiếng Việt.

- [ ] **Step 2: chạy thử flow thật end-to-end** — `npm run db:migrate:local` rồi `npm run dev`, mở http://localhost:8787 và làm tay: tạo trận (giờ trong tương lai) → thêm 2 thành viên → cả 2 đăng ký → bấm "Bỏ tên tôi" để thử cookie → tự thêm lại → nhập kết quả → xem `/history`. Chỉ để chắc flow chạy thật, không cần screenshot.

- [ ] **Step 3: `npm test` tất cả PASS; `npm run tsc` không lỗi**

- [ ] **Step 4: Commit `"docs: readme + hướng dẫn chạy và deploy"`**

---

## Lưu ý cho implementer

- TDD: mỗi task viết **test FAIL trước** rồi mới code. Nếu test pass ngay, kiểm tra lại rằng bài đó đã được cover bởi task trước.
- Không thêm thư viện, không thêm cột nào ngoài spec.
- `match.id` dùng `nanoid(10)` chữ thường — URL khó đoán; **không** dùng `crypto.randomUUID`.
- Trong route, giờ server = `Date.now()` truyền vào hàm `rules.ts`; không gọi trực tiếp thời gian trong business logic thuần.
- Mọi giá trị nghiệp vụ (60 phút, slot 10/14, chỉ win/loss…) lấy từ spec; không tự nghĩ.
- Đọc spec trước code; kế hoạch này + spec §9 là nguồn chân lý schema.
