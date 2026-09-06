import { Router } from 'express';   //reservations.js
import { getDbPool, initSchema } from './db.js';
import { randomBytes } from 'crypto';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';

// Hours list used when marking a whole day as "day off"
const HOURS = [
  '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00'
];

// Lazy schema initialization - don't block module loading
let schemaInitPromise = null;
let schemaInitAttempted = false;

async function ensureSchema() {
  // If schema is already initialized, return immediately
  if (schemaInitPromise && schemaInitAttempted) {
    try {
      await schemaInitPromise;
      return; // Schema is ready
    } catch (err) {
      // If previous attempt failed, allow retry
      console.log('🔄 Retrying schema initialization after previous failure');
      schemaInitPromise = null;
      schemaInitAttempted = false;
    }
  }
  
  if (!schemaInitPromise) {
    schemaInitAttempted = true;
    console.log('🔧 Initializing database schema...');
    schemaInitPromise = initSchema().catch(err => {
      console.error('❌ Schema initialization error:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack?.substring(0, 500) // Limit stack trace length
      });
      schemaInitPromise = null; // Allow retry
      schemaInitAttempted = false;
      throw err;
    });
  }
  
  return schemaInitPromise;
}

// Generate a secure random token
function generateToken() {
  return randomBytes(32).toString('hex');
}

// Helper to log only in development
function devLog(...args) {
  if (!isProduction) {
    console.log(...args);
  }
}

// Stricter rate limit for creating reservations (per IP).
// Front-end normally does at most a few POSTs, so 5/min is generous for real users
// but blocks scripts that try to spam the endpoint.
const postRateBuckets = new Map();

function postReservationsRateLimiter(req, res, next) {
  try {
    const now = Date.now();
    const windowMs = 60_000; // 1 minute window
    const max = 5; // Max 5 POSTs / minute / IP

    // Allow trusted admin token to bypass this limit
    const adminToken = req.headers['x-admin-token'];
    if (
      adminToken &&
      process.env.ADMIN_TOKEN &&
      adminToken === process.env.ADMIN_TOKEN
    ) {
      return next();
    }

    const ip =
      req.ip ||
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      'unknown';

    let bucket = postRateBuckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      postRateBuckets.set(ip, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        status: 'error',
        message:
          'Çox tez-tez rezervasiya sorğusu göndərirsiniz. Zəhmət olmasa bir neçə dəqiqə sonra yenidən cəhd edin.'
      });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

// GET /api/reservations -> { [date]: { [hour]: name } } + owned info if tokens provided
router.get('/reservations', async (req, res, next) => {
  try {
    // Try to ensure schema, but don't fail if it's already initialized and working
    try {
      await ensureSchema();
    } catch (schemaError) {
      console.error('⚠️ Schema initialization failed, attempting query anyway:', schemaError.message);
      // Continue - the table might already exist
    }
    
    const pool = getDbPool();
    const { date } = req.query;
    let result;
    
    console.log('📥 GET /reservations request:', { date, hasPool: !!pool });

    if (date) {
      result = await pool.query(
        'select date, hour, name, phone, token from reservations where date = $1',
        [date]
      );
    } else {
      result = await pool.query(
        'select date, hour, name, phone, token from reservations'
      );
    }

    const adminToken = req.headers['x-admin-token'];
    const includePhone =
      adminToken &&
      process.env.ADMIN_TOKEN &&
      adminToken === process.env.ADMIN_TOKEN;

    const userTokensHeader = req.headers['x-user-tokens'];
    const userTokens = userTokensHeader
      ? userTokensHeader.split(',').map(t => t.trim()).filter(t => t.length > 0)
      : [];

    const requestOwned = req.headers['x-request-owned'] === 'true';

    const map = {};
    const owned = {};
    const tokenSet = new Set(userTokens);

    for (const row of result.rows) {
      if (!map[row.date]) map[row.date] = {};
      map[row.date][row.hour] = includePhone
        ? `${row.name} (${row.phone})`
        : row.name;

      if (requestOwned && userTokens.length > 0) {
        if (!owned[row.date]) owned[row.date] = {};
        owned[row.date][row.hour] = tokenSet.has(row.token);
      }
    }

    if (requestOwned && userTokens.length > 0) {
      return res.json({ bookings: map, owned });
    }

    res.json(map);
  } catch (e) {
    console.error('❌ GET /reservations error:', e);
    console.error('Error stack:', e.stack);
    console.error('Error message:', e.message);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Məlumatları yükləmək mümkün olmadı. Zəhmət olmasa yenidən cəhd edin.',
      error: process.env.NODE_ENV === 'development' ? e.message : undefined
    });
  }
});

