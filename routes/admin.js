// =============================================
// متجر الرعدي أون لاين - alradi-online
// مسارات لوحة تحكم المدير
// =============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAdmin, isSuperAdmin, logAdminActivity } = require('../middleware/auth');
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
// إعدادات رفع الملفات
// =============================================

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        let uploadPath = 'public/uploads/';
        
        if (file.fieldname === 'logo' || file.fieldname === 'favicon') {
            uploadPath += 'logos/';
        } else if (file.fieldname === 'profileImage') {
            uploadPath += 'profiles/';
        } else if (file.fieldname === 'audio') {
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
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    },
    fileFilter: function(req, file, cb) {
        const imageTypes = /jpeg|jpg|png|gif|webp|svg/;
        const audioTypes = /mp3|wav|ogg|m4a/;
        
        const extname = path.extname(file.originalname).toLowerCase();
        
        if (file.fieldname === 'audio') {
            const isValidAudio = audioTypes.test(extname);
            if (isValidAudio) return cb(null, true);
            return cb(new Error('ملفات الصوت المسموحة: mp3, wav, ogg, m4a'));
        } else {
            const isValidImage = imageTypes.test(extname);
            if (isValidImage) return cb(null, true);
            return cb(new Error('ملفات الصور المسموحة: jpeg, jpg, png, gif, webp, svg'));
        }
    }
});

// =============================================
// تطبيق middleware على جميع المسارات
// =============================================

router.use(isAdmin);

// =============================================
// الصفحة الرئيسية للوحة التحكم - لوحة المعلومات
// =============================================

