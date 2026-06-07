const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// إعدادات السيرفر المتقدمة
app.use(session({
    secret: 'raadi-ultimate-super-secret-key-2026-legendary',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 * 7, // أسبوع كامل
        secure: false,
        httpOnly: true
    }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== قاعدة البيانات المتطورة ====================
const db = new sqlite3.Database('./raadi.db');
db.serialize(() => {
    // جدول الأقسام
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        icon TEXT,
        createdAt TEXT
    )`);
    
    // جدول المنتجات المتطور
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        oldPrice REAL,
        discount INTEGER DEFAULT 0,
        color TEXT,
        features TEXT,
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
    
    // جدول تقييمات المنتجات
    db.run(`CREATE TABLE IF NOT EXISTS product_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER,
        userId INTEGER,
        rating INTEGER,
        review TEXT,
        createdAt TEXT
    )`);
    
    // جدول المستخدمين المتطور
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        phone TEXT,
        address TEXT,
        avatar TEXT,
        wishlist TEXT,
        createdAt TEXT,
        lastLogin TEXT
    )`);
    
    // جدول الطلبات المتكامل
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        orderNumber TEXT UNIQUE,
        customer TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        city TEXT,
        country TEXT,
        items TEXT,
        subtotal REAL,
        discount INTEGER,
        discountAmount REAL,
        shipping REAL,
        tax REAL,
        total REAL,
        paymentMethod TEXT,
        status TEXT,
        trackingNumber TEXT,
        date TEXT,
        dateFormatted TEXT,
        notes TEXT
    )`);
    
    // جدول الرسائل والدردشة
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        sender TEXT,
        text TEXT,
        isAdmin INTEGER DEFAULT 0,
        isRead INTEGER DEFAULT 0,
        timestamp TEXT,
        date TEXT
    )`);
    
    // جدول كوبونات الخصم
    db.run(`CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        value INTEGER,
        minOrder REAL,
        expiresAt TEXT,
        usageLimit INTEGER,
        usedCount INTEGER DEFAULT 0,
        createdAt TEXT
    )`);
    
    // جدول إعدادات المتجر
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updatedAt TEXT
    )`);
    
    // جدول الإشعارات
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        title TEXT,
        message TEXT,
        isRead INTEGER DEFAULT 0,
        createdAt TEXT
    )`);

    // ==================== البيانات الأولية الأسطورية ====================
    
    // إدخال الأقسام الافتراضية
    db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
        if (row && row.count === 0) {
            const defaultCategories = [
                ['هواتف', 'fa-mobile-alt'],
                ['عطور', 'fa-leaf'],
                ['إكسسوارات', 'fa-headphones'],
                ['إلكترونيات', 'fa-microchip'],
                ['ملابس', 'fa-tshirt'],
                ['أحذية', 'fa-shoe-prints']
            ];
            defaultCategories.forEach(cat => {
                db.run("INSERT INTO categories (name, icon, createdAt) VALUES (?, ?, ?)", [cat[0], cat[1], new Date().toISOString()]);
            });
        }
    });
    
    // إدخال المنتجات الافتراضية الرائعة
    db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
        if (row && row.count === 0) {
            const sampleProducts = [
                ['هاتف الرعدي برو X', 'هواتف', 2999, 3499, 15, 'أسود تيتانيوم', 'كاميرا 200 ميجابكسل، شاشة 6.8 بوصة، معالج فائق السرعة', 10, 'https://picsum.photos/id/0/300/300', 4.8],
                ['سامسونج جالكسي S24 الترا', 'هواتف', 4940, 5200, 12, 'رمادي تيتانيوم', 'كاميرا 200 ميجابكسل، قلم S-Pen، سعة 512 جيجا، شاشة 6.8 بوصة', 7, 'https://picsum.photos/id/1/300/300', 4.9],
                ['سماعة أبل إيربودز برو', 'إكسسوارات', 899, 1099, 18, 'أبيض ناصع', 'تقنية عزل الضوضاء، صوت محيطي، مقاومة للماء', 15, 'https://picsum.photos/id/3/300/300', 4.7],
                ['عطر بلو دي شانيل', 'عطور', 4140, 4600, 10, 'كحلي غامق', 'رائحة خشبية فاخرة، تدوم طويلاً، تركيز عالي', 5, 'https://picsum.photos/id/2/300/300', 4.9],
                ['ساعة أبل الترا 2', 'إكسسوارات', 2799, 3299, 15, 'تيتانيوم', 'مقاومة للماء، بطارية تدوم 36 ساعة، نظام تحديد المواقع', 8, 'https://picsum.photos/id/4/300/300', 4.8],
                ['عطر توم فورد أود وود', 'عطور', 550, 650, 15, 'بني داكن', 'رائحة خشبية دافئة، ثبات طويل، فاخر', 12, 'https://picsum.photos/id/5/300/300', 4.6],
                ['آيفون 16 برو ماكس', 'هواتف', 5999, 6999, 14, 'ذهبي', 'شاشة 6.9 بوصة، كاميرا 48 ميجابكسل، معالج A18', 4, 'https://picsum.photos/id/6/300/300', 4.9],
                ['ماك بوك برو M3', 'إلكترونيات', 7999, 8999, 11, 'فضي', 'شاشة 14 بوصة، شريحة M3، 16 جيجا رام', 3, 'https://picsum.photos/id/7/300/300', 4.9],
                ['جاكيت شتوي فاخر', 'ملابس', 499, 699, 28, 'أسود', 'صوف 100%، دافئ، مناسب للاجواء الباردة', 20, 'https://picsum.photos/id/8/300/300', 4.7],
                ['حذاء رياضي برو', 'أحذية', 299, 399, 25, 'أبيض-أسود', 'مريح، خفيف، مناسب للجري', 15, 'https://picsum.photos/id/9/300/300', 4.8]
            ];
            const stmt = db.prepare("INSERT INTO products (name, category, price, oldPrice, discount, color, features, stock, image, rating, ratingCount, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            sampleProducts.forEach(p => stmt.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9], 5, new Date().toISOString()));
            stmt.finalize();
        }
    });
    
    // إدخال المستخدم المدير
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (row && row.count === 0) {
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            db.run("INSERT INTO users (name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?)", 
                ['المدير العام', 'admin@raadi.com', hashedPassword, 'admin', new Date().toISOString()]);
        }
    });
    
    // إدخال كوبونات الخصم المتقدمة
    db.get("SELECT COUNT(*) as count FROM coupons", (err, row) => {
        if (row && row.count === 0) {
            db.run("INSERT INTO coupons (code, value, minOrder, expiresAt, usageLimit, createdAt) VALUES (?, ?, ?, ?, ?, ?)", 
                ['WELCOME20', 20, 100, null, 1000, new Date().toISOString()]);
            db.run("INSERT INTO coupons (code, value, minOrder, expiresAt, usageLimit, createdAt) VALUES (?, ?, ?, ?, ?, ?)", 
                ['SUMMER70', 70, 500, null, 500, new Date().toISOString()]);
            db.run("INSERT INTO coupons (code, value, minOrder, expiresAt, usageLimit, createdAt) VALUES (?, ?, ?, ?, ?, ?)", 
                ['VIP10', 10, 0, null, 9999, new Date().toISOString()]);
            db.run("INSERT INTO coupons (code, value, minOrder, expiresAt, usageLimit, createdAt) VALUES (?, ?, ?, ?, ?, ?)", 
                ['FREESHIP', 15, 200, null, 1000, new Date().toISOString()]);
        }
    });
    
    // إدخال إعدادات المتجر
    db.get("SELECT COUNT(*) as count FROM settings", (err, row) => {
        if (row && row.count === 0) {
            db.run("INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)", ['siteName', 'الرعدي أونلاين', new Date().toISOString()]);
            db.run("INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)", ['domesticShipping', '15', new Date().toISOString()]);
            db.run("INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)", ['internationalShipping', '50', new Date().toISOString()]);
            db.run("INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)", ['taxRate', '0', new Date().toISOString()]);
            db.run("INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)", ['returnPolicy', 'يمكن استرجاع المنتج خلال 14 يوماً في حالة وجود عيب صناعي. يتم الاستبدال خلال 7 أيام.', new Date().toISOString()]);
            db.run("INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)", ['contactEmail', 'support@raadi.com', new Date().toISOString()]);
            db.run("INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)", ['contactPhone', '920000000', new Date().toISOString()]);
            db.run("INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)", ['deliveryTime', '2-5 أيام عمل', new Date().toISOString()]);
        }
    });
});

