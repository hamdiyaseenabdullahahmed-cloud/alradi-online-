// =============================================
// متجر الرعدي أون لاين - Al-Radi Online
// مسارات سلة التسوق والدفع - الإصدار الكامل
// =============================================

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const StoreSettings = require('../models/StoreSettings');
const { isAuthenticated } = require('../middleware/auth');

// =============================================
// 1. إضافة منتج إلى السلة (رابط مباشر - GET)
// =============================================
router.get('/add', async (req, res) => {
    try {
        const pId = req.query.productId;
        const qty = parseInt(req.query.quantity) || 1;
        if (!pId) return res.redirect('/products');

        const product = await Product.findById(pId);
        if (!product) return res.redirect('/products');

        if (!req.session.cart) req.session.cart = [];
        const index = req.session.cart.findIndex(i => i.productId === pId);
        
        if (index > -1) req.session.cart[index].quantity += qty;
        else req.session.cart.push({
            productId: pId, name: product.name, price: product.price,
            finalPrice: product.getFinalPrice(), quantity: qty,
            image: product.getMainImage() || '', slug: product.slug || ''
        });
        
        req.session.save(() => res.redirect('/cart'));
    } catch (e) { res.redirect('/products'); }
});

// =============================================
// 2. إضافة منتج إلى السلة (AJAX - POST)
// =============================================
router.post('/add', async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        if (!productId) return res.json({ success: false });

        const product = await Product.findById(productId);
        if (!product) return res.json({ success: false });

        if (!req.session.cart) req.session.cart = [];
        const index = req.session.cart.findIndex(i => i.productId === productId);
        
        if (index > -1) req.session.cart[index].quantity += parseInt(quantity);
        else req.session.cart.push({
            productId, name: product.name, price: product.price,
            finalPrice: product.getFinalPrice(), quantity: parseInt(quantity),
            image: product.getMainImage() || '', slug: product.slug || ''
        });
        
        req.session.save(() => {
            const count = req.session.cart.reduce((s, i) => s + i.quantity, 0);
            res.json({ success: true, cartCount: count, cart: req.session.cart });
        });
    } catch (e) { res.status(500).json({ success: false }); }
});

