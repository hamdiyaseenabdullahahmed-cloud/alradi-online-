// =============================================
// متجر الرعدي أون لاين - alradi-online
// مسارات سلة التسوق والدفع - نسخة متوافقة
// =============================================

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const StoreSettings = require('../models/StoreSettings');
const { isAuthenticated } = require('../middleware/auth');

// إضافة للسلة - POST (لـ AJAX)
router.post('/add', async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        if (!productId) return res.json({ success: false, message: 'المنتج غير محدد' });
        
        const product = await Product.findById(productId);
        if (!product || !product.isActive) return res.json({ success: false, message: 'المنتج غير متوفر' });
        
        if (!req.session.cart) req.session.cart = [];
        
        const existingIndex = req.session.cart.findIndex(item => item.productId === productId);
        const qty = parseInt(quantity) || 1;
        
        if (existingIndex > -1) {
            req.session.cart[existingIndex].quantity += qty;
        } else {
            req.session.cart.push({
                productId: product._id.toString(),
                name: product.name,
                image: product.getMainImage() || '',
                price: product.price,
                finalPrice: product.getFinalPrice(),
                quantity: qty,
                options: {},
                optionsKey: '{}',
                slug: product.slug || ''
            });
        }
        
        req.session.save(err => {
            if (err) return res.json({ success: false, message: 'خطأ في حفظ الجلسة' });
            const cartCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
            res.json({ success: true, message: 'تمت إضافة المنتج إلى السلة ✅', cartCount, cart: req.session.cart });
        });
    } catch (error) {
        console.error('❌ خطأ:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ غير متوقع' });
    }
});

// إضافة للسلة - GET (للرابط المباشر)
router.get('/add', async (req, res) => {
    try {
        const productId = req.query.productId;
        const quantity = parseInt(req.query.quantity) || 1;
        if (!productId) { req.flash('error_msg', 'المنتج غير محدد'); return res.redirect('/products'); }
        
        const product = await Product.findById(productId);
        if (!product || !product.isActive) { req.flash('error_msg', 'المنتج غير متوفر'); return res.redirect('/products'); }
        
        if (!req.session.cart) req.session.cart = [];
        const existingIndex = req.session.cart.findIndex(item => item.productId === productId);
        
        if (existingIndex > -1) { req.session.cart[existingIndex].quantity += quantity; }
        else {
            req.session.cart.push({
                productId: product._id.toString(), name: product.name, image: product.getMainImage() || '',
                price: product.price, finalPrice: product.getFinalPrice(), quantity, options: {}, optionsKey: '{}', slug: product.slug || ''
            });
        }
        
        req.session.save(err => {
            if (err) { req.flash('error_msg', 'خطأ في الحفظ'); return res.redirect('/products'); }
            req.flash('success_msg', 'تمت الإضافة إلى السلة ✅');
            return res.redirect('/cart');
        });
    } catch (error) { console.error('❌ خطأ:', error); req.flash('error_msg', 'حدث خطأ'); res.redirect('/products'); }
});

// صفحة السلة
router.get('/', async (req, res) => {
    try {
        const cart = req.session.cart || [];
        const storeSettings = await StoreSettings.getSettings();
        let subtotal = 0, totalItems = 0;
        
        for (let item of cart) {
            const product = await Product.findById(item.productId);
            if (product) {
                item.name = product.name; item.image = product.getMainImage() || '';
                item.price = product.price; item.finalPrice = product.getFinalPrice();
                item.stock = product.stock; item.slug = product.slug;
                item.isAvailable = product.isAvailable(item.quantity);
            }
            subtotal += (item.finalPrice || item.price) * item.quantity;
            totalItems += item.quantity;
        }
        
        const freeShippingMin = storeSettings.freeShippingMin || 300;
        let shippingCost = subtotal < freeShippingMin && totalItems > 0 ? (storeSettings.shippingInternal || 25) : 0;
        const total = subtotal + shippingCost;
        
        res.render('cart/index', {
            pageTitle: 'سلة التسوق', cart, subtotal, shippingCost, freeShippingMin, total, totalItems,
            coupon: req.session.coupon || null, storeSettings,
            success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
        });
    } catch (error) { console.error('❌ خطأ:', error); res.redirect('/'); }
});

