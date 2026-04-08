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
    secret_key: process.env.CLICK_SECRET_KEY || 'YOUR_SECRET_KEY',
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

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// ============================================
// DATABASE INIT
// ============================================
async function initDB() {
    try {
        console.log('🔄 Checking database...');

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
                status VARCHAR(50) DEFAULT 'new',
                admin_approved BOOLEAN DEFAULT false,
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

// Generate Click Signature
function generateClickSignature(params, secretKey) {
    const signString = `${params.service_id}${params.amount}${params.transaction_param}${secretKey}`;
    return crypto.createHash('md5').update(signString).digest('hex');
}

// ============================================
// CREATE ORDER - NEW FLOW (Admin tasdiqlashi bilan)
// ============================================
app.post('/api/orders/create-with-payment', async (req, res) => {
    console.log('\n📥 Create order request:', req.body);

    try {
        const { customerName, phone, address, comment, items, total, userType, companyData } = req.body;

        if (!customerName || !phone || !total) {
            return res.status(400).json({ 
                error: 'Missing required fields'
            });
        }

        const orderId = 'PH-' + Date.now();
        console.log('🆔 Order ID:', orderId);

        // Order ma'lumotlarini bazaga saqlash (status: new - admin tasdiqlashini kutadi)
        const isLegal = userType === 'legal';
        const result = await pool.query(`
            INSERT INTO orders (
                order_id, customer_name, customer_type, phone, address, 
                comment, items, total, payment_method, status, admin_approved
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            orderId, 
            customerName, 
            userType || 'individual', 
            phone, 
            address || '', 
            comment || '', 
            JSON.stringify(items || []), 
            parseFloat(total), 
            isLegal ? 'Bank transfer (Contract)' : 'Click', 
            'new',  // Yangi status - admin tasdiqlashini kutadi
            false   // Admin hali tasdiqlamagan
        ]);

        console.log('✅ Order created with status: NEW (waiting for admin approval)');

        // Click to'lov URL yaratish (faqat jismoniy shaxslar uchun)
        let paymentUrl = null;
        if (!isLegal) {
            const returnUrl = `https://pharmegic.uz?payment=return&order_id=${orderId}`;
            const signature = generateClickSignature({
                service_id: CLICK_CONFIG.service_id,
                amount: total,
                transaction_param: orderId
            }, CLICK_CONFIG.secret_key);

            paymentUrl = `https://my.click.uz/services/pay?` +
                `service_id=${CLICK_CONFIG.service_id}&` +
                `merchant_id=${CLICK_CONFIG.merchant_id}&` +
                `amount=${total}&` +
                `transaction_param=${orderId}&` +
                `return_url=${encodeURIComponent(returnUrl)}&` +
                `signature=${signature}`;
        }

        res.json({
            success: true,
            order_id: orderId,
            status: 'new',
            message: 'Buyurtma yaratildi. Admin tasdiqlashini kutmoqda.',
            payment_url: paymentUrl  // Agar legal bo'lsa null bo'ladi
        });

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message
        });
    }
});

// ============================================
// ADMIN APPROVAL ROUTES
// ============================================

// Buyurtmani tasdiqlash (Admin)
app.post('/api/orders/:orderId/approve', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        await pool.query(
            `UPDATE orders SET status = $1, admin_approved = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE order_id = $3`,
            ['approved', true, orderId]
        );

        console.log(`✅ Order ${orderId} approved by admin`);
        res.json({ success: true, message: 'Buyurtma tasdiqlandi' });
    } catch (error) {
        console.error('❌ Approve error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Buyurtmani rad etish (Admin)
app.post('/api/orders/:orderId/reject', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;
        
        await pool.query(
            `UPDATE orders SET status = $1, admin_approved = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE order_id = $3`,
            ['rejected', false, orderId]
        );

        console.log(`❌ Order ${orderId} rejected by admin`);
        res.json({ success: true, message: 'Buyurtma rad etildi', reason });
    } catch (error) {
        console.error('❌ Reject error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Click API integratsiyasi (faqat to'lov ma'lumotlarini saqlash)
app.post('/api/payment/click/complete', async (req, res) => {
    console.log('📥 Click Complete:', req.body);
    try {
        const { click_trans_id, merchant_trans_id, click_paydoc_id, error: clickError } = req.body;

        if (parseInt(clickError) < 0) {
            await pool.query(
                'UPDATE orders SET payment_status = $1 WHERE order_id = $2',
                ['failed', merchant_trans_id]
            );
            return res.json({ error: 0, error_note: 'Success' });
        }

        // To'lov ma'lumotlarini saqlash (lekin statusni avtomat o'zgartirmaydi)
        await pool.query(
            `UPDATE orders SET payment_status = $1, click_trans_id = $2, click_paydoc_id = $3 
             WHERE order_id = $4`,
            ['paid', click_trans_id, click_paydoc_id, merchant_trans_id]
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
    res.status(404).json({ error: 'Not found' });
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
