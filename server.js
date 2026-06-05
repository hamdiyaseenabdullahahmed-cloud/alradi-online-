const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// إعدادات middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ============================================================
// دوال مساعدة للتعامل مع ملفات البيانات
// ============================================================
const dataPath = (file) => path.join(__dirname, file);

function readData(file, defaultValue = []) {
    try {
        if (fs.existsSync(dataPath(file))) {
            return JSON.parse(fs.readFileSync(dataPath(file), 'utf8'));
        }
        return defaultValue;
    } catch (error) {
        console.error(`خطأ في قراءة ملف ${file}:`, error);
        return defaultValue;
    }
}

function writeData(file, data) {
    try {
        fs.writeFileSync(dataPath(file), JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`خطأ في حفظ ملف ${file}:`, error);
        return false;
    }
}

// ============================================================
// تحميل البيانات الافتراضية أو إنشاؤها
// ============================================================

// المنتجات
let products = readData('products.json', []);
if (products.length === 0) {
    products = [
        { id: 1, name: "هاتف الرعدي الذكي برو X", category: "هواتف", price: 2999, oldPrice: 3499, discount: 15, color: "أسود تيتانيوم", features: "كاميرا 200 ميجابكسل، شاشة 6.8 بوصة", stock: 10, image: "https://picsum.photos/id/0/300/300" },
        { id: 2, name: "سامسونج جالكسي S24 الترا", category: "هواتف", price: 4940, oldPrice: 5200, discount: 12, color: "رمادي تيتانيوم", features: "كاميرا 200 ميجابكسل، قلم S-Pen، سعة 512 جيجا", stock: 7, image: "https://picsum.photos/id/1/300/300" },
        { id: 3, name: "سماعة أبل إيربودز برو", category: "إكسسوارات", price: 899, oldPrice: 1099, discount: 18, color: "أبيض ناصع", features: "تقنية عزل الضوضاء، صوت محيطي", stock: 15, image: "https://picsum.photos/id/3/300/300" },
        { id: 4, name: "عطر بلو دي شانيل الأصلي", category: "عطور", price: 4140, oldPrice: 4600, discount: 10, color: "شفاف كحلي غامق", features: "رائحة خشبية فاخرة، تدوم طويلاً", stock: 5, image: "https://picsum.photos/id/2/300/300" },
        { id: 5, name: "ساعة أبل الترا 2", category: "إكسسوارات", price: 2799, oldPrice: 3299, discount: 15, color: "تيتانيوم", features: "مقاومة للماء، بطارية تدوم 36 ساعة", stock: 8, image: "https://picsum.photos/id/4/300/300" },
        { id: 6, name: "عطر توم فورد أود وود", category: "عطور", price: 550, oldPrice: 650, discount: 15, color: "بني داكن", features: "رائحة خشبية دافئة", stock: 12, image: "https://picsum.photos/id/5/300/300" }
    ];
    writeData('products.json', products);
}

// المستخدمين
let users = readData('users.json', []);
if (users.length === 0) {
    users = [
        { id: 1, name: "المدير", email: "admin@raadi.com", password: "admin123", role: "admin", phone: "", address: "" }
    ];
    writeData('users.json', users);
}

// الطلبات
let orders = readData('orders.json', []);

// رسائل الدردشة (لكل مستخدم على حدة)
let messages = readData('messages.json', []);

// إعدادات المتجر (مثل رسوم الشحن)
let settings = readData('settings.json', { domesticShipping: 15, internationalShipping: 50, returnPolicy: "يمكن استرجاع المنتج خلال 14 يوماً في حالة وجود عيب صناعي." });
if (!settings.domesticShipping) {
    settings.domesticShipping = 15;
    settings.internationalShipping = 50;
    writeData('settings.json', settings);
}

// ============================================================
// مسارات API (للواجهة الأمامية)
// ============================================================

// جلب المنتجات
app.get('/api/products', (req, res) => res.json(products));

// جلب الأقسام
app.get('/api/categories', (req, res) => {
    const categories = [...new Set(products.map(p => p.category))];
    res.json(categories);
});

