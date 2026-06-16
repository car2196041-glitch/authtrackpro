const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://authtrackpro.com",
      "https://www.authtrackpro.com",
    ],
    credentials: true,
  })
);

app.use(express.json());
async function createAuditLogsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        authorization_id INTEGER,
        action VARCHAR(100) NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Audit logs table ready");
  } catch (error) {
    console.error("Error creating audit_logs table:", error);
  }
}

createAuditLogsTable();
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token." });
    }

    req.user = user;
    next();
  });
}

app.get('/', (req, res) => {
  res.send('AuthTrackPro backend is running');
});

app.get('/authorizations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM authorizations WHERE user_id = $1 ORDER BY id DESC',
      [req.user.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get authorizations error:", error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'Pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'Approved') AS approved,
        COUNT(*) FILTER (WHERE status = 'Denied') AS denied
      FROM authorizations
      WHERE user_id = $1;
      `,
      [req.user.userId]
    );

    const r = rows[0];

    res.json({
      total: Number(r.total),
      pending: Number(r.pending),
      approved: Number(r.approved),
      denied: Number(r.denied)
    });
  } catch (error) {
    console.error("Dashboard database error:", error);
    res.status(500).json({ error: 'Dashboard database error' });
  }
});

// UPDATE authorization status/details
app.patch('/authorizations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, auth_number, notes } = req.body;

    const result = await pool.query(
      `UPDATE authorizations
       SET status = $1,
           auth_number = $2,
           notes = $3
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [status, auth_number, notes, id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Authorization not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Update database error' });
  }
});

// DELETE authorization
app.delete('/authorizations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM authorizations WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Authorization not found' });
    }

    res.json({
      message: 'Authorization deleted successfully',
      deleted: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Delete database error' });
  }
});

const multer = require("multer");
const csv = require("csv-parser");
const { Readable } = require("stream");

const upload = multer({ storage: multer.memoryStorage() });

// CSV Import endpoint
// TEST ROUTE
console.log("=== IMPORT ROUTES LOADED ===");

app.post("/test-import-route", (req, res) => {
  res.json({ message: "POST route works" });
});

// CSV Import endpoint
app.post("/authorizations/import", authenticateToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No CSV file uploaded" });
    }

    const results = [];
    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csv())
      .on("data", (row) => {
        results.push(row);
      })
      .on("end", async () => {
        try {
          let importedCount = 0;

          for (const row of results) {
            const patient_name = row.patient_name || row.Patient || row.patient || "";
            const dob = row.dob || row.DOB || null;
            const payer = row.payer || row.Payer || row.insurance || "";
            const procedure_name = row.procedure_name || row.Procedure || row.procedure || "";
            const cpt_code = row.cpt_code || row.CPT || row.procedure_code || "";
            const status = row.status || row.Status || "Pending";
            const priority = row.priority || row.Priority || "Normal";
            const submitted_date = row.submitted_date || row.request_date || null;
            const due_date = row.due_date || row.DueDate || null;
            const assigned_to = row.assigned_to || row.AssignedTo || null;
            const auth_number = row.auth_number || row.AuthNumber || null;
            const notes = row.notes || row.Notes || null;

            if (!patient_name || !payer || !procedure_name) {
              continue;
            }

            await pool.query(
              `INSERT INTO authorizations
              (
                patient_name,
                dob,
                payer,
                procedure_name,
                cpt_code,
                status,
                priority,
                submitted_date,
                due_date,
                assigned_to,
                auth_number,
                notes,
                user_id
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
              [
                patient_name,
                dob,
                payer,
                procedure_name,
                cpt_code,
                status,
                priority,
                submitted_date,
                due_date,
                assigned_to,
                auth_number,
                notes,
                req.user.userId,
              ]
            );

            importedCount++;
          }

          res.json({
            message: "CSV imported successfully",
            importedCount,
          });
        } catch (error) {
          console.error("CSV import database error:", error);
          res.status(500).json({ error: "Failed to import CSV records" });
        }
      });
  } catch (error) {
    console.error("CSV import error:", error);
    res.status(500).json({ error: "CSV import failed" });
  }
});

app.post("/authorizations", authenticateToken, async (req, res) => {
  try {
    const {
      patient_name,
      dob,
      payer,
      procedure_name,
      cpt_code,
      status,
      priority,
      submitted_date,
      due_date,
      assigned_to,
      auth_number,
      notes
    } = req.body;

    const result = await pool.query(
      `INSERT INTO authorizations 
      (patient_name, dob, payer, procedure_name, cpt_code, status, priority, submitted_date, due_date, assigned_to, auth_number, notes, user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        patient_name,
        dob || null,
        payer,
        procedure_name,
        cpt_code,
        status || "Pending",
        priority || "Normal",
        submitted_date || null,
        due_date || null,
        assigned_to || null,
        auth_number || null,
        notes || null,
        req.user.userId
      ]
    );

    await pool.query(
  `INSERT INTO audit_logs
   (user_id, authorization_id, action, details)
   VALUES ($1, $2, $3, $4)`,
  [
    req.user.userId,
    result.rows[0].id,
    "Authorization Created",
    `${patient_name} - ${procedure_name}`
  ]
);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create authorization error:", err);
    res.status(500).json({ error: "Could not create authorization" });
  }
});

const PORT = process.env.PORT || 3000;


app.post("/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password)
 VALUES ($1, $2)
 RETURNING id, email`,
[email, passwordHash]
    );

    const user = result.rows[0];

    const token = jwt.sign(
  { userId: user.id, email: user.email },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

    res.json({
      message: "User registered successfully",
      user,
      token
    });

  } catch (err) {
    console.error(err);

    if (err.code === "23505") {
      return res.status(409).json({ error: "Email already exists" });
    }

    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
  {
    userId: user.id,
    email: user.email
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

    res.json({
      token,
      user: {
  id: user.id,
  email: user.email
}
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.put("/authorizations/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      patient_name,
      payer,
      procedure_name,
      cpt_code,
      status,
      priority,
      submitted_date,
      due_date,
      assigned_to,
      notes,
   } = req.body;

    const result = await pool.query(
      `UPDATE authorizations
       SET patient_name = $1,
           payer = $2,
           procedure_name = $3,
           cpt_code = $4,
           status = $5,
           priority = $6,
           submitted_date = $7,
           due_date = $8,
           assigned_to = $9,
           notes = $10
       WHERE id = $11 AND user_id = $12
       RETURNING *`,
    [
      patient_name,
      payer,
      procedure_name,
      cpt_code,
      status,
      priority,
      submitted_date ? submitted_date : null,
      due_date ? due_date : null,
      assigned_to,
      notes,
      id,
      req.user.userId,
   ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Authorization not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update authorization error:", error);
    res.status(500).json({ error: "Update authorization database error" });
  }
});

app.listen(PORT, () => {
  console.log(`AuthTrackPro backend running on port ${PORT}`);
});