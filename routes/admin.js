// =============================================
// متجر الرعدي أون لاين - alradi-online
// مسارات لوحة تحكم المدير - نسخة مطورة
// =============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAdmin, isSuperAdmin } = require('../middleware/auth');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const User = require('../models/User');
const Message = require('../models/Message');
const StoreSettings = require('../models/StoreSettings');
const ErrorLog = require('../models/ErrorLog');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// =============================================
// إعدادات رفع الملفات - بدون قيود صارمة
// =============================================

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        let uploadPath = 'public/uploads/';
        if (file.fieldname === 'logo' || file.fieldname === 'favicon' || file.fieldname === 'storeLogo' || file.fieldname === 'storeFavicon') {
            uploadPath += 'logos/';
        } else if (file.fieldname === 'profileImage') {
            uploadPath += 'profiles/';
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
        cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

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
            Product.find({ isActive: true }).sort('-sales').limit(10).select('name sales price images')
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
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ:', error);
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
        req.flash('error_msg', 'حدث خطأ');
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
            nameEn: req.body.nameEn || '',
            description: description || '',
            descriptionEn: req.body.descriptionEn || '',
            category,
            brand: req.body.brand || '',
            price: parseFloat(price) || 0,
            comparePrice: parseFloat(req.body.comparePrice) || null,
            stock: parseInt(stock) || 1,
            sku: req.body.sku || undefined,
            isFeatured: isFeatured === 'on',
            isNewArrival: isNewArrival === 'on',
            isActive: true,
            isHidden: false,
            images,
            discount: {
                type: req.body.discountType || 'none',
                value: parseFloat(req.body.discountValue) || 0,
                isActive: req.body.discountType && req.body.discountType !== 'none' && parseFloat(req.body.discountValue) > 0
            }
        });

        await product.save();
        
        try {
            const cat = await Category.findById(category);
            if (cat) await cat.updateProductCount();
        } catch(e) {}

        console.log('✅ منتج جديد:', product._id);
        req.flash('success_msg', 'تم إضافة المنتج بنجاح! ✅');
        res.redirect('/admin/products');
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        req.flash('error_msg', 'خطأ: ' + error.message);
        res.redirect('/admin/products/add');
    }
});

router.get('/products/edit/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) { req.flash('error_msg', 'غير موجود'); return res.redirect('/admin/products'); }
        const categories = await Category.find({ isActive: true }).select('name');
        res.render('admin/product-form', {
            pageTitle: 'تعديل: ' + product.name,
            product, categories, isEdit: true,
            success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
        });
    } catch (error) {
        res.redirect('/admin/products');
    }
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
        product.sku = req.body.sku || undefined;
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
        req.flash('error_msg', 'خطأ: ' + error.message);
        res.redirect('/admin/products/edit/' + req.params.id);
    }
});

