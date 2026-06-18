// =============================================
// متجر الرعدي أون لاين - alradi-online
// مسارات لوحة تحكم المدير - مع إصلاح الرفع
// =============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAdmin } = require('../middleware/auth');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const User = require('../models/User');
const StoreSettings = require('../models/StoreSettings');
const ErrorLog = require('../models/ErrorLog');

// =============================================
// إعدادات رفع الملفات - بدون تحديد حجم
// =============================================

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        let uploadPath = 'public/uploads/';
        if (file.fieldname === 'storeLogo' || file.fieldname === 'storeFavicon') {
            uploadPath += 'logos/';
        } else if (file.fieldname && file.fieldname.startsWith('voice')) {
            uploadPath += 'audio/';
        } else {
            uploadPath += 'products/';
        }
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

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
            pageTitle: 'لوحة التحكم', stats, recentOrders, topProducts,
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
            products, categories, pagination: { page, limit, total, pages: Math.ceil(total / limit) },
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

router.post('/products/add', upload.array('images', 10), async (req, res) => {
    try {
        const { name, description, category, price, stock, isFeatured, isNewArrival } = req.body;
        
        if (!name || !category || !price) {
            req.flash('error_msg', 'الاسم والقسم والسعر مطلوبة');
            return res.redirect('/admin/products/add');
        }

        const images = [];
        if (req.files && req.files.length > 0) {
            req.files.forEach((file, index) => {
                images.push({
                    url: '/' + file.path.replace(/\\/g, '/').replace('public/', ''),
                    alt: name,
                    isMain: index === 0,
                    order: index
                });
            });
        }
        
        if (req.body.imageUrls) {
            req.body.imageUrls.split('\n').filter(u => u.trim()).forEach((url, i) => {
                images.push({ url: url.trim(), alt: name, isMain: images.length === 0 && i === 0, order: images.length + i });
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

router.post('/products/edit/:id', upload.array('images', 10), async (req, res) => {
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
        
        if (req.files && req.files.length > 0) {
            product.images = req.files.map((file, i) => ({
                url: '/' + file.path.replace(/\\/g, '/').replace('public/', ''),
                alt: req.body.name,
                isMain: i === 0,
                order: i
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
// إعدادات المتجر - مبسطة وتشتغل
// =============================================

router.get('/settings', async (req, res) => {
    const settings = await StoreSettings.getSettings();
    res.render('admin/settings', {
        pageTitle: 'إعدادات المتجر', settings,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.post('/settings', upload.single('storeLogo'), async (req, res) => {
    try {
        const updateData = {};
        Object.keys(req.body).forEach(key => { updateData[key] = req.body[key]; });
        
        if (req.file) {
            updateData.storeLogo = '/' + req.file.path.replace(/\\/g, '/').replace('public/', '');
        }
        
        await StoreSettings.updateSettings(updateData);
        req.flash('success_msg', 'تم الحفظ ✅');
        res.redirect('/admin/settings');
    } catch (error) {
        req.flash('error_msg', 'خطأ: ' + error.message);
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