// =============================================
// 3. عرض صفحة السلة
// =============================================
router.get('/', async (req, res) => {
    const cart = req.session.cart || [];
    const storeSettings = await StoreSettings.getSettings();
    let subtotal = 0, totalItems = 0;

    for (let item of cart) {
        const product = await Product.findById(item.productId);
        if (product) {
            item.name = product.name;
            item.image = product.getMainImage() || '';
            item.stock = product.stock;
            item.slug = product.slug;
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
});

// =============================================
// 4. تحديث كمية منتج في السلة
// =============================================
router.post('/update', async (req, res) => {
    const { productId, quantity } = req.body;
    if (!req.session.cart) req.session.cart = [];
    const index = req.session.cart.findIndex(i => i.productId === productId);
    if (index === -1) return res.json({ success: false });
    
    const newQty = parseInt(quantity);
    if (newQty < 1) req.session.cart.splice(index, 1);
    else req.session.cart[index].quantity = newQty;

    req.session.save(() => res.json({ success: true, cart: req.session.cart }));
});

// =============================================
// 5. حذف منتج من السلة
// =============================================
router.post('/remove', async (req, res) => {
    const { productId } = req.body;
    if (!req.session.cart) req.session.cart = [];
    const index = req.session.cart.findIndex(i => i.productId === productId);
    if (index > -1) req.session.cart.splice(index, 1);
    req.session.save(() => res.json({ success: true, cart: req.session.cart }));
});

// =============================================
// 6. تفريغ السلة بالكامل
// =============================================
router.post('/clear', (req, res) => {
    req.session.cart = [];
    req.session.coupon = null;
    req.session.save(() => res.json({ success: true, cartCount: 0 }));
});

// =============================================
// 7. تطبيق كوبون خصم
// =============================================
router.post('/apply-coupon', (req, res) => {
    const validCoupons = {
        'WELCOME15': { type: 'percentage', value: 15, minOrder: 100, maxDiscount: 200 },
        'RADI50': { type: 'fixed', value: 50, minOrder: 300 },
        'FREESHIP': { type: 'free_shipping', minOrder: 0 },
        'VIP20': { type: 'percentage', value: 20, minOrder: 200, maxDiscount: 500 }
    };
    const code = (req.body.couponCode || '').toUpperCase();
    const coupon = validCoupons[code];
    if (!coupon) return res.json({ success: false, message: 'كود غير صالح' });

    const cart = req.session.cart || [];
    let subtotal = 0;
    cart.forEach(i => subtotal += (i.finalPrice || i.price) * i.quantity);
    if (subtotal < (coupon.minOrder || 0)) return res.json({ success: false, message: `الحد الأدنى ${coupon.minOrder} ر.س` });

    let discount = coupon.type === 'percentage' ? Math.min(subtotal * (coupon.value / 100), coupon.maxDiscount || Infinity) : coupon.value;
    req.session.coupon = { code, type: coupon.type, discount: Math.round(discount * 100) / 100 };
    req.session.save(() => res.json({ success: true, coupon: req.session.coupon }));
});

// =============================================
// 8. صفحة إتمام الطلب (Checkout)
// =============================================
router.get('/checkout', isAuthenticated, async (req, res) => {
    const cart = req.session.cart || [];
    if (cart.length === 0) return res.redirect('/cart');

    let subtotal = 0;
    for (let item of cart) {
        const product = await Product.findById(item.productId);
        if (product) {
            item.name = product.name;
            item.image = product.getMainImage() || '';
            item.isAvailable = product.isAvailable(item.quantity);
        }
        subtotal += (item.finalPrice || item.price) * item.quantity;
    }

    const storeSettings = await StoreSettings.getSettings();
    const user = await User.findById(req.session.user._id);
    const couponDiscount = req.session.coupon?.discount || 0;
    let shippingCost = subtotal < (storeSettings.freeShippingMin || 300) ? (storeSettings.shippingInternal || 25) : 0;
    const total = subtotal - couponDiscount + shippingCost;

    res.render('cart/checkout', {
        pageTitle: 'إتمام الشراء', cart, subtotal, coupon: req.session.coupon,
        couponDiscount, shippingCost, total, user, storeSettings, currencySymbol: 'ر.س',
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

// =============================================
// 9. تأكيد الطلب وإنشاء الفاتورة
// =============================================
router.post('/place-order', isAuthenticated, async (req, res) => {
    try {
        const cart = req.session.cart || [];
        if (cart.length === 0) return res.redirect('/cart');

        const { shippingStreet, shippingCity, shippingCountry, shippingMethod, paymentMethod, notes } = req.body;
        if (!shippingStreet || !shippingCity || !shippingCountry) {
            req.flash('error_msg', 'يرجى إدخال عنوان الشحن كاملاً');
            return res.redirect('/cart/checkout');
        }

        const storeSettings = await StoreSettings.getSettings();
        const user = await User.findById(req.session.user._id);
        const orderItems = [];
        let subtotal = 0;

        for (let item of cart) {
            const product = await Product.findById(item.productId);
            if (!product || !product.isAvailable(item.quantity)) {
                req.flash('error_msg', `"${item.name}" غير متوفر حالياً`);
                return res.redirect('/cart');
            }
            const price = product.getFinalPrice();
            const itemTotal = price * item.quantity;
            subtotal += itemTotal;
            orderItems.push({
                product: product._id, name: product.name, price,
                quantity: item.quantity, total: itemTotal, image: product.getMainImage() || ''
            });
        }

        const couponDiscount = req.session.coupon?.discount || 0;
        const method = shippingMethod || 'internal';
        let shippingCost = method === 'international' ? (storeSettings.shippingInternational || 75) : (subtotal < (storeSettings.freeShippingMin || 300) ? (storeSettings.shippingInternal || 25) : 0);
        const totalAmount = subtotal - couponDiscount + shippingCost;

        const order = new Order({
            orderNumber: await Order.generateOrderNumber(),
            user: user._id,
            customerName: user.name,
            customerEmail: user.email,
            customerPhone: user.phone || '',
            shippingAddress: { street: shippingStreet, city: shippingCity, state: '', zipCode: '', country: shippingCountry || 'المملكة العربية السعودية' },
            items: orderItems,
            subtotal, couponDiscount, shippingCost, totalAmount,
            shippingMethod: method,
            paymentMethod: paymentMethod || 'cash_on_delivery',
            notes: notes || ''
        });

        await order.save();
        for (let item of cart) {
            const product = await Product.findById(item.productId);
            if (product) await product.reduceStock(item.quantity);
        }

        user.totalOrders += 1;
        user.totalSpent += totalAmount;
        user.lastOrderDate = new Date();
        await user.save();

        req.session.cart = [];
        req.session.coupon = null;
        req.session.save(() => {
            req.flash('success_msg', 'تم إنشاء طلبك بنجاح! رقم الطلب: ' + order.orderNumber);
            res.redirect('/cart/order-success/' + order._id);
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'حدث خطأ أثناء إنشاء الطلب');
        res.redirect('/cart/checkout');
    }
});

// =============================================
// 10. صفحة نجاح الطلب
// =============================================
router.get('/order-success/:id', isAuthenticated, async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.redirect('/');
    res.render('cart/order-success', {
        pageTitle: 'تم الطلب بنجاح', order,
        success_msg: req.flash('success_msg'), error_msg: req.flash('error_msg')
    });
});

// =============================================
// 11. عرض الفاتورة (HTML للطباعة)
// =============================================
router.get('/invoice/:id', isAuthenticated, async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).send('الفاتورة غير موجودة');
    res.render('cart/invoice', { pageTitle: 'فاتورة ' + order.invoiceNumber, order, layout: false });
});

module.exports = router;
