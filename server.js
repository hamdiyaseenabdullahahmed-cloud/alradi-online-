const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use(express.static(__dirname));

// إعداد قاعدة البيانات
const DB_DIR = path.join(__dirname, 'database');
const DB_PATH = path.join(DB_DIR, 'raadi.db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH);

// ============================================
// إنشاء الجداول
// ============================================
db.serialize(() => {
    // 1. جدول المستخدمين
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        role TEXT DEFAULT 'client',
        loyalty_points INTEGER DEFAULT 0,
        tier TEXT DEFAULT 'bronze',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2. جدول المنتجات
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        old_price REAL,
        stock INTEGER DEFAULT 0,
        category_id INTEGER,
        category_name TEXT,
        image TEXT,
        colors TEXT,
        sizes TEXT,
        description TEXT,
        rating REAL DEFAULT 5,
        sold_count INTEGER DEFAULT 0,
        isActive INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 3. جدول الطلبات
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE,
        user_id INTEGER,
        user_name TEXT,
        user_email TEXT,
        user_phone TEXT,
        address TEXT,
        products TEXT,
        total REAL,
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'unpaid',
        date DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 4. جدول سلة التسوق
    db.run(`CREATE TABLE IF NOT EXISTS cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_id INTEGER,
        product_name TEXT,
        product_image TEXT,
        price REAL,
        quantity INTEGER DEFAULT 1,
        color TEXT,
        size TEXT,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 5. جدول سلة المحذوفات
    db.run(`CREATE TABLE IF NOT EXISTS trash (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_type TEXT,
        item_id INTEGER,
        item_data TEXT,
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 6. جدول الإعدادات
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('✅ تم إنشاء جميع الجداول');

    // ============================================
    // إضافة حساب المدير الوحيد (بدون أي حسابات عملاء افتراضية)
    // ============================================
    const adminEmail = 'admin@system.com';
    const adminPassword = 'admin123';
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);

    db.get(`SELECT * FROM users WHERE email = ?`, [adminEmail], (err, existing) => {
        if (err) {
            console.error('خطأ في التحقق من المدير:', err);
            return;
        }
        if (!existing) {
            db.run(`INSERT INTO users (name, email, password, phone, role, loyalty_points, tier) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ['مدير النظام', adminEmail, hashedPassword, '0500000000', 'admin', 0, 'gold'],
                function(err2) {
                    if (err2) console.error('خطأ في إضافة المدير:', err2);
                    else console.log('✅ تم إضافة حساب المدير الافتراضي (admin@system.com / admin123)');
                }
            );
        } else {
            console.log('✅ حساب المدير موجود مسبقاً');
        }
    });

    // ============================================
    // إضافة منتجات افتراضية (للتجربة)
    // ============================================
    db.get(`SELECT * FROM products LIMIT 1`, (err, row) => {
        if (!row) {
            const products = [
                ['iPhone 15 Pro', 3999, 4599, 10, 1, 'إلكترونيات', 'https://picsum.photos/id/1/300/300', '["أسود","أبيض"]', '["128GB","256GB"]', 'أحدث هاتف من Apple', 4.9],
                ['ساعة ذكية', 499, 699, 20, 1, 'إلكترونيات', 'https://picsum.photos/id/2/300/300', '["أسود","فضي"]', '["S","M","L"]', 'ساعة ذكية متعددة الوظائف', 4.7],
                ['سماعات لاسلكية', 299, 450, 50, 1, 'إلكترونيات', 'https://picsum.photos/id/3/300/300', '["أسود","أبيض"]', '["M","L"]', 'سماعات عالية الجودة', 4.8],
                ['حقيبة جلدية', 799, 1299, 15, 2, 'أزياء', 'https://picsum.photos/id/20/300/300', '["بني","أسود"]', '["One Size"]', 'حقيبة جلدية فاخرة', 4.9],
                ['قلم ذكي', 149, 249, 100, 3, 'مكتبة', 'https://picsum.photos/id/4/300/300', '["فضي","ذهبي"]', '["One Size"]', 'قلم ذكي للكتابة', 4.6]
            ];
            products.forEach(p => {
                db.run(`INSERT INTO products (name, price, old_price, stock, category_id, category_name, image, colors, sizes, description, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, p);
            });
            console.log('✅ تم إضافة منتجات افتراضية للتجربة');
        }
    });

    // ============================================
    // إعدادات المتجر الافتراضية
    // ============================================
    db.get(`SELECT * FROM settings WHERE key = 'site_name'`, (err, row) => {
        if (!row) {
            const settings = [
                ['site_name', 'الرعدي أونلاين'],
                ['primary_color', '#b87333'],
                ['whatsapp_number', '966500000000'],
                ['shipping_cost', '20'],
                ['free_shipping_min', '200']
            ];
            settings.forEach(s => {
                db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, s);
            });
            console.log('✅ تم إضافة إعدادات المتجر');
        }
    });
});