// تحديث - حذف - تفريغ - كوبون - دفع - فاتورة
router.post('/update', async (req, res) => {
    const { productId, quantity } = req.body;
    if (!req.session.cart) req.session.cart = [];
    const index = req.session.cart.findIndex(item => item.productId === productId);
    if (index === -1) return res.json({ success: false });
    const newQty = parseInt(quantity);
    if (newQty < 1) req.session.cart.splice(index, 1);
    else req.session.cart[index].quantity = newQty;
    req.session.save(err => res.json({ success: !err, cart: req.session.cart }));
});

router.post('/remove', async (req, res) => {
    const { productId } = req.body;
    if (!req.session.cart) req.session.cart = [];
    const index = req.session.cart.findIndex(item => item.productId === productId);
    if (index > -1) req.session.cart.splice(index, 1);
    req.session.save(err => res.json({ success: !err, cart: req.session.cart }));
});

router.post('/clear', (req, res) => {
    req.session.cart = []; req.session.coupon = null;
    req.session.save(err => res.json({ success: !err, cartCount: 0 }));
});

router.post('/apply-coupon', (req, res) => {
    const validCoupons = { 'WELCOME15': { type: 'percentage', value: 15, minOrder: 100, maxDiscount: 200 }, 'RADI50': { type: 'fixed', value: 50, minOrder: 300 }, 'FREESHIP': { type: 'free_shipping', minOrder: 0 }, 'VIP20': { type: 'percentage', value: 20, minOrder: 200, maxDiscount: 500 } };
    const code = (req.body.couponCode || '').toUpperCase();
    const coupon = validCoupons[code];
    if (!coupon) return res.json({ success: false, message: 'كود غير صالح' });
    const cart = req.session.cart || [];
    let subtotal = 0; cart.forEach(item => { subtotal += (item.finalPrice || item.price) * item.quantity; });
    if (subtotal < (coupon.minOrder || 0)) return res.json({ success: false, message: 'الحد الأدنى ' + coupon.minOrder + ' ر.س' });
    let discount = coupon.type === 'percentage' ? Math.min(subtotal * (coupon.value / 100), coupon.maxDiscount || Infinity) : coupon.value;
    req.session.coupon = { code, type: coupon.type, discount: Math.round(discount * 100) / 100 };
    req.session.save(err => res.json({ success: !err, message: 'تم تطبيق الكوبون', coupon: req.session.coupon }));
});

