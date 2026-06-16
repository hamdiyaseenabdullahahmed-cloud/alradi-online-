// =============================================
// متجر الرعدي أون لاين - alradi-online
// واجهة API العامة
// =============================================

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const User = require('../models/User');
const StoreSettings = require('../models/StoreSettings');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// =============================================
// API: معلومات المتجر العامة
// =============================================

router.get('/store-info', async (req, res) => {
    try {
        const settings = await StoreSettings.getSettings();
        
        res.json({
            success: true,
            store: {
                name: settings.storeName,
                nameEn: settings.storeNameEn,
                logo: settings.storeLogo,
                description: settings.storeDescription,
                currency: settings.currency,
                currencySymbol: settings.currencySymbol,
                contactEmail: settings.contactEmail,
                phone: settings.phoneNumber,
                whatsapp: settings.whatsappNumber,
                address: settings.address,
                socialMedia: settings.socialMedia,
                shippingInternal: settings.shippingInternal,
                shippingInternational: settings.shippingInternational,
                freeShippingMin: settings.freeShippingMin
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// API: المنتجات المميزة
// =============================================

router.get('/featured-products', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 8;
        
        const products = await Product.find({ 
            isActive: true, 
            isFeatured: true, 
            isHidden: false 
        })
        .limit(limit)
        .select('name nameEn price comparePrice images rating stockStatus slug sales');
        
        res.json({
            success: true,
            count: products.length,
            products: products.map(p => p.getPublicData())
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// API: المنتجات الجديدة
// =============================================

router.get('/new-arrivals', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 8;
        
        const products = await Product.find({ 
            isActive: true, 
            isNewArrival: true, 
            isHidden: false 
        })
        .sort('-createdAt')
        .limit(limit)
        .select('name nameEn price comparePrice images rating stockStatus slug');
        
        res.json({
            success: true,
            count: products.length,
            products: products.map(p => p.getPublicData())
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// API: الأكثر مبيعاً
// =============================================

router.get('/best-sellers', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 8;
        
        const products = await Product.find({ 
            isActive: true, 
            isHidden: false 
        })
        .sort('-sales')
        .limit(limit)
        .select('name nameEn price comparePrice images rating stockStatus slug sales');
        
        res.json({
            success: true,
            count: products.length,
            products: products.map(p => p.getPublicData())
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// API: الأقسام
// =============================================

router.get('/categories', async (req, res) => {
    try {
        const categories = await Category.getMainCategories();
        
        res.json({
            success: true,
            count: categories.length,
            categories
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// API: منتجات قسم معين
// =============================================

router.get('/category/:slug/products', async (req, res) => {
    try {
        const category = await Category.findBySlug(req.params.slug);
        
        if (!category) {
            return res.status(404).json({ success: false, message: 'القسم غير موجود' });
        }
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        
        const result = await category.getProducts({ page, limit });
        
        res.json({
            success: true,
            category: category.getPublicData(),
            products: result.products.map(p => p.getPublicData()),
            pagination: result.pagination
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// API: تفاصيل منتج
// =============================================

router.get('/product/:slug', async (req, res) => {
    try {
        const product = await Product.findOne({ 
            slug: req.params.slug,
            isActive: true,
            isHidden: false
        }).populate('category', 'name nameEn slug');
        
        if (!product) {
            return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
        }
        
        await product.addView();
        
        res.json({
            success: true,
            product: product.getPublicData()
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// API: البحث
// =============================================

router.get('/search', async (req, res) => {
    try {
        const query = req.query.q || '';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const sort = req.query.sort || 'relevance';
        
        if (!query.trim()) {
            return res.json({ success: true, products: [], pagination: { page: 1, total: 0, pages: 0 } });
        }
        
        const result = await Product.search(query, { page, limit, sort });
        
        res.json({
            success: true,
            query,
            products: result.products.map(p => p.getPublicData()),
            pagination: result.pagination
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// API: إنشاء طلب (للجوال)
// =============================================

router.post('/place-order', isAuthenticated, async (req, res) => {
    try {
        const { items, shippingAddress, shippingMethod, paymentMethod, notes, couponCode } = req.body;
        
        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'السلة فارغة' });
        }
        
        if (!shippingAddress || !shippingAddress.street || !shippingAddress.city) {
            return res.status(400).json({ success: false, message: 'عنوان الشحن مطلوب' });
        }
        
        const user = await User.findById(req.session.user._id);
        const storeSettings = await StoreSettings.getSettings();
        
        // تجهيز عناصر الطلب
        const orderItems = [];
        let subtotal = 0;
        
        for (const item of items) {
            const product = await Product.findById(item.productId);
            
            if (!product || !product.isAvailable(item.quantity)) {
                return res.status(400).json({ 
                    success: false, 
                    message: `المنتج "${product ? product.name : 'غير معروف'}" غير متوفر` 
                });
            }
            
            const price = product.getFinalPrice();
            const itemTotal = price * item.quantity;
            subtotal += itemTotal;
            
            orderItems.push({
                product: product._id,
                name: product.name,
                price,
                quantity: item.quantity,
                total: itemTotal,
                image: product.getMainImage()
            });
        }
        
        // حساب الشحن
        let shippingCost = 0;
        if (shippingMethod === 'international') {
            shippingCost = storeSettings.shippingInternational || 75;
        } else if (subtotal < (storeSettings.freeShippingMin || 300)) {
            shippingCost = storeSettings.shippingInternal || 25;
        }
        
        const totalAmount = subtotal + shippingCost;
        
        // إنشاء الطلب
        const order = new Order({
            orderNumber: await Order.generateOrderNumber(),
            user: user._id,
            customerName: user.name,
            customerEmail: user.email,
            customerPhone: user.phone || '',
            shippingAddress,
            items: orderItems,
            subtotal,
            shippingCost,
            totalAmount,
            shippingMethod: shippingMethod || 'internal',
            paymentMethod: paymentMethod || 'cash_on_delivery',
            notes: notes || '',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        await order.save();
        
        // تقليل المخزون
        for (const item of items) {
            await Product.findByIdAndUpdate(item.productId, {
                $inc: { stock: -item.quantity, sales: item.quantity }
            });
        }
        
        // تحديث المستخدم
        user.totalOrders += 1;
        user.totalSpent += totalAmount;
        user.lastOrderDate = new Date();
        
        if (storeSettings.enableLoyaltyProgram) {
            const points = Math.floor(totalAmount * (storeSettings.pointsPerRiyal || 1));
            user.loyaltyPoints += points;
            user.totalPointsEarned += points;
        }
        
        await user.save();
        
        res.json({
            success: true,
            message: 'تم إنشاء الطلب بنجاح',
            order: order.getSummary()
        });
        
    } catch (error) {
        console.error('خطأ في API إنشاء طلب:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في إنشاء الطلب' });
    }
});

// =============================================
// API: تتبع الطلب
// =============================================

router.get('/track-order/:orderNumber', async (req, res) => {
    try {
        const { orderNumber } = req.params;
        const email = req.query.email || '';
        
        const filter = { orderNumber };
        if (email) filter.customerEmail = email;
        
        const order = await Order.findOne(filter)
            .select('orderNumber status statusHistory shippingTrackingNumber estimatedDeliveryDate actualDeliveryDate totalAmount createdAt');
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
        }
        
        res.json({
            success: true,
            order: {
                orderNumber: order.orderNumber,
                status: order.status,
                statusHistory: order.statusHistory,
                trackingNumber: order.shippingTrackingNumber,
                estimatedDelivery: order.estimatedDeliveryDate,
                actualDelivery: order.actualDeliveryDate,
                totalAmount: order.totalAmount,
                createdAt: order.createdAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// API: طلبات المستخدم
// =============================================

router.get('/my-orders', isAuthenticated, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        const skip = (page - 1) * limit;
        
        const [orders, total] = await Promise.all([
            Order.find({ user: req.session.user._id })
                .sort('-createdAt')
                .skip(skip)
                .limit(limit)
                .select('orderNumber totalAmount status paymentStatus shippingMethod createdAt'),
            Order.countDocuments({ user: req.session.user._id })
        ]);
        
        res.json({
            success: true,
            orders,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// API: إحصائيات المدير
// =============================================

router.get('/admin/stats', isAdmin, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const [
            totalProducts,
            totalOrders,
            totalCustomers,
            todayOrders,
            monthRevenue,
            pendingOrders,
            lowStockProducts
        ] = await Promise.all([
            Product.countDocuments({ isActive: true, isHidden: false }),
            Order.countDocuments(),
            User.countDocuments({ role: 'customer', isActive: true }),
            Order.countDocuments({ createdAt: { $gte: today } }),
            Order.aggregate([
                { $match: { createdAt: { $gte: firstDayOfMonth }, status: { $ne: 'cancelled' } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.countDocuments({ status: 'pending' }),
            Product.countDocuments({ stock: { $lte: 5, $gt: 0 }, isActive: true })
        ]);
        
        res.json({
            success: true,
            stats: {
                totalProducts,
                totalOrders,
                totalCustomers,
                todayOrders,
                monthRevenue: monthRevenue.length > 0 ? monthRevenue[0].total : 0,
                pendingOrders,
                lowStockProducts
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// API: تحديث حالة الطلب (للمدير)
// =============================================

router.put('/admin/order/:id/status', isAdmin, async (req, res) => {
    try {
        const { status, note } = req.body;
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
        }
        
        await order.updateStatus(status, note, req.session.user._id);
        
        res.json({
            success: true,
            message: 'تم تحديث حالة الطلب',
            order: order.getSummary()
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// =============================================
// API: إرسال إشعار جماعي (للمدير)
// =============================================

router.post('/admin/send-notification', isAdmin, async (req, res) => {
    try {
        const { subject, message, targetRole } = req.body;
        
        if (!subject || !message) {
            return res.status(400).json({ success: false, message: 'الموضوع والرسالة مطلوبان' });
        }
        
        // جلب المستخدمين المستهدفين
        const filter = { isActive: true };
        if (targetRole) filter.role = targetRole;
        
        const users = await User.find(filter).select('email name');
        
        // TODO: إرسال الإشعارات فعلياً عبر البريد
        console.log(`📧 إرسال إشعار لـ ${users.length} مستخدم`);
        console.log(`الموضوع: ${subject}`);
        console.log(`الرسالة: ${message}`);
        
        res.json({
            success: true,
            message: `تم إرسال الإشعار إلى ${users.length} مستخدم`,
            recipientsCount: users.length
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// API: النسخ الاحتياطي اليدوي (للمدير العام)
// =============================================

router.post('/admin/manual-backup', isAdmin, async (req, res) => {
    try {
        if (req.session.user.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'صلاحيات غير كافية' });
        }
        
        const archiver = require('archiver');
        const fs = require('fs');
        const path = require('path');
        
        const backupDir = path.join(__dirname, '..', 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const backupFile = path.join(backupDir, `manual-backup-${timestamp}.zip`);
        
        const output = fs.createWriteStream(backupFile);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        archive.pipe(output);
        
        const mongoose = require('mongoose');
        const collections = await mongoose.connection.db.listCollections().toArray();
        
        for (const collection of collections) {
            const data = await mongoose.connection.db.collection(collection.name).find({}).toArray();
            archive.append(JSON.stringify(data, null, 2), { name: `${collection.name}.json` });
        }
        
        await archive.finalize();
        
        res.json({
            success: true,
            message: 'تم إنشاء النسخة الاحتياطية بنجاح',
            file: `manual-backup-${timestamp}.zip`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ في النسخ الاحتياطي' });
    }
});

// =============================================
// API: Webhook للمدفوعات (للتكامل المستقبلي)
// =============================================

router.post('/webhook/payment', async (req, res) => {
    try {
        const { orderNumber, transactionId, status, amount, gateway } = req.body;
        
        // التحقق من التوقيع (يضاف لاحقاً)
        
        const order = await Order.findOne({ orderNumber });
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
        }
        
        if (status === 'paid') {
            await order.updatePaymentStatus('paid', {
                transactionId,
                gateway,
                amount
            });
        } else if (status === 'failed') {
            await order.updatePaymentStatus('failed');
        }
        
        res.json({ success: true, message: 'تم تحديث حالة الدفع' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// API: التحقق من صحة الكوبون
// =============================================

router.post('/validate-coupon', async (req, res) => {
    try {
        const { code, subtotal } = req.body;
        
        const validCoupons = {
            'WELCOME15': { type: 'percentage', value: 15, minOrder: 100, maxDiscount: 200 },
            'RADI50': { type: 'fixed', value: 50, minOrder: 300 },
            'FREESHIP': { type: 'free_shipping', minOrder: 0 },
            'VIP20': { type: 'percentage', value: 20, minOrder: 200, maxDiscount: 500 }
        };
        
        const coupon = validCoupons[code.toUpperCase()];
        
        if (!coupon) {
            return res.json({ success: false, message: 'كود الكوبون غير صالح' });
        }
        
        if (subtotal < (coupon.minOrder || 0)) {
            return res.json({ 
                success: false, 
                message: `الحد الأدنى للطلب هو ${coupon.minOrder} ر.س` 
            });
        }
        
        let discount = 0;
        if (coupon.type === 'percentage') {
            discount = subtotal * (coupon.value / 100);
            if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
        } else if (coupon.type === 'fixed') {
            discount = coupon.value;
        }
        
        res.json({
            success: true,
            coupon: {
                code: code.toUpperCase(),
                type: coupon.type,
                discount: Math.round(discount * 100) / 100
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

module.exports = router;
