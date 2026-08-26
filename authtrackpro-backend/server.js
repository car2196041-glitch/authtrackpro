const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendGraphEmail } = require("./services/graphEmailService");

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

async function createDemoRequestsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS demo_requests (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        company VARCHAR(200) NOT NULL,
        job_title VARCHAR(150),
        email VARCHAR(200) NOT NULL,
        phone VARCHAR(50),
        providers INTEGER,
        facilities INTEGER,
        current_ehr VARCHAR(100),
        biggest_challenge TEXT,
        preferred_date DATE,
        preferred_time TIME,
        additional_comments TEXT,
        status VARCHAR(50) DEFAULT 'New',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Demo requests table ready");
  } catch (error) {
    console.error("Error creating demo_requests table:", error);
  }
}

createAuditLogsTable();
createDemoRequestsTable();
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

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.user?.role?.toLowerCase();

    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({
        error: "You do not have permission to access this resource.",
      });
    }

    next();
  };
}

app.get('/', (req, res) => {
  res.send('AuthTrackPro backend is running');
});

app.get("/version", (req, res) => {
  res.json({
    version: "multi-tenant-v1",
    organizationSupport: true,
  });
});

app.get('/authorizations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
  `SELECT *
   FROM authorizations
   WHERE organization_id = $1
   ORDER BY id DESC`,
  [req.user.organizationId]
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

app.get('/audit-logs', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        al.id,
        al.action,
        al.details,
        al.created_at,
        u.email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 50
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ error: 'Failed to load audit logs' });
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
      'DELETE FROM authorizations WHERE id = $1 AND organization_id = $2 RETURNING *',
