const express = require('express');
const {setDatabase,pool} = require('./client.js'); // Import the PostgreSQL client
const cors = require('cors'); // Import CORS middleware


const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors({path:"http://localhost:5173"})); // Use CORS middleware to allow cross-origin requests

// Basic route
app.get('/', (req, res) => {
    res.send('Server is running!');
});


app.get('/set-database/:dbName', async (req, res) => {
    const dbName = req.params.dbName;

    try {
        const client = await setDatabase(dbName); // Set the database using the imported function
        if(client){
            const dbRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    res.status(200).json({message:true, tables: dbRes.rows.map(row => row.table_name)});
        }
        
    } catch (error) {
        console.error('Error setting database:', error);
        res.status(500).send('Error setting database');
    }
});

app.get('/get-city-data/:cityName', async (req, res) => {
    const cityName = req.params.cityName;
    try {
        const client = await pool.connect();
        let result;
        if(cityName === 'mouzas'){
             result = await client.query(`SELECT name FROM ${cityName}`);
        }else{
            result = await client.query(`SELECT location FROM ${cityName}`);
        }
    
        client.release(); // Release the client back to the pool
        res.status(200).json({message:true,data:result.rows});
    } catch (error) {
        console.error('Error fetching city data:', error);
        res.status(500).send('Error fetching city data');
    }
});


app.get('/get-property-size/:cityName/:location', async (req, res) => {
    const cityName = req.params.cityName;
    const location = req.params.location;
    console.log(location)
    try {
        const client = await pool.connect();
        const result = await client.query(`SELECT size_sq_yard FROM ${cityName}
            WHERE location = $1`, [location]); // Use parameter from route
        client.release();
        res.status(200).json({ message: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching property size:', error);
        res.status(500).send('Error fetching property size');
    }   
});


app.get('/get-property-value', async (req, res) => {
    const cityName = req.query.cityName;
    const location = req.query.location;
    const size = req.query.size;


    try {
        let result;
        const client = await pool.connect();
        if(cityName === 'mouzas'){
            result = await client.query(`SELECT value_per_sq_meter FROM land_classifications
                WHERE id=$1`, [location]); // Use parameters from query
        }
        else{
         result = await client.query(`SELECT value_per_sq_meter FROM ${cityName}
            WHERE location = $1 AND size_sq_yard = $2`, [location, size]); // Use parameters from query
        }
        client.release();
        res.status(200).json({ message: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching property size:', error);
        res.status(500).send('Error fetching property size');
    }   
}
);

app.get('/get-kharsa-value', async (req, res) => {
  const khasra = req.query.khasraNumber;
  const location = req.query.location;
  
  try {
    const client = await pool.connect();
  // Add validation for empty or undefined khasra

    // Get mouza id
    const mouzaRes = await client.query(`SELECT id FROM mouzas WHERE name = $1`, [location]);
    if (mouzaRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ message: 'Mouza not found' });
    }
    const mouzaId = mouzaRes.rows[0].id;

    // Get classification ids for that mouza
    const classRes = await client.query(
      `SELECT id FROM land_classifications WHERE mouza_id = $1`,
      [mouzaId]
    );
    if (classRes.rows.length === 0) {
      client.release();
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
    const result = await client.query(query, values);

    client.release();
    res.status(200).json({ message: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching khasra value:', error);
    res.status(500).send('Error fetching khasra value');
  }
});



// route to select Database 

// Start the server 
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});