// ==================== دوال مساعدة لقاعدة البيانات ====================
const query = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});
const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { 
        err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes }); 
    });
});

// ==================== مسارات API ====================

// -------------------- الأقسام --------------------
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await query("SELECT name, icon FROM categories ORDER BY name");
        res.json(categories.map(c => c.name));
    } catch (error) {
        res.status(500).json([]);
    }
});

app.post('/api/categories', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    try {
        await run("INSERT INTO categories (name, createdAt) VALUES (?, ?)", [req.body.name.trim(), new Date().toISOString()]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

app.delete('/api/categories/:name', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    try {
        await run("DELETE FROM categories WHERE name = ?", [req.params.name]);
        await run("DELETE FROM products WHERE category = ?", [req.params.name]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// -------------------- المنتجات --------------------
app.get('/api/products', async (req, res) => {
    try {
        const products = await query("SELECT * FROM products ORDER BY id DESC");
        res.json(products);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.get('/api/products/top', async (req, res) => {
    try {
        const top = await query("SELECT * FROM products ORDER BY soldCount DESC LIMIT 10");
        res.json(top);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.get('/api/products/featured', async (req, res) => {
    try {
        const featured = await query("SELECT * FROM products WHERE discount >= 20 ORDER BY id DESC LIMIT 6");
        res.json(featured);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.post('/api/products', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    const { name, category, price, oldPrice, discount, color, features, stock, image } = req.body;
    try {
        await run(`INSERT INTO products (name, category, price, oldPrice, discount, color, features, stock, image, createdAt, updatedAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [name, category, price, oldPrice || 0, discount || 0, color || '', features || '', stock || 0, image || 'https://picsum.photos/id/20/300/300', new Date().toISOString(), new Date().toISOString()]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

app.put('/api/products/:id', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    const id = req.params.id;
    const updates = req.body;
    try {
        const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), id];
        await run(`UPDATE products SET ${setClause}, updatedAt = ? WHERE id = ?`, [...values, new Date().toISOString(), id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    try {
        await run("DELETE FROM products WHERE id = ?", [req.params.id]);
        await run("DELETE FROM product_ratings WHERE productId = ?", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// -------------------- تقييمات المنتجات --------------------
app.post('/api/products/:id/rate', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'سجل دخولك أولاً' });
    }
    const { rating, review } = req.body;
    const productId = req.params.id;
    try {
        await run("INSERT INTO product_ratings (productId, userId, rating, review, createdAt) VALUES (?, ?, ?, ?, ?)", 
            [productId, req.session.userId, rating, review || '', new Date().toISOString()]);
        
        const ratings = await query("SELECT rating FROM product_ratings WHERE productId = ?", [productId]);
        const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
        await run("UPDATE products SET rating = ?, ratingCount = ? WHERE id = ?", [avgRating, ratings.length, productId]);
        res.json({ success: true, newRating: avgRating });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

app.get('/api/products/:id/ratings', async (req, res) => {
    try {
        const ratings = await query(`SELECT pr.*, u.name as userName FROM product_ratings pr 
            JOIN users u ON pr.userId = u.id WHERE pr.productId = ? ORDER BY pr.id DESC LIMIT 20`, [req.params.id]);
        res.json(ratings);
    } catch (error) {
        res.status(500).json([]);
    }
});

// -------------------- إعدادات المتجر --------------------
app.get('/api/settings', async (req, res) => {
    try {
        const rows = await query("SELECT key, value FROM settings");
        const settings = {};
        rows.forEach(row => { settings[row.key] = row.value; });
        res.json(settings);
    } catch (error) {
        res.status(500).json({});
    }
});

app.post('/api/settings', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    try {
        for (const [key, value] of Object.entries(req.body)) {
            await run("UPDATE settings SET value = ?, updatedAt = ? WHERE key = ?", [value.toString(), new Date().toISOString(), key]);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// -------------------- المصادقة --------------------
app.post('/api/register', async (req, res) => {
    const { name, email, password, phone, address } = req.body;
    try {
        const existing = await get("SELECT id FROM users WHERE email = ?", [email]);
        if (existing) {
            return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
        }
        const hashedPassword = bcrypt.hashSync(password, 10);
        await run("INSERT INTO users (name, email, password, phone, address, role, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)", 
            [name, email, hashedPassword, phone || '', address || '', 'user', new Date().toISOString()]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ في التسجيل' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await get("SELECT * FROM users WHERE email = ?", [email]);
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
        }
        await run("UPDATE users SET lastLogin = ? WHERE id = ?", [new Date().toISOString(), user.id]);
        req.session.userId = user.id;
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            address: user.address
        };
        res.json({ success: true, user: req.session.user });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ في تسجيل الدخول' });
    }
});

app.get('/api/me', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'غير مسجل' });
    }
    try {
        const user = await get("SELECT id, name, email, role, phone, address, createdAt, lastLogin FROM users WHERE id = ?", [req.session.userId]);
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// -------------------- الطلبات --------------------
app.post('/api/orders', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'سجل دخولك أولاً' });
    }
    const { customer, email, phone, address, country, items, subtotal, discount, discountAmount, shipping, total } = req.body;
    try {
        const orderNumber = 'RAD-' + Date.now();
        const result = await run(`INSERT INTO orders (userId, orderNumber, customer, email, phone, address, country, items, subtotal, discount, discountAmount, shipping, total, status, date, dateFormatted) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [req.session.userId, orderNumber, customer, email, phone, address, country, JSON.stringify(items), subtotal, discount, discountAmount, shipping, total, 'قيد المعالجة', new Date().toISOString(), new Date().toLocaleDateString('ar-EG')]);
        
        // تحديث المخزون وزيادة عدد المبيعات
        for (const item of items) {
            const product = await get("SELECT stock, soldCount FROM products WHERE id = ?", [item.id]);
            if (product) {
                await run("UPDATE products SET stock = ?, soldCount = ?, updatedAt = ? WHERE id = ?", 
                    [Math.max(0, product.stock - item.quantity), (product.soldCount || 0) + item.quantity, new Date().toISOString(), item.id]);
            }
        }
        res.json({ success: true, orderId: result.lastID });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ في إنشاء الطلب' });
    }
});

app.get('/api/my-orders', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json([]);
    }
    try {
        const orders = await query("SELECT * FROM orders WHERE userId = ? ORDER BY id DESC", [req.session.userId]);
        orders.forEach(o => { o.items = JSON.parse(o.items); });
        res.json(orders);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.get('/api/orders', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json([]);
    }
    try {
        const orders = await query("SELECT * FROM orders ORDER BY id DESC");
        orders.forEach(o => { o.items = JSON.parse(o.items); });
        res.json(orders);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.put('/api/orders/:id/status', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    const { status, trackingNumber } = req.body;
    try {
        await run("UPDATE orders SET status = ?, trackingNumber = ? WHERE id = ?", [status, trackingNumber || null, req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// -------------------- المستخدمين (للمدير) --------------------
app.get('/api/users', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json([]);
    }
    try {
        const users = await query("SELECT id, name, email, role, phone, address, createdAt, lastLogin FROM users WHERE role != 'admin' ORDER BY id DESC");
        res.json(users);
    } catch (error) {
        res.status(500).json([]);
    }
});

// -------------------- كوبونات الخصم --------------------
app.get('/api/coupons', async (req, res) => {
    try {
        const coupons = await query("SELECT code, value, minOrder, expiresAt, usageLimit, usedCount FROM coupons WHERE expiresAt IS NULL OR expiresAt > datetime('now')");
        res.json(coupons);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.post('/api/coupons', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    const { code, value, minOrder, expiresAt, usageLimit } = req.body;
    try {
        await run("INSERT INTO coupons (code, value, minOrder, expiresAt, usageLimit, createdAt) VALUES (?, ?, ?, ?, ?, ?)", 
            [code.toUpperCase(), value, minOrder || 0, expiresAt || null, usageLimit || 999999, new Date().toISOString()]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'الكود موجود مسبقاً' });
    }
});

app.delete('/api/coupons/:code', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    try {
        await run("DELETE FROM coupons WHERE code = ?", [req.params.code]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// -------------------- الدردشة والرسائل --------------------
app.get('/api/messages', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json([]);
    }
    try {
        let messages;
        if (req.session.user.role === 'admin') {
            messages = await query("SELECT * FROM messages ORDER BY id DESC LIMIT 200");
        } else {
            messages = await query("SELECT * FROM messages WHERE userId = ? OR isAdmin = 1 ORDER BY id ASC", [req.session.userId]);
        }
        res.json(messages);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.post('/api/messages', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'سجل دخولك أولاً' });
    }
    const { text, isAdmin } = req.body;
    try {
        await run(`INSERT INTO messages (userId, sender, text, isAdmin, isRead, timestamp, date) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`, 
            [req.session.userId, req.session.user.name, text, isAdmin ? 1 : 0, 0, new Date().toLocaleTimeString('ar-EG'), new Date().toISOString()]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

app.put('/api/messages/read', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403);
    }
    try {
        await run("UPDATE messages SET isRead = 1 WHERE isRead = 0");
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// -------------------- الإحصائيات المتقدمة --------------------
app.get('/api/stats', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    try {
        const totalUsers = await get("SELECT COUNT(*) as count FROM users WHERE role != 'admin'");
        const totalProducts = await get("SELECT COUNT(*) as count FROM products");
        const totalOrders = await get("SELECT COUNT(*) as count FROM orders");
        const totalRevenue = await get("SELECT SUM(total) as sum FROM orders");
        const lowStock = await get("SELECT COUNT(*) as count FROM products WHERE stock < 5");
        const todayISO = new Date().toISOString().split('T')[0];
        const todayRevenue = await get("SELECT SUM(total) as sum FROM orders WHERE date LIKE ?", [todayISO + '%']);
        const pendingOrders = await get("SELECT COUNT(*) as count FROM orders WHERE status = 'قيد المعالجة'");
        const totalViews = await get("SELECT SUM(views) as sum FROM products");
        
        res.json({
            totalUsers: totalUsers.count,
            totalProducts: totalProducts.count,
            totalOrders: totalOrders.count,
            totalRevenue: totalRevenue.sum || 0,
            todayRevenue: todayRevenue.sum || 0,
            lowStock: lowStock.count,
            pendingOrders: pendingOrders.count,
            totalViews: totalViews.sum || 0
        });
    } catch (error) {
        res.status(500).json({});
    }
});

app.get('/api/stats/sales', async (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.status(403);
    }
    try {
        const sales = await query("SELECT dateFormatted, SUM(total) as total, COUNT(*) as count FROM orders GROUP BY dateFormatted ORDER BY id DESC LIMIT 30");
        res.json(sales);
    } catch (error) {
        res.status(500).json([]);
    }
});

// -------------------- تحديث عدد المشاهدات --------------------
app.post('/api/products/:id/view', async (req, res) => {
    try {
        await run("UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// -------------------- صفحات المتجر --------------------
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== تشغيل الخادم ====================
app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`🚀 متجر الرعدي الأسطوري يعمل بنجاح!`);
    console.log(`📍 الرابط: http://localhost:${PORT}`);
    console.log(`👑 المدير: admin@raadi.com / admin123`);
    console.log(`💾 قاعدة البيانات: SQLite متكاملة`);
    console.log(`========================================`);
});
