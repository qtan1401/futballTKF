# Thiết kế: Web quản lý đội bóng nội bộ (Futball TKF)

- Ngày: 2026-11-11
- Trạng thái: chờ duyệt
- Người duyệt: chủ đội (human partner)

## 1. Ý định và lý do

Đội bóng phong trào 15–20 người, đá sân 5 hoặc sân 7 khoảng 1–2 lần mỗi tuần. Hiện tại
mọi thứ diễn ra trong nhóm chat: một người đăng tin, rồi phải nhắn hỏi từng người xem
có đá không, ai chốt thì ghi nhớ trong đầu, hết trận thì quên luôn kết quả và không ai
biết cả mùa thắng bao nhiêu.

Mục tiêu của phần mềm này: **một đường link, cả đội tự vào ghi tên, và lịch sử trận
đấu nằm lại trên web**. Không phải để quản lý chuyên nghiệp, không phải để thay huấn
luyện viên — chỉ để bỏ đi hai việc thủ công: hỏi từng người, và nhớ kết quả.

## 2. Mục tiêu

- Tạo trận với 3 thông tin: thể thức (5v5 / 7v7), sân, ngày giờ bắt đầu.
- Ai có link cũng tạo trận được; ai cũng xem được mọi trận.
- Đăng ký tự phục vụ: người tham gia tự thêm tên mình, không cần ai duyệt.
- Khoá mềm đúng 1 giờ trước giờ bóng lăn: chốt danh sách để biết đủ người, nhưng vẫn
  cho thêm người muộn (có đánh dấu).
- Sau trận: ghi **thắng hoặc thua** cho đội; hệ thống cộng dồn thành tích.
- Lịch sử trận đấu và thống kê **tồn tại vĩnh viễn trên web**, không phụ thuộc vào
  điện thoại của bất kỳ ai.
- Chi phí vận hành: 0 đồng, không cần thẻ tín dụng.

## 3. Ngoài phạm vi (non-goals)

- Không đăng nhập, không mật khẩu, không phân quyền.
- Không lưu thông tin đội đối thủ (không tên đội bạn, không cầu thủ bên bạn).
- Không thống kê từng cầu thủ (bàn thắng, kiến tạo, thẻ phạt, số phút).
- Không chia đội trong app, không xếp đội hình A/B.
- Không quản lý quỹ, đóng tiền, điểm danh buổi tập.
- Không app native, không push notification, không nhắc lịch tự động.
- Không chia mùa, không nhiều đội / nhiều tenant.
- Không có kết quả hoà.

## 4. Anti-goals (thất bại dù phần mềm vẫn chạy)

- Mất dữ liệu sau vài tháng vì gói free xoá DB hoặc pause project.
- Web "ngủ đông", mỗi lần vào phải chờ 30–60 giây.
- Tên người bị lệch ("An", "an", "An Nguyễn") khiến danh sách vô nghĩa.
- Một người lỡ tay xoá trận đã đá và lịch sử biến mất.
- Danh sách đăng ký không phản ánh thực tế vì không thêm muộn được.
- Phải cài app, phải tạo tài khoản mới xem được.

## 5. Ràng buộc

- Nền tảng: **Cloudflare Workers + D1** (đã chốt, xem mục 6).
- Không dựng server/VPS riêng; không dùng database truyền thống tự quản trị.
- Không trả phí, không nhập thẻ tín dụng.
- Múi giờ hiển thị: Asia/Ho_Chi_Minh (UTC+7); lưu trữ theo UTC.
- Quy mô: ≤ 30 người dùng, ≤ 5 trận/tuần, dữ liệu < 100 MB trong 10 năm.
- Giao diện tiếng Việt, ưu tiên điện thoại (một tay, ngoài sân nắng).
- Không cần SEO, không cần đa ngôn ngữ.

## 6. Phương án đã cân nhắc

**A. Cloudflare Workers + D1 — đã chọn.**
Free tier: 100.000 request/ngày, D1 5 GB, không cần thẻ, Workers không ngủ đông,
D1 không bị xoá. Một Worker vừa trả HTML vừa trả API, deploy bằng `wrangler`.
Đánh đổi: phải dùng `wrangler`, SQL là SQLite, runtime không có toàn bộ Node API.

**B. Firebase (Firestore + Hosting).**
Có realtime sẵn — người khác đăng ký là máy mình tự cập nhật. Free 1 GB, 1 triệu lượt
đọc/ngày, không ngủ. Đánh đổi: mô hình document khó truy vấn thống kê, gắn chặt Google,
và bảo mật bằng rules phức tạp hơn khi không có đăng nhập.

