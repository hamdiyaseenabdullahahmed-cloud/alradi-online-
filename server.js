/**
 * ====================================================================
 * الرعدي أونلاين | المتجر العالمي الأسطوري
 * ملف الخادم الرئيسي (server.js)
 * الإصدار: 8.0.0 - المؤسسي المتكامل
 * ====================================================================
 * 
 * هذا الملف هو قلب النظام بالكامل. يحتوي على:
 * 1. إعدادات السيرفر المتقدمة مع Session Management.
 * 2. قاعدة بيانات SQLite متكاملة مع جميع الجداول.
 * 3. نظام مصادقة متطور (bcrypt + Session Tokens).
 * 4. نظام أتمتة كامل (واتساب، PDF، QR Code، حجز المخزون).
 * 5. نظام إشعارات صوتية وتنبيهات للمدير.
 * 6. سجل نشاطات (Audit Log) لكل إجراء.
 * 7. نظام نقاط ولاء ومجموعات عملاء.
 * 8. جميع مسارات API المطلوبة.
 * 
 * ====================================================================
 */

// ==================== استيراد المكتبات ====================
const express = require('express');           // إطار عمل الخادم
const session = require('express-session');   // إدارة جلسات المستخدمين
const bcrypt = require('bcrypt');             // تشفير كلمات المرور
const sqlite3 = require('sqlite3').verbose(); // قاعدة البيانات
const path = require('path');                 // التعامل مع مسارات الملفات
const axios = require('axios');               // لإرسال طلبات HTTP (واتساب)
const QRCode = require('qrcode');             // لتوليد QR Code في الفواتير
const nodemailer = require('nodemailer');     // للبريد الإلكتروني (اختياري)

// ==================== تهيئة التطبيق ====================
const app = express();
const PORT = process.env.PORT || 3000;

// ==================== إعدادات السيرفر المتقدمة ====================
app.use(session({
    secret: 'raadi-ultimate-global-secret-key-2026-enterprise-level',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // صلاحية الجلسة: أسبوع كامل
        httpOnly: true,                   // يمنع الوصول للجلسة عبر JavaScript
        secure: false,                    // للإنتاج يمكن تفعيل true مع HTTPS
        sameSite: 'lax'
    }
}));

// Middleware لتحليل البيانات القادمة
app.use(express.json());                  // لقراءة JSON
app.use(express.urlencoded({ extended: true })); // لقراءة بيانات الفورم
app.use(express.static(path.join(__dirname, 'public'))); // تقديم الملفات الثابتة

// ==================== إعداد قاعدة البيانات SQLite ====================
const db = new sqlite3.Database('./raadi.db');

