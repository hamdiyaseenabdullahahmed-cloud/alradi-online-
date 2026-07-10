// ================================================================
// متجر الرعدي أون لاين - Al-Radi Online
// الملف الرئيسي للسيرفر - الإصدار العملاق النهائي (v5.0)
// ================================================================

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
app.set('trust proxy', 1);

// ================================================================
// 1. درع الحماية المتكامل
// ================================================================
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(mongoSanitize());
app.use(xss());
app.use(compression());

// ================================================================
// 2. الاتصال بقاعدة البيانات مع إعدادات متقدمة
// ================================================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alradi_online';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(async () => {
    console.log('✅ MongoDB متصل بنجاح');
    try {
        // استيراد النماذج المطلوبة
        const User = require('./models/User');
        const StoreSettings = require('./models/StoreSettings');
        const Product = require('./models/Product');
        const Order = require('./models/Order');
        
        // إنشاء إعدادات المتجر الافتراضية إذا لم تكن موجودة
        const settings = await StoreSettings.getSettings();
        if (!settings) {
            await new StoreSettings().save();
            console.log('⚙️ تم إنشاء إعدادات المتجر الافتراضية');
        }

        // إنشاء حساب المدير مع إعادة تعيين كلمة المرور
        const adminEmail = process.env.ADMIN_EMAIL || 'alradi@gmail.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        let adminUser = await User.findOne({ email: adminEmail });
        if (!adminUser) {
            adminUser = new User({
                name: 'مدير النظام',
                username: 'AlRadiAdmin',
                email: adminEmail,
                password: adminPassword,
                role: 'admin',
                isActive: true
            });
            await adminUser.save();
            console.log('👑 تم إنشاء حساب المدير: ' + adminEmail);
        } else {
            // إعادة تعيين كلمة المرور للتأكد من صلاحيتها
            adminUser.password = adminPassword;
            await adminUser.save();
            console.log('🔄 تم إعادة تعيين كلمة مرور المدير إلى: ' + adminPassword);
        }

        // حساب إحصائيات أولية (اختياري)
        const productCount = await Product.countDocuments();
        const orderCount = await Order.countDocuments();
        console.log(`📦 عدد المنتجات: ${productCount} | 🛒 عدد الطلبات: ${orderCount}`);

    } catch (err) {
        console.error('❌ خطأ في التهيئة:', err.message);
    }
})
.catch(err => console.error('❌ فشل اتصال MongoDB:', err.message));

// ================================================================
// 3. إعدادات المحرك والملفات الثابتة
// ================================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// دعم الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// دعم تحميل البيانات الكبيرة
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'alradi-cookie-secret'));

// ================================================================
// 4. نظام الجلسات المتقدم (حفظ في MongoDB)
// ================================================================
app.use(session({
    secret: process.env.SESSION_SECRET || 'alradi-thunder-secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        ttl: 30 * 24 * 60 * 60 // 30 يومًا
    }),
    cookie: {
        secure: false, // اضبط true إذا كنت تستخدم HTTPS
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

app.use(flash());

// ================================================================
// 5. متغيرات القوالب العامة (مع إعدادات المتجر)
// ================================================================
app.use(async (req, res, next) => {
    try {
        const StoreSettings = require('./models/StoreSettings');
        const settings = await StoreSettings.getSettings();
        
        // حساب عدد عناصر السلة
        let cartCount = 0;
        if (req.session && req.session.cart) {
            cartCount = req.session.cart.reduce((total, item) => total + (item.quantity || 0), 0);
        }
        
        // دمج الإعدادات مع المتغيرات المحلية
        res.locals.store = {
            name: settings.branding?.storeName || 'متجر الرعدي أون لاين',
            nameEn: settings.branding?.storeNameEn || 'Al-Radi Online Store',
            logo: settings.getMediaValue ? settings.getMediaValue('media.logo') : (settings.media?.logo?.url || settings.media?.logo?.local || '/images/default-logo.png'),
            currency: settings.finance?.currencySymbol || 'ر.س',
            primaryColor: settings.appearance?.primaryColor || '#1a1a2e',
            secondaryColor: settings.appearance?.secondaryColor || '#e94560',
            goldColor: settings.appearance?.goldColor || '#ffd700',
            tagline: settings.branding?.tagline || 'تسوق بثقة واستمتع بتجربة فاخرة'
        };
        res.locals.user = req.session.user || null;
        res.locals.cartCount = cartCount;
        res.locals.currentLanguage = req.session.language || 'ar';
        res.locals.currentPath = req.path;
        res.locals.success_msg = req.flash('success_msg');
        res.locals.error_msg = req.flash('error_msg');
        res.locals.info_msg = req.flash('info_msg');
        next();
    } catch (error) {
        console.error('❌ خطأ في متغيرات القوالب:', error.message);
        next();
    }
});

// ================================================================
// 6. تحميل جميع المسارات
// ================================================================
app.use('/', require('./routes/index'));
app.use('/products', require('./routes/products'));
app.use('/cart', require('./routes/cart'));
app.use('/auth', require('./routes/auth'));
app.use('/account', require('./routes/account'));
app.use('/admin', require('./routes/admin'));
app.use('/chat', require('./routes/chat'));
app.use('/api', require('./routes/api'));

// ================================================================
// 7. معالجة الأخطاء (404 و 500)
// ================================================================
app.use((req, res) => {
    res.status(404).render('404', { pageTitle: 'الصفحة غير موجودة' });
});

app.use((err, req, res, next) => {
    console.error('❌ خطأ غير متوقع:', err.message);
    // في بيئة الإنتاج، لا نعرض تفاصيل الخطأ للمستخدم
    const message = process.env.NODE_ENV === 'production' 
        ? 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.'
        : err.message;
    res.status(500).render('error', { 
        pageTitle: 'خطأ',
        error: { message }
    });
});

// ================================================================
// 8. تشغيل الخادم
// ================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🦅 متجر الرعدي يعمل على المنفذ ${PORT}`);
    console.log(`🔗 رابط المتجر: https://alradi-online-app.onrender.com`);
});

module.exports = app;
