// =============================================
// متجر الرعدي أون لاين - alradi-online
// مسارات سلة التسوق والدفع
// =============================================

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const StoreSettings = require('../models/StoreSettings');
const { isAuthenticated } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

// =============================================
// تهيئة السلة
// =============================================

const initCart = (req) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }
    return req.session.cart;
};

// =============================================
// حساب إجماليات السلة
// =============================================

const calculateCartTotals = (cart) => {
    let subtotal = 0;
    let totalItems = 0;
    
    cart.forEach(item => {
        const price = item.finalPrice || item.price;
        subtotal += price * item.quantity;
        totalItems += item.quantity;
    });
    
    return { subtotal, totalItems };
};

// =============================================
// إضافة للسلة عبر GET مع redirect للسلة (جديد)
// =============================================

router.get('/add', async (req, res) => {
    try {
        const productId = req.query.productId;
        const quantity = parseInt(req.query.quantity) || 1;
        
        if (!productId) {
            req.flash('error_msg', 'المنتج غير محدد');
            return res.redirect('/products');
        }
        
        const product = await Product.findById(productId);
        
        if (!product || !product.isActive || product.isHidden) {
            req.flash('error_msg', 'المنتج غير متوفر');
            return res.redirect('/products');
        }
        
        if (!product.isAvailable(quantity)) {
            req.flash('error_msg', product.stockStatus === 'out_of_stock' ? 'نفد المنتج من المخزون' : 'الكمية المطلوبة غير متوفرة');
            return res.redirect('/products');
        }
        
        const cart = initCart(req);
        const qty = parseInt(quantity);
        
        const existingIndex = cart.findIndex(item => item.productId === productId && item.optionsKey === '{}');
        
        if (existingIndex > -1) {
            const newQuantity = cart[existingIndex].quantity + qty;
            
            if (newQuantity > product.maxOrderQuantity) {
                req.flash('error_msg', `الحد الأقصى للطلب هو ${product.maxOrderQuantity} قطع`);
                return res.redirect('/products');
            }
            
            if (!product.isUnlimited && newQuantity > product.stock) {
                req.flash('error_msg', 'الكمية المطلوبة غير متوفرة في المخزون');
                return res.redirect('/products');
            }
            
            cart[existingIndex].quantity = newQuantity;
        } else {
            cart.push({
                productId: product._id.toString(),
                name: product.name,
                image: product.getMainImage(),
                price: product.price,
                finalPrice: product.getFinalPrice(),
                quantity: qty,
                options: {},
                optionsKey: '{}',
                maxOrderQuantity: product.maxOrderQuantity,
                isUnlimited: product.isUnlimited,
                slug: product.slug
            });
        }
        
        await product.addToCart();
        req.session.cart = cart;
        await req.session.save();
        
        req.flash('success_msg', 'تمت إضافة المنتج إلى السلة بنجاح');
        return res.redirect('/cart');
        
    } catch (error) {
        console.error('خطأ في إضافة المنتج للسلة:', error);
        req.flash('error_msg', 'حدث خطأ في إضافة المنتج');
        res.redirect('/products');
    }
});

// =============================================
// صفحة السلة
// =============================================

