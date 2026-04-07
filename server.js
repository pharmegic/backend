const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// CLICK API Configuration
const CLICK_CONFIG = {
    service_id: '76696',
    merchant_id: '41995',
    secret_key: 'Lpphf17Hmokk3YmFG',
    merchant_user_id: '58617'
};

// PostgreSQL Connection
const pool = new Pool({
    connectionString: 'postgresql://postgres:LxZHanCscpeXmDPXNGGAARkbadziIhLY@centerbeam.proxy.rlwy.net:13596/railway',
    ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

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
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                order_id VARCHAR(255) UNIQUE NOT NULL,
                customer_name VARCHAR(255),
                customer_type VARCHAR(50),
                phone VARCHAR(50),
                address TEXT,
                comment TEXT,
                items JSONB,
                total DECIMAL(10,2),
                payment_method VARCHAR(50),
                payment_status VARCHAR(50) DEFAULT 'pending',
                click_trans_id VARCHAR(255),
                click_paydoc_id VARCHAR(255),
                status VARCHAR(50) DEFAULT 'pending_payment',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Database initialized with Click support');
    } catch (error) {
        console.error('DB Init error:', error);
    }
}

// Generate Click Signature
function generateClickSignature(params, secretKey) {
    // Click signature: md5(service_id + amount + transaction_param + secret_key)
    const signString = `${params.service_id}${params.amount}${params.transaction_param}${secretKey}`;
    return crypto.createHash('md5').update(signString).digest('hex');
}

// Verify Click Signature
function verifyClickSignature(params, signature, secretKey) {
    const signString = `${params.click_trans_id}${params.service_id}${secretKey}${params.merchant_trans_id}${params.amount}${params.action}${params.sign_time}`;
    const computed = crypto.createHash('md5').update(signString).digest('hex');
    return computed === signature;
}

// Create Order and Generate Payment URL
app.post('/api/orders/create-with-payment', async (req, res) => {
    try {
        const { customerName, phone, address, comment, items, total } = req.body;
        
        // Generate unique order ID
        const orderId = 'PH-' + Date.now();
        
        // Save order to DB with pending status
        await pool.query(`
            INSERT INTO orders (order_id, customer_name, customer_type, phone, address, comment, items, total, payment_method, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [orderId, customerName, 'individual', phone, address, comment, JSON.stringify(items), total, 'Click', 'pending_payment']);
        
        // Generate Click Payment URL
        const returnUrl = `https://pharmegic.uz?payment=success&order_id=${orderId}`;
        
        const clickParams = {
            service_id: CLICK_CONFIG.service_id,
            merchant_id: CLICK_CONFIG.merchant_id,
            amount: total,
            transaction_param: orderId,
            return_url: returnUrl
        };
        
        const signature = generateClickSignature({
            service_id: CLICK_CONFIG.service_id,
            amount: total,
            transaction_param: orderId
        }, CLICK_CONFIG.secret_key);
        
        const paymentUrl = `https://my.click.uz/services/pay?` +
            `service_id=${CLICK_CONFIG.service_id}&` +
            `merchant_id=${CLICK_CONFIG.merchant_id}&` +
            `amount=${total}&` +
            `transaction_param=${orderId}&` +
            `return_url=${encodeURIComponent(returnUrl)}&` +
            `signature=${signature}`;
        
        res.json({
            success: true,
            order_id: orderId,
            payment_url: paymentUrl
        });
        
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Click Prepare Endpoint (Click calls this before payment)
app.post('/api/payment/click/prepare', async (req, res) => {
    try {
        const { click_trans_id, service_id, merchant_trans_id, amount, action, sign_time, signature } = req.body;
        
        // Verify signature
        const isValid = verifyClickSignature(req.body, signature, CLICK_CONFIG.secret_key);
        if (!isValid) {
            return res.json({ error: -1, error_note: 'Invalid signature' });
        }
        
        // Check order exists
        const orderResult = await pool.query('SELECT * FROM orders WHERE order_id = $1', [merchant_trans_id]);
        if (orderResult.rows.length === 0) {
            return res.json({ error: -5, error_note: 'Order not found' });
        }
        
        const order = orderResult.rows[0];
        
        // Check amount matches
        if (parseFloat(order.total) !== parseFloat(amount)) {
            return res.json({ error: -2, error_note: 'Amount mismatch' });
        }
        
        // Check if already paid
        if (order.payment_status === 'paid') {
            return res.json({ error: -4, error_note: 'Already paid' });
        }
        
        res.json({
            click_trans_id: click_trans_id,
            merchant_trans_id: merchant_trans_id,
            merchant_prepare_id: Date.now(),
            error: 0,
            error_note: 'Success'
        });
        
    } catch (error) {
        console.error('Prepare error:', error);
        res.json({ error: -3, error_note: 'Server error' });
    }
});

// Click Complete Endpoint (Click calls this after payment)
app.post('/api/payment/click/complete', async (req, res) => {
    try {
        const { click_trans_id, service_id, merchant_trans_id, amount, action, sign_time, signature, click_paydoc_id, error: clickError } = req.body;
        
        // Verify signature
        const isValid = verifyClickSignature(req.body, signature, CLICK_CONFIG.secret_key);
        if (!isValid) {
            return res.json({ error: -1, error_note: 'Invalid signature' });
        }
        
        // If Click reported error
        if (parseInt(clickError) < 0) {
            await pool.query(
                'UPDATE orders SET payment_status = $1, status = $2, updated_at = NOW() WHERE order_id = $3',
                ['failed', 'cancelled', merchant_trans_id]
            );
            return res.json({ error: 0, error_note: 'Success' });
        }
        
        // Update order as paid
        await pool.query(
            'UPDATE orders SET payment_status = $1, status = $2, click_trans_id = $3, click_paydoc_id = $4, updated_at = NOW() WHERE order_id = $5',
            ['paid', 'new', click_trans_id, click_paydoc_id, merchant_trans_id]
        );
        
        res.json({
            click_trans_id: click_trans_id,
            merchant_trans_id: merchant_trans_id,
            merchant_confirm_id: Date.now(),
            error: 0,
            error_note: 'Success'
        });
        
    } catch (error) {
        console.error('Complete error:', error);
        res.json({ error: -3, error_note: 'Server error' });
    }
});

// Check Payment Status
app.get('/api/orders/check-payment/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const result = await pool.query('SELECT payment_status, status FROM orders WHERE order_id = $1', [orderId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json({
            payment_status: result.rows[0].payment_status,
            order_status: result.rows[0].status
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Orders for Admin
app.get('/api/orders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Order Status (for Admin)
app.put('/api/orders/:orderId/status', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        
        await pool.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2', [status, orderId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Order by ID - To'lovdan keyin buyurtma ma'lumotlarini olish uchun
app.get('/api/orders/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const result = await pool.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: error.message });
    }
});


initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