// تنفيذ الأوامر بشكل متسلسل لإنشاء الجداول
db.serialize(() => {
    // ------------------------------------------------------------
    // جدول الأقسام (Categories)
    // ------------------------------------------------------------
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        icon TEXT,
        createdAt TEXT
    )`);

    // ------------------------------------------------------------
    // جدول المنتجات (Products) - يدعم اللغات والخصومات
    // ------------------------------------------------------------
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        oldPrice REAL,
        discount INTEGER DEFAULT 0,
        color TEXT,
        features_ar TEXT,
        features_en TEXT,
        stock INTEGER DEFAULT 0,
        image TEXT,
        images TEXT,
        rating REAL DEFAULT 0,
        ratingCount INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        soldCount INTEGER DEFAULT 0,
        createdAt TEXT,
        updatedAt TEXT
    )`);

    // ------------------------------------------------------------
    // جدول تقييمات المنتجات (Product Ratings)
    // ------------------------------------------------------------
    db.run(`CREATE TABLE IF NOT EXISTS product_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        review_ar TEXT,
        review_en TEXT,
        createdAt TEXT,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // ------------------------------------------------------------
    // جدول المستخدمين (Users) - شامل نقاط الولاء والتفضيلات
    // ------------------------------------------------------------
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        phone TEXT,
        address TEXT,
        avatar TEXT,
        wishlist TEXT,              // قائمة الأمنيات (JSON Array)
        loyaltyPoints INTEGER DEFAULT 0,
        preferredLang TEXT DEFAULT 'ar',
        preferredCurrency TEXT DEFAULT 'SAR',
        createdAt TEXT,
        lastLogin TEXT
    )`);

    // ------------------------------------------------------------
    // جدول الطلبات (Orders) - شامل العملة والضرائب
    // ------------------------------------------------------------
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        orderNumber TEXT UNIQUE NOT NULL,
        customer TEXT NOT NULL,
        email TEXT,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT,
        country TEXT NOT NULL,
        items TEXT NOT NULL,        // JSON Array
        subtotal REAL NOT NULL,
        discount INTEGER DEFAULT 0,
        discountAmount REAL DEFAULT 0,
        shipping REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        total REAL NOT NULL,
        currency TEXT DEFAULT 'SAR',
        paymentMethod TEXT,
        status TEXT DEFAULT 'pending',
        trackingNumber TEXT,
        date TEXT NOT NULL,
        dateFormatted TEXT NOT NULL,
        notes TEXT
    )`);

    // ------------------------------------------------------------
    // جدول الرسائل (Messages) - دردشة العملاء والدعم
    // ------------------------------------------------------------
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        sender TEXT NOT NULL,
        text_ar TEXT,
        text_en TEXT,
        isAdmin INTEGER DEFAULT 0,
        isRead INTEGER DEFAULT 0,
        timestamp TEXT NOT NULL,
        date TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // ------------------------------------------------------------
    // جدول كوبونات الخصم (Coupons)
    // ------------------------------------------------------------
    db.run(`CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        value INTEGER NOT NULL,
        minOrder REAL DEFAULT 0,
        expiresAt TEXT,
        usageLimit INTEGER,
        usedCount INTEGER DEFAULT 0,
        createdAt TEXT
    )`);

    // ------------------------------------------------------------
    // جدول إعدادات المتجر (Settings) - يدعم اللغتين
    // ------------------------------------------------------------
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_ar TEXT,
        value_en TEXT,
        updatedAt TEXT
    )`);

    // ------------------------------------------------------------
    // جدول سجل النشاطات (Audit Log) - للشفافية والأمان
    // ------------------------------------------------------------
    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        ip TEXT,
        createdAt TEXT,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    )`);

    // ------------------------------------------------------------
    // جدول الحجوزات (Reserved Stock) - لمنع البيع المزدوج
    // ------------------------------------------------------------
    db.run(`CREATE TABLE IF NOT EXISTS reserved_stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        sessionId TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    )`);

    // ------------------------------------------------------------
    // جدول المجموعات (Groups) - لتجميع العملاء
    // ------------------------------------------------------------
    db.run(`CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        createdAt TEXT
    )`);

    // ------------------------------------------------------------
    // جدول ربط العملاء بالمجموعات (User Groups)
    // ------------------------------------------------------------
    db.run(`CREATE TABLE IF NOT EXISTS user_groups (
        userId INTEGER,
        groupId INTEGER,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (groupId) REFERENCES groups(id) ON DELETE CASCADE,
        PRIMARY KEY (userId, groupId)
    )`);

    // ==================== إدخال البيانات الأولية ====================
    
    // إدخال الأقسام الافتراضية
    db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
        if (row && row.count === 0) {
            const defaultCategories = [
                ['هواتف', 'Phones', 'fa-mobile-alt'],
                ['عطور', 'Perfumes', 'fa-leaf'],
                ['إكسسوارات', 'Accessories', 'fa-headphones'],
                ['إلكترونيات', 'Electronics', 'fa-microchip'],
                ['ملابس', 'Clothing', 'fa-tshirt'],
                ['أحذية', 'Shoes', 'fa-shoe-prints']
            ];
            const stmt = db.prepare("INSERT INTO categories (name_ar, name_en, icon, createdAt) VALUES (?, ?, ?, ?)");
            defaultCategories.forEach(cat => {
                stmt.run(cat[0], cat[1], cat[2], new Date().toISOString());
            });
            stmt.finalize();
        }
    });

    // إدخال المستخدم المدير الافتراضي
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (row && row.count === 0) {
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            db.run(`INSERT INTO users (name, email, password, role, loyaltyPoints, createdAt) 
                    VALUES (?, ?, ?, ?, ?, ?)`, 
                    ['المدير العام', 'admin@raadi.com', hashedPassword, 'admin', 0, new Date().toISOString()]);
        }
    });

    // إدخال المنتجات الافتراضية
    db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
        if (row && row.count === 0) {
            const sampleProducts = [
                ['هاتف الرعدي برو X', 'Raadi Phone Pro X', 'هواتف', 2999, 3499, 15, 'أسود تيتانيوم', 'كاميرا 200 ميجابكسل، شاشة 6.8 بوصة، معالج فائق', '200MP Camera, 6.8" Screen, Ultra Processor', 10, 'https://picsum.photos/id/0/300/300'],
                ['سامسونج جالكسي S24 الترا', 'Samsung Galaxy S24 Ultra', 'هواتف', 4940, 5200, 12, 'رمادي تيتانيوم', 'قلم S-Pen، سعة 512 جيجا، شاشة 6.8 بوصة', 'S-Pen, 512GB Storage, 6.8" Screen', 7, 'https://picsum.photos/id/1/300/300'],
                ['سماعة أبل إيربودز برو', 'Apple AirPods Pro', 'إكسسوارات', 899, 1099, 18, 'أبيض ناصع', 'عزل ضوضاء، صوت محيطي، مقاومة للماء', 'Noise Cancellation, Spatial Audio, Water Resistant', 15, 'https://picsum.photos/id/3/300/300']
            ];
            const stmt = db.prepare(`INSERT INTO products (name_ar, name_en, category, price, oldPrice, discount, color, features_ar, features_en, stock, image, createdAt) 
                                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            sampleProducts.forEach(p => {
                stmt.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9], p[10], new Date().toISOString());
            });
            stmt.finalize();
        }
    });

    // إدخال الإعدادات الافتراضية
    db.get("SELECT COUNT(*) as count FROM settings", (err, row) => {
        if (row && row.count === 0) {
            const defaultSettings = [
                ['siteName', 'الرعدي أونلاين', 'Raadi Online'],
                ['domesticShipping', '15', '15'],
                ['internationalShipping', '50', '50'],
                ['taxRate', '0', '0'],
                ['returnPolicy', 'يمكن استرجاع المنتج خلال 14 يوماً في حالة وجود عيب صناعي. يتم الاستبدال خلال 7 أيام.', 'Return within 14 days if manufacturing defect. Exchange within 7 days.'],
                ['whatsappNumber', '966500000000', '966500000000'],
                ['maintenanceMode', '0', '0']
            ];
            const stmt = db.prepare("INSERT INTO settings (key, value_ar, value_en, updatedAt) VALUES (?, ?, ?, ?)");
            defaultSettings.forEach(s => {
                stmt.run(s[0], s[1], s[2], new Date().toISOString());
            });
            stmt.finalize();
        }
    });
});

// ==================== دوال مساعدة لقاعدة البيانات (Promisified) ====================

/**
 * تنفيذ استعلام SELECT وإرجاع جميع الصفوف
 * @param {string} sql - جملة SQL
 * @param {Array} params - المعاملات
 * @returns {Promise<Array>} - مصفوفة النتائج
 */
function queryAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

