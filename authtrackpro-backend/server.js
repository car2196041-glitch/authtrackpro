const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('AuthTrackPro backend is running');
});

// ✅ THIS IS THE MISSING PART
app.get('/authorizations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM authorizations ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/dashboard', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'Pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'Approved') AS approved,
        COUNT(*) FILTER (WHERE status = 'Denied') AS denied
      FROM authorizations;
    `);

    const r = rows[0];

    res.json({
      total: Number(r.total),
      pending: Number(r.pending),
      approved: Number(r.approved),
      denied: Number(r.denied)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Dashboard database error' });
  }
});

// UPDATE authorization status/details
app.patch('/authorizations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, auth_number, notes } = req.body;

    const result = await pool.query(
      `UPDATE authorizations
       SET status = $1,
           auth_number = $2,
           notes = $3
       WHERE id = $4
       RETURNING *`,
      [status, auth_number, notes, id]
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
app.delete('/authorizations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM authorizations WHERE id = $1 RETURNING *',
      [id]
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

const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

// CSV Upload endpoint
app.post('/upload-csv', upload.single('file'), async (req, res) => {
  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        for (const row of results) {
          await pool.query(
            `INSERT INTO authorizations
            (patient_name, dob, insurance, procedure_code, status, request_date, auth_number, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              row.patient_name,
              row.dob,
              row.insurance,
              row.procedure_code,
              row.status,
              row.request_date,
              row.auth_number,
              row.notes
            ]
          );
        }

        res.json({ message: 'CSV uploaded successfully', count: results.length });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'CSV upload failed' });
      }
    });
});

app.post('/authorizations', async (req, res) => {
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
      auth_number,
      notes
    } = req.body;

    const result = await pool.query(
      `INSERT INTO authorizations
      (patient_name, payer, procedure_name, cpt_code, status, priority, submitted_date, dob, auth_number, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        patient_name,
        payer,
        procedure_name,
        cpt_code,
        status || 'Pending',
        priority || 'Normal',
        submitted_date || new Date(),
        dob || null,
        auth_number || null,
        notes || null
      ]
    );

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Create authorization error:', error);
    res.status(500).json({ error: 'Create authorization error' });
  }
});

const PORT = process.env.PORT || 3000;

app.post("/authorizations", async (req, res) => {
  try {
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
      notes
    } = req.body;

    const result = await pool.query(
      `INSERT INTO authorizations 
      (patient_name, payer, procedure_name, cpt_code, status, priority, submitted_date, due_date, assigned_to, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        patient_name,
        payer,
        procedure_name,
        cpt_code,
        status,
        priority,
        submitted_date || null,
        due_date || null,
        assigned_to,
        notes
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create authorization" });
  }
});
app.listen(PORT, () => {
  console.log(`AuthTrackPro backend running on port ${PORT}`);
});
