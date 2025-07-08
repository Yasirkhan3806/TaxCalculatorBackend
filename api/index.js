// Use CommonJS require instead of ES6 import for better compatibility
const {setDatabase, pool} = require('../client.js');

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow all origins for now
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
 
// Handle preflight requests
const handleCors = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return true;
  }
  
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  return false;
};

// Main API handler - use module.exports instead of export default
module.exports = async function handler(req, res) {
  try {
    // Handle CORS
    if (handleCors(req, res)) return;

    const { method, url } = req;
    
    // More robust URL parsing
    let pathname, query;
    try {
      const urlObj = new URL(url, `http://${req.headers.host}`);
      pathname = urlObj.pathname;
      query = urlObj.searchParams;
    } catch (urlError) {
      console.error('URL parsing error:', urlError);
      return res.status(400).json({ error: 'Invalid URL' });
    }

  try {
    // Route: GET /
    if (method === 'GET' && pathname === '/') {
      return res.status(200).json({ message: 'Server is running!'});
    }

    // Route: GET /api/set-database/:dbName
    if (method === 'GET' && pathname.startsWith('/api/set-database/')) {
      const dbName = pathname.split('/').pop();
      
      const client = await setDatabase(dbName);
      if (client) {
        const dbRes = await client.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `);
        
        return res.status(200).json({
          message: true,
          tables: dbRes.rows.map(row => row.table_name)
        });
      }
      return res.status(500).json({ error: 'Error setting database' });
    }

    // Route: GET /api/get-city-data/:cityName
    if (method === 'GET' && pathname.startsWith('/api/get-city-data/')) {
      const cityName = pathname.split('/').pop();
      
      // const client = await pool.connect();
      let result;
      
      if (cityName === 'mouzas') {
        result = await pool.query(`SELECT name FROM ${cityName}`);
      } else {
        result = await pool.query(`SELECT location FROM ${cityName}`);
      }
      
      // client.release();
      return res.status(200).json({ message: true, data: result.rows });
    }

    // Route: GET /api/get-property-size/:cityName/:location
    if (method === 'GET' && pathname.startsWith('/api/get-property-size/')) {
      const pathParts = pathname.split('/');
      const cityName = pathParts[pathParts.length - 2];
      const location = pathParts[pathParts.length - 1];
      
      // const client = await pool.connect();
      const result = await pool.query(`SELECT size_sq_yard FROM ${cityName}
        WHERE location = $1`, [decodeURIComponent(location)]);
      // client.release();
      
      return res.status(200).json({ message: true, data: result.rows });
    }

    // Route: GET /api/get-property-value
    if (method === 'GET' && pathname === '/api/get-property-value') {
      const cityName = query.get('cityName');
      const location = query.get('location');
      const size = query.get('size');

      // const client = await pool.connect();
      let result;
      
      if (cityName === 'mouzas') {
        result = await pool.query(`SELECT value_per_sq_meter FROM land_classifications
          WHERE id=$1`, [location]);
      } else {
        result = await pool.query(`SELECT value_per_sq_meter FROM ${cityName}
          WHERE location = $1 AND size_sq_yard = $2`, [location, size]);
      }
      
      // client.release();
      return res.status(200).json({ message: true, data: result.rows });
    }

    // Route: GET /api/get-kharsa-value
    if (method === 'GET' && pathname === '/api/get-kharsa-value') {
      try{
      const khasra = query.get('khasraNumber');
      const location = query.get('location');
      
      // const client = await pool.connect();

      // Get mouza id
      const mouzaRes = await pool.query(`SELECT id FROM mouzas WHERE name = $1`, [location]);
      if (mouzaRes.rows.length === 0) {
        // client.release();
        return res.status(404).json({ message: 'Mouza not found' });
      }
      const mouzaId = mouzaRes.rows[0].id;

      // Get classification ids for that mouza
      const classRes = await pool.query(
        `SELECT id FROM land_classifications WHERE mouza_id = $1`,
        [mouzaId]
      );
      if (classRes.rows.length === 0) {
        // client.release();
        return res.status(404).json({ message: 'Classification not found for this mouza' });
      }

      // Extract classification IDs into array
      const classificationIds = classRes.rows.map(row => row.id);
      
      // Dynamically build placeholders like $2, $3, ...
      const placeholders = classificationIds.map((_, idx) => `$${idx + 2}`).join(", ");

      // Final query with dynamic IN clause
      const query = `
        SELECT * FROM khasra_numbers
        WHERE classification_id IN (${placeholders}) AND (
          (is_range = true AND range_start::int <= $1 AND range_end::int >= $1)
          OR
          (is_range = false AND khasra_number = $1::text)
        );
      `;

      const values = [khasra, ...classificationIds];
      const result = await pool.query(query, values);

      // client.release();
      return res.status(200).json({ message: true, data: result.rows });
        }catch(e){
        return res.status(500).json({message:`something is wrong with ${khasra}`});
    }
  }

    // Route not found
    return res.status(404).json({ error: 'Route not found' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ message: 'Internal server error',error:error });
  }
}catch(e){
console.log(e)
}
}