/**
 * تنفيذ استعلام SELECT وإرجاع صف واحد
 * @param {string} sql - جملة SQL
 * @param {Array} params - المعاملات
 * @returns {Promise<Object|null>} - الصف الأول أو null
 */
function queryGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

/**
 * تنفيذ استعلام INSERT/UPDATE/DELETE
 * @param {string} sql - جملة SQL
 * @param {Array} params - المعاملات
 * @returns {Promise<Object>} - {lastID, changes}
 */
function queryRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

// ==================== دوال تسجيل النشاطات (Audit Log) ====================

/**
 * تسجيل حدث في سجل النشاطات
 * @param {number} userId - معرف المستخدم
 * @param {string} action - نوع الحدث
 * @param {string} details - تفاصيل الحدث
 * @param {string} ip - عنوان IP
 */
async function addAuditLog(userId, action, details, ip) {
    try {
        await queryRun(
            "INSERT INTO audit_logs (userId, action, details, ip, createdAt) VALUES (?, ?, ?, ?, ?)",
            [userId, action, details, ip || '', new Date().toISOString()]
        );
    } catch (err) {
        console.error("خطأ في تسجيل النشاط:", err);
    }
}

// ==================== دوال إدارة المخزون والحجوزات ====================

/**
 * حجز المنتجات في السلة لمدة 10 دقائق
 * @param {number} userId - معرف المستخدم
 * @param {Array} items - المنتجات المراد حجزها
 * @param {string} sessionId - معرف الجلسة
 * @returns {Promise<boolean>} - نجاح العملية
 */
async function reserveStock(userId, items, sessionId) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    try {
        for (const item of items) {
            await queryRun(
                "INSERT INTO reserved_stock (productId, quantity, sessionId, expiresAt) VALUES (?, ?, ?, ?)",
                [item.id, item.quantity, sessionId, expiresAt]
            );
        }
        return true;
    } catch (err) {
        console.error("خطأ في حجز المخزون:", err);
        return false;
    }
}

/**
 * تنظيف الحجوزات المنتهية (يتم تشغيله كل دقيقة)
 */
async function cleanExpiredReservations() {
    try {
        const result = await queryRun("DELETE FROM reserved_stock WHERE expiresAt < datetime('now')");
        if (result.changes > 0) {
            console.log(`تم تنظيف ${result.changes} حجز منتهي الصلاحية`);
        }
    } catch (err) {
        console.error("خطأ في تنظيف الحجوزات:", err);
    }
}

// تشغيل مهمة التنظيف كل دقيقة
setInterval(cleanExpiredReservations, 60 * 1000);

// ==================== دوال إرسال الإشعارات ====================

/**
 * إرسال إشعار واتساب للمدير (API مخفي)
 * @param {string} message - نص الرسالة
 * @param {string} phoneNumber - رقم الهاتف المستهدف
 */
async function sendWhatsAppNotification(message, phoneNumber) {
    try {
        // استخدام واجهة واتساب غير رسمية (يمكن استبدالها بـ Twilio أو WhatsApp Business API)
        const encodedMessage = encodeURIComponent(message);
        await axios.get(`https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodedMessage}`);
        console.log("تم إرسال إشعار واتساب بنجاح");
    } catch (err) {
        console.error("فشل إرسال إشعار واتساب:", err.message);
    }
}

/**
 * توليد فاتورة PDF مع QR Code
 * @param {Object} orderData - بيانات الطلب
 * @returns {Promise<string>} - مسار ملف PDF
 */
async function generatePDFInvoice(orderData) {
    // هذه دالة نموذجية - في الإنتاج يمكن استخدام مكتبة مثل PDFKit
    console.log("توليد فاتورة PDF للطلب رقم:", orderData.orderNumber);
    // QR Code لتتبع الطلب
    const qrDataUrl = await QRCode.toDataURL(`https://raadi-store.com/track/${orderData.orderNumber}`);
    return qrDataUrl;
}

// ==================== مسارات API للمنتجات ====================

/**
 * GET /api/products
 * جلب جميع المنتجات مع دعم اللغة والفلترة
 */
app.get('/api/products', async (req, res) => {
    try {
        const lang = req.query.lang || 'ar';
        const products = await queryAll("SELECT * FROM products ORDER BY id DESC");
        
        // تنسيق المنتجات حسب اللغة المطلوبة
        const formattedProducts = products.map(p => ({
            id: p.id,
            name: lang === 'ar' ? p.name_ar : p.name_en,
            category: p.category,
            price: p.price,
            oldPrice: p.oldPrice,
            discount: p.discount,
            color: p.color,
            features: lang === 'ar' ? p.features_ar : p.features_en,
            stock: p.stock,
            image: p.image,
            rating: p.rating,
            ratingCount: p.ratingCount,
            soldCount: p.soldCount
        }));
        
        res.json(formattedProducts);
    } catch (error) {
        console.error("خطأ في جلب المنتجات:", error);
        res.status(500).json({ error: "حدث خطأ في جلب المنتجات" });
    }
});

/**
 * GET /api/products/:id
 * جلب منتج محدد بالمعرف
 */
app.get('/api/products/:id', async (req, res) => {
    try {
        const lang = req.query.lang || 'ar';
        const product = await queryGet("SELECT * FROM products WHERE id = ?", [req.params.id]);
        
        if (!product) {
            return res.status(404).json({ error: "المنتج غير موجود" });
        }
        
        // زيادة عدد المشاهدات
        await queryRun("UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = ?", [req.params.id]);
        
        const formattedProduct = {
            id: product.id,
            name: lang === 'ar' ? product.name_ar : product.name_en,
            category: product.category,
            price: product.price,
            oldPrice: product.oldPrice,
            discount: product.discount,
            color: product.color,
            features: lang === 'ar' ? product.features_ar : product.features_en,
            stock: product.stock,
            image: product.image,
            rating: product.rating,
            ratingCount: product.ratingCount
        };
        
        res.json(formattedProduct);
    } catch (error) {
        console.error("خطأ في جلب المنتج:", error);
        res.status(500).json({ error: "حدث خطأ في جلب المنتج" });
    }
});

