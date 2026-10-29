// UstaTop backend: Node 18+, tashqi kutubxonasiz. Ishga tushirish: node server.js
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "oʻzgartiring";
const RATE = 0.12; // platforma komissiyasi
const DB_FILE = path.join(__dirname, "data.json");
const CATS = ["Santexnik", "Elektrik", "Konditsioner", "Maishiy texnika", "Tozalash", "Mebel yigʻish",
  "Kompyuter ustasi", "Wi-Fi va tarmoq", "Videokuzatuv", "Printer va kartridj"];
const ZONES = ["Markaz", "Shimol", "Janub", "Sharq", "Gʻarb"];

// Ma'lumot saqlash: SUPABASE_URL va SUPABASE_KEY bo'lsa bepul Supabase bazasida, bo'lmasa data.json faylida.
const SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_KEY;
const sbH = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" };
let db = { masters: [], orders: [] }, timer = null;
async function loadDb() {
  if (SB_URL && SB_KEY) {
    const r = await fetch(SB_URL + "/rest/v1/kv?k=eq.db&select=v", { headers: sbH });
    if (!r.ok) throw new Error("Supabase oʻqish xatosi: " + r.status);
    const rows = await r.json(); if (rows[0]) db = rows[0].v;
  } else { try { db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch (e) {} }
}
async function flush() {
  if (SB_URL && SB_KEY) {
    const r = await fetch(SB_URL + "/rest/v1/kv", { method: "POST", headers: { ...sbH, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ k: "db", v: db }) });
    if (!r.ok) console.error("Supabase yozish xatosi", r.status);
  } else fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 1));
}
const save = () => { clearTimeout(timer); timer = setTimeout(() => flush().catch(e => console.error(e.message)), 500); };
process.on("SIGTERM", () => flush().finally(() => process.exit(0)));
const id = () => crypto.randomBytes(6).toString("hex");

// Faqat sinov uchun: SEED=1 node server.js
function seed() {
  if (!process.env.SEED || db.masters.length) return;
  {
  [["Anvar Tursunov", "Santexnik", "Markaz", 80000], ["Dilshod Rahimov", "Elektrik", "Shimol", 70000],
   ["Bobur Karimov", "Konditsioner", "Janub", 150000], ["Malika Saidova", "Tozalash", "Sharq", 120000],
   ["Jahongir Qodirov", "Kompyuter ustasi", "Markaz", 60000], ["Sanjar Yoqubov", "Wi-Fi va tarmoq", "Shimol", 70000]]
    .forEach((m, i) => db.masters.push({ id: id(), phone: "99890000000" + i, name: m[0], cat: m[1], zone: m[2], price: m[3],
      from: "08:00", to: "18:00", rating: 0, jobs: 0, approved: true, seen: Date.now(), token: id() }));
  save();
}
}

const pm = s => { const a = s.split(":"); return +a[0] * 60 + +a[1]; };
const nowMin = () => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Samarkand", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).split(":"); return +p[0] * 60 + +p[1]; };
const online = m => { const t = nowMin(); return Date.now() - m.seen < 150000 && t >= pm(m.from) && t < pm(m.to); };
const pub = m => ({ id: m.id, name: m.name, cat: m.cat, zone: m.zone, price: m.price, from: m.from, to: m.to, rating: m.rating, jobs: m.jobs, online: online(m) });
const norm = p => { p = String(p || "").replace(/\D/g, ""); if (p.length === 9) p = "998" + p; return p.length === 12 && p.startsWith("998") ? p : null; };
const okTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || "");

function send(res, code, obj) { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(obj)); }
function readBody(req) {
  return new Promise((ok, no) => {
    let s = ""; req.on("data", c => { s += c; if (s.length > 1e5) { req.destroy(); no(new Error("Juda katta")); } });
    req.on("end", () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { no(new Error("Notoʻgʻri JSON")); } });
  });
}
const owed = m => db.orders.filter(o => o.masterId === m.id && o.status === "bajarildi").reduce((s, o) => s + o.fee, 0) - (m.paid || 0);
const orderFor = (req, q) => {
  const o = db.orders.find(x => x.id === q.orderId); if (!o) return null;
  const m = authMaster(req);
  if (m && m.id === o.masterId) return [o, "usta"];
  if (q.ctoken && q.ctoken === o.ctoken) return [o, "mijoz"];
  return null;
};
const authMaster = req => { const t = (req.headers.authorization || "").replace("Bearer ", ""); return t && db.masters.find(m => m.token === t); };