router.delete('/products/delete/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'تم الحذف' });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// =============================================
// إدارة الأقسام
// =============================================

router.get('/categories', async (req, res) => {
    const categories = await Category.find().sort('order').populate('parent', 'name');
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

router.get('/categories/edit/:id', async (req, res) => {
    const category = await Category.findById(req.params.id);
    if (!category) { req.flash('error_msg', 'غير موجود'); return res.redirect('/admin/categories'); }
    const categories = await Category.find({ isActive: true, _id: { $ne: req.params.id } }).select('name');
    res.render('admin/category-form', {
        pageTitle: 'تعديل قسم', isEdit: true, category, categories,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.post('/categories/add', upload.single('image'), async (req, res) => {
    try {
        const category = new Category({
            name: req.body.name,
            nameEn: req.body.nameEn || '',
            order: parseInt(req.body.order) || 0,
            isActive: req.body.isActive === 'on',
            isFeatured: req.body.isFeatured === 'on',
            showInMenu: req.body.showInMenu === 'on',
            icon: req.body.icon || 'fa-folder'
        });
        if (req.file) category.image = '/' + req.file.path.replace(/\\/g, '/').replace('public/', '');
        await category.save();
        req.flash('success_msg', 'تم إضافة القسم ✅');
        res.redirect('/admin/categories');
    } catch (error) {
        req.flash('error_msg', 'خطأ');
        res.redirect('/admin/categories');
    }
});

router.post('/categories/edit/:id', upload.single('image'), async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) { req.flash('error_msg', 'غير موجود'); return res.redirect('/admin/categories'); }
        category.name = req.body.name;
        category.isActive = req.body.isActive === 'on';
        category.isFeatured = req.body.isFeatured === 'on';
        category.icon = req.body.icon || 'fa-folder';
        if (req.file) category.image = '/' + req.file.path.replace(/\\/g, '/').replace('public/', '');
        await category.save();
        req.flash('success_msg', 'تم التحديث ✅');
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
    try {
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
    } catch (error) {
        res.redirect('/admin/dashboard');
    }
});

router.get('/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('items.product', 'name images');
        if (!order) { req.flash('error_msg', 'غير موجود'); return res.redirect('/admin/orders'); }
        res.render('admin/order-detail', {
            pageTitle: 'تفاصيل الطلب', order,
            success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
        });
    } catch (error) {
        res.redirect('/admin/orders');
    }
});

router.post('/orders/update-status/:id', async (req, res) => {
    try {
        const { status, note } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order) return res.json({ success: false });
        await order.updateStatus(status, note, req.user._id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// =============================================
// إدارة العملاء
// =============================================

router.get('/customers', async (req, res) => {
    try {
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
    } catch (error) {
        res.redirect('/admin/dashboard');
    }
});

router.get('/customers/:id', async (req, res) => {
    try {
        const customer = await User.findById(req.params.id).select('-password');
        if (!customer) { req.flash('error_msg', 'غير موجود'); return res.redirect('/admin/customers'); }
        const orders = await Order.find({ user: customer._id }).sort('-createdAt');
        res.render('admin/customer-detail', {
            pageTitle: 'تفاصيل العميل', customer, orders,
            success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
        });
    } catch (error) {
        res.redirect('/admin/customers');
    }
});

// =============================================
// إعدادات المتجر - نسخة مطورة
// =============================================

router.get('/settings', async (req, res) => {
    const settings = await StoreSettings.getSettings();
    res.render('admin/settings', {
        pageTitle: 'إعدادات المتجر', settings,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

router.post('/settings', upload.fields([
    { name: 'storeLogo', maxCount: 1 },
    { name: 'storeFavicon', maxCount: 1 },
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
        console.log('📁 استلام إعدادات...');
        console.log('الملفات:', req.files ? Object.keys(req.files).join(', ') : 'لا يوجد');
        
        const updateData = {};
        Object.keys(req.body).forEach(key => { updateData[key] = req.body[key]; });
        
        if (req.files) {
            if (req.files.storeLogo && req.files.storeLogo[0]) {
                updateData.storeLogo = '/' + req.files.storeLogo[0].path.replace(/\\/g, '/').replace('public/', '');
                console.log('✅ شعار:', updateData.storeLogo);
            }
            if (req.files.storeFavicon && req.files.storeFavicon[0]) {
                updateData.storeFavicon = '/' + req.files.storeFavicon[0].path.replace(/\\/g, '/').replace('public/', '');
            }
            ['voiceGreetingFile', 'voiceAddToCartFile', 'voiceSaveFile', 'voicePrintFile', 'voiceSortFile', 'voiceSuccessFile', 'voiceErrorFile', 'voiceNotificationFile'].forEach(field => {
                if (req.files[field] && req.files[field][0]) {
                    updateData[field] = '/' + req.files[field][0].path.replace(/\\/g, '/').replace('public/', '');
                    console.log('✅ صوت:', field);
                }
            });
        }
        
        ['voiceGreetingEnabled', 'voiceInteractionsEnabled', 'enableLoyaltyProgram', 'showPromoBanner', 'showHeroSlider', 'maintenanceMode'].forEach(field => {
            if (updateData[field] !== undefined) updateData[field] = updateData[field] === 'on' || updateData[field] === 'true';
        });
        
        await StoreSettings.updateSettings(updateData);
        console.log('✅ تم حفظ الإعدادات');
        req.flash('success_msg', 'تم تحديث الإعدادات بنجاح ✅');
        res.redirect('/admin/settings');
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        req.flash('error_msg', 'خطأ: ' + error.message);
        res.redirect('/admin/settings');
    }
});

// =============================================
// المحادثات والتقارير
// =============================================

router.get('/chat', async (req, res) => {
    const connectedUsers = req.app.get('connectedUsers');
    res.render('admin/chat', {
        pageTitle: 'المحادثات',
        conversations: [],
        connectedUsers: connectedUsers ? Array.from(connectedUsers.values()) : [],
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

router.get('/backup', isSuperAdmin, async (req, res) => {
    const backupDir = path.join(__dirname, '..', 'backups');
    let backups = [];
    if (fs.existsSync(backupDir)) {
        backups = fs.readdirSync(backupDir).filter(f => f.endsWith('.zip')).map(f => ({
            name: f, size: fs.statSync(path.join(backupDir, f)).size, date: fs.statSync(path.join(backupDir, f)).mtime
        })).sort((a, b) => b.date - a.date);
    }
    res.render('admin/backup', {
        pageTitle: 'النسخ الاحتياطي', backups,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

module.exports = router;