router.get('/', async (req, res) => {
    try {
        const cart = initCart(req);
        const storeSettings = await StoreSettings.getSettings();
        
        // تحديث بيانات المنتجات في السلة
        for (let item of cart) {
            const product = await Product.findById(item.productId);
            if (product) {
                item.name = product.name;
                item.image = product.getMainImage();
                item.price = product.price;
                item.finalPrice = product.getFinalPrice();
                item.stock = product.stock;
                item.isUnlimited = product.isUnlimited;
                item.isAvailable = product.isAvailable(item.quantity);
                item.slug = product.slug;
                item.maxOrderQuantity = product.maxOrderQuantity;
            }
        }
        
        await req.session.save();
        
        const { subtotal, totalItems } = calculateCartTotals(cart);
        
        // حساب الشحن
        let shippingCost = 0;
        const freeShippingMin = storeSettings.freeShippingMin || 300;
        
        if (subtotal < freeShippingMin && totalItems > 0) {
            shippingCost = storeSettings.shippingInternal || 25;
        }
        
        const total = subtotal + shippingCost;
        
        res.render('cart/index', {
            pageTitle: 'سلة التسوق',
            cart,
            subtotal,
            shippingCost,
            freeShippingMin,
            total,
            totalItems,
            coupon: req.session.coupon || null,
            currency: storeSettings.currency || 'SAR',
            storeSettings,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
        
    } catch (error) {
        console.error('خطأ في صفحة السلة:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل السلة');
        res.redirect('/');
    }
});

// =============================================
// إضافة منتج إلى السلة (POST - API)
// =============================================

router.post('/add', async (req, res) => {
    try {
        const { productId, quantity = 1, options = {} } = req.body;
        
        if (!productId) {
            return res.json({ success: false, message: 'المنتج غير محدد' });
        }
        
        const product = await Product.findById(productId);
        
        if (!product || !product.isActive || product.isHidden) {
            return res.json({ success: false, message: 'المنتج غير متوفر' });
        }
        
        if (!product.isAvailable(parseInt(quantity))) {
            return res.json({ 
                success: false, 
                message: product.stockStatus === 'out_of_stock' ? 'نفد المنتج من المخزون' : 'الكمية المطلوبة غير متوفرة'
            });
        }
        
        const cart = initCart(req);
        const qty = parseInt(quantity);
        
        const optionsKey = JSON.stringify(options);
        
        const existingIndex = cart.findIndex(item => 
            item.productId === productId && item.optionsKey === optionsKey
        );
        
        if (existingIndex > -1) {
            const newQuantity = cart[existingIndex].quantity + qty;
            
            if (newQuantity > product.maxOrderQuantity) {
                return res.json({ 
                    success: false, 
                    message: `الحد الأقصى للطلب هو ${product.maxOrderQuantity} قطع`
                });
            }
            
            if (!product.isUnlimited && newQuantity > product.stock) {
                return res.json({ 
                    success: false, 
                    message: 'الكمية المطلوبة غير متوفرة في المخزون'
                });
            }
            
            cart[existingIndex].quantity = newQuantity;
        } else {
            cart.push({
                productId: product._id.toString(),
                name: product.name,
                image: product.getMainImage(),
                price: product.price,
                finalPrice: product.getFinalPrice(),
                quantity: qty,
                options: options,
                optionsKey: optionsKey,
                maxOrderQuantity: product.maxOrderQuantity,
                isUnlimited: product.isUnlimited,
                slug: product.slug
            });
        }
        
        await product.addToCart();
        req.session.cart = cart;
        await req.session.save();
        
        const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        
        res.json({
            success: true,
            message: 'تمت إضافة المنتج إلى السلة',
            cartCount,
            cart
        });
        
    } catch (error) {
        console.error('خطأ في إضافة المنتج للسلة:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في إضافة المنتج' });
    }
});

// =============================================
// تحديث كمية منتج في السلة
// =============================================

router.post('/update', async (req, res) => {
    try {
        const { productId, quantity, optionsKey = '{}' } = req.body;
        const cart = initCart(req);
        
        const itemIndex = cart.findIndex(item => 
            item.productId === productId && item.optionsKey === optionsKey
        );
        
        if (itemIndex === -1) {
            return res.json({ success: false, message: 'المنتج غير موجود في السلة' });
        }
        
        const newQuantity = parseInt(quantity);
        
        if (newQuantity < 1) {
            cart.splice(itemIndex, 1);
        } else {
            const product = await Product.findById(productId);
            
            if (product && !product.isUnlimited && newQuantity > product.stock) {
                return res.json({ 
                    success: false, 
                    message: 'الكمية المطلوبة غير متوفرة'
                });
            }
            
            if (product && newQuantity > product.maxOrderQuantity) {
                return res.json({ 
                    success: false, 
                    message: `الحد الأقصى هو ${product.maxOrderQuantity}`
                });
            }
            
            cart[itemIndex].quantity = newQuantity;
        }
        
        req.session.cart = cart;
        await req.session.save();
        
        const { subtotal, totalItems } = calculateCartTotals(cart);
        const storeSettings = await StoreSettings.getSettings();
        const freeShippingMin = storeSettings.freeShippingMin || 300;
        let shippingCost = subtotal < freeShippingMin && totalItems > 0 ? (storeSettings.shippingInternal || 25) : 0;
        
        res.json({
            success: true,
            cart,
            subtotal,
            shippingCost,
            total: subtotal + shippingCost,
            totalItems,
            cartCount: totalItems
        });
        
    } catch (error) {
        console.error('خطأ في تحديث السلة:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// إزالة منتج من السلة
// =============================================

router.post('/remove', async (req, res) => {
    try {
        const { productId, optionsKey = '{}' } = req.body;
        const cart = initCart(req);
        
        const itemIndex = cart.findIndex(item => 
            item.productId === productId && item.optionsKey === optionsKey
        );
        
        if (itemIndex > -1) {
            cart.splice(itemIndex, 1);
        }
        
        req.session.cart = cart;
        await req.session.save();
        
        const { subtotal, totalItems } = calculateCartTotals(cart);
        const storeSettings = await StoreSettings.getSettings();
        const freeShippingMin = storeSettings.freeShippingMin || 300;
        let shippingCost = subtotal < freeShippingMin && totalItems > 0 ? (storeSettings.shippingInternal || 25) : 0;
        
        res.json({
            success: true,
            message: 'تم إزالة المنتج من السلة',
            cart,
            subtotal,
            shippingCost,
            total: subtotal + shippingCost,
            totalItems,
            cartCount: totalItems
        });
        
    } catch (error) {
        console.error('خطأ في إزالة المنتج:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// تفريغ السلة كاملة
// =============================================

router.post('/clear', (req, res) => {
    try {
        req.session.cart = [];
        req.session.coupon = null;
        req.flash('success_msg', 'تم تفريغ السلة');
        res.json({ success: true, cartCount: 0 });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// =============================================
// تطبيق كوبون خصم
// =============================================

router.post('/apply-coupon', async (req, res) => {
    try {
        const { couponCode } = req.body;
        const cart = initCart(req);
        const { subtotal } = calculateCartTotals(cart);
        
        if (!couponCode || !couponCode.trim()) {
            return res.json({ success: false, message: 'يرجى إدخال كود الكوبون' });
        }
        
        const validCoupons = {
            'WELCOME15': { type: 'percentage', value: 15, minOrder: 100, maxDiscount: 200 },
            'RADI50': { type: 'fixed', value: 50, minOrder: 300 },
            'FREESHIP': { type: 'free_shipping', minOrder: 0 },
            'VIP20': { type: 'percentage', value: 20, minOrder: 200, maxDiscount: 500 }
        };
        
        const coupon = validCoupons[couponCode.toUpperCase()];
        
        if (!coupon) {
            return res.json({ success: false, message: 'كود الكوبون غير صالح' });
        }
        
        if (subtotal < (coupon.minOrder || 0)) {
            return res.json({ 
                success: false, 
                message: `الحد الأدنى للطلب لتطبيق هذا الكوبون هو ${coupon.minOrder} ر.س` 
            });
        }
        
        let discount = 0;
        
        if (coupon.type === 'percentage') {
            discount = subtotal * (coupon.value / 100);
            if (coupon.maxDiscount) {
                discount = Math.min(discount, coupon.maxDiscount);
            }
        } else if (coupon.type === 'fixed') {
            discount = coupon.value;
        }
        
        req.session.coupon = {
            code: couponCode.toUpperCase(),
            type: coupon.type,
            discount: Math.round(discount * 100) / 100
        };
        
        await req.session.save();
        
        res.json({
            success: true,
            message: 'تم تطبيق كود الخصم بنجاح',
            coupon: req.session.coupon
        });
        
    } catch (error) {
        console.error('خطأ في تطبيق الكوبون:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// إزالة الكوبون
// =============================================

router.post('/remove-coupon', (req, res) => {
    req.session.coupon = null;
    res.json({ success: true, message: 'تم إزالة كود الخصم' });
});

// =============================================
// صفحة إتمام الطلب (Checkout)
// =============================================

router.get('/checkout', isAuthenticated, async (req, res) => {
    try {
        const cart = initCart(req);
        
        if (cart.length === 0) {
            req.flash('error_msg', 'السلة فارغة');
            return res.redirect('/cart');
        }
        
        // تحديث بيانات المنتجات
        for (let item of cart) {
            const product = await Product.findById(item.productId);
            if (product) {
                item.name = product.name;
                item.image = product.getMainImage();
                item.price = product.price;
                item.finalPrice = product.getFinalPrice();
                item.stock = product.stock;
                item.isUnlimited = product.isUnlimited;
                item.isAvailable = product.isAvailable(item.quantity);
                
                if (!item.isAvailable) {
                    req.flash('error_msg', `المنتج "${item.name}" غير متوفر بالكمية المطلوبة`);
                    return res.redirect('/cart');
                }
            }
        }
        
        await req.session.save();
        
        const { subtotal, totalItems } = calculateCartTotals(cart);
        const storeSettings = await StoreSettings.getSettings();
        const user = await User.findById(req.session.user._id);
        
        // حساب الشحن
        let shippingCost = 0;
        const couponDiscount = req.session.coupon ? req.session.coupon.discount : 0;
        
        if (req.session.coupon && req.session.coupon.type === 'free_shipping') {
            shippingCost = 0;
        } else if (subtotal < (storeSettings.freeShippingMin || 300)) {
            shippingCost = storeSettings.shippingInternal || 25;
        }
        
        const total = subtotal - couponDiscount + shippingCost;
        
        res.render('cart/checkout', {
            pageTitle: 'إتمام الطلب',
            cart,
            subtotal,
            coupon: req.session.coupon,
            couponDiscount,
            shippingCost,
            total,
            totalItems,
            user,
            storeSettings,
            currencySymbol: 'ر.س',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
        
    } catch (error) {
        console.error('خطأ في صفحة الدفع:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل صفحة الدفع');
        res.redirect('/cart');
    }
});

// =============================================
// معالجة الطلب وإنشاء الفاتورة
// =============================================

router.post('/place-order', isAuthenticated, async (req, res) => {
    try {
        const cart = initCart(req);
        
        if (cart.length === 0) {
            req.flash('error_msg', 'السلة فارغة');
            return res.redirect('/cart');
        }
        
        const {
            shippingStreet, shippingCity, shippingState,
            shippingZipCode, shippingCountry,
            shippingMethod, paymentMethod, notes
        } = req.body;
        
        // التحقق من بيانات الشحن
        if (!shippingStreet || !shippingCity || !shippingCountry) {
            req.flash('error_msg', 'يرجى إدخال عنوان الشحن كاملاً');
            return res.redirect('/cart/checkout');
        }
        
        const storeSettings = await StoreSettings.getSettings();
        const user = await User.findById(req.session.user._id);
        
        // التحقق من توفر المنتجات
        const orderItems = [];
        let subtotal = 0;
        
        for (let item of cart) {
            const product = await Product.findById(item.productId);
            
            if (!product || !product.isAvailable(item.quantity)) {
                req.flash('error_msg', `المنتج "${item.name}" غير متوفر حالياً`);
                return res.redirect('/cart');
            }
            
            const price = product.getFinalPrice();
            const itemTotal = price * item.quantity;
            subtotal += itemTotal;
            
            orderItems.push({
                product: product._id,
                name: product.name,
                nameEn: product.nameEn || '',
                sku: product.sku || '',
                price: price,
                comparePrice: product.comparePrice,
                quantity: item.quantity,
                total: itemTotal,
                image: product.getMainImage(),
                options: item.options || []
            });
        }
        
        // حساب الخصومات
        const couponDiscount = req.session.coupon ? req.session.coupon.discount : 0;
        
        // حساب الشحن
        let shippingCost = 0;
        const selectedShippingMethod = shippingMethod || 'internal';
        
        if (req.session.coupon && req.session.coupon.type === 'free_shipping') {
            shippingCost = 0;
        } else if (selectedShippingMethod === 'international') {
            shippingCost = storeSettings.shippingInternational || 75;
        } else if (subtotal < (storeSettings.freeShippingMin || 300)) {
            shippingCost = storeSettings.shippingInternal || 25;
        }
        
        const totalAmount = subtotal - couponDiscount + shippingCost;
        
        // إنشاء الطلب
        const order = new Order({
            orderNumber: await Order.generateOrderNumber(),
            user: user._id,
            customerName: user.name,
            customerEmail: user.email,
            customerPhone: user.phone || req.body.phone || '',
            
            shippingAddress: {
                street: shippingStreet,
                city: shippingCity,
                state: shippingState || '',
                zipCode: shippingZipCode || '',
                country: shippingCountry || 'المملكة العربية السعودية'
            },
            
            billingAddress: req.body.billingSame === 'on' ? {
                street: shippingStreet,
                city: shippingCity,
                state: shippingState || '',
                zipCode: shippingZipCode || '',
                country: shippingCountry || 'المملكة العربية السعودية'
            } : {
                street: req.body.billingStreet || shippingStreet,
                city: req.body.billingCity || shippingCity,
                state: req.body.billingState || '',
                zipCode: req.body.billingZipCode || '',
                country: req.body.billingCountry || shippingCountry
            },
            
            items: orderItems,
            subtotal,
            couponCode: req.session.coupon ? req.session.coupon.code : '',
            couponDiscount,
            shippingCost,
            totalAmount,
            
            shippingMethod: selectedShippingMethod,
            shippingType: req.body.shippingType || 'standard',
            
            paymentMethod: paymentMethod || 'cash_on_delivery',
            paymentStatus: 'pending',
            
            notes: notes || '',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        await order.save();
        
        // تقليل المخزون
        for (let item of cart) {
            const product = await Product.findById(item.productId);
            if (product) {
                await product.reduceStock(item.quantity);
            }
        }
        
        // تحديث إحصائيات المستخدم
        user.totalOrders += 1;
        user.totalSpent += totalAmount;
        user.lastOrderDate = new Date();
        
        // إضافة نقاط الولاء
        if (storeSettings.enableLoyaltyProgram) {
            const pointsEarned = Math.floor(totalAmount * (storeSettings.pointsPerRiyal || 1));
            user.loyaltyPoints += pointsEarned;
            user.totalPointsEarned += pointsEarned;
        }
        
        await user.save();
        
        // تفريغ السلة تلقائياً بعد إتمام الطلب
        req.session.cart = [];
        req.session.coupon = null;
        await req.session.save();
        
        console.log(`✅ طلب جديد: ${order.orderNumber} - ${user.name} - ${totalAmount} ر.س`);
        
        req.flash('success_msg', 'تم إنشاء طلبك بنجاح! رقم الطلب: ' + order.orderNumber);
        res.redirect('/cart/order-success/' + order._id);
        
    } catch (error) {
        console.error('خطأ في إنشاء الطلب:', error);
        req.flash('error_msg', 'حدث خطأ في إنشاء الطلب. يرجى المحاولة مرة أخرى');
        res.redirect('/cart/checkout');
    }
});

// =============================================
// صفحة نجاح الطلب
// =============================================

router.get('/order-success/:id', isAuthenticated, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order || order.user.toString() !== req.session.user._id.toString()) {
            req.flash('error_msg', 'الطلب غير موجود');
            return res.redirect('/');
        }
        
        res.render('cart/order-success', {
            pageTitle: 'تم الطلب بنجاح',
            order,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
        
    } catch (error) {
        console.error('خطأ في صفحة نجاح الطلب:', error);
        res.redirect('/');
    }
});

// =============================================
// عرض الفاتورة PDF
// =============================================

router.get('/invoice/:id', isAuthenticated, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email phone');
        
        if (!order) {
            return res.status(404).send('الفاتورة غير موجودة');
        }
        
        // التحقق من الصلاحية
        const isOwner = order.user._id.toString() === req.session.user._id.toString();
        const isAdminUser = req.session.user.role === 'admin' || req.session.user.role === 'superadmin';
        
        if (!isOwner && !isAdminUser) {
            return res.status(403).send('غير مصرح');
        }
        
        // إنشاء PDF
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=invoice-${order.invoiceNumber}.pdf`);
        
        doc.pipe(res);
        
        // ترويسة الفاتورة
        doc.fontSize(22).font('Helvetica-Bold').text('مجموعة متاجر الرعدي أونلاين الفاخرة', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text('Al-Radi Online Luxury Stores Group', { align: 'center' });
        doc.moveDown(0.5);
        doc.text('فاتورة ضريبية رسمية', { align: 'center' });
        doc.moveDown();
        
        // معلومات الفاتورة
        doc.fontSize(9);
        doc.text(`رقم الفاتورة: ${order.invoiceNumber}`, { align: 'right' });
        doc.text(`رقم الطلب: ${order.orderNumber}`, { align: 'right' });
        doc.text(`تاريخ الإصدار: ${new Date(order.invoiceDate).toLocaleDateString('ar-SA')}`, { align: 'right' });
        doc.text(`تاريخ التسليم المتوقع: ${order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toLocaleDateString('ar-SA') : 'يحدد لاحقاً'}`, { align: 'right' });
        doc.moveDown();
        
        // بيانات العميل
        doc.fontSize(11).font('Helvetica-Bold').text('بيانات العميل:');
        doc.fontSize(9).font('Helvetica');
        doc.text(`الاسم: ${order.customerName}`);
        doc.text(`البريد الإلكتروني: ${order.customerEmail}`);
        doc.text(`الهاتف: ${order.customerPhone}`);
        doc.text(`العنوان: ${order.shippingAddress.fullAddress}`);
        doc.moveDown();
        
        // نوع الشحن
        doc.fontSize(10);
        doc.text(`نوع الشحن: ${order.shippingMethod === 'international' ? 'شحن دولي خارجي' : 'شحن داخلي محلي'}`);
        doc.moveDown();
        
        // جدول المنتجات
        doc.fontSize(11).font('Helvetica-Bold').text('قائمة المشتريات:');
        doc.moveDown(0.3);
        
        const tableTop = doc.y;
        doc.fontSize(8).font('Helvetica-Bold');
        doc.text('#', 40, tableTop);
        doc.text('المنتج', 60, tableTop, { width: 200 });
        doc.text('الكمية', 270, tableTop);
        doc.text('السعر', 320, tableTop);
        doc.text('الإجمالي', 380, tableTop);
        
        doc.moveDown(0.5);
        doc.moveTo(40, doc.y).lineTo(570, doc.y).stroke();
        doc.moveDown(0.3);
        
        doc.fontSize(8).font('Helvetica');
        let yPosition = doc.y;
        
        order.items.forEach((item, index) => {
            yPosition = doc.y;
            doc.text((index + 1).toString(), 40, yPosition);
            doc.text(item.name, 60, yPosition, { width: 200 });
            doc.text(item.quantity.toString(), 270, yPosition);
            doc.text(`${item.price} ر.س`, 320, yPosition);
            doc.text(`${item.total} ر.س`, 380, yPosition);
            doc.moveDown(0.3);
        });
        
        doc.moveTo(40, doc.y).lineTo(570, doc.y).stroke();
        doc.moveDown(0.5);
        
        doc.fontSize(9);
        doc.text(`المجموع الفرعي: ${order.subtotal} ر.س`, { align: 'right' });
        
        if (order.couponDiscount > 0) {
            doc.text(`خصم الكوبون (${order.couponCode}): -${order.couponDiscount} ر.س`, { align: 'right' });
        }
        
        doc.text(`رسوم الشحن: ${order.shippingCost} ر.س`, { align: 'right' });
        
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(`الإجمالي النهائي: ${order.totalAmount} ر.س`, { align: 'right' });
        doc.moveDown();
        
        // الشروط القانونية
        doc.fontSize(8).font('Helvetica');
        doc.text('الشروط والأحكام:', { align: 'right' });
        doc.text('1. يمنع منعاً باتاً استرجاع السلع نقداً بعد الشراء لأي سبب كان.', { align: 'right' });
        doc.text('2. يحق للزبون استبدال السلعة بأخرى خلال 3 أيام فقط من تاريخ الاستلام في حال وجود خلل مصنعي واضح.', { align: 'right' });
        doc.text('3. أي كشط أو تلف في ملصقات الضمان أو العبوات الأصلية يلغي الضمان بشكل فوري ويسقط حق الاستبدال.', { align: 'right' });
        doc.moveDown();
        
        // توقيع المستلم
        doc.text(`تاريخ الطلب: ${new Date(order.createdAt).toLocaleDateString('ar-SA')}`, { align: 'right' });
        doc.moveDown(2);
        doc.text('_______________________________', { align: 'left' });
        doc.text('توقيع المستلم عند الاستلام', { align: 'left' });
        
        // تذييل الفاتورة
        doc.moveDown(3);
        doc.fontSize(7);
        doc.text(`جميع الحقوق محفوظة © ${new Date().getFullYear()} لمجموعة متاجر الرعدي أونلاين الفاخرة - تجربة تسوق فائقة وآمنة`, { align: 'center' });
        
        doc.end();
        
    } catch (error) {
        console.error('خطأ في إنشاء الفاتورة:', error);
        res.status(500).send('حدث خطأ في إنشاء الفاتورة');
    }
});

// =============================================
// API: الحصول على محتويات السلة
// =============================================

router.get('/api/cart-data', (req, res) => {
    const cart = initCart(req);
    const { subtotal, totalItems } = calculateCartTotals(cart);
    
    res.json({
        success: true,
        cart,
        subtotal,
        totalItems,
        cartCount: totalItems,
        coupon: req.session.coupon || null
    });
});

module.exports = router;