router.get('/dashboard', async (req, res) => {
    try {
        // إحصائيات عامة
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
        
        // تنفيذ جميع الاستعلامات بالتوازي
        const [
            totalUsers,
            totalProducts,
            totalOrders,
            totalRevenue,
            todayOrders,
            todayRevenue,
            monthRevenue,
            yearRevenue,
            lowStockProducts,
            recentOrders,
            recentUsers,
            orderStats,
            topProducts,
            latestMessages
        ] = await Promise.all([
            User.countDocuments({ role: 'customer', isActive: true }),
            Product.countDocuments({ isActive: true, isHidden: false }),
            Order.countDocuments(),
            Order.aggregate([
                { $match: { status: { $ne: 'cancelled' } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.countDocuments({ createdAt: { $gte: today } }),
            Order.aggregate([
                { $match: { createdAt: { $gte: today }, status: { $ne: 'cancelled' } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: firstDayOfMonth }, status: { $ne: 'cancelled' } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: firstDayOfYear }, status: { $ne: 'cancelled' } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Product.countDocuments({ stock: { $lte: 5, $gt: 0 }, isActive: true, isUnlimited: false }),
            Order.find().sort('-createdAt').limit(5).populate('user', 'name email'),
            User.find({ role: 'customer' }).sort('-createdAt').limit(5).select('name email createdAt'),
            Order.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Product.find({ isActive: true }).sort('-sales').limit(10).select('name sales price images'),
            Message.find({ isDeleted: false }).sort('-createdAt').limit(5)
        ]);
        
        // تجهيز البيانات للعرض
        const stats = {
            totalUsers,
            totalProducts,
            totalOrders,
            totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
            todayOrders,
            todayRevenue: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
            monthRevenue: monthRevenue.length > 0 ? monthRevenue[0].total : 0,
            yearRevenue: yearRevenue.length > 0 ? yearRevenue[0].total : 0,
            lowStockProducts
        };
        
        res.render('admin/dashboard', {
            pageTitle: 'لوحة التحكم',
            activeMenu: 'dashboard',
            stats,
            recentOrders,
            recentUsers,
            orderStats,
            topProducts,
            latestMessages,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
        
    } catch (error) {
        console.error('خطأ في تحميل لوحة التحكم:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل البيانات');
        res.redirect('/');
    }
});

// =============================================
// إدارة المنتجات - عرض الكل
// =============================================

router.get('/products', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const category = req.query.category || '';
        const status = req.query.status || '';
        const sort = req.query.sort || '-createdAt';
        
        const filter = {};
        
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { nameEn: { $regex: search, $options: 'i' } },
                { sku: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (category) filter.category = category;
        
        if (status === 'active') filter.isActive = true;
        if (status === 'inactive') filter.isActive = false;
        if (status === 'low_stock') {
            filter.stock = { $lte: 5, $gt: 0 };
            filter.isUnlimited = false;
        }
        if (status === 'out_of_stock') filter.stockStatus = 'out_of_stock';
        
        const skip = (page - 1) * limit;
        
        const [products, total, categories] = await Promise.all([
            Product.find(filter).sort(sort).skip(skip).limit(limit).populate('category', 'name'),
            Product.countDocuments(filter),
            Category.find({ isActive: true }).select('name')
        ]);
        
        res.render('admin/products', {
            pageTitle: 'إدارة المنتجات',
            activeMenu: 'products',
            products,
            categories,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            search,
            category,
            status,
            sort,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
        
    } catch (error) {
        console.error('خطأ في تحميل المنتجات:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل المنتجات');
        res.redirect('/admin/dashboard');
    }
});

// =============================================
// إضافة منتج جديد - الصفحة
// =============================================

router.get('/products/add', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).select('name');
        
        res.render('admin/product-form', {
            pageTitle: 'إضافة منتج جديد',
            activeMenu: 'products',
            product: null,
            categories,
            isEdit: false,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في صفحة إضافة منتج:', error);
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('/admin/products');
    }
});

// =============================================
// إضافة منتج جديد - المعالجة
// =============================================

router.post('/products/add', upload.array('images', 10), async (req, res) => {
    try {
        const {
            name, nameEn, description, descriptionEn,
            category, brand, price, comparePrice, cost,
            stock, sku, isUnlimited, isFeatured, isNewArrival,
            discountType, discountValue
        } = req.body;
        
        // تجهيز الصور
        const images = [];
        if (req.files && req.files.length > 0) {
            req.files.forEach((file, index) => {
                images.push({
                    url: '/' + file.path.replace(/\\/g, '/').replace('public/', ''),
                    alt: name || 'صورة المنتج',
                    isMain: index === 0,
                    order: index
                });
            });
        }
        
        // إذا تم إدخال روابط صور خارجية
        if (req.body.imageUrls) {
            const urls = req.body.imageUrls.split('\n').filter(url => url.trim());
            urls.forEach((url, index) => {
                images.push({
                    url: url.trim(),
                    alt: name || 'صورة المنتج',
                    isMain: images.length === 0 && index === 0,
                    order: images.length + index
                });
            });
        }
        
        // تجهيز الخيارات (ألوان، مقاسات)
        const options = [];
        if (req.body.optionNames) {
            const optionNames = Array.isArray(req.body.optionNames) ? req.body.optionNames : [req.body.optionNames];
            for (const optName of optionNames) {
                const values = [];
                const valueKeys = Object.keys(req.body).filter(k => k.startsWith(`optionValue_${optName}_`));
                for (const key of valueKeys) {
                    const index = key.split('_').pop();
                    values.push({
                        value: req.body[key],
                        additionalPrice: parseFloat(req.body[`optionPrice_${optName}_${index}`]) || 0,
                        stock: parseInt(req.body[`optionStock_${optName}_${index}`]) || 0
                    });
                }
                options.push({
                    name: optName,
                    type: 'custom',
                    values
                });
            }
        }
        
        // تجهيز الخصم
        const discount = {
            type: discountType || 'none',
            value: parseFloat(discountValue) || 0,
            isActive: discountType && discountType !== 'none' && parseFloat(discountValue) > 0
        };
        
        const product = new Product({
            name,
            nameEn: nameEn || '',
            description,
            descriptionEn: descriptionEn || '',
            category,
            brand: brand || '',
            price: parseFloat(price) || 0,
            comparePrice: parseFloat(comparePrice) || null,
            cost: parseFloat(cost) || 0,
            stock: parseInt(stock) || 0,
            sku: sku || '',
            isUnlimited: isUnlimited === 'on',
            isFeatured: isFeatured === 'on',
            isNewArrival: isNewArrival === 'on',
            images,
            options,
            discount
        });
        
        await product.save();
        
        // تحديث عدد منتجات القسم
        const categoryDoc = await Category.findById(category);
        if (categoryDoc) {
            await categoryDoc.updateProductCount();
        }
        
        req.flash('success_msg', 'تم إضافة المنتج بنجاح');
        res.redirect('/admin/products');
        
    } catch (error) {
        console.error('خطأ في إضافة المنتج:', error);
        req.flash('error_msg', 'حدث خطأ في إضافة المنتج: ' + error.message);
        res.redirect('/admin/products/add');
    }
});

// =============================================
// تعديل منتج - الصفحة
// =============================================

router.get('/products/edit/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            req.flash('error_msg', 'المنتج غير موجود');
            return res.redirect('/admin/products');
        }
        
        const categories = await Category.find({ isActive: true }).select('name');
        
        res.render('admin/product-form', {
            pageTitle: 'تعديل المنتج: ' + product.name,
            activeMenu: 'products',
            product,
            categories,
            isEdit: true,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في صفحة تعديل المنتج:', error);
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('/admin/products');
    }
});

// =============================================
// تعديل منتج - المعالجة
// =============================================

router.post('/products/edit/:id', upload.array('images', 10), async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            req.flash('error_msg', 'المنتج غير موجود');
            return res.redirect('/admin/products');
        }
        
        // تحديث الحقول الأساسية
        product.name = req.body.name;
        product.nameEn = req.body.nameEn || '';
        product.description = req.body.description;
        product.descriptionEn = req.body.descriptionEn || '';
        product.category = req.body.category;
        product.brand = req.body.brand || '';
        product.price = parseFloat(req.body.price) || 0;
        product.comparePrice = parseFloat(req.body.comparePrice) || null;
        product.cost = parseFloat(req.body.cost) || 0;
        product.stock = parseInt(req.body.stock) || 0;
        product.sku = req.body.sku || '';
        product.isUnlimited = req.body.isUnlimited === 'on';
        product.isFeatured = req.body.isFeatured === 'on';
        product.isNewArrival = req.body.isNewArrival === 'on';
        product.isActive = req.body.isActive === 'on';
        
        // تحديث الصور إذا تم رفع صور جديدة
        if (req.files && req.files.length > 0) {
            product.images = req.files.map((file, index) => ({
                url: '/' + file.path.replace(/\\/g, '/').replace('public/', ''),
                alt: req.body.name || 'صورة المنتج',
                isMain: index === 0,
                order: index
            }));
        }
        
        // تحديث الخصم
        product.discount = {
            type: req.body.discountType || 'none',
            value: parseFloat(req.body.discountValue) || 0,
            isActive: req.body.discountType && req.body.discountType !== 'none' && parseFloat(req.body.discountValue) > 0
        };
        
        await product.save();
        
        req.flash('success_msg', 'تم تحديث المنتج بنجاح');
        res.redirect('/admin/products');
        
    } catch (error) {
        console.error('خطأ في تحديث المنتج:', error);
        req.flash('error_msg', 'حدث خطأ في تحديث المنتج');
        res.redirect('/admin/products/edit/' + req.params.id);
    }
});

// =============================================
// حذف منتج
// =============================================

router.delete('/products/delete/:id', async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        
        if (product) {
            // تحديث عدد منتجات القسم
            const category = await Category.findById(product.category);
            if (category) {
                await category.updateProductCount();
            }
            
            res.json({ success: true, message: 'تم حذف المنتج بنجاح' });
        } else {
            res.status(404).json({ success: false, message: 'المنتج غير موجود' });
        }
    } catch (error) {
        console.error('خطأ في حذف المنتج:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في حذف المنتج' });
    }
});

// =============================================
// إدارة الأقسام
// =============================================

router.get('/categories', async (req, res) => {
    try {
        const categories = await Category.find().sort('order').populate('parent', 'name');
        
        res.render('admin/categories', {
            pageTitle: 'إدارة الأقسام',
            activeMenu: 'categories',
            categories,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في تحميل الأقسام:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل الأقسام');
        res.redirect('/admin/dashboard');
    }
});

// =============================================
// إضافة قسم جديد
// =============================================

router.post('/categories/add', upload.single('image'), async (req, res) => {
    try {
        const category = new Category({
            name: req.body.name,
            nameEn: req.body.nameEn || '',
            description: req.body.description || '',
            parent: req.body.parent || null,
            order: parseInt(req.body.order) || 0,
            isActive: req.body.isActive === 'on',
            isFeatured: req.body.isFeatured === 'on',
            showInMenu: req.body.showInMenu === 'on',
            icon: req.body.icon || 'fa-folder'
        });
        
        if (req.file) {
            category.image = '/' + req.file.path.replace(/\\/g, '/').replace('public/', '');
        }
        
        await category.save();
        
        req.flash('success_msg', 'تم إضافة القسم بنجاح');
        res.redirect('/admin/categories');
        
    } catch (error) {
        console.error('خطأ في إضافة القسم:', error);
        req.flash('error_msg', 'حدث خطأ في إضافة القسم');
        res.redirect('/admin/categories');
    }
});

// =============================================
// تعديل قسم
// =============================================

router.post('/categories/edit/:id', upload.single('image'), async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            req.flash('error_msg', 'القسم غير موجود');
            return res.redirect('/admin/categories');
        }
        
        category.name = req.body.name;
        category.nameEn = req.body.nameEn || '';
        category.description = req.body.description || '';
        category.parent = req.body.parent || null;
        category.order = parseInt(req.body.order) || 0;
        category.isActive = req.body.isActive === 'on';
        category.isFeatured = req.body.isFeatured === 'on';
        category.showInMenu = req.body.showInMenu === 'on';
        category.icon = req.body.icon || 'fa-folder';
        
        if (req.file) {
            category.image = '/' + req.file.path.replace(/\\/g, '/').replace('public/', '');
        }
        
        await category.save();
        
        req.flash('success_msg', 'تم تحديث القسم بنجاح');
        res.redirect('/admin/categories');
        
    } catch (error) {
        console.error('خطأ في تحديث القسم:', error);
        req.flash('error_msg', 'حدث خطأ في تحديث القسم');
        res.redirect('/admin/categories');
    }
});

