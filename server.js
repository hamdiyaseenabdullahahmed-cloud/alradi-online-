const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// إعدادات الـ session (لحماية المسارات)
app.use(session({
    secret: 'raadi_super_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // يوم كامل
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ============================================================
// مسارات المساعدة للبيانات
// ============================================================
const dataPath = (file) => path.join(__dirname, file);

function readData(file, defaultValue = []) {
    try {
        if (fs.existsSync(dataPath(file))) {
            return JSON.parse(fs.readFileSync(dataPath(file), 'utf8'));
        }
        return defaultValue;
    } catch (err) { return defaultValue; }
}

function writeData(file, data) {
    try {
        fs.writeFileSync(dataPath(file), JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) { return false; }
}

// ============================================================
// تحميل/إنشاء البيانات
// ============================================================
let products = readData('products.json', []);
if (products.length === 0) {
    products = [
        { id: 1, name: "هاتف الرعدي الذكي برو X", category: "هواتف", price: 2999, oldPrice: 3499, discount: 15, color: "أسود تيتانيوم", features: "كاميرا 200 ميجابكسل، شاشة 6.8 بوصة", stock: 10, image: "https://picsum.photos/id/0/300/300" },
        { id: 2, name: "سامسونج جالكسي S24 الترا", category: "هواتف", price: 4940, oldPrice: 5200, discount: 12, color: "رمادي تيتانيوم", features: "كاميرا 200 ميجابكسل، قلم S-Pen، سعة 512 جيجا", stock: 7, image: "https://picsum.photos/id/1/300/300" },
        { id: 3, name: "سماعة أبل إيربودز برو", category: "إكسسوارات", price: 899, oldPrice: 1099, discount: 18, color: "أبيض ناصع", features: "تقنية عزل الضوضاء، صوت محيطي", stock: 15, image: "https://picsum.photos/id/3/300/300" },
        { id: 4, name: "عطر بلو دي شانيل الأصلي", category: "عطور", price: 4140, oldPrice: 4600, discount: 10, color: "شفاف كحلي غامق", features: "رائحة خشبية فاخرة، تدوم طويلاً", stock: 5, image: "https://picsum.photos/id/2/300/300" }
    ];
    writeData('products.json', products);
}

let users = readData('users.json', []);
if (users.length === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    users.push({ id: 1, name: "المدير", email: "admin@raadi.com", password: hashedPassword, role: "admin", phone: "", address: "" });
    writeData('users.json', users);
}

let orders = readData('orders.json', []);
let messages = readData('messages.json', []);
let settings = readData('settings.json', { domesticShipping: 15, internationalShipping: 50, returnPolicy: "يمكن استرجاع المنتج خلال 14 يوماً في حالة وجود عيب صناعي." });

// ============================================================
// API المسارات
// ============================================================

// المنتجات
app.get('/api/products', (req, res) => res.json(products));
app.get('/api/categories', (req, res) => res.json([...new Set(products.map(p => p.category))]));

// المصادقة
app.post('/api/register', (req, res) => {
    const { name, email, password, phone, address } = req.body;
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'البريد مسجل' });
    const hashed = bcrypt.hashSync(password, 10);
    const newUser = { id: Date.now(), name, email, password: hashed, role: 'user', phone, address };
    users.push(newUser);
    writeData('users.json', users);
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'بيانات غير صحيحة' });
    const match = bcrypt.compareSync(password, user.password);
    if (!match) return res.status(401).json({ error: 'بيانات غير صحيحة' });
    req.session.userId = user.id;
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ success: true, user: req.session.user });
});

app.get('/api/me', (req, res) => {
    if (req.session.userId) return res.json(req.session.user);
    res.status(401).json({ error: 'غير مسجل' });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// الطلبات
app.post('/api/orders', (req, res) => {
    const order = { id: Date.now(), ...req.body, date: new Date().toISOString(), dateFormatted: new Date().toLocaleDateString('ar-EG') };
    orders.push(order);
    writeData('orders.json', orders);
    // تقليل المخزون
    order.items.forEach(item => {
        const p = products.find(pr => pr.id == item.id);
        if (p) p.stock -= item.quantity;
    });
    writeData('products.json', products);
    res.json({ success: true, order });
});

app.get('/api/orders', (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') return res.status(403).json([]);
    res.json(orders);
});

// الرسائل
app.get('/api/messages', (req, res) => {
    if (!req.session.userId) return res.status(401).json([]);
    const userMessages = messages.filter(m => m.userId === req.session.userId || m.isAdmin);
    res.json(userMessages);
});

app.post('/api/messages', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'غير مسجل' });
    const { text } = req.body;
    const newMsg = { id: Date.now(), userId: req.session.userId, sender: req.session.user.name, text, isAdmin: false, timestamp: new Date().toLocaleTimeString('ar-EG') };
    messages.push(newMsg);
    writeData('messages.json', messages);
    res.json({ success: true });
});

// إدارة المنتجات (للمدير فقط)
app.post('/api/products', (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
    const newProduct = { id: Date.now(), ...req.body };
    products.push(newProduct);
    writeData('products.json', products);
    res.json({ success: true });
});

app.delete('/api/products/:id', (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') return res.status(403);
    products = products.filter(p => p.id != req.params.id);
    writeData('products.json', products);
    res.json({ success: true });
});

// إحصائيات للمدير
app.get('/api/stats', (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') return res.status(403);
    const totalUsers = users.filter(u => u.role !== 'admin').length;
    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    res.json({ totalUsers, totalProducts: products.length, totalOrders: orders.length, totalRevenue, lowStock: products.filter(p => p.stock < 5).length });
});

// إعدادات المتجر
app.get('/api/settings', (req, res) => res.json(settings));
app.post('/api/settings', (req, res) => {
    settings = { ...settings, ...req.body };
    writeData('settings.json', settings);
    res.json({ success: true });
});

// ============================================================
// حماية الصفحات
// ============================================================
app.get('/admin', (req, res) => {
    if (!req.session.userId || req.session.user.role !== 'admin') {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// تشغيل الخادم
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 متجر الرعدي يعمل على http://localhost:${PORT}`);
    console.log(`👑 المدير: admin@raadi.com | admin123`);
});
