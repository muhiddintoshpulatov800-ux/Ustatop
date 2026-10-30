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

const ADMIN_HTML = String.raw`<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>UstaTop admin</title>
<style>
:root{color-scheme:dark}
body{margin:0 auto;background:#14120e;color:#f3ecda;font:16px/1.5 system-ui,sans-serif;padding:16px;max-width:720px}
h1{font-size:1.4rem}
input,button{font:inherit;padding:10px;border-radius:10px;border:1px solid #3a3427;background:#1f1c15;color:#f3ecda}
button{background:#d4a94a;color:#14120e;border:0;font-weight:700;cursor:pointer}
button.g{background:#3a3427;color:#f3ecda}
.c{background:#1f1c15;border:1px solid #3a3427;border-radius:12px;padding:14px;margin:10px 0}
.p{color:#d4a94a;font-weight:700}.o{color:#7fd1a0;font-weight:700}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.row input{flex:1;min-width:120px}
</style></head><body>
<h1>UstaTop admin</h1>
<div id="login"><input id="k" type="password" placeholder="Admin parol"> <button id="go">Kirish</button><p id="e"></p></div>
<div id="main" hidden><div class="c"><button id="pb">🔔 Bildirishnomani yoqish</button><p id="pm"></p></div><div class="c">Yigʻilgan komissiya (bajarilgan buyurtmalar): <b id="tot"></b></div><div id="l"></div><h2>Buyurtmalar</h2><div id="ol"></div></div>
<script>
var key="";
function $(i){return document.getElementById(i)}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function f(n){return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g," ")+" soʻm"}
function api(p,b){var o={headers:{"x-admin-key":key,"Content-Type":"application/json"}};if(b){o.method="POST";o.body=JSON.stringify(b)}
  return fetch(p,o).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||"Xatolik");return j})})}
function load(){api("/api/admin/masters").then(function(d){
  $("login").hidden=true;$("main").hidden=false;$("tot").textContent=f(d.commission);
  var ms=d.masters.slice().sort(function(a,b){return (a.approved?1:0)-(b.approved?1:0)});
  $("l").innerHTML=ms.map(function(m){
    return '<div class="c"><b>'+esc(m.name)+'</b> · '+esc(m.cat)+' · '+esc(m.zone)+'<br>+'+esc(m.phone)+' · '+m.services.map(function(s){return esc(s.title)+': '+f(s.price)}).join(', ')+' · '+m.from+'–'+m.to+'<br>'
    +(m.approved?'<span class="o">Tasdiqlangan</span>':'<span class="p">Tasdiq kutilmoqda</span>')+' · Qarz (komissiya): <b>'+f(m.owed)+'</b>'
    +'<div class="row"><button class="'+(m.approved?'g':'')+'" data-a="'+(m.approved?'0':'1')+'" data-i="'+m.id+'">'+(m.approved?'Roʻyxatdan olib tashlash':'Tasdiqlash')+'</button></div>'
    +'<div class="row"><input type="number" min="1" placeholder="Usta oʻtkazgan summa" id="p'+m.id+'"><button class="g" data-pay="'+m.id+'">Toʻlov qabul qildim</button></div></div>';
  }).join("")||'<p>Hozircha ustalar yoʻq.</p>';
  Array.prototype.forEach.call($("l").querySelectorAll("button[data-i]"),function(b){b.onclick=function(){
    api("/api/admin/approve",{id:b.dataset.i,approved:b.dataset.a==="1"}).then(load).catch(function(e){alert(e.message)})}});
  Array.prototype.forEach.call($("l").querySelectorAll("button[data-pay]"),function(b){b.onclick=function(){
    var a=+$("p"+b.dataset.pay).value;if(!(a>0)){alert("Summani kiriting");return}
    api("/api/admin/paid",{id:b.dataset.pay,amount:a}).then(load).catch(function(e){alert(e.message)})}});
orders();
}).catch(function(e){$("e").textContent=e.message;$("login").hidden=false;$("main").hidden=true})}
var ST={yangi:"Yangi",qabul:"Qabul qilingan",bajarildi:"Bajarildi",bekor:"Bekor qilingan"};
function orders(){api("/api/admin/orders").then(function(os){
  $("ol").innerHTML=os.map(function(o){var fin=o.status==="bajarildi"||o.status==="bekor";
    return '<div class="c"><b>'+esc(o.service)+' · '+f(o.total)+'</b><br>Usta: '+esc(o.master)+' · Mijoz: +'+esc(o.customerPhone)+'<br>'+esc(o.address)+' · Komissiya: '+f(o.fee)+'<br><span class="'+(o.status==="bajarildi"?'o':'p')+'">'+(ST[o.status]||o.status)+'</span>'+(fin?'<div class="row"><button class="g" data-del="'+o.id+'">Oʻchirish</button></div>':'')+'</div>'}).join("")||'<p>Hozircha buyurtma yoʻq.</p>';
  Array.prototype.forEach.call($("ol").querySelectorAll("button[data-del]"),function(b){b.onclick=function(){
    if(confirm("Roʻyxatdan oʻchirilsinmi? (Bajarilgan ishning komissiya hisobi saqlanib qoladi)"))api("/api/admin/orders/delete",{id:b.dataset.del}).then(load).catch(function(e){alert(e.message)})}});
}).catch(function(){})}
function b64(s){var p="=".repeat((4-s.length%4)%4),r=atob((s+p).replace(/-/g,"+").replace(/_/g,"/")),o=new Uint8Array(r.length);for(var i=0;i<r.length;i++)o[i]=r.charCodeAt(i);return o}
$("pb").onclick=function(){
  if(typeof Notification==="undefined"||!navigator.serviceWorker||!window.PushManager){$("pm").textContent="Bu brauzer bildirishnomani qoʻllamaydi.";return}
  Notification.requestPermission().then(function(p){
    if(p!=="granted"){$("pm").textContent="Ruxsat berilmadi.";return}
    return navigator.serviceWorker.register("/sw.js").then(function(){return navigator.serviceWorker.ready}).then(function(reg){
      return api("/api/push/key").then(function(k){return reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(k.key)})})})
    .then(function(sub){return api("/api/push/subscribe",{sub:sub.toJSON()})})
    .then(function(){$("pm").textContent="Yoqildi: yangi buyurtmada telefoningizga xabar keladi."})
  }).catch(function(e){$("pm").textContent="Xato: "+e.message})};
$("go").onclick=function(){key=$("k").value;load()};
</script></body></html>
`;