// =============================================
// حذف قسم
// =============================================

router.delete('/categories/delete/:id', async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'تم حذف القسم بنجاح' });
    } catch (error) {
        console.error('خطأ في حذف القسم:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في حذف القسم' });
    }
});

// =============================================
// إدارة الطلبات
// =============================================

router.get('/orders', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status || '';
        const search = req.query.search || '';
        const sort = req.query.sort || '-createdAt';
        
        const filter = {};
        if (status) filter.status = status;
        if (search) {
            filter.$or = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { customerEmail: { $regex: search, $options: 'i' } }
            ];
        }
        
        const skip = (page - 1) * limit;
        
        const [orders, total] = await Promise.all([
            Order.find(filter).sort(sort).skip(skip).limit(limit).populate('user', 'name email'),
            Order.countDocuments(filter)
        ]);
        
        res.render('admin/orders', {
            pageTitle: 'إدارة الطلبات',
            activeMenu: 'orders',
            orders,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            status,
            search,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
        
    } catch (error) {
        console.error('خطأ في تحميل الطلبات:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل الطلبات');
        res.redirect('/admin/dashboard');
    }
});

// =============================================
// عرض تفاصيل طلب
// =============================================

router.get('/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate('items.product', 'name images');
        
        if (!order) {
            req.flash('error_msg', 'الطلب غير موجود');
            return res.redirect('/admin/orders');
        }
        
        res.render('admin/order-detail', {
            pageTitle: 'تفاصيل الطلب: ' + order.orderNumber,
            activeMenu: 'orders',
            order,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في عرض تفاصيل الطلب:', error);
        req.flash('error_msg', 'حدث خطأ في عرض الطلب');
        res.redirect('/admin/orders');
    }
});

