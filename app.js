// =============================================
// متجر الرعدي أون لاين - Al-Radi Online
// السيرفر الرئيسي - إصدار Premium Masterpiece
// =============================================

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const path = require('path');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1); // ثقة بروكسي Render

// =============================================
// 1. إعدادات الحماية المتقدمة (Security Layer)
// =============================================
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(mongoSanitize());
app.use(xss());
app.use(compression());

// =============================================
// 2. ربط قاعدة البيانات وخلق البيانات الأولية
// =============================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alradi_online';

mongoose.connect(MONGODB_URI).then(async () => {
    console.log('✅ MongoDB متصل');
    try {
        const User = require('./models/User');
        const StoreSettings = require('./models/StoreSettings');
        if (!await StoreSettings.findOne()) {
            await new StoreSettings({ storeName: 'متجر الرعدي أون لاين', shippingInternal: 25, shippingInternational: 75, freeShippingMin: 300 }).save();
            console.log('⚙️ تم إنشاء إعدادات المتجر');
        }
        const adminEmail = process.env.ADMIN_EMAIL || 'alradi@gmil.com';
        if (!await User.findOne({ email: adminEmail })) {
            await new User({ name: 'مدير النظام', username: 'AlRadiAdmin', email: adminEmail, password: process.env.ADMIN_PASSWORD || 'admin123', role: 'admin', isActive: true }).save();
            console.log('👑 تم إنشاء حساب المدير');
        }
    } catch (err) { console.error('خطأ في التهيئة:', err.message); }
}).catch(err => console.error('❌ فشل اتصال MongoDB:', err.message));

// =============================================
// 3. إعدادات المحرك والملفات الثابتة
// =============================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ⭐ حل سحري لمشكلة الصور: دعم المسارات المحلية والخارجية
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
// دعم الصور الخارجية (Cloudinary) عبر البروكسي لمنع أخطاء CORS
app.use('/proxy-image', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) return res.status(400).send('No URL');
        const fetch = require('node-fetch');
        const response = await fetch(imageUrl);
        if (response.ok) {
            res.setHeader('Content-Type', response.headers.get('content-type'));
            response.body.pipe(res);
        } else res.status(404).send('Image not found');
    } catch (e) { res.status(500).send('Error'); }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'alradi-cookie-secret'));

// =============================================
// 4. الجلسات الخالدة (Persistent Sessions via MongoDB)
// =============================================
app.use(session({
    secret: process.env.SESSION_SECRET || 'alradi-thunder-secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        collectionName: 'sessions',
        ttl: 30 * 24 * 60 * 60 // 30 يوماً
    }),
    cookie: {
        secure: false, // false لأن Render يستخدم HTTP
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 يوماً
    }
}));

app.use(flash());

// =============================================
// 5. المتغيرات العامة لجميع القوالب
// =============================================
app.use(async (req, res, next) => {
    try {
        const StoreSettings = require('./models/StoreSettings');
        let store = await StoreSettings.findOne() || { storeName: 'متجر الرعدي أون لاين', currency: 'SAR' };
        let cartCount = 0;
        if (req.session && req.session.cart) {
            cartCount = req.session.cart.reduce((total, item) => total + (item.quantity || 0), 0);
        }
        res.locals.store = store;
        res.locals.user = req.session.user || null;
        res.locals.cartCount = cartCount;
        res.locals.currentLanguage = req.session.language || 'ar';
        res.locals.currentPath = req.path;
        res.locals.success_msg = req.flash('success_msg');
        res.locals.error_msg = req.flash('error_msg');
        next();
    } catch (error) { next(); }
});

// =============================================
// 6. المسارات الرئيسية
// =============================================
app.use('/', require('./routes/index'));
app.use('/products', require('./routes/products'));
app.use('/cart', require('./routes/cart'));
app.use('/auth', require('./routes/auth'));
app.use('/account', require('./routes/account'));
app.use('/admin', require('./routes/admin'));
app.use('/chat', require('./routes/chat'));
app.use('/api', require('./routes/api'));

// 404 والأخطاء
app.use((req, res) => res.status(404).render('404', { pageTitle: 'الصفحة غير موجودة' }));
app.use((err, req, res, next) => {
    console.error('❌ خطأ:', err.message);
    res.status(500).render('error', { pageTitle: 'خطأ', error: { message: 'حدث خطأ غير متوقع' } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🦅 متجر الرعدي يعمل على المنفذ ${PORT}`));
module.exports = app;