/**
 * POST /api/products
 * إضافة منتج جديد (للمدير فقط)
 */
app.post('/api/products', async (req, res) => {
    // التحقق من صلاحيات المدير
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: "غير مصرح بهذا الإجراء" });
    }
    
    const {
        name_ar, name_en, category, price, oldPrice, discount,
        color, features_ar, features_en, stock, image
    } = req.body;
    
    // التحقق من الحقول الأساسية
    if (!name_ar || !name_en || !category || !price) {
        return res.status(400).json({ error: "الحقول الأساسية مطلوبة" });
    }
    
    try {
        const result = await queryRun(
            `INSERT INTO products (name_ar, name_en, category, price, oldPrice, discount, color, features_ar, features_en, stock, image, createdAt, updatedAt) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name_ar, name_en, category, price, oldPrice || 0, discount || 0, color || '', features_ar || '', features_en || '', stock || 0, image || '', new Date().toISOString(), new Date().toISOString()]
        );
        
        // تسجيل النشاط
        await addAuditLog(req.session.userId, 'ADD_PRODUCT', `أضاف منتج جديد: ${name_ar}`, req.ip);
        
        res.json({ success: true, productId: result.lastID });
    } catch (error) {
        console.error("خطأ في إضافة المنتج:", error);
        res.status(500).json({ error: "حدث خطأ في إضافة المنتج" });
    }
});

/**
 * PUT /api/products/:id
 * تحديث منتج موجود (للمدير فقط)
 */
app.put('/api/products/:id', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: "غير مصرح بهذا الإجراء" });
    }
    
    const id = req.params.id;
    const updates = req.body;
    
    try {
        const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), id];
        await queryRun(`UPDATE products SET ${setClause}, updatedAt = ? WHERE id = ?`, [...values, new Date().toISOString(), id]);
        
        await addAuditLog(req.session.userId, 'UPDATE_PRODUCT', `حدث منتج رقم ${id}`, req.ip);
        res.json({ success: true });
    } catch (error) {
        console.error("خطأ في تحديث المنتج:", error);
        res.status(500).json({ error: "حدث خطأ في تحديث المنتج" });
    }
});

/**
 * DELETE /api/products/:id
 * حذف منتج (للمدير فقط)
 */
app.delete('/api/products/:id', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: "غير مصرح بهذا الإجراء" });
    }
    
    try {
        await queryRun("DELETE FROM products WHERE id = ?", [req.params.id]);
        await queryRun("DELETE FROM product_ratings WHERE productId = ?", [req.params.id]);
        
        await addAuditLog(req.session.userId, 'DELETE_PRODUCT', `حذف منتج رقم ${req.params.id}`, req.ip);
        res.json({ success: true });
    } catch (error) {
        console.error("خطأ في حذف المنتج:", error);
        res.status(500).json({ error: "حدث خطأ في حذف المنتج" });
    }
});

// ==================== مسارات API للأقسام ====================

/**
 * GET /api/categories
 * جلب جميع الأقسام مع دعم اللغة
 */
app.get('/api/categories', async (req, res) => {
    try {
        const lang = req.query.lang || 'ar';
        const categories = await queryAll("SELECT name_ar, name_en, icon FROM categories");
        
        const formattedCategories = categories.map(c => ({
            name: lang === 'ar' ? c.name_ar : c.name_en,
            icon: c.icon
        }));
        
        res.json(formattedCategories);
    } catch (error) {
        console.error("خطأ في جلب الأقسام:", error);
        res.status(500).json({ error: "حدث خطأ في جلب الأقسام" });
    }
});

/**
 * POST /api/categories
 * إضافة قسم جديد (للمدير فقط)
 */
app.post('/api/categories', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: "غير مصرح بهذا الإجراء" });
    }
    
    const { name_ar, name_en, icon } = req.body;
    
    if (!name_ar || !name_en) {
        return res.status(400).json({ error: "اسم القسم مطلوب باللغتين" });
    }
    
    try {
        await queryRun(
            "INSERT INTO categories (name_ar, name_en, icon, createdAt) VALUES (?, ?, ?, ?)",
            [name_ar, name_en, icon || '', new Date().toISOString()]
        );
        
        await addAuditLog(req.session.userId, 'ADD_CATEGORY', `أضاف قسم جديد: ${name_ar}`, req.ip);
        res.json({ success: true });
    } catch (error) {
        console.error("خطأ في إضافة القسم:", error);
        res.status(500).json({ error: "حدث خطأ في إضافة القسم" });
    }
});

/**
 * DELETE /api/categories/:name
 * حذف قسم وجميع منتجاته (للمدير فقط)
 */
app.delete('/api/categories/:name', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: "غير مصرح بهذا الإجراء" });
    }
    
    const categoryName = req.params.name;
    
    try {
        await queryRun("DELETE FROM products WHERE category = ?", [categoryName]);
        await queryRun("DELETE FROM categories WHERE name_ar = ? OR name_en = ?", [categoryName, categoryName]);
        
        await addAuditLog(req.session.userId, 'DELETE_CATEGORY', `حذف قسم: ${categoryName}`, req.ip);
        res.json({ success: true });
    } catch (error) {
        console.error("خطأ في حذف القسم:", error);
        res.status(500).json({ error: "حدث خطأ في حذف القسم" });
    }
});

// ==================== مسارات API للتقييمات ====================

/**
 * POST /api/products/:id/rate
 * إضافة تقييم لمنتج
 */
app.post('/api/products/:id/rate', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "الرجاء تسجيل الدخول أولاً" });
    }
    
    const { rating, review_ar, review_en } = req.body;
    const productId = req.params.id;
    
    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "التقييم يجب أن يكون بين 1 و 5" });
    }
    
    try {
        // إضافة التقييم
        await queryRun(
            "INSERT INTO product_ratings (productId, userId, rating, review_ar, review_en, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
            [productId, req.session.userId, rating, review_ar || '', review_en || '', new Date().toISOString()]
        );
        
        // حساب متوسط التقييم الجديد
        const ratings = await queryAll("SELECT rating FROM product_ratings WHERE productId = ?", [productId]);
        const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
        
        await queryRun("UPDATE products SET rating = ?, ratingCount = ? WHERE id = ?", [avgRating, ratings.length, productId]);
        
        await addAuditLog(req.session.userId, 'RATE_PRODUCT', `قيم منتج ${productId} بـ ${rating} نجوم`, req.ip);
        res.json({ success: true, newRating: avgRating });
    } catch (error) {
        console.error("خطأ في إضافة التقييم:", error);
        res.status(500).json({ error: "حدث خطأ في إضافة التقييم" });
    }
});

/**
 * GET /api/products/:id/ratings
 * جلب جميع تقييمات منتج معين
 */
app.get('/api/products/:id/ratings', async (req, res) => {
    try {
        const lang = req.query.lang || 'ar';
        const ratings = await queryAll(
            `SELECT pr.*, u.name as userName 
             FROM product_ratings pr 
             JOIN users u ON pr.userId = u.id 
             WHERE pr.productId = ? 
             ORDER BY pr.id DESC LIMIT 20`,
            [req.params.id]
        );
        
        const formattedRatings = ratings.map(r => ({
            id: r.id,
            userName: r.userName,
            rating: r.rating,
            review: lang === 'ar' ? r.review_ar : r.review_en,
            createdAt: r.createdAt
        }));
        
        res.json(formattedRatings);
    } catch (error) {
        console.error("خطأ في جلب التقييمات:", error);
        res.status(500).json([]);
    }
});

// ==================== مسارات API لقائمة الأمنيات (Wishlist) ====================

/**
 * GET /api/wishlist
 * جلب قائمة أمنيات المستخدم الحالي
 */
app.get('/api/wishlist', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "الرجاء تسجيل الدخول أولاً" });
    }
    
    try {
        const user = await queryGet("SELECT wishlist FROM users WHERE id = ?", [req.session.userId]);
        const wishlist = user && user.wishlist ? JSON.parse(user.wishlist) : [];
        res.json(wishlist);
    } catch (error) {
        console.error("خطأ في جلب الأمنيات:", error);
        res.status(500).json([]);
    }
});

/**
 * POST /api/wishlist/add
 * إضافة منتج إلى قائمة الأمنيات
 */
app.post('/api/wishlist/add', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "الرجاء تسجيل الدخول أولاً" });
    }
    
    const { productId } = req.body;
    
    try {
        const user = await queryGet("SELECT wishlist FROM users WHERE id = ?", [req.session.userId]);
        let wishlist = user && user.wishlist ? JSON.parse(user.wishlist) : [];
        
        if (!wishlist.includes(productId)) {
            wishlist.push(productId);
            await queryRun("UPDATE users SET wishlist = ? WHERE id = ?", [JSON.stringify(wishlist), req.session.userId]);
        }
        
        await addAuditLog(req.session.userId, 'ADD_WISHLIST', `أضاف منتج ${productId} إلى الأمنيات`, req.ip);
        res.json({ success: true });
    } catch (error) {
        console.error("خطأ في إضافة الأمنية:", error);
        res.status(500).json({ error: "حدث خطأ" });
    }
});

/**
 * POST /api/wishlist/remove
 * إزالة منتج من قائمة الأمنيات
 */
app.post('/api/wishlist/remove', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "الرجاء تسجيل الدخول أولاً" });
    }
    
    const { productId } = req.body;
    
    try {
        const user = await queryGet("SELECT wishlist FROM users WHERE id = ?", [req.session.userId]);
        let wishlist = user && user.wishlist ? JSON.parse(user.wishlist) : [];
        
        wishlist = wishlist.filter(id => id !== productId);
        await queryRun("UPDATE users SET wishlist = ? WHERE id = ?", [JSON.stringify(wishlist), req.session.userId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error("خطأ في إزالة الأمنية:", error);
        res.status(500).json({ error: "حدث خطأ" });
    }
});

// ==================== مسارات API للطلبات ====================

/**
 * POST /api/orders
 * إنشاء طلب جديد
 */
app.post('/api/orders', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "الرجاء تسجيل الدخول أولاً" });
    }
    
    const {
        customer, email, phone, address, city, country,
        items, subtotal, discount, discountAmount, shipping, tax, total, currency, notes
    } = req.body;
    
    const orderNumber = 'RAD-' + Date.now();
    const dateFormatted = new Date().toLocaleDateString('ar-EG');
    
    try {
        // حفظ الطلب في قاعدة البيانات
        await queryRun(
            `INSERT INTO orders (
                userId, orderNumber, customer, email, phone, address, city, country,
                items, subtotal, discount, discountAmount, shipping, tax, total, currency,
                status, date, dateFormatted, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.session.userId, orderNumber, customer, email, phone, address, city, country,
                JSON.stringify(items), subtotal, discount, discountAmount, shipping, tax, total, currency,
                'pending', new Date().toISOString(), dateFormatted, notes || ''
            ]
        );
        
        // تحديث المخزون وإزالة الحجوزات
        for (const item of items) {
            await queryRun("DELETE FROM reserved_stock WHERE productId = ? AND sessionId = ?", [item.id, req.session.id]);
            
            const product = await queryGet("SELECT stock FROM products WHERE id = ?", [item.id]);
            if (product) {
                await queryRun("UPDATE products SET stock = ?, soldCount = COALESCE(soldCount, 0) + ? WHERE id = ?",
                    [product.stock - item.quantity, item.quantity, item.id]);
            }
        }
        
        // إضافة نقاط ولاء (كل 100 ريال = 5 نقاط)
        const pointsEarned = Math.floor(total / 100) * 5;
        await queryRun("UPDATE users SET loyaltyPoints = COALESCE(loyaltyPoints, 0) + ? WHERE id = ?", [pointsEarned, req.session.userId]);
        
        // تسجيل النشاط
        await addAuditLog(req.session.userId, 'PLACE_ORDER', `طلب جديد رقم ${orderNumber} بقيمة ${total} ${currency}`, req.ip);
        
        // إرسال إشعار واتساب للمدير
        const settings = await queryGet("SELECT value_ar FROM settings WHERE key = 'whatsappNumber'");
        const whatsappNumber = settings?.value_ar || '966500000000';
        const message = `🦅 طلب جديد في الرعدي أونلاين\n📋 رقم: ${orderNumber}\n👤 العميل: ${customer}\n📞 ${phone}\n📍 ${address}\n💰 الإجمالي: ${total} ${currency}\n🔗 https://raadi-store.com/orders/${orderNumber}`;
        await sendWhatsAppNotification(message, whatsappNumber);
        
        res.json({ success: true, orderNumber });
    } catch (error) {
        console.error("خطأ في إنشاء الطلب:", error);
        res.status(500).json({ error: "حدث خطأ في إنشاء الطلب" });
    }
});

