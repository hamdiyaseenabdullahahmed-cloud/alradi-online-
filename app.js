// =============================================
// متجر الرعدي أون لاين - Al-Radi Online
// الملف الرئيسي للسيرفر | الإصدار النهائي مع حل الجلسات
// =============================================

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
// [✅ التعديل السحري] استيراد مكتبة حفظ الجلسات في قاعدة البيانات
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
// [✅ مهم جداً] تفعيل الثقة بالخادم الوكيل (Render)
app.set('trust proxy', 1); 

// =============================================
// 1. درع الحماية
// =============================================
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(mongoSanitize());
app.use(xss());
app.use(compression());

// =============================================
// 2. الاتصال بقاعدة البيانات
// =============================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alradi_online';

mongoose.connect(MONGODB_URI).then(async () => {
    console.log('✅ MongoDB متصل بنجاح');
    try {
        const User = require('./models/User');
        const StoreSettings = require('./models/StoreSettings');
        
        // إعدادات المتجر الافتراضية
        if (!await StoreSettings.findOne()) {
            await new StoreSettings({
                storeName: 'متجر الرعدي أون لاين',
                shippingInternal: 25,
                shippingInternational: 75,
                freeShippingMin: 300
            }).save();
            console.log('⚙️ تم إنشاء إعدادات المتجر');
        }

        // [✅ مهم] إنشاء حساب المدير تلقائياً (البريد: alradi@gmil.com / كلمة السر: admin123)
        const adminEmail = process.env.ADMIN_EMAIL || 'alradi@gmil.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        if (!await User.findOne({ email: adminEmail })) {
            await new User({
                name: 'مدير النظام',
                username: 'AlRadiAdmin',
                email: adminEmail,
                password: adminPassword,
                role: 'admin',
                isActive: true
            }).save();
            console.log('👑 تم إنشاء حساب المدير. البريد: ' + adminEmail);
        }
    } catch (err) { console.error('خطأ في التهيئة:', err.message); }
}).catch(err => console.error('❌ فشل اتصال MongoDB:', err.message));

// =============================================
// 3. إعدادات المحرك والملفات
// =============================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'alradi-cookie-secret'));

// =============================================
// 4. [✅ التعديل الأهم] إعدادات جلسات المستخدم (حفظ في MongoDB)
// =============================================
app.use(session({
    secret: process.env.SESSION_SECRET || 'alradi-thunder-secret',
    resave: false,          // تم التعديل
    saveUninitialized: false, // تم التعديل
    // [✅ الكود السحري] هنا نقول للخادم يحفظ الجلسات في قاعدة البيانات بدل الذاكرة
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        ttl: 30 * 24 * 60 * 60 // صلاحية الجلسة 30 يوماً
    }),
    cookie: {
        secure: false, // يبقى false لأن Render يستخدم HTTP داخلياً
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

app.use(flash());

// =============================================
// 5. متغيرات القوالب العامة
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
// 6. تشغيل المسارات
// =============================================
app.use('/', require('./routes/index'));
app.use('/products', require('./routes/products'));
app.use('/cart', require('./routes/cart'));
app.use('/auth', require('./routes/auth'));
app.use('/account', require('./routes/account'));
app.use('/admin', require('./routes/admin'));
app.use('/chat', require('./routes/chat'));
app.use('/api', require('./routes/api'));

// =============================================
// 7. معالجة الأخطاء
// =============================================
app.use((req, res) => res.status(404).render('404', { pageTitle: 'الصفحة غير موجودة' }));
app.use((err, req, res, next) => {
    console.error('❌ خطأ:', err.message);
    res.status(500).render('error', { pageTitle: 'خطأ', error: { message: 'حدث خطأ غير متوقع' } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🦅 متجر الرعدي يعمل على المنفذ ${PORT}`));
module.exports = app;
