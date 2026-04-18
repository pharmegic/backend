require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 8080;

// ==================== CONFIG ====================
const CLICK_CONFIG = {
    service_id: process.env.CLICK_SERVICE_ID || '76696',
    merchant_id: process.env.CLICK_MERCHANT_ID || '41995',
    secret_key: process.env.CLICK_SECRET_KEY || 'YOUR_SECRET_KEY',
    merchant_user_id: process.env.CLICK_MERCHANT_USER_ID || '58617'
};

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_IDS = (process.env.ADMIN_CHAT_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://your-domain.up.railway.app';

// ==================== TELEGRAM BOT ====================
let bot = null;

if (BOT_TOKEN) {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    console.log('🤖 Telegram bot initialized');

    // Bot commands
    bot.setMyCommands([
        { command: 'start', description: 'Boshlash / Web App ochish' },
        { command: 'orders', description: 'Yangi buyurtmalar (admin)' },
        { command: 'stats', description: 'Statistika (admin)' }
    ]);

    // /start - Barcha foydalanuvchilar
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const username = msg.from.username || msg.from.first_name || 'Mijoz';

        const text = `👋 Salom, <b>${username}</b>!\n\n` +
            `📦 PHARMEGIC - O'zbekiston bo'ylab farmatsevtika va oziq-ovqat hom-ashyolarini yetkazib beruvchi.\n\n` +
            `🔹 Mahsulotlarni ko'rish va buyurtma berish uchun <b>"Katalog"</b> tugmasini bosing.\n` +
            `🔹 Admin panelga kirish uchun <b>"Admin"</b> tugmasini bosing.`;

        bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📦 Katalog ochish', web_app: { url: WEB_APP_URL } }],
                    [{ text: '⚙️ Admin panel', url: `${WEB_APP_URL}/admin.html` }]
                ]
            }
        });
    });

    // /orders - Faqat adminlar
    bot.onText(/\/orders/, async (msg) => {
        const chatId = msg.chat.id;
        if (!ADMIN_CHAT_IDS.includes(String(chatId))) {
            return bot.sendMessage(chatId, '❌ Bu buyruq faqat adminlar uchun');
        }

        try {
            const result = await pool.query(
                "SELECT * FROM orders WHERE status = 'new' ORDER BY created_at DESC LIMIT 10"
            );

            if (result.rows.length === 0) {
                return bot.sendMessage(chatId, '✅ Hozircha yangi buyurtmalar yo\'q');
            }

            await bot.sendMessage(chatId, `📋 <b>Yangi buyurtmalar:</b> ${result.rows.length} ta`, { parse_mode: 'HTML' });

            for (const order of result.rows) {
                await bot.sendMessage(chatId, formatOrderMessage(order), {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '✅ Qabul qilish', callback_data: `approve_${order.order_id}` },
                                { text: '❌ Bekor qilish', callback_data: `reject_${order.order_id}` }
                            ]
                        ]
                    }
                });
            }
        } catch (err) {
            bot.sendMessage(chatId, '❌ Xatolik: ' + err.message);
        }
    });

    // /stats - Faqat adminlar
    bot.onText(/\/stats/, async (msg) => {
        const chatId = msg.chat.id;
        if (!ADMIN_CHAT_IDS.includes(String(chatId))) {
            return bot.sendMessage(chatId, '❌ Bu buyruq faqat adminlar uchun');
        }

        try {
            const total = await pool.query('SELECT COUNT(*) FROM orders');
            const newOrders = await pool.query("SELECT COUNT(*) FROM orders WHERE status = 'new'");
            const completed = await pool.query("SELECT COUNT(*) FROM orders WHERE status = 'completed'");
            const cancelled = await pool.query("SELECT COUNT(*) FROM orders WHERE status = 'cancelled'");

            const statsText =
                `📊 <b>PHARMEGIC Statistika</b>\n\n` +
                `📦 Jami buyurtmalar: <b>${total.rows[0].count}</b>\n` +
                `🆕 Yangi: <b>${newOrders.rows[0].count}</b>\n` +
                `✅ Qabul qilingan: <b>${completed.rows[0].count}</b>\n` +
                `❌ Bekor qilingan: <b>${cancelled.rows[0].count}</b>`;

            bot.sendMessage(chatId, statsText, { parse_mode: 'HTML' });
        } catch (err) {
            bot.sendMessage(chatId, '❌ Xatolik: ' + err.message);
        }
    });

    // Callback queries (Inline buttonlar)
    bot.on('callback_query', async (query) => {
        const data = query.data;
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;

        if (!ADMIN_CHAT_IDS.includes(String(chatId))) {
            return bot.answerCallbackQuery(query.id, { text: '❌ Ruxsat yo\'q' });
        }

        try {
            if (data.startsWith('approve_')) {
                const orderId = data.replace('approve_', '');
                await pool.query(
                    "UPDATE orders SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1",
                    [orderId]
                );

                bot.answerCallbackQuery(query.id, { text: '✅ Buyurtma qabul qilindi!' });

                // Xabarni yangilash
                const newText = query.message.text + '\n\n─────────────\n✅ <b>QABUL QILINDI</b>';
                await bot.editMessageText(newText, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: [] }
                });

            } else if (data.startsWith('reject_')) {
                const orderId = data.replace('reject_', '');
                await pool.query(
                    "UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1",
                    [orderId]
                );

                bot.answerCallbackQuery(query.id, { text: '❌ Buyurtma bekor qilindi!' });

                const newText = query.message.text + '\n\n─────────────\n❌ <b>BEKOR QILINDI</b>';
                await bot.editMessageText(newText, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: [] }
                });
            }
        } catch (err) {
            bot.answerCallbackQuery(query.id, { text: '❌ Xatolik: ' + err.message });
        }
    });

    // Bot polling error handling
    bot.on('polling_error', (error) => {
        console.error('🤖 Bot polling error:', error.message);
    });

} else {
    console.log('⚠️ TELEGRAM_BOT_TOKEN not set. Bot disabled.');
}

