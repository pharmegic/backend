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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
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



async function initDB() {
    try {
        console.log('🔄 Checking database...');

        // Products jadvalini tekshirish
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'products'
            );
        `);
        
        const tableExists = tableCheck.rows[0].exists;
        
        if (!tableExists) {
            // Products jadvalini yaratish
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

        // Orders jadvalini tekshirish
        const ordersTableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'orders'
            );
        `);
        
        const ordersTableExists = ordersTableCheck.rows[0].exists;
        
        if (!ordersTableExists) {
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

        // MAHSULOTLAR BORLIGINI TEKSHIRISH
        const countResult = await pool.query('SELECT COUNT(*) as count FROM products');
        const count = parseInt(countResult.rows[0].count);
        
        console.log(`📊 Bazada ${count} ta mahsulot bor`);
        
        // Agar bo'sh bo'lsa, initial products ni qo'shish
        if (count === 0) {
            console.log('📝 Boshlang\'ich mahsulotlarni qo\'shish...');
            
            const INITIAL_PRODUCTS = [
                {
                    id: 1,
                    nameRu: "Аэросил 200 (Коллоидал силикон диоксид)",
                    nameUz: "Aerosil 200 (Kolloidal kremniy dioksid)",
                    nameEn: "Aerosil 200 (Colloidal silicon dioxide)",
                    category: "excipient",
                    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400&h=300&fit=crop",
                    prices: { retail: 100, wholesale: 100 },
                    minQty: 10,
                    descriptionRu: "Фармацевтический наполнитель для таблеток и капсул.",
                    descriptionUz: "Tabletalar va kapsulalar uchun farmatsevtik to'ldirgich.",
                    descriptionEn: "Pharmaceutical excipient for tablets and capsules.",
                    status: "active"
                },
                {
                    id: 2,
                    nameRu: "Бензокаин (Анестезин)",
                    nameUz: "Benzokain (Anestezin)",
                    nameEn: "Benzocaine (Anesthesin)",
                    category: "chemical",
                    image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=300&fit=crop",
                    prices: { retail: 350000, wholesale: 300000 },
                    minQty: 25,
                    descriptionRu: "Местный анестетик для медицинских и косметических продуктов.",
                    descriptionUz: "Tibbiy va kosmetik mahsulotlar uchun mahalliy anestetik.",
                    descriptionEn: "Topical anesthetic for medical and cosmetic products.",
                    status: "active"
                },
                {
                    id: 3,
                    nameRu: "Дифенгидрамин (Димедрол)",
                    nameUz: "Difengidramin (Dimedrol)",
                    nameEn: "Diphenhydramine (Dimedrol)",
                    category: "chemical",
                    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=300&fit=crop",
                    prices: { retail: 625000, wholesale: 550000 },
                    minQty: 25,
                    descriptionRu: "Антигистаминное средство для фармацевтического производства.",
                    descriptionUz: "Farmatsevtika ishlab chiqarish uchun antigistamin vosita.",
                    descriptionEn: "Antihistamine for pharmaceutical manufacturing.",
                    status: "active"
                },
                {
                    id: 4,
                    nameRu: "Диметилсульфоксид",
                    nameUz: "Dimetilsulfoksid",
                    nameEn: "Dimethyl sulfoxide (DMSO)",
                    category: "chemical",
                    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400&h=300&fit=crop",
                    prices: { retail: 150000, wholesale: 90000 },
                    minQty: 250,
                    descriptionRu: "Растворитель для фармацевтических препаратов.",
                    descriptionUz: "Farmatsevtik preparatlar uchun erituvchi.",
                    descriptionEn: "Solvent for pharmaceutical preparations.",
                    status: "active"
                },
                {
                    id: 5,
                    nameRu: "Магния стеарат",
                    nameUz: "Magniy stearat",
                    nameEn: "Magnesium stearate",
                    category: "excipient",
                    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400&h=300&fit=crop",
                    prices: { retail: 75000, wholesale: 75000 },
                    minQty: 10,
                    descriptionRu: "Смазывающий агент для производства таблеток.",
                    descriptionUz: "Tablet ishlab chiqarish uchun yog'lovchi modda.",
                    descriptionEn: "Lubricant for tablet manufacturing.",
                    status: "active"
                },
                {
                    id: 6,
                    nameRu: "Ментол кристаллический",
                    nameUz: "Mentol kristall",
                    nameEn: "Menthol crystals",
                    category: "chemical",
                    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400&h=300&fit=crop",
                    prices: { retail: 350000, wholesale: 300000 },
                    minQty: 25,
                    descriptionRu: "Фармацевтический ментол для косметических и фармацевтических применений.",
                    descriptionUz: "Kosmetik va farmatsevtik qo'llanish uchun farmatsevtik mentol.",
                    descriptionEn: "Pharmaceutical menthol for cosmetic and pharmaceutical applications.",
                    status: "active"
                },
                {
                    id: 7,
                    nameRu: "Микрокристаллическая целлюлоза 101",
                    nameUz: "Mikrokristallik tsellyuloza 101 (MKTS 101)",
                    nameEn: "Microcrystalline cellulose 101 (MCC 101)",
                    category: "excipient",
                    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400&h=300&fit=crop",
                    prices: { retail: 75000, wholesale: 75000 },
                    minQty: 20,
                    descriptionRu: "Микрокристаллическая целлюлоза 101 для производства таблеток.",
                    descriptionUz: "Tablet ishlab chiqarish uchun mikrokristallik tsellyuloza 101.",
                    descriptionEn: "Microcrystalline cellulose 101 for tablet manufacturing.",
                    status: "active"
                },
                {
                    id: 8,
                    nameRu: "Микрокристаллическая целлюлоза 102",
                    nameUz: "Mikrokristallik tsellyuloza 102 (MKTS 102)",
                    nameEn: "Microcrystalline cellulose 102 (MCC 102)",
                    category: "excipient",
                    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400&h=300&fit=crop",
                    prices: { retail: 80000, wholesale: 80000 },
                    minQty: 20,
                    descriptionRu: "Микрокристаллическая целлюлоза 102 для производства таблеток.",
                    descriptionUz: "Tablet ishlab chiqarish uchun mikrokristallik tsellyuloza 102.",
                    descriptionEn: "Microcrystalline cellulose 102 for tablet manufacturing.",
                    status: "active"
                },
                {
                    id: 9,
                    nameRu: "Метилпарабен (Нипагин)",
                    nameUz: "Metilparaben (Nipagin)",
                    nameEn: "Methylparaben (Nipagin)",
                    category: "excipient",
                    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=300&fit=crop",
                    prices: { retail: 350000, wholesale: 300000 },
                    minQty: 25,
                    descriptionRu: "Консервант для косметических и фармацевтических продуктов.",
                    descriptionUz: "Kosmetik va farmatsevtik mahsulotlar uchun konservant.",
                    descriptionEn: "Preservative for cosmetic and pharmaceutical products.",
                    status: "active"
                },
                {
                    id: 10,
                    nameRu: "Метилпарабен натрий (Нипагин)",
                    nameUz: "Metilparaben natriy (Nipagin)",
                    nameEn: "Sodium methylparaben (Nipagin)",
                    category: "excipient",
                    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=300&fit=crop",
                    prices: { retail: 350000, wholesale: 300000 },
                    minQty: 25,
                    descriptionRu: "Консервант для косметических и фармацевтических продуктов.",
                    descriptionUz: "Kosmetik va farmatsevtik mahsulotlar uchun konservant.",
                    descriptionEn: "Preservative for cosmetic and pharmaceutical products.",
                    status: "active"
                },
                {
                    id: 11,
                    nameRu: "Натрий крахмал гликолят",
                    nameUz: "Natriy kraxmal glikolat",
                    nameEn: "Sodium starch glycolate",
                    category: "excipient",
                    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400&h=300&fit=crop",
                    prices: { retail: 75000, wholesale: 75000 },
                    minQty: 25,
                    descriptionRu: "Супердизинтегрант для фармацевтических таблеток.",
                    descriptionUz: "Farmatsevtik tabletalar uchun superdisintegrant.",
                    descriptionEn: "Superdisintegrant for pharmaceutical tablets.",
                    status: "active"
                },
                {
                    id: 12,
                    nameRu: "Натрий карбоксиметилцеллюлоза",
                    nameUz: "Natriy karboksimetiltsellyuloza",
                    nameEn: "Sodium carboxymethylcellulose (CMC)",
                    category: "excipient",
                    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400&h=300&fit=crop",
                    prices: { retail: 100000, wholesale: 100000 },
                    minQty: 25,
                    descriptionRu: "Натрий КМЦ для фармацевтических применений.",
                    descriptionUz: "Farmatsevtik qo'llanishlar uchun natriy KMTS.",
                    descriptionEn: "Sodium CMC for pharmaceutical applications.",
                    status: "active"
                },
                {
                    id: 13,
                    nameRu: "Повидон йод",
                    nameUz: "Povidon yod",
                    nameEn: "Povidone iodine",
                    category: "chemical",
                    image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=300&fit=crop",
                    prices: { retail: 450000, wholesale: 400000 },
                    minQty: 25,
                    descriptionRu: "Антисептик для фармацевтических и медицинских применений.",
                    descriptionUz: "Farmatsevtik va tibbiy qo'llanishlar uchun antiseptik.",
                    descriptionEn: "Antiseptic for pharmaceutical and medical applications.",
                    status: "active"
                },
                {
                    id: 14,
                    nameRu: "Поливинилпирролидон К30",
                    nameUz: "Polivinilpirrolidon K30 (Povidon K30)",
                    nameEn: "Polyvinylpyrrolidone K30 (Povidone K30)",
                    category: "excipient",
                    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400&h=300&fit=crop",
                    prices: { retail: 250000, wholesale: 170000 },
                    minQty: 25,
                    descriptionRu: "Связывающее вещество для таблеток.",
                    descriptionUz: "Tabletalar uchun bog'lovchi modda.",
                    descriptionEn: "Binder for tablets.",
                    status: "active"
                },
                {
                    id: 15,
                    nameRu: "Прокаин гидрохлорид",
                    nameUz: "Prokain gidroxlorid (Novokain)",
                    nameEn: "Procaine hydrochloride (Novocaine)",
                    category: "chemical",
                    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=300&fit=crop",
                    prices: { retail: 350000, wholesale: 300000 },
                    minQty: 25,
                    descriptionRu: "Местный анестетик для фармацевтического производства.",
                    descriptionUz: "Farmatsevtika ishlab chiqarish uchun mahalliy anestetik.",
                    descriptionEn: "Local anesthetic for pharmaceutical manufacturing.",
                    status: "active"
                },
                {
                    id: 16,
                    nameRu: "Пропилпарабен (Нипазол)",
                    nameUz: "Propilparaben (Nipazol)",
                    nameEn: "Propylparaben (Nipazol)",
                    category: "excipient",
                    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=300&fit=crop",
                    prices: { retail: 350000, wholesale: 300000 },
                    minQty: 25,
                    descriptionRu: "Консервант для косметических и фармацевтических продуктов.",
                    descriptionUz: "Kosmetik va farmatsevtik mahsulotlar uchun konservant.",
                    descriptionEn: "Preservative for cosmetic and pharmaceutical products.",
                    status: "active"
                },
                {
                    id: 17,
                    nameRu: "Пропилпарабен натрий (Нипазол)",
                    nameUz: "Propilparaben natriy (Nipazol)",
                    nameEn: "Sodium propylparaben (Nipazol)",
                    category: "excipient",
                    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=300&fit=crop",
                    prices: { retail: 350000, wholesale: 300000 },
                    minQty: 25,
                    descriptionRu: "Консервант для косметических и фармацевтических продуктов.",
                    descriptionUz: "Kosmetik va farmatsevtik mahsulotlar uchun konservant.",
                    descriptionEn: "Preservative for cosmetic and pharmaceutical products.",
                    status: "active"
                },
                {
                    id: 18,
                    nameRu: "Фенирамина малеат",
                    nameUz: "Feniramina maleat",
                    nameEn: "Pheniramine maleate",
                    category: "chemical",
                    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=300&fit=crop",
                    prices: { retail: 2600000, wholesale: 2400000 },
                    minQty: 25,
                    descriptionRu: "Антигистаминное средство для фармацевтического производства.",
                    descriptionUz: "Farmatsevtika ishlab chiqarish uchun antigistamin vosita.",
                    descriptionEn: "Antihistamine for pharmaceutical manufacturing.",
                    status: "active"
                },
                {
                    id: 19,
                    nameRu: "Солнечный закат (Sunset yellow)",
                    nameUz: "Quyosh botishi sariq (Sunset yellow)",
                    nameEn: "Sunset yellow",
                    category: "chemical",
                    image: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&h=300&fit=crop",
                    prices: { retail: 600000, wholesale: 600000 },
                    minQty: 5,
                    descriptionRu: "Пищевой краситель для фармацевтической и пищевой промышленности.",
                    descriptionUz: "Farmatsevtika va oziq-ovqat sanoati uchun ozuqali bo'yoq.",
                    descriptionEn: "Food colorant for pharmaceutical and food industry.",
                    status: "active"
                },
                {
                    id: 20,
                    nameRu: "Хинолин жёлтый (Quinoline yellow)",
                    nameUz: "Xinolin sariq (Quinoline yellow)",
                    nameEn: "Quinoline yellow",
                    category: "chemical",
                    image: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&h=300&fit=crop",
                    prices: { retail: 600000, wholesale: 600000 },
                    minQty: 5,
                    descriptionRu: "Пищевой краситель для фармацевтической и пищевой промышленности.",
                    descriptionUz: "Farmatsevtika va oziq-ovqat sanoati uchun ozuqali bo'yoq.",
                    descriptionEn: "Food colorant for pharmaceutical and food industry.",
                    status: "active"
                },
                {
                    id: 21,
                    nameRu: "Цитиколин натрий",
                    nameUz: "Tsitikolin natriy",
                    nameEn: "Citicoline sodium",
                    category: "chemical",
                    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=300&fit=crop",
                    prices: { retail: 4000000, wholesale: 4000000 },
                    minQty: 25,
                    descriptionRu: "Ноотропный ингредиент для добавок для здоровья мозга.",
                    descriptionUz: "Miya sog'ligi uchun qo'shimchalar uchun nootrop ingredient.",
                    descriptionEn: "Nootropic ingredient for brain health supplements.",
                    status: "active"
                },
                {
                    id: 22,
                    nameRu: "Нитрофуразол (Фурацилин)",
                    nameUz: "Nitrofurozol (Furatsilin)",
                    nameEn: "Nitrofurazone (Furacilin)",
                    category: "chemical",
                    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=300&fit=crop",
                    prices: { retail: 1150000, wholesale: 1050000 },
                    minQty: 25,
                    descriptionRu: "Антисептик для наружного применения.",
                    descriptionUz: "Tashqi qo'llanish uchun antiseptik.",
                    descriptionEn: "Antiseptic for external use.",
                    status: "active"
                },
                {
                    id: 23,
                    nameRu: "Гидроксипропилметилцеллюлоза (Гипромелоза) HPMC",
                    nameUz: "Gidroksipropilmetiltsellyuloza (Gipromeloza) HPMC",
                    nameEn: "Hydroxypropyl methylcellulose (HPMC)",
                    category: "excipient",
                    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400&h=300&fit=crop",
                    prices: { retail: 250000, wholesale: 190000 },
                    minQty: 25,
                    descriptionRu: "Гипромеллоза для покрытия таблеток.",
                    descriptionUz: "Tablet qoplamalari uchun gipromeloza.",
                    descriptionEn: "Hydroxypropyl methylcellulose for tablet coating.",
                    status: "active"
                },
                {
                    id: 24,
                    nameRu: "Полиэтиленгликоль 6000",
                    nameUz: "Polietilenglikol 6000",
                    nameEn: "Polyethylene glycol 6000 (PEG 6000)",
                    category: "excipient",
                    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400&h=300&fit=crop",
                    prices: { retail: 130000, wholesale: 100000 },
                    minQty: 25,
                    descriptionRu: "Фармацевтический эксципиент ПЭГ 6000.",
                    descriptionUz: "Farmatsevtik eksipiyent PEG 6000.",
                    descriptionEn: "Pharmaceutical excipient PEG 6000.",
                    status: "active"
                },
                {
                    id: 25,
                    nameRu: "Полиэтиленгликоль 4000",
                    nameUz: "Polietilenglikol 4000",
                    nameEn: "Polyethylene glycol 4000 (PEG 4000)",
                    category: "excipient",
                    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400&h=300&fit=crop",
                    prices: { retail: 130000, wholesale: 100000 },
                    minQty: 25,
                    descriptionRu: "Фармацевтический эксципиент ПЭГ 4000.",
                    descriptionUz: "Farmatsevtik eksipiyent PEG 4000.",
                    descriptionEn: "Pharmaceutical excipient PEG 4000.",
                    status: "active"
                },
                {
                    id: 26,
                    nameRu: "Масло эвкалиптовое",
                    nameUz: "Evkalipt moyi",
                    nameEn: "Eucalyptus oil",
                    category: "oil",
                    image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=300&fit=crop",
                    prices: { retail: 500000, wholesale: 500000 },
                    minQty: 25,
                    descriptionRu: "Чистое эфирное масло эвкалипта для фармацевтического и косметического использования.",
                    descriptionUz: "Farmatsevtik va kosmetik foydalanish uchun toza evkalipt efir moyi.",
                    descriptionEn: "Pure eucalyptus essential oil for pharmaceutical and cosmetic use.",
                    status: "active"
                },
                {
                    id: 27,
                    nameRu: "Масло тимоловое",
                    nameUz: "Timol moyi",
                    nameEn: "Thyme oil",
                    category: "oil",
                    image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=300&fit=crop",
                    prices: { retail: 500000, wholesale: 500000 },
                    minQty: 25,
                    descriptionRu: "Тимьяновое масло с высоким содержанием тимола.",
                    descriptionUz: "Yuqori timol tarkibiga ega timyan moyi.",
                    descriptionEn: "Thyme oil with high thymol content.",
                    status: "active"
                },
                {
                    id: 28,
                    nameRu: "Масло мяты перечной",
                    nameUz: "Yalpiz moyi",
                    nameEn: "Peppermint oil",
                    category: "oil",
                    image: "https://images.unsplash.com/photo-1628556270448-4d4e6a4d57c1?w=400&h=300&fit=crop",
                    prices: { retail: 500000, wholesale: 500000 },
                    minQty: 25,
                    descriptionRu: "Перечная мята эфирное масло для пищевой и фармацевтической промышленности.",
                    descriptionUz: "Oziq-ovqat va farmatsevtika sanoati uchun yalpiz efir moyi.",
                    descriptionEn: "Peppermint essential oil for food and pharmaceutical industry.",
                    status: "active"
                },
                {
                    id: 29,
                    nameRu: "Кроскармеллоза натрий",
                    nameUz: "Kroskarmeloza natriy",
                    nameEn: "Croscarmellose sodium",
                    category: "excipient",
                    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400&h=300&fit=crop",
                    prices: { retail: 300000, wholesale: 275000 },
                    minQty: 25,
                    descriptionRu: "Супердизинтегрант для фармацевтических таблеток.",
                    descriptionUz: "Farmatsevtik tabletalar uchun superdisintegrant.",
                    descriptionEn: "Superdisintegrant for pharmaceutical tablets.",
                    status: "active"
                },
                {
                    id: 30,
                    nameRu: "Симетикон эмульсия 30%",
                    nameUz: "Simetikon emulsiya 30%",
                    nameEn: "Simethicone emulsion 30%",
                    category: "chemical",
                    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=300&fit=crop",
                    prices: { retail: 230000, wholesale: 230000 },
                    minQty: 50,
                    descriptionRu: "Антифлатулент для фармацевтических препаратов.",
                    descriptionUz: "Farmatsevtik preparatlar uchun antiflatulent.",
                    descriptionEn: "Antiflatulent for pharmaceutical preparations.",
                    status: "active"
                }
            ];
            
            for (const product of INITIAL_PRODUCTS) {
                await pool.query(`
                    INSERT INTO products (id, name_uz, name_ru, name_en, category, prices, min_qty, 
                        description_uz, description_ru, description_en, image, status, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    product.id, product.nameUz, product.nameRu, product.nameEn,
                    product.category, JSON.stringify(product.prices), product.minQty,
                    product.descriptionUz, product.descriptionRu, product.descriptionEn,
                    product.image, product.status
                ]);
            }
            console.log(`✅ ${INITIAL_PRODUCTS.length} ta mahsulot qo'shildi`);
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
            isLegal ? 'legal' : 'individual',
            phone, 
            address || '', 
            comment || '', 
            JSON.stringify(items), 
            parseFloat(total), 
            isLegal ? 'Bank transfer (Contract)' : 'Click', 
            'new'
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

// ============================================
// PRODUCTS API - BARCHA ENDPOINTLAR
// ============================================

app.get('/api/products', async (req, res) => {
    try {
        const { lastSync } = req.query; // Client oxirgi marta qachon yangilaganini yuboradi
        
        let query = 'SELECT * FROM products';
        let params = [];
        
        // Agar lastSync berilgan bo'lsa, faqat shu vaqtdan keyin o'zgarganlarni qaytar
        if (lastSync) {
            query += ' WHERE updated_at > $1';
            params.push(new Date(parseInt(lastSync)));
        }
        
        query += ' ORDER BY updated_at DESC';
        
        const result = await pool.query(query, params);
        
        // So'nggi yangilanish vaqtini ham qaytarish
        const maxResult = await pool.query('SELECT MAX(updated_at) as last_update FROM products');
        const serverLastUpdate = maxResult.rows[0]?.last_update || new Date();
        
        res.json({
            products: result.rows,
            serverTime: new Date().getTime(),
            lastUpdate: serverLastUpdate
        });
    } catch (error) {
        console.error('❌ Get products error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// GET single product
app.get('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Get product error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const { id, nameUz, nameRu, nameEn, category, prices, minQty, 
                descriptionUz, descriptionRu, descriptionEn, image, status } = req.body;
        
        // Avval mavjud mahsulotni tekshirish
        const checkResult = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
        const exists = checkResult.rowCount > 0;
        
        let result;
        const now = new Date();
        
        if (exists) {
            // UPDATE - updated_at ni yangilash
            result = await pool.query(`
                UPDATE products SET
                    name_uz = $1, name_ru = $2, name_en = $3, category = $4,
                    prices = $5, min_qty = $6, description_uz = $7, description_ru = $8,
                    description_en = $9, image = $10, status = $11, updated_at = $12
                WHERE id = $13
                RETURNING *
            `, [nameUz, nameRu, nameEn, category, JSON.stringify(prices), minQty,
                descriptionUz, descriptionRu, descriptionEn, image, status, now, id]);
        } else {
            // INSERT - created_at va updated_at ni qo'shish
            result = await pool.query(`
                INSERT INTO products (id, name_uz, name_ru, name_en, category, prices,
                    min_qty, description_uz, description_ru, description_en, image, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING *
            `, [id, nameUz, nameRu, nameEn, category, JSON.stringify(prices), minQty,
                descriptionUz, descriptionRu, descriptionEn, image, status, now, now]);
        }
        
        console.log(`✅ Product ${id} ${exists ? 'updated' : 'created'} at ${now}`);
        
        // Barcha ulangan clientlarga xabar yuborish (keyinchalik WebSocket qo'shish mumkin)
        res.json({ 
            success: true, 
            product: result.rows[0],
            timestamp: now.getTime()
        });
    } catch (error) {
        console.error('❌ Save product error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// PUT update product - BU ENDPOINT YANGI QO'SHILDI
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            nameUz, nameRu, nameEn, category, prices, minQty, 
            descriptionUz, descriptionRu, descriptionEn, image, status 
        } = req.body;
        
        // ID ni tekshirish
        const productId = parseInt(id);
        if (isNaN(productId)) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }
        
        console.log(`📝 Updating product ${productId}`);
        
        // Avval mahsulot mavjudligini tekshirish
        const checkResult = await pool.query(
            'SELECT id FROM products WHERE id = $1',
            [productId]
        );
        
        if (checkResult.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // UPDATE so'rovi - to'g'ri parameter binding
        const result = await pool.query(
            `UPDATE products SET
                name_uz = $1,
                name_ru = $2,
                name_en = $3,
                category = $4,
                prices = $5,
                min_qty = $6,
                description_uz = $7,
                description_ru = $8,
                description_en = $9,
                image = $10,
                status = $11,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $12
            RETURNING *`,
            [
                nameUz || '',
                nameRu || '',
                nameEn || '',
                category || 'other',
                JSON.stringify(prices || { retail: 0, wholesale: 0 }),
                parseInt(minQty) || 1,
                descriptionUz || '',
                descriptionRu || '',
                descriptionEn || '',
                image || '',
                status || 'active',
                productId
            ]
        );
        
        console.log(`✅ Product ${productId} updated`);
        res.json({ 
            success: true, 
            message: 'Product updated',
            product: result.rows[0] 
        });
        
    } catch (error) {
        console.error('❌ Update error:', error.message);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

// DELETE product
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM products WHERE id = $1', [id]);
        console.log(`✅ Product ${id} deleted`);
        res.json({ success: true, deletedAt: new Date().getTime() });
    } catch (error) {
        console.error('❌ Delete product error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// PATCH update status - Faqat status o'zgartirish uchun
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
        
        console.log(`✅ Product ${id} status changed to ${status}`);
        res.json({ success: true, product: result.rows[0] });
    } catch (error) {
        console.error('❌ Update status error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path, method: req.method });
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
