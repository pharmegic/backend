const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL Connection - Railway
const pool = new Pool({
    connectionString: 'postgresql://postgres:LxZHanCscpeXmDPXNGGAARkbadziIhLY@centerbeam.proxy.rlwy.net:13596/railway',
    ssl: {
        rejectUnauthorized: false
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.sendStatus(401);
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Initialize Database
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name_ru VARCHAR(255) NOT NULL,
                name_uz VARCHAR(255),
                category VARCHAR(50),
                image TEXT,
                retail_price DECIMAL(10,2),
                wholesale_price DECIMAL(10,2),
                stock INTEGER DEFAULT 0,
                description TEXT,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                customer_name VARCHAR(255),
                customer_type VARCHAR(50),
                phone VARCHAR(50),
                email VARCHAR(255),
                company_name VARCHAR(255),
                inn VARCHAR(50),
                items JSONB,
                total DECIMAL(10,2),
                payment_method VARCHAR(50),
                status VARCHAR(50) DEFAULT 'new',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                phone VARCHAR(50),
                email VARCHAR(255),
                type VARCHAR(50),
                company_name VARCHAR(255),
                inn VARCHAR(50),
                total_orders INTEGER DEFAULT 0,
                total_spent DECIMAL(10,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sourcing_requests (
                id SERIAL PRIMARY KEY,
                product_name VARCHAR(255),
                quantity INTEGER,
                company_name VARCHAR(255),
                phone VARCHAR(50),
                status VARCHAR(50) DEFAULT 'new',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                key VARCHAR(255) UNIQUE,
                value TEXT
            )
        `);
        
        // Create default admin
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await pool.query(`
            INSERT INTO admins (email, password, name) 
            VALUES ('admin@pharmegic.uz', $1, 'Admin')
            ON CONFLICT (email) DO NOTHING
        `, [hashedPassword]);
        
        console.log('Database initialized');
    } catch (error) {
        console.error('DB Init error:', error);
    }
}

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const result = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);
        const user = result.rows[0];
        
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
        
        res.json({
            token,
            user: { id: user.id, email: user.email, name: user.name }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Products Routes
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/products/count', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) as count FROM products');
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/products', authenticateToken, async (req, res) => {
    try {
        const { nameRu, nameUz, category, image, retailPrice, wholesalePrice, stock, description, active } = req.body;
        
        const result = await pool.query(`
            INSERT INTO products (name_ru, name_uz, category, image, retail_price, wholesale_price, stock, description, active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
        `, [nameRu, nameUz, category, image, retailPrice, wholesalePrice, stock, description, active]);
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nameRu, nameUz, category, image, retailPrice, wholesalePrice, stock, description, active } = req.body;
        
        const result = await pool.query(`
            UPDATE products 
            SET name_ru = $1, name_uz = $2, category = $3, image = $4, 
                retail_price = $5, wholesale_price = $6, stock = $7, description = $8, active = $9
            WHERE id = $10 RETURNING *
        `, [nameRu, nameUz, category, image, retailPrice, wholesalePrice, stock, description, active, id]);
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { active } = req.body;
        
        const result = await pool.query(
            'UPDATE products SET active = $1 WHERE id = $2 RETURNING *',
            [active, id]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM products WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Orders Routes
app.get('/api/orders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/orders/stats', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const todayResult = await pool.query(
            "SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = $1",
            [today]
        );
        
        const pendingResult = await pool.query(
            "SELECT COUNT(*) as count FROM orders WHERE status IN ('new', 'processing')"
        );
        
        const revenueResult = await pool.query(
            "SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE DATE(created_at) = $1",
            [today]
        );
        
        const newResult = await pool.query(
            "SELECT COUNT(*) as count FROM orders WHERE status = 'new'"
        );
        
        const recentResult = await pool.query(
            "SELECT * FROM orders ORDER BY created_at DESC LIMIT 5"
        );
        
        res.json({
            today: parseInt(todayResult.rows[0].count),
            pending: parseInt(pendingResult.rows[0].count),
            revenue: parseFloat(revenueResult.rows[0].total),
            newOrders: parseInt(newResult.rows[0].count),
            recentOrders: recentResult.rows
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { customerName, customerType, phone, email, companyName, inn, items, total, paymentMethod } = req.body;
        
        const result = await pool.query(`
            INSERT INTO orders (customer_name, customer_type, phone, email, company_name, inn, items, total, payment_method)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
        `, [customerName, customerType, phone, email, companyName, inn, JSON.stringify(items), total, paymentMethod]);
        
        // Update customer stats
        await pool.query(`
            INSERT INTO customers (name, phone, email, type, company_name, inn, total_orders, total_spent)
            VALUES ($1, $2, $3, $4, $5, $6, 1, $7)
            ON CONFLICT (phone) DO UPDATE SET
                total_orders = customers.total_orders + 1,
                total_spent = customers.total_spent + $7
        `, [customerName, phone, email, customerType, companyName, inn, total]);
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/orders/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const result = await pool.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Customers Routes
app.get('/api/customers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM customers ORDER BY total_spent DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/customers/count', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) as count FROM customers');
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sourcing Routes
app.get('/api/sourcing', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sourcing_requests ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/sourcing', async (req, res) => {
    try {
        const { productName, quantity, companyName, phone } = req.body;
        
        const result = await pool.query(`
            INSERT INTO sourcing_requests (product_name, quantity, company_name, phone)
            VALUES ($1, $2, $3, $4) RETURNING *
        `, [productName, quantity, companyName, phone]);
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/sourcing/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        
        const result = await pool.query(
            'UPDATE sourcing_requests SET status = $1, notes = $2 WHERE id = $3 RETURNING *',
            [status, notes, id]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Content & Settings Routes
app.get('/api/content', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM settings WHERE key LIKE 'content_%'");
        const content = {};
        result.rows.forEach(row => {
            content[row.key.replace('content_', '')] = row.value;
        });
        res.json(content);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/content', authenticateToken, async (req, res) => {
    try {
        const updates = Object.entries(req.body);
        
        for (const [key, value] of updates) {
            await pool.query(`
                INSERT INTO settings (key, value) VALUES ($1, $2)
                ON CONFLICT (key) DO UPDATE SET value = $2
            `, [`content_${key}`, value]);
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/settings', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM settings WHERE key NOT LIKE 'content_%'");
        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/settings', authenticateToken, async (req, res) => {
    try {
        const updates = Object.entries(req.body);
        
        for (const [key, value] of updates) {
            await pool.query(`
                INSERT INTO settings (key, value) VALUES ($1, $2)
                ON CONFLICT (key) DO UPDATE SET value = $2
            `, [key, value]);
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start Server
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});