const adminFails = {};
function adminOk(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress).split(",")[0].trim();
  const f = adminFails[ip] || (adminFails[ip] = { n: 0, until: 0 });
  if (Date.now() < f.until) return false;
  const a = Buffer.from(String(req.headers["x-admin-key"] || "")), b = Buffer.from(ADMIN_KEY);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) { f.n = 0; return true; }
  if (++f.n >= 10) { f.n = 0; f.until = Date.now() + 600000; }
  return false;
}

// ---- Veb-bildirishnoma (Web Push), tashqi kutubxonasiz ----
const SW_JS = `self.addEventListener("push", function (e) { e.waitUntil(self.registration.showNotification("UstaTop", { body: "Yangi buyurtma keldi! Ochish uchun bosing.", tag: "order", renotify: true })); });
self.addEventListener("notificationclick", function (e) { e.notification.close(); e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (l) { for (var i = 0; i < l.length; i++) { if ("focus" in l[i]) return l[i].focus(); } return clients.openWindow("/"); })); });`;
const b64u = buf => Buffer.from(buf).toString("base64url");
function vapid() {
  if (!db.vapid) {
    const k = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const pj = k.publicKey.export({ format: "jwk" }), kj = k.privateKey.export({ format: "jwk" });
    db.vapid = { x: pj.x, y: pj.y, d: kj.d }; save();
  }
  return db.vapid;
}
const vapidPub = () => { const v = vapid(); return b64u(Buffer.concat([Buffer.from([4]), Buffer.from(v.x, "base64url"), Buffer.from(v.y, "base64url")])); };
function vapidAuth(endpoint) {
  const v = vapid(), key = crypto.createPrivateKey({ key: { kty: "EC", crv: "P-256", x: v.x, y: v.y, d: v.d }, format: "jwk" });
  const head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: process.env.VAPID_SUBJECT || process.env.RENDER_EXTERNAL_URL || "mailto:admin@example.com" }));
  const sig = crypto.sign("sha256", Buffer.from(head + "." + body), { key, dsaEncoding: "ieee-p1363" });
  return "vapid t=" + head + "." + body + "." + b64u(sig) + ", k=" + vapidPub();
}
const okEndpoint = ep => /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|mozilla\.com|apple\.com|windows\.com|microsoft\.com)\//.test(ep)
  || (process.env.NODE_ENV !== "production" && /^http:\/\/localhost[:/]/.test(ep));