**C. Vercel + Neon Postgres.**
Postgres thật, quen thuộc. Đánh đổi: Neon tự ngủ (lần vào đầu chậm 1–2 giây), Vercel
Hobby về lý thuyết là phi thương mại.

Loại B và C vì mục tiêu số một là "không bao giờ phải nghĩ tới hạ tầng nữa" và dữ liệu
không được biến mất; A là lựa chọn duy nhất không có cơ chế ngủ, pause hay xoá. Nhu cầu
realtime của B không cần thiết: một nút tải lại là đủ cho 20 người.

## 7. Quyết định của chủ đội

1. Khoá ở T-60′ là **khoá mềm**: không xoá tên người khác được nữa, nhưng vẫn thêm được.
2. **Không có kết quả hoà**; mỗi trận luôn ghi thắng hoặc thua.
3. Ai có link cũng truy cập, **không tài khoản**.
4. Chỉ cần thống kê **thắng/thua của đội**, không cần thống kê cầu thủ.
5. Hạ tầng: phương án **A (Cloudflare)**.
6. Trận đấu là **đội mình vs đội bên ngoài**, nhưng **không lưu thông tin đội bạn** —
   chỉ cần biết trận đó mình thắng hay thua.

## 8. Quyết định của người viết (có thể đổi, không cần hỏi lại)

1. **Danh sách thành viên cố định.** Người dùng bấm tên mình trong danh sách đã lưu,
   không gõ tự do. Có thêm ô "khách" cho người ngoài đội. Lý do: giữ tên nhất quán
   cho danh sách và lịch sử.
2. **Giới hạn slot mềm:** 10 chỗ cho 5v5, 14 chỗ cho 7v7. Vượt số đó thì vào danh sách
   chờ, người vẫn được thêm.
3. **Kết quả chỉ gồm thắng/thua.** Tỷ số là **tuỳ chọn** (nhập cũng được, bỏ trống cũng
   được) và không ảnh hưởng tới thống kê. Không có trường đội thắng/đội thua riêng,
   không có tên đối thủ.
4. **Không xoá cứng.** Trận chưa có kết quả thì ẩn được; trận đã có kết quả thì không.
5. **Link khó đoán** (subdomain riêng + `noindex`), không có màn hình đăng nhập.
6. **Cookie giữ `player_id`** của người đã chọn tên, chỉ để hiện nút "bỏ tên tôi".
7. **Thêm muộn** được phép tới khi kết quả được nhập.
8. **Nút xuất JSON** toàn bộ dữ liệu để chủ đội tự sao lưu.
9. **Sửa/xoá kết quả** được phép bất kỳ lúc nào (ghi `updated_at`), vì không có phân quyền.
10. **Chỉ sửa được thông tin trận** (sân, giờ, thể thức) trước giờ khoá; sau đó cố định
    để không làm lệch danh sách đã chốt.
11. **Chặn trùng tên** thành viên (bỏ qua hoa/thường và khoảng trắng thừa); cho đổi tên.

## 9. Dữ liệu (D1 / SQLite)

```sql
CREATE TABLE players (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL
);
CREATE UNIQUE INDEX players_name_unique ON players (lower(trim(name)));

CREATE TABLE matches (
  id          TEXT    PRIMARY KEY,          -- nanoid
  format      INTEGER NOT NULL CHECK (format IN (5, 7)),
  pitch       TEXT    NOT NULL,
  kickoff_at  TEXT    NOT NULL,             -- ISO 8601 UTC
  result      TEXT    CHECK (result IN ('win', 'loss')),
  our_score   INTEGER,
  their_score INTEGER,
  note        TEXT,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT,
  deleted_at  TEXT,                         -- NULL = còn hiển thị
  CHECK ((our_score IS NULL) = (their_score IS NULL)),
  CHECK ((our_score IS NULL) OR (our_score >= 0 AND their_score >= 0))
);

CREATE TABLE signups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id    TEXT    NOT NULL REFERENCES matches(id),
  player_id   INTEGER REFERENCES players(id),
  guest_name  TEXT,                         -- dùng khi player_id IS NULL
  is_late     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL,
  UNIQUE (match_id, player_id),
  CHECK (player_id IS NOT NULL OR guest_name IS NOT NULL)
);
```

Thống kê tính bằng truy vấn, không lưu bảng riêng:

