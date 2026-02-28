// backend/src/server.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db.js";

dotenv.config();

const app = express();

// ===== Env =====
const PORT = Number(process.env.PORT || 5000);

// Optional: exact origin (ex: http://localhost:5175)
// We will ALSO allow any http://localhost:* so Vite port changes won't break CORS.
const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || "").trim();

app.use(express.json());

// ===== CORS (robust for Vite changing ports) =====
app.use(
  cors({
    origin: (origin, cb) => {
      // allow Thunder Client / Postman (no origin)
      if (!origin) return cb(null, true);

      // allow any localhost port (Vite can switch ports)
      if (origin.startsWith("http://localhost:")) return cb(null, true);

      // allow the exact origin if set
      if (FRONTEND_ORIGIN && origin === FRONTEND_ORIGIN) return cb(null, true);

      return cb(new Error("CORS blocked: " + origin));
    },
    credentials: true,
  }),
);

// (optional) nice root message instead of "Cannot GET /"
app.get("/", (_req, res) => {
  res.send("GCMS Backend OK. Try /health");
});

// ===== Health check =====
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "connected" });
  } catch (e: any) {
    res.status(500).json({
      ok: false,
      db: "failed",
      error: String(e?.message || e),
    });
  }
});

// ===== Email-only login =====
app.post("/login", async (req, res) => {
  const email = String(req.body?.email || "").trim();

  if (!email) {
    return res.status(400).json({ ok: false, error: "Email is required" });
  }

  try {
    const [rows] = await pool.query(
      `
  SELECT
    u.users_id,
    u.fname,
    u.mname,
    u.lname,
    u.email,
    COALESCE(ut.user_type_name, 'UNKNOWN') AS role,
    u.created_at,
    u.updated_at
  FROM users u
  LEFT JOIN user_type ut ON ut.user_type_id = u.user_type_id
  WHERE LOWER(u.email) = LOWER(?)
  LIMIT 1
  `,
      [email],
    );

    const list = rows as any[];

    if (!list.length) {
      return res.status(401).json({
        ok: false,
        error: "Email not found. Ask admin to create your account.",
      });
    }
    app.post("/users", async (req, res) => {
      const { fname, mname, lname, email, role } = req.body;

      if (!fname || !lname || !email || !role) {
        return res.status(400).json({ ok: false, error: "Missing fields" });
      }

      try {
        // get user_type_id
        const [typeRows] = await pool.query(
          `SELECT user_type_id FROM user_type WHERE UPPER(user_type_name)=? LIMIT 1`,
          [role.toUpperCase()],
        );

        const types = typeRows as any[];
        if (!types.length) {
          return res.status(400).json({ ok: false, error: "Invalid role" });
        }

        const userTypeId = types[0].user_type_id;

        // check duplicate
        const [existsRows] = await pool.query(
          `SELECT users_id FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1`,
          [email],
        );

        if ((existsRows as any[]).length) {
          return res
            .status(409)
            .json({ ok: false, error: "Email already exists" });
        }

        await pool.query(
          `
  INSERT INTO users (fname, mname, lname, email, user_type_id)
  VALUES (?, ?, ?, ?, ?)
  `,
          [fname, mname || null, lname, email, userTypeId],
        );

        return res.json({ ok: true });
      } catch (e: any) {
        console.error(e);
        return res.status(500).json({ ok: false, error: "Server error" });
      }
    });
    const user = list[0];

    // normalize role (prevents frontend mismatch)
    user.role = String(user.role || "")
      .trim()
      .toUpperCase();

    return res.json({ ok: true, user });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: String(e?.message || e),
    });
  }
});
app.post("/users", async (req, res) => {
  const fname = String(req.body?.fname || "").trim();
  const mname = String(req.body?.mname || "").trim() || null;
  const lname = String(req.body?.lname || "").trim();
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const role = String(req.body?.role || "")
    .trim()
    .toUpperCase(); // ADMIN/COUNSELOR/STUDENT

  // optional for students
  const collegeId = req.body?.collegeId ?? null;
  const yearLevelId = req.body?.yearLevelId ?? null;

  if (!fname || !lname || !email || !role) {
    return res
      .status(400)
      .json({ ok: false, error: "Missing required fields" });
  }

  // map role -> user_type_id (adjust IDs to match your DB)
  const [typeRows] = await pool.query(
    `SELECT user_type_id FROM user_type WHERE UPPER(user_type_name)=? LIMIT 1`,
    [role],
  );
  const types = typeRows as any[];
  if (!types.length) {
    return res.status(400).json({ ok: false, error: "Invalid role/user type" });
  }
  const userTypeId = types[0].user_type_id;

  try {
    // prevent duplicates
    const [existsRows] = await pool.query(
      `SELECT users_id FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1`,
      [email],
    );
    const exists = existsRows as any[];
    if (exists.length) {
      return res.status(409).json({ ok: false, error: "Email already exists" });
    }

    // Insert (you might need to adjust column names to match your schema)
    const [result] = await pool.query(
      `
      INSERT INTO users (fname, mname, lname, email, user_type_id, college_id, year_level_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [fname, mname, lname, email, userTypeId, collegeId, yearLevelId],
    );

    // return created
    const insertId = (result as any).insertId;

    const [rows] = await pool.query(
      `
      SELECT
        u.users_id, u.fname, u.mname, u.lname, u.email,
        COALESCE(ut.user_type_name,'UNKNOWN') AS role,
        u.created_at, u.updated_at
      FROM users u
      LEFT JOIN user_type ut ON ut.user_type_id = u.user_type_id
      WHERE u.users_id = ?
      LIMIT 1
      `,
      [insertId],
    );

    const list = rows as any[];
    const user = list[0];
    user.role = String(user.role || "")
      .trim()
      .toUpperCase();

    return res.json({ ok: true, user });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: String(e?.message || e),
    });
  }
});
// ===== Start server =====
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (FRONTEND_ORIGIN) {
    console.log(`FRONTEND_ORIGIN: ${FRONTEND_ORIGIN}`);
  } else {
    console.log(
      "FRONTEND_ORIGIN not set (allowing http://localhost:* by default)",
    );
  }
});