// ============================================
// API التسجيل (لإنشاء حساب عميل فقط، لا يمكن إنشاء حساب مدير)
// ============================================
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, phone, address } = req.body;
        if (!name || !email || !password) {
            return res.json({ success: false, error: 'جميع الحقول المطلوبة غير مكتملة' });
        }

        // منع تسجيل حساب بالبريد الخاص بالمدير
        if (email === 'admin@system.com') {
            return res.json({ success: false, error: 'لا يمكن استخدام هذا البريد للتسجيل' });
        }

        db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, existing) => {
            if (err) return res.json({ success: false, error: err.message });
            if (existing) return res.json({ success: false, error: 'البريد الإلكتروني مسجل مسبقاً' });

            const hashedPassword = await bcrypt.hash(password, 10);
            const role = 'client'; // دائماً عميل، لا يمكن تسجيل مدير من الخارج

            db.run(`INSERT INTO users (name, email, password, phone, address, role, loyalty_points, tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [name, email, hashedPassword, phone || '', address || '', role, 0, 'bronze'],
                function(err2) {
                    if (err2) return res.json({ success: false, error: err2.message });
                    res.json({ success: true, message: 'تم إنشاء الحساب بنجاح، يمكنك تسجيل الدخول الآن' });
                });
        });
    } catch (err) {
        console.error(err);
        res.json({ success: false, error: 'خطأ في الخادم' });
    }
});

// ============================================
// API تسجيل الدخول (يدخل مدير أو عميل)
// ============================================
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
            if (err) return res.json({ success: false, error: err.message });
            if (!user) return res.json({ success: false, error: 'البريد الإلكتروني غير موجود' });

            const match = await bcrypt.compare(password, user.password);
            if (!match) return res.json({ success: false, error: 'كلمة المرور غير صحيحة' });

            res.json({
                success: true,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    loyalty_points: user.loyalty_points,
                    tier: user.tier
                }
            });
        });
    } catch (err) {
        console.error(err);
        res.json({ success: false, error: 'خطأ في الخادم' });
    }
});

// ============================================
// باقي الـ APIs (المنتجات، الطلبات، السلة، إلخ)
// ============================================

// جلب المنتجات
app.get('/api/products', (req, res) => {
    db.all(`SELECT * FROM products WHERE isActive = 1 ORDER BY id DESC`, (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows });
    });
});

// جلب منتج واحد
app.get('/api/products/:id', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM products WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: row });
    });
});

// إضافة إلى السلة
app.post('/api/cart', (req, res) => {
    const { user_id, product_id, product_name, product_image, price, quantity, color, size } = req.body;
    
    db.get(`SELECT * FROM cart WHERE user_id = ? AND product_id = ?`, [user_id, product_id], (err, existing) => {
        if (err) return res.json({ success: false, error: err.message });
        
        if (existing) {
            db.run(`UPDATE cart SET quantity = quantity + ? WHERE id = ?`, [quantity || 1, existing.id], function(err2) {
                if (err2) return res.json({ success: false, error: err2.message });
                res.json({ success: true, action: 'updated' });
            });
        } else {
            db.run(`INSERT INTO cart (user_id, product_id, product_name, product_image, price, quantity, color, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [user_id, product_id, product_name, product_image, price, quantity || 1, color || '', size || ''],
                function(err2) {
                    if (err2) return res.json({ success: false, error: err2.message });
                    res.json({ success: true, action: 'added' });
                });
        }
    });
});

// جلب سلة المستخدم
app.get('/api/cart/:userId', (req, res) => {
    const { userId } = req.params;
    db.all(`SELECT * FROM cart WHERE user_id = ?`, [userId], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        let subtotal = 0;
        rows.forEach(item => { subtotal += item.price * item.quantity; });
        res.json({ success: true, data: rows, subtotal });
    });
});

