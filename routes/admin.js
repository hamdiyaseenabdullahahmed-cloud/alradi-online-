// =============================================
// متجر الرعدي أون لاين - alradi-online
// مسارات لوحة تحكم المدير - نسخة مستقرة
// =============================================

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { isAdmin } = require('../middleware/auth');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const User = require('../models/User');
const StoreSettings = require('../models/StoreSettings');
const ErrorLog = require('../models/ErrorLog');

router.use(isAdmin);

// =============================================
// لوحة التحكم
// =============================================

router.get('/dashboard', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const [
            totalUsers, totalProducts, totalOrders, totalRevenue,
            todayOrders, todayRevenue, monthRevenue,
            lowStockProducts, recentOrders, topProducts
        ] = await Promise.all([
            User.countDocuments({ role: 'customer', isActive: true }),
            Product.countDocuments({ isActive: true }),
            Order.countDocuments(),
            Order.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
            Order.countDocuments({ createdAt: { $gte: today } }),
            Order.aggregate([{ $match: { createdAt: { $gte: today }, status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
            Order.aggregate([{ $match: { createdAt: { $gte: firstDayOfMonth }, status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
            Product.countDocuments({ stock: { $lte: 5, $gt: 0 }, isActive: true, isUnlimited: false }),
            Order.find().sort('-createdAt').limit(5),
            Product.find({ isActive: true }).sort('-sales').limit(10).select('name sales price')
        ]);

        const stats = {
            totalUsers, totalProducts, totalOrders,
            totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
            todayOrders,
            todayRevenue: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
            monthRevenue: monthRevenue.length > 0 ? monthRevenue[0].total : 0,
            lowStockProducts
        };

        res.render('admin/dashboard', {
            pageTitle: 'لوحة التحكم',
            stats, recentOrders, topProducts,
            success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
        });
    } catch (error) {
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('/');
    }
});

// =============================================
// إدارة المنتجات
// =============================================

router.get('/products', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const search = req.query.search || '';
        const category = req.query.category || '';
        const status = req.query.status || '';
        const filter = {};
        if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }];
        if (category) filter.category = category;
        if (status === 'active') filter.isActive = true;
        if (status === 'low_stock') { filter.stock = { $lte: 5, $gt: 0 }; filter.isUnlimited = false; }
        if (status === 'out_of_stock') filter.stockStatus = 'out_of_stock';
        const skip = (page - 1) * limit;
        const [products, total, categories] = await Promise.all([
            Product.find(filter).sort('-createdAt').skip(skip).limit(limit).populate('category', 'name'),
            Product.countDocuments(filter),
            Category.find({ isActive: true }).select('name')
        ]);
        res.render('admin/products', {
            pageTitle: 'إدارة المنتجات',
            products, categories,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            search, category, status,
            success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
        });
    } catch (error) {
        res.redirect('/admin/dashboard');
    }
});

router.get('/products/add', async (req, res) => {
    const categories = await Category.find({ isActive: true }).select('name');
    res.render('admin/product-form', {
        pageTitle: 'إضافة منتج جديد',
        product: null, categories, isEdit: false,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.post('/products/add', async (req, res) => {
    try {
        const { name, description, category, price, stock, isFeatured, isNewArrival, imageUrls } = req.body;
        
        if (!name || !category || !price) {
            req.flash('error_msg', 'الاسم والقسم والسعر مطلوبة');
            return res.redirect('/admin/products/add');
        }

        const images = [];
        if (imageUrls) {
            imageUrls.split('\n').filter(u => u.trim()).forEach((url, i) => {
                images.push({ url: url.trim(), alt: name, isMain: i === 0, order: i });
            });
        }

        const product = new Product({
            name,
            description: description || '',
            category,
            price: parseFloat(price) || 0,
            stock: parseInt(stock) || 1,
            isFeatured: isFeatured === 'on',
            isNewArrival: isNewArrival === 'on',
            isActive: true,
            isHidden: false,
            images
        });

        await product.save();
        req.flash('success_msg', 'تم إضافة المنتج بنجاح ✅');
        res.redirect('/admin/products');
    } catch (error) {
        req.flash('error_msg', 'خطأ: ' + error.message);
        res.redirect('/admin/products/add');
    }
});

router.get('/products/edit/:id', async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) { req.flash('error_msg', 'غير موجود'); return res.redirect('/admin/products'); }
    const categories = await Category.find({ isActive: true }).select('name');
    res.render('admin/product-form', {
        pageTitle: 'تعديل: ' + product.name,
        product, categories, isEdit: true,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.post('/products/edit/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) { req.flash('error_msg', 'غير موجود'); return res.redirect('/admin/products'); }
        
        product.name = req.body.name;
        product.description = req.body.description;
        product.category = req.body.category;
        product.price = parseFloat(req.body.price) || 0;
        product.stock = parseInt(req.body.stock) || 1;
        product.isFeatured = req.body.isFeatured === 'on';
        product.isNewArrival = req.body.isNewArrival === 'on';
        product.isActive = req.body.isActive === 'on';
        
        if (req.body.imageUrls) {
            product.images = req.body.imageUrls.split('\n').filter(u => u.trim()).map((url, i) => ({
                url: url.trim(), alt: req.body.name, isMain: i === 0, order: i
            }));
        }
        
        await product.save();
        req.flash('success_msg', 'تم التحديث ✅');
        res.redirect('/admin/products');
    } catch (error) {
        res.redirect('/admin/products/edit/' + req.params.id);
    }
});

router.delete('/products/delete/:id', async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// =============================================
// إدارة الأقسام
// =============================================

router.get('/categories', async (req, res) => {
    const categories = await Category.find().sort('order');
    res.render('admin/categories', {
        pageTitle: 'إدارة الأقسام', categories,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.get('/categories/add', async (req, res) => {
    const categories = await Category.find({ isActive: true }).select('name');
    res.render('admin/category-form', {
        pageTitle: 'إضافة قسم', isEdit: false, category: null, categories,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.post('/categories/add', async (req, res) => {
    try {
        const category = new Category({
            name: req.body.name,
            isActive: req.body.isActive === 'on',
            isFeatured: req.body.isFeatured === 'on',
            showInMenu: req.body.showInMenu === 'on',
            icon: req.body.icon || 'fa-folder'
        });
        await category.save();
        req.flash('success_msg', 'تم إضافة القسم ✅');
        res.redirect('/admin/categories');
    } catch (error) {
        res.redirect('/admin/categories');
    }
});

router.delete('/categories/delete/:id', async (req, res) => {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// =============================================
// إدارة الطلبات
// =============================================

router.get('/orders', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const status = req.query.status || '';
    const filter = {};
    if (status) filter.status = status;
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
        Order.find(filter).sort('-createdAt').skip(skip).limit(limit),
        Order.countDocuments(filter)
    ]);
    res.render('admin/orders', {
        pageTitle: 'إدارة الطلبات', orders,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }, status,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.get('/orders/:id', async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) { req.flash('error_msg', 'غير موجود'); return res.redirect('/admin/orders'); }
    res.render('admin/order-detail', {
        pageTitle: 'تفاصيل الطلب', order,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.post('/orders/update-status/:id', async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.json({ success: false });
    await order.updateStatus(req.body.status, req.body.note, req.user._id);
    res.json({ success: true });
});

// =============================================
// إدارة العملاء
// =============================================

router.get('/customers', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const search = req.query.search || '';
    const filter = { role: 'customer' };
    if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    const skip = (page - 1) * limit;
    const [customers, total] = await Promise.all([
        User.find(filter).sort('-createdAt').skip(skip).limit(limit).select('-password'),
        User.countDocuments(filter)
    ]);
    res.render('admin/customers', {
        pageTitle: 'إدارة العملاء', customers,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }, search,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.get('/customers/:id', async (req, res) => {
    const customer = await User.findById(req.params.id).select('-password');
    if (!customer) { req.flash('error_msg', 'غير موجود'); return res.redirect('/admin/customers'); }
    const orders = await Order.find({ user: customer._id }).sort('-createdAt');
    res.render('admin/customer-detail', {
        pageTitle: 'تفاصيل العميل', customer, orders,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

// =============================================
// إعدادات المتجر
// =============================================

router.get('/settings', async (req, res) => {
    const settings = await StoreSettings.getSettings();
    res.render('admin/settings', {
        pageTitle: 'إعدادات المتجر', settings,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.post('/settings', async (req, res) => {
    try {
        const updateData = {
            storeName: req.body.storeName,
            storeNameEn: req.body.storeNameEn || '',
            contactEmail: req.body.contactEmail || '',
            whatsappNumber: req.body.whatsappNumber || '',
            shippingInternal: parseFloat(req.body.shippingInternal) || 25,
            shippingInternational: parseFloat(req.body.shippingInternational) || 75,
            freeShippingMin: parseFloat(req.body.freeShippingMin) || 300,
            voiceGreetingEnabled: req.body.voiceGreetingEnabled === 'on',
            voiceInteractionsEnabled: req.body.voiceInteractionsEnabled === 'on',
            returnPolicy: req.body.returnPolicy || '',
            copyrightText: req.body.copyrightText || ''
        };
        
        // حفظ الروابط المباشرة
        if (req.body.storeLogoUrl && req.body.storeLogoUrl.trim()) {
            updateData.storeLogo = req.body.storeLogoUrl.trim();
        }
        if (req.body.voiceGreetingUrl && req.body.voiceGreetingUrl.trim()) {
            updateData.voiceGreetingFile = req.body.voiceGreetingUrl.trim();
        }
        if (req.body.voiceAddToCartUrl && req.body.voiceAddToCartUrl.trim()) {
            updateData.voiceAddToCartFile = req.body.voiceAddToCartUrl.trim();
        }
        if (req.body.voiceSaveUrl && req.body.voiceSaveUrl.trim()) {
            updateData.voiceSaveFile = req.body.voiceSaveUrl.trim();
        }
        if (req.body.voicePrintUrl && req.body.voicePrintUrl.trim()) {
            updateData.voicePrintFile = req.body.voicePrintUrl.trim();
        }
        if (req.body.voiceNotificationUrl && req.body.voiceNotificationUrl.trim()) {
            updateData.voiceNotificationFile = req.body.voiceNotificationUrl.trim();
        }
        if (req.body.voiceSuccessUrl && req.body.voiceSuccessUrl.trim()) {
            updateData.voiceSuccessFile = req.body.voiceSuccessUrl.trim();
        }
        if (req.body.voiceErrorUrl && req.body.voiceErrorUrl.trim()) {
            updateData.voiceErrorFile = req.body.voiceErrorUrl.trim();
        }
        
        console.log('📁 حفظ الإعدادات...');
        await StoreSettings.updateSettings(updateData);
        console.log('✅ تم الحفظ بنجاح');
        
        req.flash('success_msg', 'تم حفظ الإعدادات بنجاح ✅');
        res.redirect('/admin/settings');
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        req.flash('error_msg', 'خطأ في الحفظ: ' + error.message);
        res.redirect('/admin/settings');
    }
});

// =============================================
// باقي الصفحات
// =============================================

router.get('/chat', async (req, res) => {
    res.render('admin/chat', {
        pageTitle: 'المحادثات',
        conversations: [],
        connectedUsers: [],
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.get('/activity-log', async (req, res) => {
    const errors = await ErrorLog.find().sort('-createdAt').limit(50);
    res.render('admin/activity-log', {
        pageTitle: 'سجل النشاطات', errors,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.get('/reports', async (req, res) => {
    res.render('admin/reports', {
        pageTitle: 'التقارير',
        type: req.query.type || 'sales',
        period: req.query.period || 'month',
        reportData: {},
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

module.exports = router;
