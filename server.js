const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(express.static(__dirname));

// إنشاء مجلد قاعدة البيانات
const DB_DIR = path.join(__dirname, 'database');
const DB_PATH = path.join(DB_DIR, 'raadi.db');

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

console.log(`📁 مسار قاعدة البيانات: ${DB_PATH}`);

// فتح قاعدة البيانات
const db = new sqlite3.Database(DB_PATH);

// دالة إنشاء الجداول
function createTables() {
    // جدول المستخدمين
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        phone TEXT,
        role TEXT DEFAULT 'client',
        loyalty_points INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('خطأ في جدول users:', err.message);
        else console.log('✅ جدول users جاهز');
    });

    // جدول المنتجات
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        old_price REAL,
        stock INTEGER DEFAULT 0,
        category TEXT,
        image TEXT,
        colors TEXT,
        rating REAL DEFAULT 5,
        sold_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('خطأ في جدول products:', err.message);
        else console.log('✅ جدول products جاهز');
    });

    // جدول الطلبات
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT,
        product_id INTEGER,
        product_name TEXT,
        total REAL,
        status TEXT DEFAULT 'pending',
        date DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('خطأ في جدول orders:', err.message);
        else console.log('✅ جدول orders جاهز');
    });

    // بعد إنشاء الجداول، أضف البيانات الافتراضية
    setTimeout(() => {
        addDefaultData();
    }, 1000);
}

// إضافة بيانات افتراضية
function addDefaultData() {
    // إضافة مستخدم أدمن
    db.get(`SELECT * FROM users WHERE email = 'admin@system.com'`, (err, row) => {
        if (err) {
            console.error('خطأ في البحث:', err.message);
            return;
        }
        if (!row) {
            db.run(`INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)`,
                ['مدير النظام', 'admin@system.com', 'admin123', '0500000000', 'admin']);
            db.run(`INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)`,
                ['أحمد العميل', 'ahmed@client.com', '123456', '0555123456', 'client']);
            console.log('✅ تم إضافة المستخدمين الافتراضيين');
        } else {
            console.log('✅ المستخدمين موجودين مسبقاً');
        }
    });

    // إضافة منتجات افتراضية
    db.get(`SELECT * FROM products LIMIT 1`, (err, row) => {
        if (err) {
            console.error('خطأ في البحث عن المنتجات:', err.message);
            return;
        }
        if (!row) {
            const products = [
                ['سماعات لاسلكية برو', 299, 450, 50, 'electronics', 'https://picsum.photos/id/1/300/300', '["أسود","أبيض","أزرق"]', 4.8],
                ['ساعة ذكية رياضية', 499, 699, 30, 'electronics', 'https://picsum.photos/id/2/300/300', '["أسود","فضي","ذهبي"]', 4.6],
                ['حقيبة جلدية فاخرة', 799, 1299, 15, 'fashion', 'https://picsum.photos/id/3/300/300', '["بني","أسود"]', 4.9],
                ['قلم ذكي للكتابة', 149, 249, 100, 'office', 'https://picsum.photos/id/4/300/300', '["فضي","ذهبي"]', 4.5]
            ];
            
            products.forEach(p => {
                db.run(`INSERT INTO products (name, price, old_price, stock, category, image, colors, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, p);
            });
            console.log('✅ تم إضافة المنتجات الافتراضية');
        } else {
            console.log('✅ المنتجات موجودة مسبقاً');
        }
    });
}

// بدء إنشاء الجداول
db.serialize(() => {
    createTables();
});

// ==============================================
// API Routes
// ==============================================

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// لوحة المدير
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// جلب جميع المنتجات
app.get('/api/products', (req, res) => {
    db.all(`SELECT * FROM products ORDER BY id DESC`, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, data: rows });
    });
});

// جلب منتج واحد
app.get('/api/products/:id', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM products WHERE id = ?`, [id], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, data: row });
    });
});

// تسجيل الدخول
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT id, name, email, phone, role, loyalty_points FROM users WHERE email = ? AND password = ?`, 
        [email, password], (err, user) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
            if (user) {
                res.json({ success: true, user: user });
            } else {
                res.json({ success: false, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
            }
        });
});

// إنشاء طلب جديد
app.post('/api/orders', (req, res) => {
    const { userId, userName, productId, productName, total } = req.body;
    db.run(`INSERT INTO orders (user_id, user_name, product_id, product_name, total, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, userName, productId, productName, total, 'pending'],
        function(err) {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
            res.json({ success: true, orderId: this.lastID });
        });
});

// جلب طلبات المستخدم
app.get('/api/orders/:userId', (req, res) => {
    const { userId } = req.params;
    db.all(`SELECT * FROM orders WHERE user_id = ? ORDER BY date DESC`, [userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, data: rows });
    });
});

// جلب جميع الطلبات (للمدير)
app.get('/api/orders', (req, res) => {
    db.all(`SELECT * FROM orders ORDER BY date DESC`, (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, data: rows });
    });
});

// تحديث حالة الطلب
app.put('/api/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, id], function(err) {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, updated: this.changes });
    });
});

// إحصائيات سريعة
app.get('/api/stats', (req, res) => {
    const stats = {};
    
    db.get(`SELECT COUNT(*) as count FROM products`, (err, row) => {
        stats.products = row ? row.count : 0;
        
        db.get(`SELECT COUNT(*) as count FROM orders`, (err2, row2) => {
            stats.orders = row2 ? row2.count : 0;
            
            db.get(`SELECT SUM(total) as total FROM orders`, (err3, row3) => {
                stats.revenue = row3 ? (row3.total || 0) : 0;
                
                db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'client'`, (err4, row4) => {
                    stats.clients = row4 ? row4.count : 0;
                    res.json({ success: true, stats });
                });
            });
        });
    });
});

// تشغيل السيرفر
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
    console.log(`🌐 الرابط: http://localhost:${PORT}`);
});
