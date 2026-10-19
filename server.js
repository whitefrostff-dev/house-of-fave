const express = require("express");
const crypto = require("crypto");
const { Pool } = require("pg");
const path = require("path");

const ADMINS = ["whitefrostff@gmail.com", "favouranigbogu44@gmail.com"];
const SECRET = process.env.SECRET || "change-me";
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const app = express();
app.use(express.json({ limit: "5mb" }));
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get(["/admin", "/admin.html"], (_, res) => res.sendFile(path.join(__dirname, "admin.html")));

const sign = (s) => crypto.createHmac("sha256", SECRET).update(s).digest("hex");
function auth(req, res, next) {
  const [body, sig] = (req.headers.authorization || "").replace("Bearer ", "").split(".");
  if (!body || sig !== sign(body)) return res.status(401).json({ error: "Unauthorized" });
  const { e, x } = JSON.parse(Buffer.from(body, "base64url").toString());
  if (x < Date.now() || !ADMINS.includes(e)) return res.status(401).json({ error: "Session expired" });
  next();
}

pool.query(`CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
  price NUMERIC DEFAULT 0, description TEXT DEFAULT '', image TEXT DEFAULT '',
  sold_out BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now())`).catch(console.error);

app.get("/api/config", (_, res) => res.json({ clientId: CLIENT_ID }));

pool.query(`CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY, type TEXT NOT NULL, name TEXT DEFAULT '', vid TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now())`).catch(console.error);

app.post("/api/track", async (req, res) => {
  const { type, name, vid } = req.body || {};
  if (["visit", "order", "checkout", "booking"].includes(type))
    await pool.query("INSERT INTO events(type,name,vid) VALUES($1,$2,$3)",
      [type, String(name || "").slice(0, 100), String(vid || "").slice(0, 40)]).catch(() => {});
  res.json({ ok: true });
});

app.get("/api/stats", auth, async (_, res) => {
  const L = "(created_at AT TIME ZONE 'Africa/Lagos')::date";
  const T = "(now() AT TIME ZONE 'Africa/Lagos')::date";
  const ORD = "type IN ('order','checkout')";
  const t = await pool.query(`SELECT
    count(*) FILTER (WHERE type='visit') visits_all,
    count(DISTINCT vid) FILTER (WHERE type='visit') people_all,
    count(*) FILTER (WHERE type='visit' AND ${L}=${T}) visits_today,
    count(DISTINCT vid) FILTER (WHERE type='visit' AND ${L}=${T}) people_today,
    count(DISTINCT vid) FILTER (WHERE type='visit' AND created_at > now()-interval '7 days') people_7,
    count(*) FILTER (WHERE ${ORD}) orders_all,
    count(*) FILTER (WHERE ${ORD} AND ${L}=${T}) orders_today,
    count(*) FILTER (WHERE ${ORD} AND created_at > now()-interval '7 days') orders_7,
    count(*) FILTER (WHERE type='booking') bookings_all FROM events`);
  const days = await pool.query(`SELECT ${L} AS day,
    count(DISTINCT vid) FILTER (WHERE type='visit') people,
    count(*) FILTER (WHERE ${ORD}) orders FROM events
    WHERE created_at > now()-interval '7 days' GROUP BY 1 ORDER BY 1 DESC`);
  const top = await pool.query(`SELECT name, count(*) c FROM events WHERE type='order' AND name<>''
    GROUP BY name ORDER BY c DESC LIMIT 5`);
  res.json({ totals: t.rows[0], days: days.rows, top: top.rows });
});

app.post("/api/google-login", async (req, res) => {
  try {
    const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(req.body.credential || ""));
    const g = await r.json();
    const email = String(g.email || "").toLowerCase();
    if (!r.ok || g.aud !== CLIENT_ID || g.email_verified !== "true" || !ADMINS.includes(email))
      return res.status(403).json({ error: "This Google account is not allowed" });
    const body = Buffer.from(JSON.stringify({ e: email, x: Date.now() + 30 * 24 * 36e5 })).toString("base64url");
    res.json({ token: body + "." + sign(body), email });
  } catch { res.status(500).json({ error: "Google sign-in failed" }); }
});

app.get("/api/products", async (_, res) => {
  const r = await pool.query("SELECT * FROM products ORDER BY id DESC");
  res.json(r.rows);
});
app.post("/api/products", auth, async (req, res) => {
  const { name, category, price, description, image, sold_out } = req.body;
  const r = await pool.query(
    "INSERT INTO products(name,category,price,description,image,sold_out) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
    [name, category, price || 0, description || "", image || "", !!sold_out]);
  res.json(r.rows[0]);
});
app.put("/api/products/:id", auth, async (req, res) => {
  const { name, category, price, description, image, sold_out } = req.body;
  const r = await pool.query(
    "UPDATE products SET name=$1,category=$2,price=$3,description=$4,image=$5,sold_out=$6 WHERE id=$7 RETURNING *",
    [name, category, price || 0, description || "", image || "", !!sold_out, req.params.id]);
  res.json(r.rows[0]);
});
app.delete("/api/products/:id", auth, async (req, res) => {
  await pool.query("DELETE FROM products WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => console.log("House of Favé running"));
