// Token lấy từ thiết kế Figma "Futball TKF - Mobile" (phong cách phẳng, một màu nhấn tối).
export const CSS = `
:root{
  --bg:#F7F5F0;
  --panel:#FFFFFF;
  --ink:#1C1B18;
  --muted:#75716A;
  --soft:#ECE8E0;
  --accent:#1F3D2F;
  --on-accent:#F8F5EF;
  --win:#2E7D4F;
  --loss:#B4493F;
  --warn:#B2750F;
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}
body{font-size:16px;line-height:1.45;padding:16px 16px 96px;max-width:560px;margin:0 auto}
h1{font-size:28px;line-height:1.15;letter-spacing:-0.02em;margin:8px 0 16px;font-weight:700}
h2{font-size:17px;margin:20px 0 8px;font-weight:600}
a{color:inherit}
.muted{color:var(--muted);font-size:14px}
.panel{background:var(--panel);border-radius:18px;padding:16px;margin:12px 0}
.hero{background:var(--accent);color:var(--on-accent);border-radius:22px;padding:22px;margin:12px 0}
.big{font-size:64px;font-weight:700;letter-spacing:-0.03em;font-variant-numeric:tabular-nums;line-height:1}
.num{font-variant-numeric:tabular-nums}
.win{color:var(--win);font-weight:600}
.loss{color:var(--loss);font-weight:600}
.late{color:var(--warn);font-weight:600}
.btn{display:block;width:100%;min-height:52px;border:0;border-radius:14px;background:var(--accent);color:var(--on-accent);font:inherit;font-weight:600;font-size:16px;padding:14px 18px;text-align:center;text-decoration:none;cursor:pointer}
.btn.secondary{background:var(--soft);color:var(--muted)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.field{display:block;margin:12px 0}
.field span{display:block;font-size:13px;color:var(--muted);margin-bottom:4px}
input,select,textarea{width:100%;min-height:48px;font:inherit;font-size:16px;padding:12px 14px;border:0;border-radius:14px;background:var(--soft);color:var(--ink)}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0}
.row + .row{border-top:0}
.nav{position:fixed;left:0;right:0;bottom:0;background:var(--panel);display:flex;justify-content:space-around;padding:8px 8px 20px}
.nav a{flex:1;text-align:center;font-size:12px;color:var(--muted);text-decoration:none;padding:6px 0}
.nav a.active{color:var(--accent);font-weight:600}
.bar{height:8px;border-radius:4px;background:var(--soft);overflow:hidden}
.bar > i{display:block;height:100%;background:var(--accent)}
.bar.on-accent{background:rgba(248,245,239,.2)}
.bar.on-accent > i{background:var(--on-accent)}
.flash{background:var(--soft);border-radius:14px;padding:12px 14px;margin:12px 0}
.flash.error{color:var(--loss)}
`