// =============================================
// تحديث حالة الطلب
// =============================================

router.post('/orders/update-status/:id', async (req, res) => {
    try {
        const { status, note } = req.body;
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.json({ success: false, message: 'الطلب غير موجود' });
        }
        
        await order.updateStatus(status, note, req.user._id);
        
        res.json({ success: true, message: 'تم تحديث حالة الطلب بنجاح' });
    } catch (error) {
        console.error('خطأ في تحديث حالة الطلب:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// إدارة العملاء
// =============================================

router.get('/customers', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const sort = req.query.sort || '-createdAt';
        
        const filter = { role: 'customer' };
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } }
            ];
        }
        
        const skip = (page - 1) * limit;
        
        const [customers, total] = await Promise.all([
            User.find(filter).sort(sort).skip(skip).limit(limit).select('-password'),
            User.countDocuments(filter)
        ]);
        
        res.render('admin/customers', {
            pageTitle: 'إدارة العملاء',
            activeMenu: 'customers',
            customers,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            search,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في تحميل العملاء:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل العملاء');
        res.redirect('/admin/dashboard');
    }
});

// =============================================
// عرض تفاصيل عميل
// =============================================

router.get('/customers/:id', async (req, res) => {
    try {
        const customer = await User.findById(req.params.id).select('-password');
        
        if (!customer) {
            req.flash('error_msg', 'العميل غير موجود');
            return res.redirect('/admin/customers');
        }
        
        const orders = await Order.find({ user: customer._id }).sort('-createdAt');
        
        res.render('admin/customer-detail', {
            pageTitle: 'تفاصيل العميل: ' + customer.name,
            activeMenu: 'customers',
            customer,
            orders,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في عرض تفاصيل العميل:', error);
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('/admin/customers');
    }
});

// =============================================
// إعدادات المتجر
// =============================================

router.get('/settings', async (req, res) => {
    try {
        const settings = await StoreSettings.getSettings();
        
        res.render('admin/settings', {
            pageTitle: 'إعدادات المتجر',
            activeMenu: 'settings',
            settings,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في تحميل الإعدادات:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل الإعدادات');
        res.redirect('/admin/dashboard');
    }
});

// =============================================
// تحديث إعدادات المتجر
// =============================================

router.post('/settings', upload.fields([
    { name: 'storeLogo', maxCount: 1 },
    { name: 'storeFavicon', maxCount: 1 },
    { name: 'voiceGreetingFile', maxCount: 1 },
    { name: 'voiceAddToCartFile', maxCount: 1 },
    { name: 'voiceSaveFile', maxCount: 1 },
    { name: 'voicePrintFile', maxCount: 1 },
    { name: 'voiceSortFile', maxCount: 1 }
]), async (req, res) => {
    try {
        const updateData = { ...req.body };
        
        // تحديث مسارات الملفات المرفوعة
        if (req.files) {
            if (req.files.storeLogo) {
                updateData.storeLogo = '/' + req.files.storeLogo[0].path.replace(/\\/g, '/').replace('public/', '');
            }
            if (req.files.storeFavicon) {
                updateData.storeFavicon = '/' + req.files.storeFavicon[0].path.replace(/\\/g, '/').replace('public/', '');
            }
            // تحديث ملفات الصوت
            const audioFields = ['voiceGreetingFile', 'voiceAddToCartFile', 'voiceSaveFile', 'voicePrintFile', 'voiceSortFile'];
            audioFields.forEach(field => {
                if (req.files[field]) {
                    updateData[field] = '/' + req.files[field][0].path.replace(/\\/g, '/').replace('public/', '');
                }
            });
        }
        
        // تحويل القيم المنطقية
        const booleanFields = [
            'enableInternationalShipping', 'voiceGreetingEnabled', 'voiceInteractionsEnabled',
            'showHeroSlider', 'showFeaturedProducts', 'showNewArrivals', 'showBestSellers',
            'showPromoBanner', 'enableOTP', 'enableEmailNotifications', 'enableSMSNotifications',
            'enableWhatsAppNotifications', 'orderConfirmationEmail', 'shippingUpdateEmail',
            'lowStockAlert', 'enableLoyaltyProgram', 'maintenanceMode', 'enableWishlist',
            'enableProductComparison', 'enableReviews', 'reviewsAutoApprove', 'enableGuestCheckout'
        ];
        
        booleanFields.forEach(field => {
            updateData[field] = req.body[field] === 'on' || req.body[field] === 'true';
        });
        
        await StoreSettings.updateSettings(updateData);
        
        req.flash('success_msg', 'تم تحديث إعدادات المتجر بنجاح');
        res.redirect('/admin/settings');
        
    } catch (error) {
        console.error('خطأ في تحديث الإعدادات:', error);
        req.flash('error_msg', 'حدث خطأ في تحديث الإعدادات');
        res.redirect('/admin/settings');
    }
});

// =============================================
// المحادثات
// =============================================

router.get('/chat', async (req, res) => {
    try {
        const conversations = await Message.getConversationsList(req.user._id.toString(), 'admin');
        const connectedUsers = req.app.get('connectedUsers');
        
        res.render('admin/chat', {
            pageTitle: 'مركز المحادثات',
            activeMenu: 'chat',
            conversations,
            connectedUsers: connectedUsers ? Array.from(connectedUsers.values()) : [],
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في تحميل المحادثات:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل المحادثات');
        res.redirect('/admin/dashboard');
    }
});

// =============================================
// سجل النشاطات الأمني
// =============================================

router.get('/activity-log', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 50;
        
        const errors = await ErrorLog.find()
            .sort('-createdAt')
            .skip((page - 1) * limit)
            .limit(limit);
        
        const total = await ErrorLog.countDocuments();
        
        res.render('admin/activity-log', {
            pageTitle: 'سجل النشاطات',
            activeMenu: 'activity-log',
            errors,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في تحميل سجل النشاطات:', error);
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('/admin/dashboard');
    }
});

// =============================================
// التقارير
// =============================================

router.get('/reports', async (req, res) => {
    try {
        const type = req.query.type || 'sales';
        const period = req.query.period || 'month';
        
        let startDate, endDate;
        const now = new Date();
        
        if (period === 'today') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = now;
        } else if (period === 'week') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
            endDate = now;
        } else if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
        } else if (period === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = now;
        } else if (period === 'custom' && req.query.startDate && req.query.endDate) {
            startDate = new Date(req.query.startDate);
            endDate = new Date(req.query.endDate);
        }
        
        let reportData = {};
        
        if (type === 'sales') {
            reportData = await Order.getStats(startDate, endDate);
        } else if (type === 'products') {
            reportData.topProducts = await Product.find({ isActive: true })
                .sort('-sales')
                .limit(20)
                .select('name sales revenue price');
        } else if (type === 'customers') {
            reportData.topCustomers = await User.find({ role: 'customer' })
                .sort('-totalSpent')
                .limit(20)
                .select('name totalSpent totalOrders email');
        }
        
        res.render('admin/reports', {
            pageTitle: 'التقارير',
            activeMenu: 'reports',
            type,
            period,
            startDate,
            endDate,
            reportData,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في تحميل التقارير:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل التقارير');
        res.redirect('/admin/dashboard');
    }
});

// =============================================
// تصدير التقرير PDF
// =============================================

router.get('/reports/export-pdf', async (req, res) => {
    try {
        const type = req.query.type || 'sales';
        
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=report-${type}-${Date.now()}.pdf`);
        
        doc.pipe(res);
        
        // ترويسة التقرير
        doc.fontSize(20).text('متجر الرعدي أون لاين', { align: 'center' });
        doc.fontSize(14).text(`تقرير ${type === 'sales' ? 'المبيعات' : type === 'products' ? 'المنتجات' : 'العملاء'}`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}`, { align: 'left' });
        doc.moveDown();
        
        // محتوى التقرير حسب النوع
        if (type === 'sales') {
            const stats = await Order.getStats();
            doc.fontSize(12).text(`إجمالي الطلبات: ${stats.totalOrders}`);
            doc.text(`إجمالي الإيرادات: ${stats.totalRevenue} ر.س`);
            doc.text(`متوسط قيمة الطلب: ${stats.averageOrderValue} ر.س`);
        } else if (type === 'products') {
            const products = await Product.find({ isActive: true }).sort('-sales').limit(20);
            products.forEach((product, index) => {
                doc.text(`${index + 1}. ${product.name} - ${product.sales} مبيعات - ${product.revenue} ر.س`);
            });
        }
        
        doc.end();
        
    } catch (error) {
        console.error('خطأ في تصدير PDF:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في تصدير التقرير' });
    }
});

// =============================================
// تصدير التقرير Excel
// =============================================

router.get('/reports/export-excel', async (req, res) => {
    try {
        const type = req.query.type || 'sales';
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('التقرير');
        
        worksheet.columns = [
            { header: 'الرقم', key: 'id', width: 10 },
            { header: 'الاسم', key: 'name', width: 30 },
            { header: 'القيمة', key: 'value', width: 20 }
        ];
        
        // إضافة البيانات حسب النوع
        if (type === 'products') {
            const products = await Product.find({ isActive: true }).sort('-sales').limit(50);
            products.forEach((product, index) => {
                worksheet.addRow({
                    id: index + 1,
                    name: product.name,
                    value: product.sales
                });
            });
        }
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=report-${type}-${Date.now()}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('خطأ في تصدير Excel:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في تصدير التقرير' });
    }
});

// =============================================
// النسخ الاحتياطي
// =============================================

router.get('/backup', isSuperAdmin, async (req, res) => {
    try {
        const backupDir = path.join(__dirname, '..', 'backups');
        let backups = [];
        
        if (fs.existsSync(backupDir)) {
            backups = fs.readdirSync(backupDir)
                .filter(file => file.endsWith('.zip'))
                .map(file => ({
                    name: file,
                    size: fs.statSync(path.join(backupDir, file)).size,
                    date: fs.statSync(path.join(backupDir, file)).mtime
                }))
                .sort((a, b) => b.date - a.date);
        }
        
        res.render('admin/backup', {
            pageTitle: 'النسخ الاحتياطي',
            activeMenu: 'backup',
            backups,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في صفحة النسخ الاحتياطي:', error);
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('/admin/dashboard');
    }
});

module.exports = router;
