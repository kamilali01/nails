import pg from 'pg';  //db.js
const { Pool } = pg;

const ssl = {
  require: true,
  rejectUnauthorized: false,
};

// Stateless database connection - create pool per request or reuse global pool
// For Vercel serverless, we use a global pool that persists across invocations
let globalPool = null;

function getPool() {
  // In serverless environments, reuse the global pool if it exists
  if (globalPool && !globalPool.ended) {
    return globalPool;
  }

  // Create new pool
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    // Check if password placeholder exists
    if (databaseUrl.includes('[YOUR-PASSWORD]')) {
      throw new Error(
        'DATABASE_URL contains placeholder [YOUR-PASSWORD]. Please replace it with your actual Supabase password in the .env file.'
      );
    }
    
    // Convert session pooler (port 5432) to transaction pooler (port 6543) for better serverless support
    let finalDatabaseUrl = databaseUrl;
    try {
      const url = new URL(databaseUrl);
      // If using session pooler (port 5432), suggest transaction pooler
      if (url.port === '5432' && url.hostname.includes('pooler.supabase.com')) {
        url.port = '6543'; // Transaction mode pooler - better for serverless
        finalDatabaseUrl = url.toString();
        console.log('ℹ️  Using transaction mode pooler (port 6543) - better for serverless/stateless apps');
        console.log('   If you prefer session mode, use port 5432 but ensure only 1 connection is used');
      }
      console.log(`🔌 Connecting to database: ${url.protocol}//${url.hostname}:${url.port}${url.pathname}`);
      console.log(`👤 Database user: ${url.username}`);
    } catch (e) {
      console.warn('⚠️ Could not parse DATABASE_URL for logging');
    }
    
    globalPool = new Pool({
      connectionString: finalDatabaseUrl,
      ssl: ssl,
      max: 1, // Serverless-friendly: minimal connections (required for Supabase session pooler)
      idleTimeoutMillis: 20000, // Shorter timeout for serverless
      connectionTimeoutMillis: 5000, // Faster timeout
      allowExitOnIdle: true, // Allow process to exit when idle
    });
  } else {
    const host = process.env.PGHOST;
    const port = process.env.PGPORT ? Number(process.env.PGPORT) : 5432;
    const database = process.env.PGDATABASE;
    const user = process.env.PGUSER;
    const password = process.env.PGPASSWORD;

    if (!host || !database || !user) {
      throw new Error(
        'Database config missing. Set DATABASE_URL or PGHOST, PGDATABASE, PGUSER (and optional PGPORT, PGPASSWORD).\n' +
        'For Supabase, use: DATABASE_URL=postgresql://postgres.vwoxnuxpqubqetwinryq:YOUR_ACTUAL_PASSWORD@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres'
      );
    }

    console.log(`🔌 Connecting to database: ${host}:${port}/${database}`);
    console.log(`👤 Database user: ${user}`);

    globalPool = new Pool({
      host,
      port,
      database,
      user,
      password,
      ssl: ssl,
      max: 1,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: true,
    });
  }

  // Handle pool errors to prevent crashes
  globalPool.on('error', (err) => {
    console.error('Database pool error:', err);
    // Reset pool on error so next request creates a new one
    if (globalPool) {
      globalPool.end().catch(() => {}); // Clean up on error
    }
    globalPool = null;
  });

  return globalPool;
}

// Export a function that returns the pool (stateless)
export function getDbPool() {
  return getPool();
}

// For backwards compatibility, export pool getter
export const pool = new Proxy({}, {
  get(target, prop) {
    const actualPool = getPool();
    return actualPool[prop];
  }
});

// Initialize schema (idempotent, safe to call multiple times)
let schemaInitialized = false;
let initPromise = null;

export async function initSchema() {
  if (schemaInitialized && initPromise) {
    return initPromise;
  }
  
  if (initPromise) {
    return initPromise;
  }
  
  initPromise = (async () => {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS reservations (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        hour TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        token TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(date, hour)
      );
    `;
    
    // Use a single client connection for schema initialization to avoid pool issues
    let pool;
    try {
      pool = getPool();
      console.log('🔌 Got database pool for schema initialization');
    } catch (poolError) {
      console.error('❌ Failed to get database pool:', poolError);
      initPromise = null;
      throw poolError;
    }
    
    let client = null;
    let retries = 3;
    
    while (retries > 0) {
      try {
        // Get a client from the pool
        console.log(`🔗 Attempting to connect to database (${4 - retries}/3)...`);
        client = await pool.connect();
        console.log('✅ Database client connected');
        
        await client.query(createTableSql);
        console.log('✅ Table created/verified');
        
        // Add columns if they don't exist (backwards compatibility)
        await client.query('ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS phone TEXT');
        await client.query('ALTER TABLE IF EXISTS reservations ADD COLUMN IF NOT EXISTS token TEXT');
        
        // Create index for faster date queries
        await client.query('CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_reservations_created_at ON reservations(created_at)');
        
        schemaInitialized = true;
        console.log('✅ Database schema initialized successfully');
        
        // Release the client back to the pool
        if (client) {
          client.release();
          client = null;
        }
        return;
      } catch (err) {
        // Release client on error
        if (client) {
          try {
            client.release();
          } catch (releaseErr) {
            console.error('⚠️ Error releasing client:', releaseErr);
          }
          client = null;
        }
        
        retries--;
        console.error(`❌ Database initialization failed (${3 - retries}/3):`, err.message);
        console.error('Error code:', err.code);
        console.error('Error details:', {
          message: err.message,
          code: err.code,
          severity: err.severity
        });
        
        if (retries === 0) {
          initPromise = null; // Reset on failure so it can be retried
          throw err;
        }
        
        // Wait longer before retry to avoid connection limit issues
        console.log(`⏳ Waiting 3 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  })();
  
  return initPromise;
}