// ==================== MIDDLEWARE ====================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'Origin'],
    credentials: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== DATABASE ====================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
    try {
        console.log('🔄 Checking database...');

        // Products table
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'products'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            await pool.query(`
                CREATE TABLE products (
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
            console.log('✅ Products table created');
        }

        // Orders table
        const ordersCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'orders'
            );
        `);

        if (!ordersCheck.rows[0].exists) {
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

        // Initial products
        // Initial products - YO'QOLGANLARNI TIKLASH
        const countResult = await pool.query('SELECT COUNT(*) as count FROM products');
        const existingIds = await pool.query('SELECT id FROM products');
        const existingIdSet = new Set(existingIds.rows.map(r => parseInt(r.id)));
        
        const { INITIAL_PRODUCTS } = require('./menu.js');
        
        // Yo'qolgan mahsulotlarni topish
        const missingProducts = INITIAL_PRODUCTS.filter(p => !existingIdSet.has(parseInt(p.id)));
        
        if (missingProducts.length > 0) {
            console.log(`📝 ${missingProducts.length} ta mahsulot yo'qolgan, tiklanmoqda...`);
            for (const p of missingProducts) {
                await pool.query(`
                    INSERT INTO products (id, name_uz, name_ru, name_en, category, prices, min_qty, 
                        description_uz, description_ru, description_en, image, status, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    p.id, p.nameUz, p.nameRu, p.nameEn, p.category, JSON.stringify(p.prices), p.minQty,
                    p.descriptionUz, p.descriptionRu, p.descriptionEn, p.image, p.status
                ]);
            }
            console.log(`✅ ${missingProducts.length} ta mahsulot tiklandi`);
        } else {
            console.log('✅ Barcha mahsulotlar bazada mavjud');
        }

        console.log('✅ Database ready');
        return true;
    } catch (error) {
        console.error('❌ Database init error:', error.message);
        return false;
    }
}

// ==================== HELPERS ====================
function generateClickSignature(params, secretKey) {
    const signString = `${params.service_id}${params.amount}${params.transaction_param}${secretKey}`;
    return crypto.createHash('md5').update(signString).digest('hex');
}

function formatOrderMessage(order) {
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
    const itemsText = items.map(i => `• ${i.name}: <b>${i.quantity} kg</b>`).join('\n');

    const typeIcon = order.customer_type === 'legal' ? '🏢' : '👤';
    const typeText = order.customer_type === 'legal' ? 'Yuridik shaxs' : 'Jismoniy shaxs';

    return `🆕 <b>Yangi buyurtma!</b>\n\n` +
        `🆔 ID: <code>${order.order_id}</code>\n` +
        `${typeIcon} Turi: <b>${typeText}</b>\n` +
        `👤 Mijoz: <b>${order.customer_name}</b>\n` +
        `📞 Tel: <code>${order.phone}</code>\n` +
        `📍 Manzil: ${order.address || '-'}\n` +
        `💰 Summa: <b>${order.total} so'm</b>\n` +
        `💳 To'lov: ${order.payment_method}\n\n` +
        `📋 Mahsulotlar:\n${itemsText}\n\n` +
        `🕐 ${new Date(order.created_at).toLocaleString('uz-UZ')}`;
}

async function notifyAdmins(order) {
    if (!bot || ADMIN_CHAT_IDS.length === 0) {
        console.log('⚠️ Bot or admin IDs not configured, skipping notification');
        return;
    }

    const message = formatOrderMessage(order);

    for (const adminId of ADMIN_CHAT_IDS) {
        try {
            await bot.sendMessage(adminId, message, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ Qabul qilish', callback_data: `approve_${order.order_id}` },
                            { text: '❌ Bekor qilish', callback_data: `reject_${order.order_id}` }
                        ]
                    ]
                }
            });
            console.log(`📨 Notification sent to admin ${adminId}`);
        } catch (err) {
            console.error(`❌ Failed to notify admin ${adminId}:`, err.message);
        }
    }
}