// POST /api/reservations  { date, hour, name, phone } -> returns token
router.post('/reservations', postReservationsRateLimiter, async (req, res, next) => {
  try {
    const { date, hour, name, phone } = req.body || {};
    
    devLog('📝 POST /reservations request:', { date, hour, name, phone: phone ? '***' : undefined });
    
    // Validate input
    if (!date || !hour || !name || !phone) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Bütün məlumatları doldurun (tarix, saat, ad, telefon)' 
      });
    }
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Yanlış tarix formatı' 
      });
    }
    
    // Validate hour format (HH:mm)
    if (!/^\d{2}:\d{2}$/.test(hour)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Yanlış saat formatı' 
      });
    }
    
    // Validate phone number (Azerbaijan format)
    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (!/^(\+994|0)[0-9]{9}$/.test(cleanPhone)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Düzgün telefon nömrəsi daxil edin (məs: +994501234567 və ya 0501234567)' 
      });
    }
    
    // Validate booking date (no past, max 30 days future)
    const bookingDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 30); // 30 days max
    
    if (bookingDate < today) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Keçmiş tarixə rezervasiya etmək mümkün deyil' 
      });
    }
    
    if (bookingDate > maxDate) {
      return res.status(400).json({ 
        status: 'error', 
        message: '30 gündən çox qabaqcadan rezervasiya etmək mümkün deyil' 
      });
    }
    
    const token = generateToken();
    
    const adminToken = req.headers['x-admin-token'];
    const userToken = req.headers['x-user-token'];
    
    // Check if user is admin
    const isAdmin = adminToken && process.env.ADMIN_TOKEN && adminToken === process.env.ADMIN_TOKEN;
    
    devLog('🔐 Auth check:', { isAdmin, hasUserToken: !!userToken });
    
    await ensureSchema();
    const pool = getDbPool();
    
    if (isAdmin) {
      // Admin can create/update any reservation
      try {
        await pool.query(
          'insert into reservations(date, hour, name, phone, token) values ($1, $2, $3, $4, $5) on conflict(date, hour) do update set name = excluded.name, phone = excluded.phone, token = excluded.token',
          [date, hour, name, phone, token]
        );
        devLog('✅ Admin reservation created/updated');
        return res.json({ status: 'success', token });
      } catch (dbError) {
        console.error('Admin reservation error:', dbError);
        return res.status(500).json({ 
          status: 'error', 
          message: 'Rezervasiya yaradılmadı. Zəhmət olmasa yenidən cəhd edin.' 
        });
      }
    } else if (userToken) {
      // User updating their own reservation
      devLog('🔄 User attempting to update existing reservation');
      try {
        const existing = await pool.query(
          'select token from reservations where date = $1 and hour = $2', 
          [date, hour]
        );
        
        devLog('🔍 Existing reservation check:', { 
          found: existing.rows.length > 0,
          tokenMatch: existing.rows.length > 0 && existing.rows[0].token === userToken
        });
        
        if (existing.rows.length > 0 && existing.rows[0].token === userToken) {
          await pool.query(
            'update reservations set name = $1, phone = $2 where date = $3 and hour = $4 and token = $5',
            [name, phone, date, hour, userToken]
          );
          devLog('✅ User reservation updated');
          return res.json({ status: 'success', token: userToken });
        } else {
          devLog('❌ User token does not match existing reservation');
          return res.status(403).json({ 
            status: 'error', 
            message: 'Bu saat artıq başqası tərəfindən rezerv olunub' 
          });
        }
      } catch (dbError) {
        console.error('User update reservation error:', dbError);
        return res.status(500).json({ 
          status: 'error', 
          message: 'Rezervasiya yenilənmədi. Zəhmət olmasa yenidən cəhd edin.' 
        });
      }
    } else {
      // NEW BOOKING - Regular user
      devLog('🆕 New booking attempt');
      try {
        // 1. Check if the specific slot is already taken
        const slotCheck = await pool.query(
          'select token from reservations where date = $1 and hour = $2', 
          [date, hour]
        );
        
        devLog('🔍 Slot check:', { date, hour, isOccupied: slotCheck.rows.length > 0 });
        
        if (slotCheck.rows.length > 0) {
          devLog('❌ Slot is already occupied');
          return res.status(409).json({ 
            status: 'error', 
            message: 'Bu saat artıq rezerv olunub. Zəhmət olmasa başqa saat seçin.' 
          });
        }
        
        // 2. Check if user already has ANY booking for this date
        const userTokensHeader = req.headers['x-user-tokens'];
        const userTokens = userTokensHeader
          ? userTokensHeader.split(',').map(t => t.trim()).filter(t => t.length > 0)
          : [];
        
        devLog('🔑 User tokens for one-per-day check:', { count: userTokens.length });
        
        if (userTokens.length > 0) {
          const existingBooking = await pool.query(
            'select hour, name, token from reservations where date = $1 and token = ANY($2::text[])',
            [date, userTokens]
          );
          
          devLog('📅 Existing booking check for date:', { 
            date, 
            foundBookings: existingBooking.rows.length,
            bookings: existingBooking.rows.map(r => ({ hour: r.hour, name: r.name }))
          });
          
          if (existingBooking.rows.length > 0) {
            const bookedHour = existingBooking.rows[0].hour;
            devLog('❌ User already has booking today at:', bookedHour);
            return res.status(409).json({ 
              status: 'error', 
              message: `Siz bu gün artıq ${bookedHour} üçün rezervasiya etmisiniz. Hər gün yalnız 1 rezervasiya etmək mümkündür.`,
              existingHour: bookedHour
            });
          }
        }
        
        // 3. All checks passed - create new reservation
        devLog('✅ All checks passed, creating reservation...');
        await pool.query(
          'insert into reservations(date, hour, name, phone, token) values ($1, $2, $3, $4, $5)',
          [date, hour, name, phone, token]
        );
        
        devLog('✅ New reservation created successfully');
        return res.json({ status: 'success', token });
        
      } catch (insertError) {
        // Check if it's a unique constraint violation (race condition)
        if (insertError.code === '23505') {
          devLog('⚠️ Race condition detected - slot taken:', date, hour);
          return res.status(409).json({ 
            status: 'error', 
            message: 'Bu saat artıq rezerv olunub. Zəhmət olmasa başqa saat seçin.' 
          });
        }
        
        console.error('❌ Database error during reservation:', insertError);
        
        return res.status(500).json({ 
          status: 'error', 
          message: 'Rezervasiya yaradılmadı. Zəhmət olmasa yenidən cəhd edin.' 
        });
      }
    }
  } catch (e) {
    console.error('❌ POST /reservations unexpected error:', e);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.' 
    });
  }
});

