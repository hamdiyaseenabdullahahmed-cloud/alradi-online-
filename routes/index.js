// =============================================
// متجر الرعدي أون لاين - alradi-online
// المسارات الرئيسية والصفحات العامة
// =============================================

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const StoreSettings = require('../models/StoreSettings');
const Order = require('../models/Order');
const User = require('../models/User');

// =============================================
// الصفحة الرئيسية
// =============================================

router.get('/', async (req, res) => {
    try {
        const [
            featuredProducts,
            newArrivals,
            bestSellers,
            onSaleProducts,
            featuredCategories,
            storeSettings
        ] = await Promise.all([
            Product.find({ isActive: true, isFeatured: true })
                .limit(8)
                .select('name nameEn price comparePrice images rating isOnSale stockStatus slug'),
            Product.find({ isActive: true, isNewArrival: true })
                .sort('-createdAt')
                .limit(8)
                .select('name nameEn price comparePrice images rating isOnSale stockStatus slug'),
            Product.find({ isActive: true, isBestSeller: true })
                .sort('-sales')
                .limit(8)
                .select('name nameEn price comparePrice images rating isOnSale stockStatus slug'),
            Product.find({ isActive: true, isOnSale: true })
                .limit(8)
                .select('name nameEn price comparePrice images rating isOnSale stockStatus slug'),
            Category.getFeaturedCategories(),
            StoreSettings.getSettings()
        ]);

        const currency = storeSettings.currency || 'SAR';
        const currencySymbol = storeSettings.currencySymbol || 'ر.س';

        res.render('index', {
            pageTitle: 'الرئيسية',
            featuredProducts, newArrivals, bestSellers, onSaleProducts,
            featuredCategories, storeSettings, currency, currencySymbol,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg'),
            info_msg: req.flash('info_msg')
        });
    } catch (error) {
        console.error('خطأ:', error);
        res.render('index', {
            pageTitle: 'الرئيسية',
            featuredProducts: [], newArrivals: [], bestSellers: [],
            onSaleProducts: [], featuredCategories: [],
            storeSettings: { currency: 'SAR', currencySymbol: 'ر.س' },
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg'),
            info_msg: req.flash('info_msg')
        });
    }
});

// =============================================
// صفحة البحث
// =============================================

router.get('/search', async (req, res) => {
    try {
        const query = req.query.q || '';
        const page = parseInt(req.query.page) || 1;
        const sort = req.query.sort || 'relevance';
        const limit = 12;
        if (!query.trim()) return res.redirect('/products');
        const result = await Product.search(query, { page, limit, sort: sort === 'relevance' ? null : sort });
        res.render('search', {
            pageTitle: 'نتائج البحث عن: ' + query,
            query, products: result.products, pagination: result.pagination,
            sort, totalResults: result.pagination.total,
            success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
        });
    } catch (error) {
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('/');
    }
});

// =============================================
// صفحة اتصل بنا
// =============================================

router.get('/contact', async (req, res) => {
    try {
        const storeSettings = await StoreSettings.getSettings();
        res.render('contact', {
            pageTitle: 'اتصل بنا', storeSettings,
            success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
        });
    } catch (error) {
        res.render('contact', {
            pageTitle: 'اتصل بنا', storeSettings: null,
            success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
        });
    }
});

router.post('/contact', async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;
        if (!name || !email || !subject || !message) {
            req.flash('error_msg', 'يرجى ملء جميع الحقول');
            return res.redirect('/contact');
        }
        console.log('📧 رسالة من:', name, email, '-', subject);
        req.flash('success_msg', 'تم إرسال رسالتك بنجاح');
        res.redirect('/contact');
    } catch (error) {
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('/contact');
    }
});

// =============================================
// الصفحات العامة
// =============================================