router.get('/checkout', isAuthenticated, async (req, res) => {
    try {
        const cart = req.session.cart || [];
        if (cart.length === 0) { req.flash('error_msg', 'السلة فارغة'); return res.redirect('/cart'); }
        let subtotal = 0;
        for (let item of cart) {
            const product = await Product.findById(item.productId);
            if (product) { item.name = product.name; item.image = product.getMainImage() || ''; item.price = product.price; item.finalPrice = product.getFinalPrice(); }
            subtotal += (item.finalPrice || item.price) * item.quantity;
        }
        const storeSettings = await StoreSettings.getSettings();
        const user = await User.findById(req.session.user._id);
        const couponDiscount = req.session.coupon ? req.session.coupon.discount : 0;
        let shippingCost = subtotal < (storeSettings.freeShippingMin || 300) ? (storeSettings.shippingInternal || 25) : 0;
        const total = subtotal - couponDiscount + shippingCost;
        res.render('cart/checkout', { pageTitle: 'إتمام الشراء', cart, subtotal, coupon: req.session.coupon, couponDiscount, shippingCost, total, user, storeSettings, currencySymbol: 'ر.س', success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg') });
    } catch (error) { res.redirect('/cart'); }
});

router.post('/place-order', isAuthenticated, async (req, res) => {
    try {
        const cart = req.session.cart || [];
        if (cart.length === 0) { req.flash('error_msg', 'السلة فارغة'); return res.redirect('/cart'); }
        const { shippingStreet, shippingCity, shippingCountry, shippingMethod, paymentMethod, notes } = req.body;
        if (!shippingStreet || !shippingCity || !shippingCountry) { req.flash('error_msg', 'يرجى إدخال عنوان الشحن'); return res.redirect('/cart/checkout'); }
        const storeSettings = await StoreSettings.getSettings();
        const user = await User.findById(req.session.user._id);
        const orderItems = []; let subtotal = 0;
        for (let item of cart) {
            const product = await Product.findById(item.productId);
            if (!product || !product.isAvailable(item.quantity)) { req.flash('error_msg', `"${item.name}" غير متوفر`); return res.redirect('/cart'); }
            const price = product.getFinalPrice(); const itemTotal = price * item.quantity; subtotal += itemTotal;
            orderItems.push({ product: product._id, name: product.name, price, quantity: item.quantity, total: itemTotal, image: product.getMainImage() || '' });
        }
        const couponDiscount = req.session.coupon ? req.session.coupon.discount : 0;
        const method = shippingMethod || 'internal'; let shippingCost = 0;
        if (method === 'international') shippingCost = storeSettings.shippingInternational || 75;
        else if (subtotal < (storeSettings.freeShippingMin || 300)) shippingCost = storeSettings.shippingInternal || 25;
        const totalAmount = subtotal - couponDiscount + shippingCost;
        const order = new Order({ orderNumber: await Order.generateOrderNumber(), user: user._id, customerName: user.name, customerEmail: user.email, customerPhone: user.phone || '', shippingAddress: { street: shippingStreet, city: shippingCity, state: '', zipCode: '', country: shippingCountry || 'المملكة العربية السعودية' }, items: orderItems, subtotal, couponDiscount, shippingCost, totalAmount, shippingMethod: method, paymentMethod: paymentMethod || 'cash_on_delivery', notes: notes || '' });
        await order.save();
        for (let item of cart) { const product = await Product.findById(item.productId); if (product) await product.reduceStock(item.quantity); }
        user.totalOrders += 1; user.totalSpent += totalAmount; user.lastOrderDate = new Date(); await user.save();
        req.session.cart = []; req.session.coupon = null;
        req.session.save(err => { console.log('✅ طلب جديد:', order.orderNumber, '-', totalAmount, 'ر.س'); req.flash('success_msg', 'تم إنشاء طلبك بنجاح! رقم الطلب: ' + order.orderNumber); res.redirect('/cart/order-success/' + order._id); });
    } catch (error) { console.error('❌ خطأ:', error); req.flash('error_msg', 'حدث خطأ'); res.redirect('/cart/checkout'); }
});

router.get('/order-success/:id', isAuthenticated, async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) { req.flash('error_msg', 'غير موجود'); return res.redirect('/'); }
    res.render('cart/order-success', { pageTitle: 'تم الطلب بنجاح', order, success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg') });
});

router.get('/invoice/:id', isAuthenticated, async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).send('غير موجودة');
    res.render('cart/invoice', { pageTitle: 'فاتورة: ' + order.invoiceNumber, order: order, layout: false });
});

router.get('/api/cart-data', (req, res) => {
    const cart = req.session.cart || [];
    let subtotal = 0, totalItems = 0;
    cart.forEach(item => { subtotal += (item.finalPrice || item.price) * item.quantity; totalItems += item.quantity; });
    res.json({ success: true, cart, subtotal, totalItems, cartCount: totalItems, coupon: req.session.coupon || null });
});

module.exports = router;
