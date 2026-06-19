// =============================================
// متجر الرعدي أون لاين - Al-Radi Online
// مسارات لوحة تحكم المدير - الإصدار الكامل
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
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// =============================================
// إعدادات رفع الملفات (Multer)
// =============================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dir = 'public/uploads/';
        if (file.fieldname.startsWith('voice')) dir += 'audio/';
        else if (file.fieldname === 'storeLogo') dir += 'logos/';
        else dir += 'products/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// تطبيق middleware المشدد
router.use(isAdmin);

// =============================================
// 1. لوحة المعلومات الرئيسية
// =============================================
router.get('/dashboard', async (req, res) => {
    try {
        const today = new Date(); today.setHours(0,0,0,0);
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
            Order.find().sort('-createdAt').limit(5).populate('user', 'name email'),
            Product.find({ isActive: true }).sort('-sales').limit(10).select('name sales price images')
        ]);

        const stats = {
            totalUsers, totalProducts, totalOrders,
            totalRevenue: totalRevenue[0]?.total || 0,
            todayOrders, todayRevenue: todayRevenue[0]?.total || 0,
            monthRevenue: monthRevenue[0]?.total || 0,
            lowStockProducts
        };

        res.render('admin/dashboard', {
            pageTitle: 'لوحة التحكم',
            stats, recentOrders, topProducts,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// =============================================
// 2. إدارة المنتجات (عرض، إضافة، تعديل، حذف)
// =============================================
router.get('/products', async (req, res) => {
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

    const [products, total, categories] = await Promise.all([
        Product.find(filter).sort('-createdAt').skip((page-1)*limit).limit(limit).populate('category', 'name'),
        Product.countDocuments(filter),
        Category.find({ isActive: true }).select('name')
    ]);

    res.render('admin/products', {
        pageTitle: 'إدارة المنتجات', products, categories,
        pagination: { page, limit, total, pages: Math.ceil(total/limit) },
        search, category, status,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.get('/products/add', async (req, res) => {
    const categories = await Category.find({ isActive: true }).select('name');
    res.render('admin/product-form', { pageTitle: 'إضافة منتج', product: null, categories, isEdit: false, success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg') });
});

router.post('/products/add', upload.array('images', 10), async (req, res) => {
    try {
        const { name, description, category, price, stock, isFeatured, isNewArrival, imageUrls } = req.body;
        if (!name || !category || !price) {
            req.flash('error_msg', 'الاسم والقسم والسعر مطلوبة');
            return res.redirect('/admin/products/add');
        }

        const images = [];
        if (req.files) req.files.forEach((f, i) => images.push({ url: '/' + f.path.replace(/\\/g, '/').replace('public/', ''), alt: name, isMain: i === 0 }));
        if (imageUrls) imageUrls.split('\n').filter(u => u.trim()).forEach((url, i) => images.push({ url: url.trim(), alt: name, isMain: images.length === 0 && i === 0 }));

        await Product.create({
            name, description: description || '', category, price: parseFloat(price), stock: parseInt(stock) || 1,
            isFeatured: isFeatured === 'on', isNewArrival: isNewArrival === 'on', isActive: true, isHidden: false, images
        });

        req.flash('success_msg', 'تم إضافة المنتج بنجاح ✅');
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'خطأ: ' + err.message);
        res.redirect('/admin/products/add');
    }
});

router.get('/products/edit/:id', async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect('/admin/products');
    const categories = await Category.find({ isActive: true }).select('name');
    res.render('admin/product-form', { pageTitle: 'تعديل المنتج', product, categories, isEdit: true, success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg') });
});

router.post('/products/edit/:id', upload.array('images', 10), async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.redirect('/admin/products');
        const { name, description, category, price, stock, isFeatured, isNewArrival, isActive } = req.body;
        product.name = name;
        product.description = description;
        product.category = category;
        product.price = parseFloat(price);
        product.stock = parseInt(stock) || 1;
        product.isFeatured = isFeatured === 'on';
        product.isNewArrival = isNewArrival === 'on';
        product.isActive = isActive === 'on';
        if (req.files && req.files.length > 0) {
            product.images = req.files.map((f, i) => ({ url: '/' + f.path.replace(/\\/g, '/').replace('public/', ''), alt: name, isMain: i === 0 }));
        }
        await product.save();
        req.flash('success_msg', 'تم التحديث ✅');
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'خطأ: ' + err.message);
        res.redirect('back');
    }
});

router.delete('/products/delete/:id', async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// =============================================
// 3. إدارة الأقسام
// =============================================
router.get('/categories', async (req, res) => {
    const categories = await Category.find().sort('order').populate('parent', 'name');
    res.render('admin/categories', { pageTitle: 'إدارة الأقسام', categories, success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg') });
});

router.get('/categories/add', async (req, res) => {
    const categories = await Category.find({ isActive: true }).select('name');
    res.render('admin/category-form', { pageTitle: 'إضافة قسم', isEdit: false, category: null, categories, success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg') });
});

router.post('/categories/add', async (req, res) => {
    const { name, isActive, isFeatured, showInMenu, icon } = req.body;
    await Category.create({ name, isActive: isActive === 'on', isFeatured: isFeatured === 'on', showInMenu: showInMenu === 'on', icon: icon || 'fa-folder' });
    req.flash('success_msg', 'تم إضافة القسم ✅');
    res.redirect('/admin/categories');
});

router.delete('/categories/delete/:id', async (req, res) => {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// =============================================
// 4. إدارة الطلبات
// =============================================
router.get('/orders', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const status = req.query.status || '';
    const filter = status ? { status } : {};
    const [orders, total] = await Promise.all([
        Order.find(filter).sort('-createdAt').skip((page-1)*limit).limit(limit).populate('user', 'name email'),
        Order.countDocuments(filter)
    ]);
    res.render('admin/orders', {
        pageTitle: 'إدارة الطلبات', orders,
        pagination: { page, limit, total, pages: Math.ceil(total/limit) }, status,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.get('/orders/:id', async (req, res) => {
    const order = await Order.findById(req.params.id).populate('user', 'name email phone').populate('items.product', 'name images');
    if (!order) return res.redirect('/admin/orders');
    res.render('admin/order-detail', { pageTitle: 'تفاصيل الطلب', order, success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg') });
});

router.post('/orders/update-status/:id', async (req, res) => {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.json({ success: false });
    order.status = status;
    order.statusHistory.push({ status, note, timestamp: new Date() });
    await order.save();
    res.json({ success: true });
});

// =============================================
// 5. إدارة العملاء
// =============================================
router.get('/customers', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const search = req.query.search || '';
    const filter = { role: 'customer' };
    if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    const [customers, total] = await Promise.all([
        User.find(filter).sort('-createdAt').skip((page-1)*limit).limit(limit).select('-password'),
        User.countDocuments(filter)
    ]);
    res.render('admin/customers', {
        pageTitle: 'إدارة العملاء', customers,
        pagination: { page, limit, total, pages: Math.ceil(total/limit) }, search,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.get('/customers/:id', async (req, res) => {
    const customer = await User.findById(req.params.id).select('-password');
    if (!customer) return res.redirect('/admin/customers');
    const orders = await Order.find({ user: customer._id }).sort('-createdAt');
    res.render('admin/customer-detail', { pageTitle: 'تفاصيل العميل', customer, orders, success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg') });
});

// =============================================
// 6. إعدادات المتجر المتقدمة (شعار، صوتيات، ألوان...)
// =============================================
router.get('/settings', async (req, res) => {
    const settings = await StoreSettings.getSettings();
    res.render('admin/settings', { pageTitle: 'إعدادات المتجر', settings, success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg') });
});

router.post('/settings', upload.fields([
    { name: 'storeLogo', maxCount: 1 },
    { name: 'voiceGreetingFile', maxCount: 1 },
    { name: 'voiceAddToCartFile', maxCount: 1 },
    { name: 'voiceSaveFile', maxCount: 1 },
    { name: 'voicePrintFile', maxCount: 1 },
    { name: 'voiceSortFile', maxCount: 1 },
    { name: 'voiceSuccessFile', maxCount: 1 },
    { name: 'voiceErrorFile', maxCount: 1 },
    { name: 'voiceNotificationFile', maxCount: 1 }
]), async (req, res) => {
    try {
        const updateData = { ...req.body };
        // تحويل checkboxes
        ['voiceGreetingEnabled', 'voiceInteractionsEnabled'].forEach(f => updateData[f] = req.body[f] === 'on');

        // رفع الشعار
        if (req.files?.storeLogo?.[0]) {
            updateData.storeLogo = '/' + req.files.storeLogo[0].path.replace(/\\/g, '/').replace('public/', '');
        }
        // رفع الصوتيات
        ['voiceGreeting', 'voiceAddToCart', 'voiceSave', 'voicePrint', 'voiceSort', 'voiceSuccess', 'voiceError', 'voiceNotification'].forEach(f => {
            const field = f + 'File';
            if (req.files?.[field]?.[0]) {
                updateData[field] = '/' + req.files[field][0].path.replace(/\\/g, '/').replace('public/', '');
            }
        });
        // روابط صوتية مباشرة
        ['voiceGreetingUrl', 'voiceAddToCartUrl', 'voiceSaveUrl', 'voicePrintUrl', 'voiceSortUrl', 'voiceSuccessUrl', 'voiceErrorUrl', 'voiceNotificationUrl'].forEach(urlField => {
            if (req.body[urlField]?.trim()) {
                const dbField = urlField.replace('Url', 'File');
                updateData[dbField] = req.body[urlField].trim();
            }
        });

        await StoreSettings.updateSettings(updateData);
        req.flash('success_msg', 'تم حفظ الإعدادات بنجاح ✅');
        res.redirect('/admin/settings');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'خطأ في الحفظ: ' + err.message);
        res.redirect('/admin/settings');
    }
});

// =============================================
// 7. الأدوات الأخرى (المحادثات، السجلات، التقارير)
// =============================================
router.get('/chat', (req, res) => res.render('admin/chat', { pageTitle: 'المحادثات', success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg') }));
router.get('/activity-log', async (req, res) => {
    const errors = await ErrorLog.find().sort('-createdAt').limit(50);
    res.render('admin/activity-log', { pageTitle: 'سجل النشاطات', errors, success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg') });
});
router.get('/reports', (req, res) => res.render('admin/reports', { pageTitle: 'التقارير', success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg') }));

module.exports = router;
