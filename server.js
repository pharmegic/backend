const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// CLICK API Configuration
const CLICK_CONFIG = {
    service_id: process.env.CLICK_SERVICE_ID || '76696',
    merchant_id: process.env.CLICK_MERCHANT_ID || '41995',
    secret_key: process.env.CLICK_SECRET_KEY || 'Lpphf17Hmokk3YmFG',
    merchant_user_id: process.env.CLICK_MERCHANT_USER_ID || '58617'
};

// CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'Origin'],
    credentials: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// ============================================
// DATABASE INIT - DROP AND RECREATE
// ============================================
async function initDB() {
    try {
        console.log('🔄 Checking database...');

        // Avvalgi jadvalni o'chirish (agar mavjud bo'lsa)
        try {
            await pool.query('DROP TABLE IF EXISTS orders CASCADE');
            console.log('✅ Old table dropped');
        } catch (e) {
            console.log('ℹ️ No old table to drop');
        }

        // Yangi jadval yaratish
        await pool.query(`
            CREATE TABLE orders (
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

        console.log('✅ Database initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Database init error:', error.message);
        return false;
    }
}

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'PHARMEGIC API is running',
        timestamp: new Date().toISOString()
    });
});

// Test
app.get('/test', (req, res) => {
    res.json({ cors: 'working', origin: req.headers.origin });
});

// Generate Click Signature
function generateClickSignature(params, secretKey) {
    const signString = `${params.service_id}${params.amount}${params.transaction_param}${secretKey}`;
    return crypto.createHash('md5').update(signString).digest('hex');
}

// ============================================
// CREATE ORDER
// ============================================
app.post('/api/orders/create-with-payment', async (req, res) => {
    console.log('\n📥 Create order request:', req.body);

    try {
        const { customerName, phone, address, comment, items, total } = req.body;

        // Validation
        if (!customerName || !phone || !total) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                fields: { customerName: !!customerName, phone: !!phone, total: !!total }
            });
        }

        const orderId = 'PH-' + Date.now();
        console.log('🆔 Order ID:', orderId);

        // Insert to database
        console.log('📝 Inserting to database...');
        const result = await pool.query(`
            INSERT INTO orders (order_id, customer_name, customer_type, phone, address, comment, items, total, payment_method, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            orderId, 
            customerName, 
            'individual', 
            phone, 
            address || '', 
            comment || '', 
            JSON.stringify(items || []), 
            parseFloat(total), 
            'Click', 
            'pending_payment'
        ]);

        console.log('✅ Database insert successful:', result.rows[0].order_id);

        // Generate Click URL
        const returnUrl = `https://pharmegic.uz?payment=success&order_id=${orderId}`;
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

        console.log('✅ Order created successfully');

        res.json({
            success: true,
            order_id: orderId,
            payment_url: paymentUrl
        });

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message
        });
    }
});

// Click Prepare
app.post('/api/payment/click/prepare', async (req, res) => {
    console.log('📥 Click Prepare:', req.body);
    try {
        const { click_trans_id, merchant_trans_id, amount } = req.body;

        const orderResult = await pool.query('SELECT * FROM orders WHERE order_id = $1', [merchant_trans_id]);
        if (orderResult.rows.length === 0) {
            return res.json({ error: -5, error_note: 'Order not found' });
        }

        const order = orderResult.rows[0];
        if (parseFloat(order.total) !== parseFloat(amount)) {
            return res.json({ error: -2, error_note: 'Amount mismatch' });
        }

        res.json({
            click_trans_id: click_trans_id,
            merchant_trans_id: merchant_trans_id,
            merchant_prepare_id: Date.now(),
            error: 0,
            error_note: 'Success'
        });
    } catch (error) {
        console.error('❌ Prepare error:', error.message);
        res.json({ error: -3, error_note: 'Server error' });
    }
});

// Click Complete
app.post('/api/payment/click/complete', async (req, res) => {
    console.log('📥 Click Complete:', req.body);
    try {
        const { click_trans_id, merchant_trans_id, click_paydoc_id, error: clickError } = req.body;

        if (parseInt(clickError) < 0) {
            await pool.query(
                'UPDATE orders SET payment_status = $1, status = $2 WHERE order_id = $3',
                ['failed', 'cancelled', merchant_trans_id]
            );
            return res.json({ error: 0, error_note: 'Success' });
        }

        await pool.query(
            'UPDATE orders SET payment_status = $1, status = $2, click_trans_id = $3, click_paydoc_id = $4 WHERE order_id = $5',
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
        console.error('❌ Complete error:', error.message);
        res.json({ error: -3, error_note: 'Server error' });
    }
});

// Check Payment Status
app.get('/api/orders/check-payment/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const result = await pool.query('SELECT payment_status, status, click_trans_id, click_paydoc_id FROM orders WHERE order_id = $1', [orderId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({
            payment_status: result.rows[0].payment_status,
            order_status: result.rows[0].status,
            click_trans_id: result.rows[0].click_trans_id,
            click_paydoc_id: result.rows[0].click_paydoc_id
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get All Orders
app.get('/api/orders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Start
async function start() {
    await initDB();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server running on port ${PORT}`);
    });
}

start().catch(err => {
    console.error('❌ Failed to start:', err.message);
    process.exit(1);
});