```sql
SELECT
  COUNT(*)                                          AS total,
  SUM(CASE WHEN result = 'win'  THEN 1 ELSE 0 END)  AS wins,
  SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END)  AS losses
FROM matches
WHERE deleted_at IS NULL AND result IS NOT NULL;
```

Chuỗi thắng/thua hiện tại và tỷ lệ thắng tính trong code từ danh sách trận đã có kết quả,
sắp xếp theo `kickoff_at`.

## 10. Màn hình

1. **`/` — Danh sách trận.** Trận sắp tới (mở đăng ký / đã chốt) ở trên, trận đã đá
   ở dưới (10 trận gần nhất + link "xem tất cả"). Nút "Tạo trận".
2. **`/m/:id` — Chi tiết trận.** Thông tin trận, đếm ngược tới giờ khoá, danh sách
   đăng ký (có nhãn "muộn", có danh sách chờ), nút "+ Thêm tôi", từ giờ bóng lăn hiện
   form kết quả: **Thắng / Thua** + tỷ số tuỳ chọn.
3. **`/history` — Lịch sử + thống kê.** Tổng trận, thắng, thua, tỷ lệ thắng, chuỗi
   thắng/thua hiện tại, bảng toàn bộ trận đã đá.
4. **`/players` — Thành viên.** Thêm tên, đổi tên, ẩn tên (không xoá).
5. **`/export` — Xuất JSON.**

Phác thảo màn hình trận:

```
┌ Chủ nhật 15/11 · Sân K34 · 17:00–18:30 · 7v7 ┐
│ Đã đăng ký 11/14        🔒 chốt lúc 16:00    │
│ ✓ An  ✓ Bình  ✓ Cường  ✓ Dũng (muộn)  ...    │
│ [ + Thêm tôi ]                               │
│ ── từ giờ bóng lăn ──                        │
│ Kết quả  [ Thắng ] [ Thua ]                  │
│ Tỷ số (không bắt buộc) [ 3 ] – [ 2 ]         │
└──────────────────────────────────────────────┘
```

## 11. Quy tắc nghiệp vụ

- **Giờ khoá** = `kickoff_at − 60 phút`. Server luôn là nguồn thời gian; client chỉ
  hiển thị đếm ngược.
- Trước giờ khoá: thêm và bỏ tên tự do; sửa được thông tin trận.
- Từ giờ khoá tới khi có kết quả: **không bỏ tên được**, thêm được với `is_late = 1`;
  thông tin trận cố định.
- Từ giờ bóng lăn: nhập được kết quả.
- Sau khi có kết quả: khoá hoàn toàn việc thêm/bỏ tên; kết quả vẫn sửa hoặc xoá được.
- Không cho trùng: một người chỉ đăng ký một lần trong một trận (ràng buộc `UNIQUE`).
- Trận đã có kết quả không ẩn/xoá được; trận chưa có kết quả thì ẩn được (soft delete).

## 12. Bảo mật và sao lưu

- Không có đăng nhập nghĩa là ai có link cũng ghi/xoá mềm được. Chấp nhận, vì đây là
  công cụ nội bộ 20 người; giảm thiểu bằng: link khó đoán, `noindex`, không xoá cứng,
  và kiểm tra dữ liệu ở tầng server (không tin client).
- D1 có Time Travel để khôi phục DB về một mốc thời gian.
- `/export` trả toàn bộ dữ liệu dạng JSON để chủ đội lưu ngoài web.

## 13. Kiểm thử

- Unit test cho quy tắc khoá: đúng biên T-60 (59′59″ còn sửa được, 60′00″ thì không xoá
  được nữa), thêm muộn bị gắn cờ, sau khi có kết quả thì chặn hẳn.
- Test kết quả: bắt buộc chọn thắng/thua; tỷ số nhập một bên thì từ chối; xoá kết quả
  mở lại được việc thêm muộn.
- Test đăng ký trùng tên và trùng tên thành viên (khác hoa/thường, thừa khoảng trắng).
- Test ẩn trận: chỉ trận chưa có kết quả mới ẩn được.
- Chạy bằng `vitest` + `@cloudflare/vitest-pool-workers` với D1 giả lập.

## 14. Phần để builder quyết

- Framework và cách render: Hono + HTML server-side, hay React/Vite build tĩnh gọi API.
- Thư viện CSS, có dùng Tailwind CDN hay CSS thuần.
- Cách sinh `id`, cách đặt subdomain, quy trình deploy bằng `wrangler`.
- Có cron dọn dữ liệu hay không (hiện chưa cần).
- Chi tiết hiển thị đếm ngược và định dạng ngày giờ.
