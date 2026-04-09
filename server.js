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

        // Check if table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'orders'
            );
        `);
        
        const tableExists = tableCheck.rows[0].exists;
        
        if (!tableExists) {
            // Create new table with all columns
            await pool.query(`
                CREATE TABLE orders (
                    id SERIAL PRIMARY KEY,
                    order_id VARCHAR(255) UNIQUE NOT NULL,
                    customer_name VARCHAR(255),
                    customer_type VARCHAR(50) DEFAULT 'individual',
                    phone VARCHAR(50),
                    address TEXT,
                    comment TEXT,
                    items JSONB,
                    total DECIMAL(10,2),
                    payment_method VARCHAR(50) DEFAULT 'Click',
                    payment_status VARCHAR(50) DEFAULT 'pending',
                    click_trans_id VARCHAR(255),
                    click_paydoc_id VARCHAR(255),
                    status VARCHAR(50) DEFAULT 'new',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Orders table created');
        }

        // Ensure all columns exist
        const columns = [
            'order_id', 'customer_name', 'customer_type', 'phone', 'address', 
            'comment', 'items', 'total', 'payment_method', 'payment_status',
            'click_trans_id', 'click_paydoc_id', 'status', 'created_at', 'updated_at'
        ];
        
        for (const col of columns) {
            try {
                await pool.query(`
                    ALTER TABLE orders 
                    ADD COLUMN IF NOT EXISTS ${col} VARCHAR(255)
                `);
            } catch (e) {
                // Column might already exist with different type
            }
        }
        
        console.log('✅ Database ready');
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
// CREATE ORDER - HAMMA UCHUN (Jismoniy va Yuridik)
// ============================================
app.post('/api/orders/create-with-payment', async (req, res) => {
    console.log('\\n📥 Create order request:', req.body);

    try {
        const { customerName, phone, address, comment, items, total, userType } = req.body;

        if (!customerName || !phone || !total || !items) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['customerName', 'phone', 'total', 'items']
            });
        }

        const orderId = 'PH-' + Date.now();
        console.log('🆔 Order ID:', orderId);
        console.log('👤 User Type:', userType || 'individual');

        const isLegal = userType === 'legal';
        
        // Order ma'lumotlarini bazaga saqlash
        const result = await pool.query(`
            INSERT INTO orders (
                order_id, customer_name, customer_type, phone, address, 
                comment, items, total, payment_method, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
            RETURNING *
        `, [
            orderId, 
            customerName, 
            isLegal ? 'legal' : 'individual',  // ✅ Jismoniy shaxslar ham 'individual' sifatida saqlanadi
            phone, 
            address || '', 
            comment || '', 
            JSON.stringify(items), 
            parseFloat(total), 
            isLegal ? 'Bank transfer (Contract)' : 'Click', 
            'new'  // Yangi status
        ]);

        console.log('✅ Order saved to database:', result.rows[0].order_id);
        console.log('   Customer Type:', result.rows[0].customer_type);

        // Click to'lov URL (faqat jismoniy shaxslar uchun)
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
            customer_type: isLegal ? 'legal' : 'individual',
            message: 'Buyurtma yaratildi',
            payment_url: paymentUrl
        });

    } catch (error) {
        console.error('\\n❌ Error:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message
        });
    }
});

