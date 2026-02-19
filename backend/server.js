const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_xBHygJt20rDu@ep-odd-dream-ai3pt7yq-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    role VARCHAR(50) DEFAULT 'user',
    company_id VARCHAR(100),
    company_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(err => console.error('Table creation error:', err));

app.post('/api/register', async (req, res) => {
  const { email, name, password, plan, role, company_id, company_name } = req.body;

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Email, name, and password are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, plan, role, company_id, company_name) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, name, plan, role, company_id, company_name`,
      [email, name, hashedPassword, plan || 'free', role || 'user', company_id, company_name]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      userContext: {
        user_id: user.id.toString(),
        email: user.email,
        name: user.name,
        custom_fields: {
          plan: user.plan,
          role: user.role,
        },
        company: user.company_id ? {
          id: user.company_id,
          name: user.company_name,
        } : undefined,
      }
    });
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      userContext: {
        user_id: user.id.toString(),
        email: user.email,
        name: user.name,
        custom_fields: {
          plan: user.plan,
          role: user.role,
        },
        company: user.company_id ? {
          id: user.company_id,
          name: user.company_name,
        } : undefined,
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query(
      'SELECT id, email, name, plan, role, company_id, company_name FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      userContext: {
        user_id: user.id.toString(),
        email: user.email,
        name: user.name,
        custom_fields: {
          plan: user.plan,
          role: user.role,
        },
        company: user.company_id ? {
          id: user.company_id,
          name: user.company_name,
        } : undefined,
      }
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});