router.get('/about', async (req, res) => {
    const store = await StoreSettings.getSettings().catch(() => ({ storeName: 'متجر الرعدي أون لاين' }));
    res.render('pages', {
        page: 'about', pageTitle: 'من نحن', store: store,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.get('/privacy-policy', async (req, res) => {
    const store = await StoreSettings.getSettings().catch(() => ({ storeName: 'متجر الرعدي أون لاين' }));
    res.render('pages', {
        page: 'privacy-policy', pageTitle: 'سياسة الخصوصية', store: store,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.get('/terms', async (req, res) => {
    const store = await StoreSettings.getSettings().catch(() => ({ storeName: 'متجر الرعدي أون لاين' }));
    res.render('pages', {
        page: 'terms', pageTitle: 'الشروط والأحكام', store: store,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.get('/shipping-policy', async (req, res) => {
    const store = await StoreSettings.getSettings().catch(() => ({ storeName: 'متجر الرعدي أون لاين', shippingInternal: 25, shippingInternational: 75, freeShippingMin: 300 }));
    res.render('pages', {
        page: 'shipping-policy', pageTitle: 'سياسة الشحن', store: store,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.get('/return-policy', async (req, res) => {
    const store = await StoreSettings.getSettings().catch(() => ({ storeName: 'متجر الرعدي أون لاين' }));
    res.render('pages', {
        page: 'return-policy', pageTitle: 'سياسة الاستبدال', store: store,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

// =============================================
// تبديل اللغة والوضع الليلي والعملة
// =============================================

router.get('/switch-language/:lang', (req, res) => {
    if (['ar', 'en'].includes(req.params.lang)) {
        req.session.language = req.params.lang;
        res.cookie('language', req.params.lang, { maxAge: 365 * 24 * 60 * 60 * 1000 });
    }
    res.redirect(req.headers.referer || '/');
});

router.get('/toggle-dark-mode', (req, res) => {
    const current = req.cookies.darkMode === 'true';
    res.cookie('darkMode', !current, { maxAge: 365 * 24 * 60 * 60 * 1000 });
    res.redirect(req.headers.referer || '/');
});

router.get('/switch-currency/:currency', (req, res) => {
    if (['SAR', 'USD', 'EUR', 'AED'].includes(req.params.currency)) {
        req.session.currency = req.params.currency;
        res.cookie('currency', req.params.currency, { maxAge: 365 * 24 * 60 * 60 * 1000 });
    }
    res.redirect(req.headers.referer || '/');
});

// =============================================
// تتبع الطلب
// =============================================

router.get('/track-order', (req, res) => {
    res.render('track-order', {
        pageTitle: 'تتبع الطلب', order: null, notFound: false,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.post('/track-order', async (req, res) => {
    try {
        const { orderNumber, email } = req.body;
        if (!orderNumber) { req.flash('error_msg', 'يرجى إدخال رقم الطلب'); return res.redirect('/track-order'); }
        const order = await Order.findOne({ orderNumber, customerEmail: email || { $exists: true } });
        res.render('track-order', {
            pageTitle: 'تتبع الطلب', order, notFound: !order,
            success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
        });
    } catch (error) {
        res.redirect('/track-order');
    }
});

// =============================================
// العروض وخريطة الموقع
// =============================================

router.get('/offers', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const result = await Product.search(null, { onSale: true, page, limit: 12 });
        res.render('pages', {
            page: 'offers', pageTitle: 'العروض', products: result.products,
            pagination: result.pagination,
            success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
        });
    } catch (error) {
        res.redirect('/');
    }
});

router.get('/sitemap', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).select('name slug');
        res.render('sitemap', {
            pageTitle: 'خريطة الموقع', categories,
            success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
        });
    } catch (error) {
        res.redirect('/');
    }
});

// =============================================
// API إحصائيات
// =============================================

router.get('/api/store-stats', async (req, res) => {
    try {
        const [productsCount, categoriesCount, ordersCount, customersCount] = await Promise.all([
            Product.countDocuments({ isActive: true }),
            Category.countDocuments({ isActive: true }),
            Order.countDocuments(),
            User.countDocuments({ role: 'customer', isActive: true })
        ]);
        res.json({ success: true, stats: { productsCount, categoriesCount, ordersCount, customersCount } });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;