// DELETE /api/reservations?date=YYYY-MM-DD&hour=HH:mm
router.delete('/reservations', async (req, res, next) => {
  try {
    const { date, hour } = req.query;
    if (!date || !hour) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Tarix və saat tələb olunur' 
      });
    }
    
    await ensureSchema();
    const pool = getDbPool();
    
    const adminToken = req.headers['x-admin-token'];
    if (adminToken && process.env.ADMIN_TOKEN && adminToken === process.env.ADMIN_TOKEN) {
      try {
        await pool.query('delete from reservations where date = $1 and hour = $2', [date, hour]);
        devLog('✅ Admin deleted reservation:', date, hour);
        return res.json({ status: 'success' });
      } catch (dbError) {
        console.error('Admin delete error:', dbError);
        return res.status(500).json({ 
          status: 'error', 
          message: 'Rezervasiya silinmədi. Zəhmət olmasa yenidən cəhd edin.' 
        });
      }
    }
    
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.status(401).json({ 
        status: 'error', 
        message: 'İcazə yoxdur' 
      });
    }
    
    try {
      const del = await pool.query(
        'delete from reservations where date = $1 and hour = $2 and token = $3', 
        [date, hour, userToken]
      );
      
      if (del.rowCount === 0) {
        return res.status(403).json({ 
          status: 'error', 
          message: 'Bu rezervasiyanı silmək üçün icazəniz yoxdur' 
        });
      }
      
      devLog('✅ User deleted own reservation:', date, hour);
      return res.json({ status: 'success' });
    } catch (dbError) {
      console.error('User delete error:', dbError);
      return res.status(500).json({ 
        status: 'error', 
        message: 'Rezervasiya silinmədi. Zəhmət olmasa yenidən cəhd edin.' 
      });
    }
  } catch (e) {
    console.error('DELETE /reservations unexpected error:', e);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.' 
    });
  }
});