// تحديث كمية منتج في السلة
app.put('/api/cart/:id', (req, res) => {
    const { id } = req.params;
    const { quantity } = req.body;
    db.run(`UPDATE cart SET quantity = ? WHERE id = ?`, [quantity, id], function(err) {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// حذف منتج من السلة
app.delete('/api/cart/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM cart WHERE id = ?`, [id], function(err) {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// تفريغ السلة بالكامل
app.delete('/api/cart/clear/:userId', (req, res) => {
    const { userId } = req.params;
    db.run(`DELETE FROM cart WHERE user_id = ?`, [userId], function(err) {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// إنشاء طلب جديد
app.post('/api/orders', (req, res) => {
    const { user_id, user_name, user_email, user_phone, address, products, total } = req.body;
    const orderNumber = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    
    db.run(`INSERT INTO orders (order_number, user_id, user_name, user_email, user_phone, address, products, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderNumber, user_id, user_name, user_email, user_phone, address, JSON.stringify(products), total],
        function(err) {
            if (err) return res.json({ success: false, error: err.message });
            
            // إضافة نقاط ولاء
            const points = Math.floor(total / 10);
            db.run(`UPDATE users SET loyalty_points = loyalty_points + ? WHERE id = ?`, [points, user_id]);
            
            // تحديث مستوى العميل
            db.get(`SELECT loyalty_points FROM users WHERE id = ?`, [user_id], (err2, user) => {
                let tier = 'bronze';
                if (user.loyalty_points >= 1000) tier = 'gold';
                else if (user.loyalty_points >= 500) tier = 'silver';
                db.run(`UPDATE users SET tier = ? WHERE id = ?`, [tier, user_id]);
            });
            
            // تفريغ السلة
            db.run(`DELETE FROM cart WHERE user_id = ?`, [user_id]);
            
            res.json({ success: true, orderId: this.lastID, orderNumber });
        });
});

// جلب طلبات المستخدم
app.get('/api/orders/user/:userId', (req, res) => {
    const { userId } = req.params;
    db.all(`SELECT * FROM orders WHERE user_id = ? ORDER BY date DESC`, [userId], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows });
    });
});

// جلب جميع الطلبات (للمدير فقط)
app.get('/api/orders', (req, res) => {
    db.all(`SELECT * FROM orders ORDER BY date DESC`, (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows });
    });
});

// تحديث حالة الطلب (للمدير)
app.put('/api/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, payment_status, tracking_number } = req.body;
    db.run(`UPDATE orders SET status = ?, payment_status = ?, tracking_number = ? WHERE id = ?`,
        [status, payment_status, tracking_number, id], function(err) {
            if (err) return res.json({ success: false, error: err.message });
            res.json({ success: true });
        });
});

// إحصائيات المدير
app.get('/api/stats', (req, res) => {
    const stats = {};
    db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'client'`, (err, row) => { stats.clients = row?.count || 0; });
    db.get(`SELECT COUNT(*) as count FROM products`, (err, row) => { stats.products = row?.count || 0; });
    db.get(`SELECT COUNT(*) as count FROM orders`, (err, row) => { stats.orders = row?.count || 0; });
    db.get(`SELECT SUM(total) as total FROM orders WHERE status != 'cancelled'`, (err, row) => { stats.revenue = row?.total || 0; });
    db.get(`SELECT COUNT(*) as count FROM orders WHERE status = 'pending'`, (err, row) => { stats.pendingOrders = row?.count || 0; });
    
    setTimeout(() => {
        res.json({ success: true, stats });
    }, 500);
});

// جلب جميع المستخدمين (للمدير)
app.get('/api/users', (req, res) => {
    db.all(`SELECT id, name, email, phone, role, loyalty_points, tier, created_at FROM users ORDER BY id`, (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: rows });
    });
});

// جلب الإعدادات
app.get('/api/settings', (req, res) => {
    db.all(`SELECT * FROM settings`, (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        const settings = {};
        rows.forEach(row => { settings[row.key] = row.value; });
        res.json({ success: true, data: settings });
    });
});

// تحديث الإعدادات
app.put('/api/settings/:key', (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    db.run(`UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?`, [value, key], function(err) {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// ============================================
// الصفحات الأمامية
// ============================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'client.html')));
app.get('/client.html', (req, res) => res.sendFile(path.join(__dirname, 'client.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/cart.html', (req, res) => res.sendFile(path.join(__dirname, 'cart.html')));
app.get('/product.html', (req, res) => res.sendFile(path.join(__dirname, 'product.html')));

// تشغيل السيرفر
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
});