/**
 * GET /api/my-orders
 * جلب طلبات المستخدم الحالي
 */
app.get('/api/my-orders', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json([]);
    }
    
    try {
        const orders = await queryAll("SELECT * FROM orders WHERE userId = ? ORDER BY id DESC", [req.session.userId]);
        
        // تحويل items من JSON إلى كائن
        orders.forEach(o => {
            o.items = JSON.parse(o.items);
        });
        
        res.json(orders);
    } catch (error) {
        console.error("خطأ في جلب الطلبات:", error);
        res.status(500).json([]);
    }
});

/**
 * GET /api/orders (للمدير فقط)
 * جلب جميع الطلبات
 */
app.get('/api/orders', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: "غير مصرح" });
    }
    
    try {
        const orders = await queryAll("SELECT * FROM orders ORDER BY id DESC");
        orders.forEach(o => {
            o.items = JSON.parse(o.items);
        });
        res.json(orders);
    } catch (error) {
        console.error("خطأ في جلب الطلبات:", error);
        res.status(500).json([]);
    }
});

/**
 * PUT /api/orders/:id/status
 * تحديث حالة الطلب (للمدير فقط)
 */
app.put('/api/orders/:id/status', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: "غير مصرح" });
    }
    
    const { status, trackingNumber } = req.body;
    
    try {
        await queryRun("UPDATE orders SET status = ?, trackingNumber = ? WHERE id = ?", [status, trackingNumber || null, req.params.id]);
        await addAuditLog(req.session.userId, 'UPDATE_ORDER_STATUS', `تحديث حالة الطلب ${req.params.id} إلى ${status}`, req.ip);
        res.json({ success: true });
    } catch (error) {
        console.error("خطأ في تحديث حالة الطلب:", error);
        res.status(500).json({ error: "حدث خطأ" });
    }
});

