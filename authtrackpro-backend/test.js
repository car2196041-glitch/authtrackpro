const pool = require('./db');

async function test() {
  const result = await pool.query('SELECT * FROM authorizations');
  console.log(result.rows);
}

test();