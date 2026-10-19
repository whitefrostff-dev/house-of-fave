const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const admin = require("firebase-admin");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const ADMIN_EMAILS = new Set([
  "favouranigbogu44@gmail.com",
  "whitefrostff@gmail.com"
].map(x => x.toLowerCase()));

let pool;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost")
      ? false
      : { rejectUnauthorized: false }
  });
}

function initFirebase() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.warn("FIREBASE_SERVICE_ACCOUNT_JSON is missing; admin API will not authenticate.");
    return;
  }
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(raw)),
      projectId: process.env.FIREBASE_PROJECT_ID || undefined
    });
  } catch (err) {
    console.error("Firebase Admin initialization failed:", err.message);
  }
}
initFirebase();

async function requireAdmin(req, res, next) {
  try {
    if (!admin.apps.length) {
      return res.status(503).json({ error: "Admin authentication is not configured yet." });
    }
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer (.+)$/i);
    if (!match) return res.status(401).json({ error: "Please sign in with Google." });
    const decoded = await admin.auth().verifyIdToken(match[1]);
    const email = String(decoded.email || "").toLowerCase();
    if (!decoded.email_verified || !ADMIN_EMAILS.has(email)) {
      return res.status(403).json({ error: "This Google account is not authorized to manage the store." });
    }
    req.adminEmail = email;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Your sign-in expired. Please sign in again." });
  }
}

async function requireDatabase(res) {
  if (!pool) {
    res.status(503).json({ error: "Database is not configured. Add DATABASE_URL in Render environment variables." });
    return false;
  }
  return true;
}

async function createTable() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price NUMERIC(12,2) NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT 'Fashion',
      image_url TEXT NOT NULL DEFAULT '',
      available BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
createTable().catch(err => console.error("Database table setup failed:", err.message));

app.get("/api/config", (_req, res) => {
  res.json({
    firebaseApiKey: process.env.FIREBASE_API_KEY || "",
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "",
    firebaseAppId: process.env.FIREBASE_APP_ID || "",
    whatsappNumber: (process.env.WHATSAPP_NUMBER || "").replace(/\D/g, "")
  });
});

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "HOUSE OF FAVÉ" }));

app.get("/api/products", async (req, res) => {
  if (!await requireDatabase(res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT id, name, description, price::float AS price, category, image_url,
              available, created_at
       FROM products
       WHERE ($1::boolean = TRUE OR available = TRUE)
       ORDER BY created_at DESC`,
      [req.query.includeUnavailable === "true"]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load products." });
  }
});

app.post("/api/products", requireAdmin, async (req, res) => {
  if (!await requireDatabase(res)) return;
  const { name, description = "", price, category = "Fashion", image_url = "", available = true } = req.body || {};
  if (!String(name || "").trim()) return res.status(400).json({ error: "Product name is required." });
  if (!Number.isFinite(Number(price)) || Number(price) < 0) return res.status(400).json({ error: "Enter a valid price." });
  if (String(image_url).length > 2000) return res.status(400).json({ error: "Image URL is too long." });
  try {
    const { rows } = await pool.query(
      `INSERT INTO products (name, description, price, category, image_url, available)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, name, description, price::float AS price, category, image_url, available`,
      [String(name).trim(), String(description).trim(), Number(price), String(category).trim() || "Other", String(image_url).trim(), Boolean(available)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save product." });
  }
});

app.put("/api/products/:id", requireAdmin, async (req, res) => {
  if (!await requireDatabase(res)) return;
  const { name, description = "", price, category = "Fashion", image_url = "", available = true } = req.body || {};
  if (!String(name || "").trim()) return res.status(400).json({ error: "Product name is required." });
  if (!Number.isFinite(Number(price)) || Number(price) < 0) return res.status(400).json({ error: "Enter a valid price." });
  try {
    const { rows } = await pool.query(
      `UPDATE products SET name=$1, description=$2, price=$3, category=$4,
       image_url=$5, available=$6, updated_at=NOW() WHERE id=$7
       RETURNING id, name, description, price::float AS price, category, image_url, available`,
      [String(name).trim(), String(description).trim(), Number(price), String(category).trim() || "Other", String(image_url).trim(), Boolean(available), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Product not found." });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update product." });
  }
});

app.delete("/api/products/:id", requireAdmin, async (req, res) => {
  if (!await requireDatabase(res)) return;
  try {
    const result = await pool.query("DELETE FROM products WHERE id=$1", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Product not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete product." });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`HOUSE OF FAVÉ listening on ${PORT}`));
