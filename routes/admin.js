// =============================================
// متجر الرعدي أون لاين - Al-Radi Online
// مسارات لوحة تحكم المدير - النسخة المطورة الكاملة
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
        console.error('❌ خطأ في لوحة التحكم:', err.message);
        req.flash('error_msg', 'حدث خطأ في تحميل لوحة التحكم');
        res.redirect('/');
    }
});

// =============================================
// 2. إدارة المنتجات
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
        console.error('❌ خطأ في إضافة المنتج:', err.message);
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
        console.error('❌ خطأ في تحديث المنتج:', err.message);
        req.flash('error_msg', 'خطأ: ' + err.message);
        res.redirect('back');
    }
});

router.delete('/products/delete/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// =============================================
// 3. إدارة الأقسام (المطورة والكاملة) 🔥
// =============================================

// عرض قائمة الأقسام
router.get('/categories', async (req, res) => {
    try {
        const categories = await Category.find().sort('order').populate('parent', 'name');
        res.render('admin/categories', {
            pageTitle: 'إدارة الأقسام',
            categories,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('❌ خطأ في عرض الأقسام:', error.message);
        req.flash('error_msg', 'حدث خطأ في تحميل الأقسام');
        res.redirect('/admin/dashboard');
    }
});

// عرض نموذج إضافة قسم جديد
router.get('/categories/add', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).select('name _id');
        res.render('admin/category-form', {
            pageTitle: 'إضافة قسم جديد',
            isEdit: false,
            category: null,
            categories,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('❌ خطأ في عرض نموذج الإضافة:', error.message);
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('/admin/categories');
    }
});

// معالجة إضافة قسم جديد (نسخة مطورة بالكامل)
router.post('/categories/add', async (req, res) => {
    try {
        const { name, nameEn, description, icon, order, parent, isActive, isFeatured, showInMenu } = req.body;

        // =============================================
        // [🔥 التحقق الأساسي] هل اسم القسم موجود؟
        // =============================================
        if (!name || name.trim() === '') {
            req.flash('error_msg', 'اسم القسم مطلوب');
            return res.redirect('/admin/categories/add');
        }

        // =============================================
        // [🔥 التحقق من التكرار] هل يوجد قسم بنفس الاسم؟
        // =============================================
        const existingCategory = await Category.findOne({ name: name.trim() });
        if (existingCategory) {
            req.flash('error_msg', 'يوجد قسم بنفس الاسم بالفعل، اختر اسماً آخر');
            return res.redirect('/admin/categories/add');
        }

        // =============================================
        // إنشاء القسم الجديد
        // =============================================
        const newCategory = new Category({
            name: name.trim(),
            nameEn: nameEn ? nameEn.trim() : '',
            description: description || '',
            icon: icon || 'fa-folder',
            order: parseInt(order) || 0,
            parent: parent || null,
            isActive: isActive === 'on',
            isFeatured: isFeatured === 'on',
            showInMenu: showInMenu === 'on'
        });

        await newCategory.save();

        console.log('✅ تم إضافة قسم جديد: ' + newCategory.name);
        req.flash('success_msg', 'تم إضافة القسم "' + newCategory.name + '" بنجاح ✅');
        res.redirect('/admin/categories');

    } catch (error) {
        console.error('❌ خطأ في إضافة القسم:', error.message);
        req.flash('error_msg', 'حدث خطأ أثناء إضافة القسم: ' + error.message);
        res.redirect('/admin/categories/add');
    }
});

// عرض نموذج تعديل قسم
router.get('/categories/edit/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            req.flash('error_msg', 'القسم غير موجود');
            return res.redirect('/admin/categories');
        }
        const categories = await Category.find({ isActive: true, _id: { $ne: category._id } }).select('name _id');
        res.render('admin/category-form', {
            pageTitle: 'تعديل القسم',
            isEdit: true,
            category,
            categories,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('❌ خطأ في عرض نموذج التعديل:', error.message);
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('/admin/categories');
    }
});

// معالجة تعديل قسم
router.post('/categories/edit/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            req.flash('error_msg', 'القسم غير موجود');
            return res.redirect('/admin/categories');
        }

        const { name, nameEn, description, icon, order, parent, isActive, isFeatured, showInMenu } = req.body;

        // التحقق من وجود اسم
        if (!name || name.trim() === '') {
            req.flash('error_msg', 'اسم القسم مطلوب');
            return res.redirect('/admin/categories/edit/' + req.params.id);
        }

        // التحقق من عدم تكرار الاسم (باستثناء نفسه)
        const existingCategory = await Category.findOne({ name: name.trim(), _id: { $ne: category._id } });
        if (existingCategory) {
            req.flash('error_msg', 'يوجد قسم بنفس الاسم بالفعل');
            return res.redirect('/admin/categories/edit/' + req.params.id);
        }

        // تحديث البيانات
        category.name = name.trim();
        category.nameEn = nameEn ? nameEn.trim() : '';
        category.description = description || '';
        category.icon = icon || 'fa-folder';
        category.order = parseInt(order) || 0;
        category.parent = parent || null;
        category.isActive = isActive === 'on';
        category.isFeatured = isFeatured === 'on';
        category.showInMenu = showInMenu === 'on';

        await category.save();

        console.log('✅ تم تحديث القسم: ' + category.name);
        req.flash('success_msg', 'تم تحديث القسم "' + category.name + '" بنجاح ✅');
        res.redirect('/admin/categories');

    } catch (error) {
        console.error('❌ خطأ في تحديث القسم:', error.message);
        req.flash('error_msg', 'حدث خطأ أثناء تحديث القسم: ' + error.message);
        res.redirect('/admin/categories/edit/' + req.params.id);
    }
});

// حذف قسم
router.delete('/categories/delete/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.json({ success: false, message: 'القسم غير موجود' });
        }
        await Category.findByIdAndDelete(req.params.id);
        console.log('🗑️ تم حذف القسم: ' + category.name);
        res.json({ success: true, message: 'تم حذف القسم بنجاح' });
    } catch (error) {
        console.error('❌ خطأ في حذف القسم:', error.message);
        res.json({ success: false, message: error.message });
    }
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
// 6. إعدادات المتجر
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
        ['voiceGreetingEnabled', 'voiceInteractionsEnabled'].forEach(f => updateData[f] = req.body[f] === 'on');

        if (req.files?.storeLogo?.[0]) {
            updateData.storeLogo = '/' + req.files.storeLogo[0].path.replace(/\\/g, '/').replace('public/', '');
        }
        ['voiceGreeting', 'voiceAddToCart', 'voiceSave', 'voicePrint', 'voiceSort', 'voiceSuccess', 'voiceError', 'voiceNotification'].forEach(f => {
            const field = f + 'File';
            if (req.files?.[field]?.[0]) {
                updateData[field] = '/' + req.files[field][0].path.replace(/\\/g, '/').replace('public/', '');
            }
        });
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
        console.error('❌ خطأ في حفظ الإعدادات:', err.message);
        req.flash('error_msg', 'خطأ في الحفظ: ' + err.message);
        res.redirect('/admin/settings');
    }
});

// =============================================
// 7. الأدوات الأخرى
// =============================================
router.get('/chat', (req, res) => res.render('admin/chat', { pageTitle: 'المحادثات', success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg') }));

router.get('/activity-log', async (req, res) => {
    const errors = await ErrorLog.find().sort('-createdAt').limit(50);
    res.render('admin/activity-log', { pageTitle: 'سجل النشاطات', errors, success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg') });
});

router.get('/reports', (req, res) => res.render('admin/reports', { pageTitle: 'التقارير', success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg') }));

module.exports = router;