const setPin = (m, pin) => { m.salt = crypto.randomBytes(8).toString("hex"); m.pin = crypto.scryptSync(pin, m.salt, 32).toString("hex"); };
const checkPin = (m, pin) => m.pin && m.salt && crypto.timingSafeEqual(Buffer.from(m.pin, "hex"), crypto.scryptSync(pin, m.salt, 32));

const routes = {
  "GET /api/masters": async () => [200, { cats: CATS, zones: ZONES, masters: db.masters.filter(m => m.approved).map(pub) }],

  // Roʻyxatdan oʻtish va qayta kirish (telefon bo'yicha)
  "POST /api/register": async (req, res, b) => {
    const phone = norm(b.phone), pin = String(b.pin || "");
    if (!phone) return [400, { error: "Telefon raqami notoʻgʻri" }];
    if (!/^\d{4,8}$/.test(pin)) return [400, { error: "PIN 4–8 ta raqamdan iborat boʻlsin" }];
    let m = db.masters.find(x => x.phone === phone);
    if (m) {
      if (m.lockUntil > Date.now()) return [429, { error: "Juda koʻp xato urinish. 10 daqiqadan keyin urining" }];
      if (!checkPin(m, pin)) { m.fails = (m.fails || 0) + 1; if (m.fails >= 5) { m.lockUntil = Date.now() + 600000; m.fails = 0; } save(); return [403, { error: "Bu raqam roʻyxatdan oʻtgan, PIN notoʻgʻri" }]; }
    }
    const name = String(b.name || "").trim(), price = +b.price;
    if (name.length < 2 || name.length > 60) return [400, { error: "Ismni kiriting" }];
    if (!CATS.includes(b.cat) || !ZONES.includes(b.zone)) return [400, { error: "Xizmat yoki hudud notoʻgʻri" }];
    if (!(price >= 10000 && price <= 2000000)) return [400, { error: "Narx 10 000 – 2 000 000 oraligʻida boʻlsin" }];
    if (!okTime(b.from) || !okTime(b.to) || pm(b.from) >= pm(b.to)) return [400, { error: "Ish vaqtini tekshiring" }];
    if (!m) { m = { id: id(), phone, rating: 0, jobs: 0, approved: false }; setPin(m, pin); db.masters.push(m); }
    m.fails = 0;
    Object.assign(m, { name, cat: b.cat, zone: b.zone, price, from: b.from, to: b.to, seen: Date.now(), token: id() + id() });
    save();
    return [200, { token: m.token, approved: m.approved }];
  },

  // Buyurtma ichidagi suhbat (usta: Bearer token, mijoz: ctoken)
  "GET /api/chat": async (req, res, q) => { const r = orderFor(req, q); return r ? [200, { status: r[0].status, messages: r[0].chat }] : [403, { error: "Ruxsat yoʻq" }]; },
  "POST /api/chat": async (req, res, b) => {
    const r = orderFor(req, b); if (!r) return [403, { error: "Ruxsat yoʻq" }];
    const text = String(b.text || "").trim().slice(0, 500);
    if (!text) return [400, { error: "Xabar boʻsh" }];
    if (r[0].chat.length >= 500) return [400, { error: "Suhbat limiti tugadi" }];
    r[0].chat.push({ from: r[1], text, t: Date.now() }); save(); return [200, { ok: true }];
  },
  "GET /api/me": async req => { const m = authMaster(req); return m ? [200, { ...pub(m), phone: m.phone, approved: m.approved }] : [401, { error: "Kiring" }]; },
  "POST /api/beat": async req => { const m = authMaster(req); if (!m) return [401, { error: "Kiring" }]; m.seen = Date.now(); save(); return [200, { ok: true }]; },

  "POST /api/orders": async (req, res, b) => {
    const m = db.masters.find(x => x.id === b.masterId && x.approved), hours = +b.hours, cphone = norm(b.phone);
    if (!m) return [404, { error: "Usta topilmadi" }];
    if (!(hours >= 1 && hours <= 12)) return [400, { error: "Soatni tekshiring" }];
    if (!cphone) return [400, { error: "Telefon raqamingizni kiriting" }];
    const address = String(b.address || "").trim().slice(0, 200); if (!address) return [400, { error: "Manzilni kiriting" }];
    const total = m.price * hours, fee = Math.round(total * RATE);
    const o = { id: id(), masterId: m.id, hours, address, problem: String(b.problem || "").slice(0, 500), customerPhone: cphone,
      total, fee, payout: total - fee, status: "yangi", created: Date.now(), ctoken: id() + id(), chat: [] };
    db.orders.push(o); save();
    return [200, { order: { ...o, ctoken: undefined, chat: undefined }, ctoken: o.ctoken, masterName: m.name, masterPhone: "+" + m.phone }];
  },

  "GET /api/my-orders": async req => { const m = authMaster(req); return m ? [200, db.orders.filter(o => o.masterId === m.id).map(o => ({ ...o, ctoken: undefined, chat: undefined }))] : [401, { error: "Kiring" }]; },
  "POST /api/orders/status": async (req, res, b) => {
    const m = authMaster(req); if (!m) return [401, { error: "Kiring" }];
    const o = db.orders.find(x => x.id === b.id && x.masterId === m.id);
    if (!o || !["qabul", "bajarildi", "bekor"].includes(b.status)) return [400, { error: "Notoʻgʻri soʻrov" }];
    if (b.status === "bajarildi" && o.status !== "bajarildi") m.jobs++;
    o.status = b.status; save(); return [200, { ...o, ctoken: undefined, chat: undefined }];
  },

  // Admin: ustalarni tasdiqlash va daromadni koʻrish. Sarlavha: x-admin-key
  "GET /api/admin/masters": async req => req.headers["x-admin-key"] !== ADMIN_KEY ? [403, { error: "Ruxsat yoʻq" }]
    : [200, { masters: db.masters.map(m => ({ ...pub(m), phone: m.phone, approved: m.approved, owed: owed(m) })),
              commission: db.orders.filter(o => o.status === "bajarildi").reduce((s, o) => s + o.fee, 0) }],
  // Usta komissiyani sizga o'tkazganda yozib qo'ying: owed kamayadi
  "POST /api/admin/paid": async (req, res, b) => {
    if (req.headers["x-admin-key"] !== ADMIN_KEY) return [403, { error: "Ruxsat yoʻq" }];
    const m = db.masters.find(x => x.id === b.id), a = +b.amount; if (!m || !(a > 0)) return [400, { error: "Notoʻgʻri soʻrov" }];
    m.paid = (m.paid || 0) + a; save(); return [200, { owed: owed(m) }];
  },
  "POST /api/admin/approve": async (req, res, b) => {
    if (req.headers["x-admin-key"] !== ADMIN_KEY) return [403, { error: "Ruxsat yoʻq" }];
    const m = db.masters.find(x => x.id === b.id); if (!m) return [404, { error: "Topilmadi" }];
    m.approved = b.approved !== false; save(); return [200, { ok: true }];
  }
};

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const h = routes[req.method + " " + url.pathname];
  if (h) {
    try { const b = req.method === "POST" ? await readBody(req) : Object.fromEntries(url.searchParams); const [c, o] = await h(req, res, b); return send(res, c, o); }
    catch (e) { return send(res, 400, { error: e.message }); }
  }
  if (url.pathname !== "/" && url.pathname !== "/index.html") { res.writeHead(404); return res.end("Topilmadi"); }
  const f = fs.existsSync(path.join(__dirname, "public", "index.html")) ? path.join(__dirname, "public", "index.html") : path.join(__dirname, "index.html");
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end("Topilmadi"); } res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(d); });
});
loadDb().then(() => { seed(); server.listen(PORT, () => console.log("UstaTop: http://localhost:" + PORT)); })
  .catch(e => { console.error(e.message); process.exit(1); });