// جلب إعدادات المتجر
app.get('/api/settings', (req, res) => res.json(settings));

// تسجيل الدخول
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } else {
        res.status(401).json({ success: false, error: 'بيانات الدخول غير صحيحة' });
    }
});

// تسجيل مستخدم جديد
app.post('/api/register', (req, res) => {
    const { name, email, password, phone, address } = req.body;
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ success: false, error: 'البريد الإلكتروني مسجل بالفعل' });
    }
    const newUser = { id: Date.now(), name, email, password, phone, address, role: "user" };
    users.push(newUser);
    writeData('users.json', users);
    res.json({ success: true, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } });
});

// جلب جميع المستخدمين (للمدير)
app.get('/api/users', (req, res) => {
    res.json(users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, address: u.address })));
});

// إضافة منتج جديد (للمدير)
app.post('/api/products', (req, res) => {
    const newProduct = { id: Date.now(), ...req.body };
    products.push(newProduct);
    writeData('products.json', products);
    res.json({ success: true, product: newProduct });
});

// حذف منتج (للمدير)
app.delete('/api/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    products = products.filter(p => p.id !== id);
    writeData('products.json', products);
    res.json({ success: true });
});

// تحديث منتج (للمدير)
app.put('/api/products/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
        products[index] = { ...products[index], ...req.body };
        writeData('products.json', products);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'المنتج غير موجود' });
    }
});

// إنشاء طلب جديد
app.post('/api/orders', (req, res) => {
    const order = { id: Date.now(), ...req.body, date: new Date().toISOString(), dateFormatted: new Date().toLocaleDateString('ar-EG') };
    orders.push(order);
    writeData('orders.json', orders);

    // تقليل المخزون
    order.items.forEach(item => {
        const product = products.find(p => p.id == item.id);
        if (product) {
            product.stock -= item.quantity;
        }
    });
    writeData('products.json', products);

    res.json({ success: true, order: order });
});

// جلب جميع الطلبات (للمدير)
app.get('/api/orders', (req, res) => res.json(orders));

// تحديث حالة الطلب (للمدير)
app.put('/api/orders/:id/status', (req, res) => {
    const id = parseInt(req.params.id);
    const order = orders.find(o => o.id === id);
    if (order) {
        order.status = req.body.status;
        writeData('orders.json', orders);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'الطلب غير موجود' });
    }
});

// جلب الرسائل
app.get('/api/messages', (req, res) => res.json(messages));

// إرسال رسالة جديدة
app.post('/api/messages', (req, res) => {
    const { sender, text, userId, isAdmin } = req.body;
    const newMessage = { id: Date.now(), sender, text, userId, isAdmin: isAdmin || false, timestamp: new Date().toLocaleTimeString('ar-EG'), date: new Date().toISOString() };
    messages.push(newMessage);
    writeData('messages.json', messages);
    res.json({ success: true });
});

// جلب رسائل مستخدم معين
app.get('/api/messages/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const userMessages = messages.filter(m => m.userId === userId || (m.isAdmin && m.userId === userId));
    res.json(userMessages);
});

// تحديث إعدادات المتجر
app.post('/api/settings', (req, res) => {
    settings = { ...settings, ...req.body };
    writeData('settings.json', settings);
    res.json({ success: true });
});

// الإحصائيات للمدير
app.get('/api/stats', (req, res) => {
    const totalUsers = users.filter(u => u.role !== 'admin').length;
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const today = new Date().toDateString();
    const todayRevenue = orders.filter(o => new Date(o.date).toDateString() === today).reduce((sum, o) => sum + o.total, 0);
    res.json({ totalUsers, totalOrders, totalRevenue, todayRevenue, totalProducts: products.length, lowStock: products.filter(p => p.stock < 5).length });
});

// ============================================================
// مسارات الصفحات
// ============================================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ============================================================
// تشغيل الخادم
// ============================================================
app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`🚀 متجر الرعدي الأسطوري يعمل الآن!`);
    console.log(`📍 الرابط: http://localhost:${PORT}`);
    console.log(`👑 حساب المدير: admin@raadi.com / admin123`);
    console.log(`========================================`);
});