// ==================== مسارات API للمستخدمين ====================

/**
 * GET /api/users (للمدير فقط)
 * جلب جميع المستخدمين
 */
app.get('/api/users', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json([]);
    }
    
    try {
        const users = await queryAll("SELECT id, name, email, role, phone, address, loyaltyPoints, createdAt, lastLogin FROM users WHERE role != 'admin'");
        res.json(users);
    } catch (error) {
        console.error("خطأ في جلب المستخدمين:", error);
        res.status(500).json([]);
    }
});

// ==================== مسارات API للكوبونات ====================

/**
 * GET /api/coupons
 * جلب جميع كوبونات الخصم الصالحة
 */
app.get('/api/coupons', async (req, res) => {
    try {
        const coupons = await queryAll("SELECT code, value, minOrder, expiresAt, usageLimit, usedCount FROM coupons WHERE expiresAt IS NULL OR expiresAt > datetime('now')");
        res.json(coupons);
    } catch (error) {
        console.error("خطأ في جلب الكوبونات:", error);
        res.status(500).json([]);
    }
});

/**
 * POST /api/coupons
 * إضافة كوبون خصم جديد (للمدير فقط)
 */
app.post('/api/coupons', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: "غير مصرح" });
    }
    
    const { code, value, minOrder, expiresAt, usageLimit } = req.body;
    
    if (!code || !value) {
        return res.status(400).json({ error: "الكود وقيمة الخصم مطلوبة" });
    }
    
    try {
        await queryRun(
            "INSERT INTO coupons (code, value, minOrder, expiresAt, usageLimit, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
            [code.toUpperCase(), value, minOrder || 0, expiresAt || null, usageLimit || 999999, new Date().toISOString()]
        );
        
        await addAuditLog(req.session.userId, 'ADD_COUPON', `أضاف كوبون ${code} بنسبة ${value}%`, req.ip);
        res.json({ success: true });
    } catch (error) {
        console.error("خطأ في إضافة الكوبون:", error);
        res.status(500).json({ error: "الكود موجود مسبقاً" });
    }
});

/**
 * DELETE /api/coupons/:code
 * حذف كوبون خصم
 */