[id, req.user.organizationId]
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
app.post(
  "/authorizations/import",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No CSV file uploaded",
        });
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
            let failedCount = 0;
            const importErrors = [];

            for (const row of results) {
              const patient_name =
                row.patient_name || row.Patient || row.patient || "";

              const dob =
                row.dob || row.DOB || null;

              const payer =
                row.payer || row.Payer || row.insurance || "";

              const procedure_name =
                row.procedure_name ||
                row.Procedure ||
                row.procedure ||
                "";

              const cpt_code =
                row.cpt_code ||
                row.CPT ||
                row.procedure_code ||
                "";

              const status =
                row.status ||
                row.Status ||
                "Pending";

              const priority =
                row.priority ||
                row.Priority ||
                "Normal";

              const submitted_date =
                row.submitted_date ||
                row.request_date ||
                null;

              const due_date =
                row.due_date ||
                row.DueDate ||
                null;

              const assigned_to =
                row.assigned_to ||
                row.AssignedTo ||
                null;

              const auth_number =
                row.auth_number ||
                row.AuthNumber ||
                null;

              const notes =
                row.notes ||
                row.Notes ||
                null;

              // Required fields
              if (!patient_name || !payer || !procedure_name) {
                failedCount++;

                importErrors.push({
                  patient_name: patient_name || "Unknown",
                  error: "Missing patient name, payer, or procedure",
                });

                continue;
              }

              try {
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
                    user_id,
                    organization_id
                  )
                  VALUES (
                    $1,$2,$3,$4,$5,$6,$7,
                    $8,$9,$10,$11,$12,$13,$14
                  )`,
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
                    req.user.organizationId,
                  ]
                );

                importedCount++;
              } catch (rowError) {
                failedCount++;

                importErrors.push({
                  patient_name,
                  error: rowError.message,
                });

                console.error(
                  `CSV row failed for ${patient_name}:`,
                  rowError.message
                );
              }
            }

            return res.json({
              message:
                failedCount === 0
                  ? "CSV imported successfully"
                  : "CSV import completed with some errors",
              importedCount,
              failedCount,
              totalRows: results.length,
              errors: importErrors,
            });
          } catch (error) {
            console.error("CSV import database error:", error);

            if (!res.headersSent) {
              return res.status(500).json({
                error: "Failed to import CSV records",
              });
            }
          }
        })

        .on("error", (error) => {
          console.error("CSV parsing error:", error);

          if (!res.headersSent) {
            return res.status(400).json({
              error: "Unable to read CSV file",
            });
          }
        });
    } catch (error) {
      console.error("CSV import error:", error);

      return res.status(500).json({
        error: "CSV import failed",
      });
    }
  }
);

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
    user_id,
    organization_id
  )
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
    req.user.userId,
    req.user.organizationId,
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

console.log("Audit log created:", result.rows[0].id);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create authorization error:", err);
    res.status(500).json({ error: "Could not create authorization" });
  }
});

const PORT = process.env.PORT || 3000;


app.post("/auth/register", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      organizationName,
      organizationType,
      firstName,
      lastName,
      email,
      password,
    } = req.body;

    // Required registration fields
    if (!organizationName || !firstName || !lastName || !email || !password) {
      return res.status(400).json({
        error:
          "Organization name, first name, last name, email, and password are required",
      });
    }

    // Check for an existing user before creating the organization
    const existingUser = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: "Email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await client.query("BEGIN");

    // Create the new customer organization
    const organizationResult = await client.query(
      `INSERT INTO organizations (
        organization_name,
        organization_type,
        email,
        subscription_plan,
        subscription_status
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, organization_name, subscription_plan, subscription_status`,
      [
        organizationName,
        organizationType || null,
        email,
        "Starter",
        "Trial",
      ]
    );

    const organization = organizationResult.rows[0];

    // The person creating the organization becomes its first administrator
    const userResult = await client.query(
      `INSERT INTO users (
        email,
        password,
        first_name,
        last_name,
        role,
        organization_id,
        active
      )
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING
        id,
        email,
        first_name,
        last_name,
        role,
        organization_id,
        active`,
      [
        email,
        passwordHash,
        firstName,
        lastName,
        "admin",
        organization.id,
      ]
    );

    const user = userResult.rows[0];

    await client.query("COMMIT");

    // Include organization and role in the JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Welcome email should not undo registration if email delivery fails
    try {
      await sendGraphEmail({
        to: user.email,
        subject: "Welcome to AuthTrack Pro",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Welcome to AuthTrack Pro</h2>
            <p>Hi ${user.first_name},</p>
            <p>Your organization and administrator account have been created successfully.</p>
            <p>
              You can now log in and begin setting up your organization,
              managing prior authorizations, and inviting your team.
            </p>
            <p>Thank you for choosing AuthTrack Pro.</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Welcome email failed:", emailError.message);
    }

    return res.status(201).json({
      message: "Organization and administrator account created successfully",
      user,
      organization,
      token,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }

    console.error("Registration error:", err);

    if (err.code === "23505") {
      return res.status(409).json({
        error: "An account with this information already exists",
      });
    }

    return res.status(500).json({
      error: "Registration failed",
    });
  } finally {
    client.release();
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
  `SELECT
    id,
    email,
    password,
    role,
    organization_id,
    active
   FROM users
   WHERE LOWER(email) = LOWER($1)`,
  [email]
);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    if (!user.active) {
  return res.status(403).json({
    error: "This account is inactive",
  });
}

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
    email: user.email,
    role: user.role || "employee",
    organizationId: user.organization_id,
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

    res.json({
  token,
  user: {
    id: user.id,
    email: user.email,
    role: user.role || "employee",
    organizationId: user.organization_id,
  }
});

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/demo-requests", async (req, res) => {
  try {
    const {
      fullName,
      company,
      jobTitle,
      email,
      phone,
      providers,
      facilities,
      currentEhr,
      biggestChallenge,
      preferredDate,
      preferredTime,
      additionalComments,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO demo_requests
      (
        full_name,
        company,
        job_title,
        email,
        phone,
        providers,
        facilities,
        current_ehr,
        biggest_challenge,
        preferred_date,
        preferred_time,
        additional_comments
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        fullName,
        company,
        jobTitle,
        email,
        phone,
        providers || null,
        facilities || null,
        currentEhr,
        biggestChallenge,
        preferredDate || null,
        preferredTime || null,
        additionalComments,
      ]
    );

    res.status(201).json({
      message: "Demo request submitted successfully",
      demoRequest: result.rows[0],
    });
  } catch (error) {
    console.error("Error saving demo request:", error);
    res.status(500).json({ error: "Failed to submit demo request" });
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
       WHERE id = $11 AND organization_id = $12
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
      req.user.organizationId,
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