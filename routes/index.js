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

// =============================================
// الصفحة الرئيسية
// =============================================

router.get('/', async (req, res) => {
    try {
        // جلب البيانات للصفحة الرئيسية بالتوازي
        const [
            featuredProducts,
            newArrivals,
            bestSellers,
            onSaleProducts,
            featuredCategories,
            storeSettings
        ] = await Promise.all([
            Product.find({ isActive: true, isFeatured: true, isHidden: false })
                .limit(8)
                .select('name nameEn price comparePrice images rating isOnSale stockStatus slug'),
            
            Product.find({ isActive: true, isNewArrival: true, isHidden: false })
                .sort('-createdAt')
                .limit(8)
                .select('name nameEn price comparePrice images rating isOnSale stockStatus slug'),
            
            Product.find({ isActive: true, isBestSeller: true, isHidden: false })
                .sort('-sales')
                .limit(8)
                .select('name nameEn price comparePrice images rating isOnSale stockStatus slug'),
            
            Product.find({ isActive: true, isOnSale: true, isHidden: false })
                .limit(8)
                .select('name nameEn price comparePrice images rating isOnSale stockStatus slug'),
            
            Category.getFeaturedCategories(),
            
            StoreSettings.getSettings()
        ]);
        
        // الحصول على العملة
        const currency = storeSettings.currency || 'SAR';
        const currencySymbol = storeSettings.currencySymbol || 'ر.س';
        
        res.render('index', {
            pageTitle: 'الرئيسية',
            featuredProducts,
            newArrivals,
            bestSellers,
            onSaleProducts,
            featuredCategories,
            storeSettings,
            currency,
            currencySymbol,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg'),
            info_msg: req.flash('info_msg')
        });
        
    } catch (error) {
        console.error('خطأ في تحميل الصفحة الرئيسية:', error);
        res.render('index', {
            pageTitle: 'الرئيسية',
            featuredProducts: [],
            newArrivals: [],
            bestSellers: [],
            onSaleProducts: [],
            featuredCategories: [],
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
        
        if (!query.trim()) {
            return res.redirect('/products');
        }
        
        const result = await Product.search(query, {
            page,
            limit,
            sort: sort === 'relevance' ? null : sort
        });
        
        res.render('search', {
            pageTitle: 'نتائج البحث عن: ' + query,
            query,
            products: result.products,
            pagination: result.pagination,
            sort,
            totalResults: result.pagination.total,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
        
    } catch (error) {
        console.error('خطأ في البحث:', error);
        req.flash('error_msg', 'حدث خطأ في البحث');
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
            pageTitle: 'اتصل بنا',
            storeSettings,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في صفحة اتصل بنا:', error);
        res.render('contact', {
            pageTitle: 'اتصل بنا',
            storeSettings: null,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    }
});

// =============================================
// معالجة نموذج الاتصال
// =============================================

router.post('/contact', async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;
        
        if (!name || !email || !subject || !message) {
            req.flash('error_msg', 'يرجى ملء جميع الحقول المطلوبة');
            return res.redirect('/contact');
        }
        
        // TODO: إرسال البريد الإلكتروني للإدارة
        console.log('📧 رسالة جديدة من:', name, email);
        console.log('الموضوع:', subject);
        console.log('الرسالة:', message);
        
        req.flash('success_msg', 'تم إرسال رسالتك بنجاح. سنتواصل معك قريباً');
        res.redirect('/contact');
        
    } catch (error) {
        console.error('خطأ في إرسال رسالة الاتصال:', error);
        req.flash('error_msg', 'حدث خطأ في إرسال الرسالة');
        res.redirect('/contact');
    }
});

// =============================================
// صفحة من نحن
// =============================================

router.get('/about', async (req, res) => {
    try {
        const storeSettings = await StoreSettings.getSettings();
        
        res.render('about', {
            pageTitle: 'من نحن',
            storeSettings,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في صفحة من نحن:', error);
        res.render('about', {
            pageTitle: 'من نحن',
            storeSettings: null,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    }
});

// =============================================
// صفحة سياسة الخصوصية
// =============================================

router.get('/privacy-policy', async (req, res) => {
    try {
        const storeSettings = await StoreSettings.getSettings();
        
        res.render('privacy-policy', {
            pageTitle: 'سياسة الخصوصية',
            storeSettings,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في صفحة سياسة الخصوصية:', error);
        res.render('privacy-policy', {
            pageTitle: 'سياسة الخصوصية',
            storeSettings: null,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    }
});

// =============================================
// صفحة الشروط والأحكام
// =============================================

router.get('/terms', async (req, res) => {
    try {
        const storeSettings = await StoreSettings.getSettings();
        
        res.render('terms', {
            pageTitle: 'الشروط والأحكام',
            storeSettings,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في صفحة الشروط والأحكام:', error);
        res.render('terms', {
            pageTitle: 'الشروط والأحكام',
            storeSettings: null,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    }
});

// =============================================
// صفحة سياسة الشحن والتسليم
// =============================================

router.get('/shipping-policy', async (req, res) => {
    try {
        const storeSettings = await StoreSettings.getSettings();
        
        res.render('shipping-policy', {
            pageTitle: 'سياسة الشحن والتسليم',
            storeSettings,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في صفحة سياسة الشحن:', error);
        res.render('shipping-policy', {
            pageTitle: 'سياسة الشحن والتسليم',
            storeSettings: null,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    }
});

// =============================================
// صفحة سياسة الاستبدال والاسترجاع
// =============================================

router.get('/return-policy', async (req, res) => {
    try {
        const storeSettings = await StoreSettings.getSettings();
        
        res.render('return-policy', {
            pageTitle: 'سياسة الاستبدال والاسترجاع',
            storeSettings,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في صفحة سياسة الاستبدال:', error);
        res.render('return-policy', {
            pageTitle: 'سياسة الاستبدال والاسترجاع',
            storeSettings: null,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    }
});

// =============================================
// تبديل اللغة
// =============================================

router.get('/switch-language/:lang', (req, res) => {
    const lang = req.params.lang;
    
    if (['ar', 'en'].includes(lang)) {
        req.session.language = lang;
        res.cookie('language', lang, { maxAge: 365 * 24 * 60 * 60 * 1000 });
    }
    
    // العودة للصفحة السابقة
    const returnTo = req.headers.referer || '/';
    res.redirect(returnTo);
});

// =============================================
// تبديل الوضع الليلي
// =============================================

router.get('/toggle-dark-mode', (req, res) => {
    const currentMode = req.cookies.darkMode === 'true';
    res.cookie('darkMode', !currentMode, { maxAge: 365 * 24 * 60 * 60 * 1000 });
    
    const returnTo = req.headers.referer || '/';
    res.redirect(returnTo);
});

// =============================================
// تبديل العملة
// =============================================

router.get('/switch-currency/:currency', async (req, res) => {
    const currency = req.params.currency;
    
    if (['SAR', 'USD', 'EUR', 'AED'].includes(currency)) {
        req.session.currency = currency;
        res.cookie('currency', currency, { maxAge: 365 * 24 * 60 * 60 * 1000 });
    }
    
    const returnTo = req.headers.referer || '/';
    res.redirect(returnTo);
});

// =============================================
// تتبع الطلب
// =============================================

router.get('/track-order', (req, res) => {
    res.render('track-order', {
        pageTitle: 'تتبع الطلب',
        order: null,
        notFound: false,
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
    });
});

router.post('/track-order', async (req, res) => {
    try {
        const { orderNumber, email } = req.body;
        
        if (!orderNumber) {
            req.flash('error_msg', 'يرجى إدخال رقم الطلب');
            return res.redirect('/track-order');
        }
        
        const order = await Order.findOne({ 
            orderNumber: orderNumber,
            customerEmail: email || { $exists: true }
        });
        
        if (!order) {
            return res.render('track-order', {
                pageTitle: 'تتبع الطلب',
                order: null,
                notFound: true,
                success_msg: req.flash('success_msg'),
                error_msg: req.flash('error_msg')
            });
        }
        
        res.render('track-order', {
            pageTitle: 'تتبع الطلب: ' + order.orderNumber,
            order,
            notFound: false,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
        
    } catch (error) {
        console.error('خطأ في تتبع الطلب:', error);
        req.flash('error_msg', 'حدث خطأ في البحث عن الطلب');
        res.redirect('/track-order');
    }
});

// =============================================
// العروض والتخفيضات
// =============================================

router.get('/offers', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        
        const result = await Product.search(null, {
            onSale: true,
            page,
            limit
        });
        
        res.render('offers', {
            pageTitle: 'العروض والتخفيضات',
            products: result.products,
            pagination: result.pagination,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في صفحة العروض:', error);
        res.redirect('/');
    }
});

// =============================================
// خريطة الموقع
// =============================================

router.get('/sitemap', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).select('name slug');
        
        res.render('sitemap', {
            pageTitle: 'خريطة الموقع',
            categories,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في خريطة الموقع:', error);
        res.redirect('/');
    }
});

// =============================================
// صفحة خطأ 404
// =============================================

router.get('/404', (req, res) => {
    res.status(404).render('404', {
        pageTitle: 'الصفحة غير موجودة',
        path: req.url
    });
});

// =============================================
// API: الحصول على إحصائيات المتجر
// =============================================

router.get('/api/store-stats', async (req, res) => {
    try {
        const [
            productsCount,
            categoriesCount,
            ordersCount,
            customersCount
        ] = await Promise.all([
            Product.countDocuments({ isActive: true, isHidden: false }),
            Category.countDocuments({ isActive: true }),
            Order.countDocuments(),
            User.countDocuments({ role: 'customer', isActive: true })
        ]);
        
        res.json({
            success: true,
            stats: {
                productsCount,
                categoriesCount,
                ordersCount,
                customersCount
            }
        });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;