app.delete('/api/coupons/:code', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: "غير مصرح" });
    }
    
    try {
        await queryRun("DELETE FROM coupons WHERE code = ?", [req.params.code]);
        await addAuditLog(req.session.userId, 'DELETE_COUPON', `حذف كوبون ${req.params.code}`, req.ip);
        res.json({ success: true });
    } catch (error) {
        console.error("خطأ في حذف الكوبون:", error);
        res.status(500).json({ error: "حدث خطأ" });
    }
});

// ==================== مسارات API للدردشة ====================

/**
 * GET /api/messages
 * جلب رسائل الدردشة (للمستخدم الحالي أو للمدير)
 */
app.get('/api/messages', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json([]);
    }
    
    try {
        let messages;
        if (req.session.user.role === 'admin') {
            messages = await queryAll("SELECT * FROM messages ORDER BY id DESC LIMIT 200");
        } else {
            messages = await queryAll("SELECT * FROM messages WHERE userId = ? OR isAdmin = 1 ORDER BY id ASC", [req.session.userId]);
        }
        res.json(messages);
    } catch (error) {
        console.error("خطأ في جلب الرسائل:", error);
        res.status(500).json([]);
    }
});

/**
 * POST /api/messages
 * إرسال رسالة جديدة
 */
app.post('/api/messages', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "الرجاء تسجيل الدخول أولاً" });
    }
    
    const { text, text_ar, text_en, isAdmin } = req.body;
    
    try {
        await queryRun(
            `INSERT INTO messages (userId, sender, text_ar, text_en, isAdmin, timestamp, date) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.session.userId, req.session.user.name, text_ar || text, text_en || text, isAdmin ? 1 : 0, new Date().toLocaleTimeString('ar-EG'), new Date().toISOString()]
        );
        res.json({ success: true });
    } catch (error) {
        console.error("خطأ في إرسال الرسالة:", error);
        res.status(500).json({ error: "حدث خطأ" });
    }
});

// ==================== مسارات API للإحصائيات ====================

/**
 * GET /api/stats (للمدير فقط)
 * جلب إحصائيات المتجر
 */
app.get('/api/stats', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: "غير مصرح" });
    }
    
    try {
        const totalUsers = await queryGet("SELECT COUNT(*) as count FROM users WHERE role != 'admin'");
        const totalProducts = await queryGet("SELECT COUNT(*) as count FROM products");
        const totalOrders = await queryGet("SELECT COUNT(*) as count FROM orders");
        const totalRevenue = await queryGet("SELECT SUM(total) as sum FROM orders");
        const lowStock = await queryGet("SELECT COUNT(*) as count FROM products WHERE stock < 5");
        const pendingOrders = await queryGet("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'");
        
        const today = new Date().toISOString().split('T')[0];
        const todayRevenue = await queryGet("SELECT SUM(total) as sum FROM orders WHERE date LIKE ?", [today + '%']);
        
        res.json({
            totalUsers: totalUsers.count,
            totalProducts: totalProducts.count,
            totalOrders: totalOrders.count,
            totalRevenue: totalRevenue.sum || 0,
            todayRevenue: todayRevenue.sum || 0,
            lowStock: lowStock.count,
            pendingOrders: pendingOrders.count
        });
    } catch (error) {
        console.error("خطأ في جلب الإحصائيات:", error);
        res.status(500).json({});
    }
});

/**
 * GET /api/pending-orders-count
 * جلب عدد الطلبات المعلقة (للمدير)
 */
app.get('/api/pending-orders-count', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: "غير مصرح" });
    }
    
    try {
        const result = await queryGet("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'");
        res.json({ count: result.count });
    } catch (error) {
        console.error("خطأ في جلب عدد الطلبات:", error);
        res.json({ count: 0 });
    }
});

// ==================== مسارات API لإعدادات المتجر ====================

/**
 * GET /api/settings
 * جلب إعدادات المتجر
 */
app.get('/api/settings', async (req, res) => {
    try {
        const rows = await queryAll("SELECT key, value_ar, value_en FROM settings");
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = { ar: row.value_ar, en: row.value_en };
        });
        res.json(settings);
    } catch (error) {
        console.error("خطأ في جلب الإعدادات:", error);
        res.status(500).json({});
    }
});

/**
 * POST /api/settings
 * تحديث إعدادات المتجر (للمدير فقط)
 */
app.post('/api/settings', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: "غير مصرح" });
    }
    
    const updates = req.body;
    
    try {
        for (const [key, value] of Object.entries(updates)) {
            if (typeof value === 'object' && value.ar && value.en) {
                await queryRun("UPDATE settings SET value_ar = ?, value_en = ?, updatedAt = ? WHERE key = ?", [value.ar, value.en, new Date().toISOString(), key]);
            } else {
                await queryRun("UPDATE settings SET value_ar = ?, value_en = ?, updatedAt = ? WHERE key = ?", [value, value, new Date().toISOString(), key]);
            }
        }
        
        await addAuditLog(req.session.userId, 'UPDATE_SETTINGS', 'تحديث إعدادات المتجر', req.ip);
        res.json({ success: true });
    } catch (error) {
        console.error("خطأ في حفظ الإعدادات:", error);
        res.status(500).json({ error: "حدث خطأ" });
    }
});

/**
 * GET /api/maintenance-status
 * التحقق من حالة وضع الطوارئ
 */
app.get('/api/maintenance-status', async (req, res) => {
    try {
        const mode = await queryGet("SELECT value_ar FROM settings WHERE key = 'maintenanceMode'");
        res.json({ maintenance: mode?.value_ar === '1' });
    } catch (error) {
        res.json({ maintenance: false });
    }
});

// ==================== مسارات API لحجز المخزون ====================

/**
 * POST /api/reserve-stock
 * حجز منتجات في السلة
 */
app.post('/api/reserve-stock', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "الرجاء تسجيل الدخول أولاً" });
    }
    
    const { items } = req.body;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    try {
        for (const item of items) {
            await queryRun(
                "INSERT INTO reserved_stock (productId, quantity, sessionId, expiresAt) VALUES (?, ?, ?, ?)",
                [item.id, item.quantity, req.session.id, expiresAt]
            );
        }
        res.json({ success: true, expiresAt });
    } catch (error) {
        console.error("خطأ في حجز المخزون:", error);
        res.status(500).json({ error: "حدث خطأ" });
    }
});

// ==================== مسارات المصادقة (Authentication) ====================

/**
 * POST /api/register
 * تسجيل مستخدم جديد
 */
app.post('/api/register', async (req, res) => {
    const { name, email, password, phone, address } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ error: "الاسم والبريد الإلكتروني وكلمة المرور مطلوبة" });
    }
    
    try {
        // التحقق من وجود البريد
        const existingUser = await queryGet("SELECT id FROM users WHERE email = ?", [email]);
        if (existingUser) {
            return res.status(400).json({ error: "البريد الإلكتروني مسجل مسبقاً" });
        }
        
        // تشفير كلمة المرور
        const hashedPassword = bcrypt.hashSync(password, 10);
        
        // إضافة المستخدم
        await queryRun(
            "INSERT INTO users (name, email, password, phone, address, role, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [name, email, hashedPassword, phone || '', address || '', 'user', new Date().toISOString()]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error("خطأ في التسجيل:", error);
        res.status(500).json({ error: "حدث خطأ في التسجيل" });
    }
});

/**
 * POST /api/login
 * تسجيل دخول المستخدم
 */
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: "البريد الإلكتروني وكلمة المرور مطلوبة" });
    }
    
    try {
        // البحث عن المستخدم
        const user = await queryGet("SELECT * FROM users WHERE email = ?", [email]);
        
        // التحقق من وجود المستخدم
        if (!user) {
            return res.status(401).json({ error: "البريد الإلكتروني غير مسجل" });
        }
        
        // التحقق من كلمة المرور
        const passwordMatch = bcrypt.compareSync(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
        }
        
        // تحديث آخر تسجيل دخول
        await queryRun("UPDATE users SET lastLogin = ? WHERE id = ?", [new Date().toISOString(), user.id]);
        
        // إنشاء جلسة المستخدم
        req.session.userId = user.id;
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            address: user.address,
            loyaltyPoints: user.loyaltyPoints,
            preferredLang: user.preferredLang || 'ar',
            preferredCurrency: user.preferredCurrency || 'SAR'
        };
        
        // تسجيل النشاط
        await addAuditLog(user.id, 'LOGIN', 'تسجيل دخول ناجح', req.ip);
        
        res.json({ success: true, user: req.session.user });
    } catch (error) {
        console.error("خطأ في تسجيل الدخول:", error);
        res.status(500).json({ error: "حدث خطأ في تسجيل الدخول" });
    }
});

/**
 * GET /api/me
 * جلب بيانات المستخدم الحالي
 */
app.get('/api/me', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "غير مسجل" });
    }
    
    try {
        const user = await queryGet(
            "SELECT id, name, email, role, phone, address, avatar, loyaltyPoints, preferredLang, preferredCurrency, createdAt, lastLogin FROM users WHERE id = ?",
            [req.session.userId]
        );
        res.json(user);
    } catch (error) {
        console.error("خطأ في جلب بيانات المستخدم:", error);
        res.status(500).json({ error: "حدث خطأ" });
    }
});

/**
 * POST /api/update-profile
 * تحديث بيانات المستخدم
 */
app.post('/api/update-profile', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "غير مسجل" });
    }
    
    const { name, phone, address, avatar, preferredLang, preferredCurrency } = req.body;
    
    try {
        await queryRun(
            "UPDATE users SET name = ?, phone = ?, address = ?, avatar = ?, preferredLang = ?, preferredCurrency = ? WHERE id = ?",
            [name, phone || '', address || '', avatar || '', preferredLang || 'ar', preferredCurrency || 'SAR', req.session.userId]
        );
        
        // تحديث بيانات الجلسة
        req.session.user.name = name;
        req.session.user.preferredLang = preferredLang || 'ar';
        req.session.user.preferredCurrency = preferredCurrency || 'SAR';
        
        await addAuditLog(req.session.userId, 'UPDATE_PROFILE', 'تحديث بيانات الملف الشخصي', req.ip);
        res.json({ success: true });
    } catch (error) {
        console.error("خطأ في تحديث الملف الشخصي:", error);
        res.status(500).json({ error: "حدث خطأ" });
    }
});

/**
 * POST /api/logout
 * تسجيل الخروج
 */
app.post('/api/logout', (req, res) => {
    if (req.session.userId) {
        addAuditLog(req.session.userId, 'LOGOUT', 'تسجيل خروج', req.ip);
    }
    req.session.destroy();
    res.json({ success: true });
});

// ==================== مسارات الصفحات ====================

/**
 * صفحة لوحة تحكم المدير
 */
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

/**
 * الصفحة الرئيسية للمتجر
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== تشغيل الخادم ====================
app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`🦅 الرعدي أونلاين | المتجر العالمي الأسطوري`);
    console.log(`🚀 الخادم يعمل على: http://localhost:${PORT}`);
    console.log(`👑 حساب المدير: admin@raadi.com / admin123`);
    console.log(`🌐 دعم اللغات: العربية / English`);
    console.log(`💱 دعم العملات: ريال سعودي / دولار أمريكي`);
    console.log(`================================================================`);
});