// ==================== API ROUTES ====================

// Create Order
app.post('/api/orders/create-with-payment', async (req, res) => {
    console.log('\n📥 Create order request:', req.body);

    try {
        const { customerName, phone, address, comment, items, total, userType } = req.body;

        if (!customerName || !phone || !total || !items) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['customerName', 'phone', 'total', 'items']
            });
        }

        const orderId = 'PH-' + Date.now();
        const isLegal = userType === 'legal';

        const result = await pool.query(`
            INSERT INTO orders (
                order_id, customer_name, customer_type, phone, address, 
                comment, items, total, payment_method, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
            RETURNING *
        `, [
            orderId, 
            customerName, 
            isLegal ? 'legal' : 'individual',
            phone, 
            address || '', 
            comment || '', 
            JSON.stringify(items), 
            parseFloat(total), 
            isLegal ? 'Bank transfer (Contract)' : 'Click', 
            'new'
        ]);

        const savedOrder = result.rows[0];
        console.log('✅ Order saved:', savedOrder.order_id);

        // ===== TELEGRAM NOTIFICATION =====
        await notifyAdmins(savedOrder);

        // Click payment URL (only for individuals)
        let paymentUrl = null;
        if (!isLegal) {
            const returnUrl = `${WEB_APP_URL}?payment=return&order_id=${orderId}`;
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
        console.error('\n❌ Order error:', error.message);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Approve Order
app.post('/api/orders/:orderId/approve', async (req, res) => {
    try {
        const result = await pool.query(
            "UPDATE orders SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1 RETURNING *",
            [req.params.orderId]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: true, message: 'Qabul qilindi', order: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reject Order
app.post('/api/orders/:orderId/reject', async (req, res) => {
    try {
        const result = await pool.query(
            "UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1 RETURNING *",
            [req.params.orderId]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: true, message: 'Bekor qilindi', order: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Orders
app.get('/api/orders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Check Payment
app.get('/api/orders/check-payment/:orderId', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT payment_status, status, click_trans_id, click_paydoc_id FROM orders WHERE order_id = $1',
            [req.params.orderId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CLICK Prepare
app.get('/api/payment/click/prepare', async (req, res) => {
    try {
        const { merchant_trans_id, amount, click_trans_id } = req.query;
        const result = await pool.query('SELECT * FROM orders WHERE order_id = $1', [merchant_trans_id]);
        if (result.rows.length === 0) return res.json({ error: -5, error_note: 'Order not found' });
        if (parseFloat(result.rows[0].total) !== parseFloat(amount)) return res.json({ error: -2, error_note: 'Invalid amount' });
        res.json({ click_trans_id, merchant_trans_id, merchant_prepare_id: Date.now(), error: 0, error_note: 'Success' });
    } catch (error) {
        res.json({ error: -3, error_note: 'Server error' });
    }
});

// CLICK Complete
app.post('/api/payment/click/complete', async (req, res) => {
    try {
        const { click_trans_id, merchant_trans_id, click_paydoc_id, error: clickError } = req.body;
        if (parseInt(clickError) < 0) {
            await pool.query('UPDATE orders SET payment_status = $1 WHERE order_id = $2', ['failed', merchant_trans_id]);
            return res.json({ error: 0, error_note: 'Success' });
        }
        await pool.query(
            'UPDATE orders SET payment_status = $1, click_trans_id = $2, click_paydoc_id = $3 WHERE order_id = $4',
            ['paid', click_trans_id, click_paydoc_id, merchant_trans_id]
        );
        res.json({ click_trans_id, merchant_trans_id, merchant_confirm_id: Date.now(), error: 0, error_note: 'Success' });
    } catch (error) {
        res.json({ error: -3, error_note: 'Server error' });
    }
});

// ==================== PRODUCTS API ====================
app.get('/api/products', async (req, res) => {
    try {
        const { lastSync } = req.query;
        let query = 'SELECT * FROM products';
        let params = [];
        if (lastSync) {
            query += ' WHERE updated_at > $1';
            params.push(new Date(parseInt(lastSync)));
        }
        query += ' ORDER BY id ASC';
        const result = await pool.query(query, params);
        const maxResult = await pool.query('SELECT MAX(updated_at) as last_update FROM products');
        res.json({
            products: result.rows,
            serverTime: new Date().getTime(),
            lastUpdate: maxResult.rows[0]?.last_update || new Date()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const { id, nameUz, nameRu, nameEn, category, prices, minQty, descriptionUz, descriptionRu, descriptionEn, image, status } = req.body;
        const check = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
        const exists = check.rowCount > 0;
        const now = new Date();
        let result;
        if (exists) {
            result = await pool.query(`UPDATE products SET name_uz=$1, name_ru=$2, name_en=$3, category=$4, prices=$5, min_qty=$6, description_uz=$7, description_ru=$8, description_en=$9, image=$10, status=$11, updated_at=$12 WHERE id=$13 RETURNING *`,
                [nameUz, nameRu, nameEn, category, JSON.stringify(prices), minQty, descriptionUz, descriptionRu, descriptionEn, image, status, now, id]);
        } else {
            result = await pool.query(`INSERT INTO products (id, name_uz, name_ru, name_en, category, prices, min_qty, description_uz, description_ru, description_en, image, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
                [id, nameUz, nameRu, nameEn, category, JSON.stringify(prices), minQty, descriptionUz, descriptionRu, descriptionEn, image, status, now, now]);
        }
        res.json({ success: true, product: result.rows[0], timestamp: now.getTime() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nameUz, nameRu, nameEn, category, prices, minQty, descriptionUz, descriptionRu, descriptionEn, image, status } = req.body;
        const result = await pool.query(
            `UPDATE products SET name_uz=$1, name_ru=$2, name_en=$3, category=$4, prices=$5, min_qty=$6, description_uz=$7, description_ru=$8, description_en=$9, image=$10, status=$11, updated_at=CURRENT_TIMESTAMP WHERE id=$12 RETURNING *`,
            [nameUz||'', nameRu||'', nameEn||'', category||'other', JSON.stringify(prices||{retail:0,wholesale:0}), parseInt(minQty)||1, descriptionUz||'', descriptionRu||'', descriptionEn||'', image||'', status||'active', parseInt(id)]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Product not found' });
        res.json({ success: true, product: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
        res.json({ success: true, deletedAt: new Date().getTime() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/products/:id/status', async (req, res) => {
    try {
        const result = await pool.query('UPDATE products SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [req.body.status, req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Product not found' });
        res.json({ success: true, product: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path, method: req.method });
});

// ==================== START ====================
async function start() {
    await initDB();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`🌐 Web App: ${WEB_APP_URL}`);
        console.log(`🤖 Bot: ${BOT_TOKEN ? 'Active' : 'Disabled'}`);
        console.log(`👥 Admin IDs: ${ADMIN_CHAT_IDS.join(', ') || 'None'}`);
    });
}

start().catch(err => {
    console.error('❌ Failed to start:', err.message);
    process.exit(1);
});