// PUT /api/reservations  { date, hour, newName, newPhone }
router.put('/reservations', async (req, res, next) => {
  try {
    const { date, hour, newName, newPhone } = req.body || {};
    if (!date || !hour || !newName || !newPhone) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Bütün məlumatları doldurun' 
      });
    }
    
    // Validate phone number
    const cleanPhone = newPhone.replace(/[\s-]/g, '');
    if (!/^(\+994|0)[0-9]{9}$/.test(cleanPhone)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Düzgün telefon nömrəsi daxil edin' 
      });
    }
    
    await ensureSchema();
    const pool = getDbPool();
    
    const adminToken = req.headers['x-admin-token'];
    if (adminToken && process.env.ADMIN_TOKEN && adminToken === process.env.ADMIN_TOKEN) {
      try {
        const r = await pool.query(
          'update reservations set name = $1, phone = $2 where date = $3 and hour = $4', 
          [newName, newPhone, date, hour]
        );
        
        if (r.rowCount === 0) {
          return res.status(404).json({ 
            status: 'error', 
            message: 'Rezervasiya tapılmadı' 
          });
        }
        
        return res.json({ status: 'success' });
      } catch (dbError) {
        console.error('Admin update error:', dbError);
        return res.status(500).json({ 
          status: 'error', 
          message: 'Rezervasiya yenilənmədi. Zəhmət olmasa yenidən cəhd edin.' 
        });
      }
    }
    
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.status(401).json({ 
        status: 'error', 
        message: 'İcazə yoxdur' 
      });
    }
    
    try {
      const r = await pool.query(
        'update reservations set name = $1, phone = $2 where date = $3 and hour = $4 and token = $5', 
        [newName, newPhone, date, hour, userToken]
      );
      
      if (r.rowCount === 0) {
        return res.status(403).json({ 
          status: 'error', 
          message: 'Bu rezervasiyanı dəyişmək üçün icazəniz yoxdur' 
        });
      }
      
      return res.json({ status: 'success' });
    } catch (dbError) {
      console.error('User update error:', dbError);
      return res.status(500).json({ 
        status: 'error', 
        message: 'Rezervasiya yenilənmədi. Zəhmət olmasa yenidən cəhd edin.' 
      });
    }
  } catch (e) {
    console.error('PUT /reservations unexpected error:', e);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.' 
    });
  }
});

// Admin-only: Cleanup old bookings (7+ days old)
router.delete('/reservations/cleanup', async (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }
  
  try {
    await ensureSchema();
    const pool = getDbPool();
    const result = await pool.query(
      "DELETE FROM reservations WHERE date < TO_CHAR(NOW() - INTERVAL '7 days', 'YYYY-MM-DD')"
    );
    console.log(`🗑️ Cleaned up ${result.rowCount} old bookings`);
    return res.json({ status: 'success', deleted: result.rowCount });
  } catch (err) {
    console.error('Cleanup error:', err);
    return res.status(500).json({ status: 'error', message: 'Cleanup failed' });
  }
});

// Admin-only: Mark a full day as "Bugün işləmirik" if it has no reservations yet
router.post('/reservations/day-off', async (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  const { date } = req.body || {};
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      status: 'error',
      message: 'Düzgün tarix göndərilməyib'
    });
  }

  try {
    await ensureSchema();
    const pool = getDbPool();

    // Check if there is already any reservation for that day
    const existing = await pool.query(
      'select count(*)::int as cnt from reservations where date = $1',
      [date]
    );

    if (existing.rows[0].cnt > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'Bu gün üçün artıq rezervasiyalar var. Yalnız tam boş günləri bağlamaq mümkündür.'
      });
    }

    // Insert "Bugün işləmirik" for all standard hours
    const tokenBase = generateToken();
    const values = [];
    const params = [];
    let idx = 1;

    for (const hour of HOURS) {
      const token = `${tokenBase}-${hour}`;
      values.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`);
      params.push(date, hour, 'Bugün işləmirik', '', token);
      idx += 5;
    }

    await pool.query(
      `insert into reservations(date, hour, name, phone, token) values ${values.join(',')}`,
      params
    );

    return res.json({ status: 'success' });
  } catch (err) {
    console.error('Day-off creation error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Günü bağlamaq mümkün olmadı. Zəhmət olmasa yenidən cəhd edin.'
    });
  }
});

export default router;