// ============================================
// ADMIN APPROVAL - Faqat 1 marta qabul qilish
// ============================================
app.post('/api/orders/:orderId/approve', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const result = await pool.query(
            `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE order_id = $2
             RETURNING *`,
            ['completed', orderId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        console.log(`✅ Order ${orderId} approved (completed)`);
        res.json({ 
            success: true, 
            message: 'Buyurtma qabul qilindi',
            order: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Approve error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Buyurtmani bekor qilish
app.post('/api/orders/:orderId/reject', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const result = await pool.query(
            `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE order_id = $2
             RETURNING *`,
            ['cancelled', orderId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        console.log(`❌ Order ${orderId} cancelled`);
        res.json({ 
            success: true, 
            message: 'Buyurtma bekor qilindi',
            order: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Reject error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// CLICK API INTEGRATION
// ============================================

// Prepare
app.get('/api/payment/click/prepare', async (req, res) => {
    console.log('📥 Click Prepare:', req.query);
    try {
        const { merchant_trans_id, amount, click_trans_id } = req.query;
        
        const result = await pool.query(
            'SELECT * FROM orders WHERE order_id = $1',
            [merchant_trans_id]
        );

        if (result.rows.length === 0) {
            return res.json({ error: -5, error_note: 'Order not found' });
        }

        const order = result.rows[0];
        
        if (parseFloat(order.total) !== parseFloat(amount)) {
            return res.json({ error: -2, error_note: 'Invalid amount' });
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

// Complete
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

        // To'lov ma'lumotlarini saqlash (status avtomat o'zgarmaydi, admin qabul qiladi)
        await pool.query(
            `UPDATE orders SET payment_status = $1, click_trans_id = $2, click_paydoc_id = $3 
             WHERE order_id = $4`,
            ['paid', click_trans_id, click_paydoc_id, merchant_trans_id]
        );

        console.log(`💰 Payment completed for ${merchant_trans_id}`);

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

// ============================================
// GET ORDERS - Real-time uchun
// ============================================
app.get('/api/orders', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM orders ORDER BY created_at DESC'
        );
        
        console.log(`📤 Sending ${result.rows.length} orders`);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Get orders error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get single order
app.get('/api/orders/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const result = await pool.query(
            'SELECT * FROM orders WHERE order_id = $1',
            [orderId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Check Payment Status
app.get('/api/orders/check-payment/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const result = await pool.query(
            'SELECT payment_status, status, click_trans_id, click_paydoc_id FROM orders WHERE order_id = $1', 
            [orderId]
        );

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



app.get('/api/products', async (req, res) => {
    try {
        // Agar products jadvali bo'lmasa, vaqtinchalik localStorage dan olish
        // Yoki yangi jadval yaratish
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'products'
            );
        `);
        
        const tableExists = result.rows[0].exists;
        
        if (!tableExists) {
            // Vaqtinchalik bo'sh massiv qaytarish
            return res.json([]);
        }
        
        const products = await pool.query('SELECT * FROM products ORDER BY id');
        res.json(products.rows);
    } catch (error) {
        console.error('❌ Get products error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Yangi mahsulot qo'shish
app.post('/api/products', async (req, res) => {
    try {
        const { id, nameUz, nameRu, nameEn, category, prices, minQty, 
                descriptionUz, descriptionRu, descriptionEn, image, status } = req.body;
        
        // Products jadvalini tekshirish/yaratish
        await pool.query(`
            CREATE TABLE IF NOT EXISTS products (
                id BIGINT PRIMARY KEY,
                name_uz VARCHAR(255),
                name_ru VARCHAR(255),
                name_en VARCHAR(255),
                category VARCHAR(50),
                prices JSONB,
                min_qty INTEGER,
                description_uz TEXT,
                description_ru TEXT,
                description_en TEXT,
                image TEXT,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        const result = await pool.query(`
            INSERT INTO products (id, name_uz, name_ru, name_en, category, prices, 
                min_qty, description_uz, description_ru, description_en, image, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO UPDATE SET
                name_uz = EXCLUDED.name_uz,
                name_ru = EXCLUDED.name_ru,
                name_en = EXCLUDED.name_en,
                category = EXCLUDED.category,
                prices = EXCLUDED.prices,
                min_qty = EXCLUDED.min_qty,
                description_uz = EXCLUDED.description_uz,
                description_ru = EXCLUDED.description_ru,
                description_en = EXCLUDED.description_en,
                image = EXCLUDED.image,
                status = EXCLUDED.status,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [id, nameUz, nameRu, nameEn, category, JSON.stringify(prices), minQty,
            descriptionUz, descriptionRu, descriptionEn, image, status]);
        
        res.json({ success: true, product: result.rows[0] });
    } catch (error) {
        console.error('❌ Save product error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Mahsulotni o'chirish
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM products WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Delete product error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Status yangilash
app.patch('/api/products/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const result = await pool.query(`
            UPDATE products SET status = $1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2 RETURNING *
        `, [status, id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json({ success: true, product: result.rows[0] });
    } catch (error) {
        console.error('❌ Update status error:', error.message);
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
        console.log(`📊 Admin panel: https://backend-production-c4f9.up.railway.app`);
    });
}

start().catch(err => {
    console.error('❌ Failed to start:', err.message);
    process.exit(1);
});
