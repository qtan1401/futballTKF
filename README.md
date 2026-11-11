# Futball TKF

Web app nội bộ quản lý đội bóng: tạo trận, đăng ký tham gia, ghi kết quả, xem lịch sử.
Cloudflare Workers + D1 + Hono (render JSX phía server), không cần đăng nhập.

## Chạy local

```bash
npm install
npm run db:migrate:local   # tạo bảng trong D1 local
npm run dev                # http://127.0.0.1:8787
```

Kiểm tra: `npm test` (vitest) và `npm run tsc`.

## Triển khai (Cloudflare)

```bash
npx wrangler login
npx wrangler d1 create tkf          # chép database_id in ra
# sửa database_id trong wrangler.jsonc
npx wrangler d1 migrations apply tkf --remote
npm run deploy
```

## Quy tắc chính

- Đăng ký đóng trước giờ đá 60 phút (tính theo giờ server). Sau đó vẫn đăng ký được nhưng gắn "muộn"; chỉ bỏ tên được trước giờ khoá.
- 5v5 có 10 chỗ, 7v7 có 14 chỗ; vượt quá là danh sách chờ.
- Kết quả chỉ thắng/thua, tỉ số tuỳ chọn nhưng phải nhập đủ cả hai hoặc bỏ trống.
- Không xoá cứng: trận chưa có kết quả được ẩn, thành viên được ẩn.
- Giờ lưu UTC, hiển thị theo Asia/Ho_Chi_Minh (+07).
- Cookie `tkf_me` (HttpOnly) nhớ bạn là ai trên thiết bị.

## Sao lưu

- `GET /export` tải JSON gồm thành viên (cả người đã ẩn), trận và đăng ký.
- Dùng thêm D1 Time Travel của Cloudflare để khôi phục theo thời điểm.