async function pushTo(subs) {
  const dead = [];
  await Promise.all((subs || []).map(async s => {
    try {
      const r = await fetch(s.endpoint, { method: "POST", headers: { Authorization: vapidAuth(s.endpoint), TTL: "3600", Urgency: "high" } });
      if (r.status === 404 || r.status === 410) dead.push(s.endpoint); else if (!r.ok) console.error("push", r.status);
    } catch (e) { console.error("push xato", e.message); }
  }));
  return dead;
}
function notifyOrder(m) {
  pushTo(m.push).then(d => { if (d.length) { m.push = m.push.filter(s => !d.includes(s.endpoint)); save(); } });
  pushTo(db.adminPush).then(d => { if (d.length) { db.adminPush = db.adminPush.filter(s => !d.includes(s.endpoint)); save(); } });
}

const pm = s => { const a = s.split(":"); return +a[0] * 60 + +a[1]; };
const nowMin = () => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Samarkand", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).split(":"); return +p[0] * 60 + +p[1]; };
const online = m => { const t = nowMin(); return Date.now() - m.seen < 150000 && t >= pm(m.from) && t < pm(m.to); };
const pub = m => ({ id: m.id, name: m.name, cat: m.cat, zone: m.zone, services: svc(m), price: Math.min(...svc(m).map(x => x.price)), from: m.from, to: m.to, rating: m.rating, jobs: m.jobs, online: online(m) });
const norm = p => { p = String(p || "").replace(/\D/g, ""); if (p.length === 9) p = "998" + p; return p.length === 12 && p.startsWith("998") ? p : null; };
const svc = m => (m.services && m.services.length ? m.services : [{ title: m.cat, price: m.price }]);
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
  "GET /api/masters": async () => [200, { rate: RATE, cats: CATS, zones: ZONES, masters: db.masters.filter(m => m.approved).map(pub) }],

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
    const name = String(b.name || "").trim(), services = Array.isArray(b.services) ? b.services.slice(0, 10).map(x => ({ title: String((x && x.title) || "").trim().slice(0, 60), price: Math.round(+(x && x.price)) })) : [];
    if (name.length < 2 || name.length > 60) return [400, { error: "Ismni kiriting" }];
    if (!CATS.includes(b.cat) || !ZONES.includes(b.zone)) return [400, { error: "Xizmat yoki hudud notoʻgʻri" }];
    if (!services.length || services.some(x => x.title.length < 2 || !(x.price >= 5000 && x.price <= 5000000))) return [400, { error: "Har bir xizmat nomini va narxini (5 000 – 5 000 000 soʻm) kiriting" }];
    if (!okTime(b.from) || !okTime(b.to) || pm(b.from) >= pm(b.to)) return [400, { error: "Ish vaqtini tekshiring" }];
    if (!m) { m = { id: id(), phone, rating: 0, jobs: 0, approved: false }; setPin(m, pin); db.masters.push(m); }
    m.fails = 0;
    Object.assign(m, { name, cat: b.cat, zone: b.zone, services, price: Math.min(...services.map(x => x.price)), from: b.from, to: b.to, seen: Date.now(), token: id() + id() });
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
    const m = db.masters.find(x => x.id === b.masterId && x.approved), si = +b.service, cphone = norm(b.phone);
    if (!m) return [404, { error: "Usta topilmadi" }];
    const sv = svc(m)[si]; if (!sv) return [400, { error: "Xizmatni tanlang" }];
    if (!cphone) return [400, { error: "Telefon raqamingizni kiriting" }];
    const address = String(b.address || "").trim().slice(0, 200); if (!address) return [400, { error: "Manzilni kiriting" }];
    const total = sv.price, fee = Math.round(total * RATE);
    const o = { id: id(), masterId: m.id, service: sv.title, address, problem: String(b.problem || "").slice(0, 500), customerPhone: cphone,
      total, fee, payout: total - fee, status: "yangi", created: Date.now(), ctoken: id() + id(), chat: [] };
    db.orders.push(o); save(); notifyOrder(m);
    return [200, { order: { ...o, ctoken: undefined, chat: undefined }, ctoken: o.ctoken, masterName: m.name, masterPhone: "+" + m.phone }];
  },

  "GET /api/my-orders": async req => { const m = authMaster(req); return m ? [200, db.orders.filter(o => o.masterId === m.id && !o.archived).map(o => ({ ...o, ctoken: undefined, chat: undefined }))] : [401, { error: "Kiring" }]; },
  "POST /api/orders/status": async (req, res, b) => {
    const m = authMaster(req); if (!m) return [401, { error: "Kiring" }];
    const o = db.orders.find(x => x.id === b.id && x.masterId === m.id);
    if (!o || !["qabul", "bajarildi", "bekor"].includes(b.status)) return [400, { error: "Notoʻgʻri soʻrov" }];
    if (b.status === "bajarildi" && o.status !== "bajarildi") m.jobs++;
    o.status = b.status; save(); return [200, { ...o, ctoken: undefined, chat: undefined }];
  },

  // Admin: ustalarni tasdiqlash va daromadni koʻrish. Sarlavha: x-admin-key
  "GET /api/admin/masters": async req => !adminOk(req) ? [403, { error: "Ruxsat yoʻq" }]
    : [200, { masters: db.masters.map(m => ({ ...pub(m), phone: m.phone, approved: m.approved, owed: owed(m) })),
              commission: db.orders.filter(o => o.status === "bajarildi").reduce((s, o) => s + o.fee, 0) }],
  // Usta komissiyani sizga o'tkazganda yozib qo'ying: owed kamayadi
  "POST /api/admin/paid": async (req, res, b) => {
    if (!adminOk(req)) return [403, { error: "Ruxsat yoʻq" }];
    const m = db.masters.find(x => x.id === b.id), a = +b.amount; if (!m || !(a > 0)) return [400, { error: "Notoʻgʻri soʻrov" }];
    m.paid = (m.paid || 0) + a; save(); return [200, { owed: owed(m) }];
  },
  // Admin: buyurtmalar roʻyxati va oʻchirish. Bekor qilingani butunlay oʻchadi, bajarilgani
  // roʻyxatdan yashiriladi (komissiya hisobi saqlanib qoladi).
  "GET /api/admin/orders": async req => !adminOk(req) ? [403, { error: "Ruxsat yoʻq" }]
    : [200, db.orders.filter(o => !o.archived).slice().reverse().map(o => ({ id: o.id, master: (db.masters.find(m => m.id === o.masterId) || {}).name || "?",
        service: o.service, address: o.address, customerPhone: o.customerPhone, total: o.total, fee: o.fee, status: o.status, created: o.created }))],
  "POST /api/admin/orders/delete": async (req, res, b) => {
    if (!adminOk(req)) return [403, { error: "Ruxsat yoʻq" }];
    const i = db.orders.findIndex(x => x.id === b.id); if (i < 0) return [404, { error: "Topilmadi" }];
    const o = db.orders[i];
    if (o.status === "bekor") db.orders.splice(i, 1);
    else if (o.status === "bajarildi") o.archived = true;
    else return [400, { error: "Faqat bajarilgan yoki bekor qilingan buyurtmani oʻchirish mumkin" }];
    save(); return [200, { ok: true }];
  },
  "GET /api/push/key": async () => [200, { key: vapidPub() }],
  "POST /api/push/subscribe": async (req, res, b) => {
    const sub = b.sub;
    if (!sub || typeof sub.endpoint !== "string" || !okEndpoint(sub.endpoint) || !sub.keys) return [400, { error: "Obuna notoʻgʻri" }];
    const item = { endpoint: sub.endpoint, keys: sub.keys };
    const add = (list, max) => [item].concat((list || []).filter(x => x.endpoint !== item.endpoint)).slice(0, max);
    if (req.headers["x-admin-key"]) { if (!adminOk(req)) return [403, { error: "Ruxsat yoʻq" }]; db.adminPush = add(db.adminPush, 10); }
    else { const m = authMaster(req); if (!m) return [401, { error: "Kiring" }]; m.push = add(m.push, 5); }
    save(); return [200, { ok: true }];
  },
  "POST /api/admin/approve": async (req, res, b) => {
    if (!adminOk(req)) return [403, { error: "Ruxsat yoʻq" }];
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
  if (url.pathname === "/sw.js") { res.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-cache" }); return res.end(SW_JS); }
  if (url.pathname === "/admin") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return res.end(ADMIN_HTML); }
  if (url.pathname !== "/" && url.pathname !== "/index.html") { res.writeHead(404); return res.end("Topilmadi"); }
  const f = ["page.html", "site.html", "index.html"].map(n => path.join(__dirname, n)).find(q => fs.existsSync(q));
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end("Topilmadi"); } res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(d); });
});
loadDb().then(() => { seed(); server.listen(PORT, () => console.log("UstaTop: http://localhost:" + PORT)); })
  .catch(e => { console.error(e.message); process.exit(1); });
