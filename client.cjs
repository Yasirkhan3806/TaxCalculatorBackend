const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: 'D:/krw/KRW tax calculator/.env' });

// Initialize the pool ONCE
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: 'postgres',
  password: process.env.PG_PASS,
  port: 5432,
   ssl: {
    rejectUnauthorized: false  // Required for Supabase SSL connection
  }
});

const setDatabase = async (schemaName) => {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${schemaName}`);
    console.log(`Schema set to ${schemaName}`);
    return client; // You can now use this client to run queries in that schema
  } catch (err) {
    console.error('Error setting schema:', err.stack);
    client.release(); // always release the client
    throw err;
  }
};

module.exports = { pool, setDatabase };
