// ⚡ الرعدي أونلاين – الخادم النهائي v23.0
// 🦅 جميع الحقوق محفوظة

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = 'alradi-super-secret-key-2024';

// ==================== MongoDB Connection ====================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://alradi:alradi12345@cluster0.njjwehg.mongodb.net/alradi_store?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('MongoDB Error:', err));

// ==================== Schemas ====================
const UserSchema = new mongoose.Schema({
    fullName: String, email: String, phone: String, password: String,
    role: { type: String, default: 'customer' }, isActive: { type: Boolean, default: true },
    loyaltyPoints: { type: Number, default: 0 }, loyaltyTier: { type: String, default: 'برونزي' },
    country: String, city: String, createdAt: { type: Date, default: Date.now }
});

const ProductSchema = new mongoose.Schema({
    name: String, category: String, price: Number, comparePrice: Number,
    stock: Number, description: String, images: [String], isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false }, salesCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const OrderSchema = new mongoose.Schema({
    orderNumber: String, userId: mongoose.Schema.Types.ObjectId, userName: String,
    items: Array, total: Number, status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const CouponSchema = new mongoose.Schema({
    code: String, discountType: String, discountValue: Number,
    minOrder: { type: Number, default: 0 }, isActive: { type: Boolean, default: true }
});

const CategorySchema = new mongoose.Schema({
    name: String, icon: String, isActive: { type: Boolean, default: true }
});

const User = mongoose.model('User', UserSchema);
const Product = mongoose.model('Product', ProductSchema);
const Order = mongoose.model('Order', OrderSchema);
const Coupon = mongoose.model('Coupon', CouponSchema);
const Category = mongoose.model('Category', CategorySchema);

// ==================== Initialize Data ====================
async function initData() {
    // Create Admin
    const admin = await User.findOne({ email: 'alradi@gmail.com' });
    if (!admin) {
        const hash = await bcrypt.hash('admin123', 10);
        await User.create({
            fullName: 'الرعدي', email: 'alradi@gmail.com', phone: '+966500000000',
            password: hash, role: 'superadmin', isActive: true, loyaltyPoints: 9999, loyaltyTier: 'أسطوري'
        });
        console.log('✅ Admin created');
    }

    // Create Sample Products
    const productsCount = await Product.countDocuments();
    if (productsCount === 0) {
        await Product.insertMany([
            { name: '📱 ساعة ذكية فاخرة Pro Max', price: 599, comparePrice: 899, stock: 50, category: 'إلكترونيات', description: 'ساعة ذكية متطورة', isFeatured: true, images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'] },
            { name: '🎧 سماعات لاسلكية بريميوم', price: 349, stock: 100, category: 'إلكترونيات', description: 'جودة صوت عالية', isFeatured: true, images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'] },
            { name: '🧴 عطر شرقي فاخر', price: 450, comparePrice: 600, stock: 30, category: 'عطور', description: 'عطر فاخر', images: ['https://images.unsplash.com/photo-1541643600914-78b084683601?w=400'] },
            { name: '👜 حقيبة يد جلد طبيعي', price: 799, stock: 15, category: 'أزياء', description: 'حقيبة جلدية', images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400'] },
            { name: '📱 هاتف ذكي Ultra 5G', price: 2999, comparePrice: 3499, stock: 12, category: 'إلكترونيات', description: 'هاتف متطور', isFeatured: true, images: ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400'] }
        ]);
        console.log('✅ Sample products created');
    }

    // Create Categories
    const categoriesCount = await Category.countDocuments();
    if (categoriesCount === 0) {
        await Category.insertMany([
            { name: 'إلكترونيات', icon: '📱', isActive: true },
            { name: 'أزياء', icon: '👕', isActive: true },
            { name: 'عطور', icon: '🧴', isActive: true },
            { name: 'ساعات', icon: '⌚', isActive: true },
            { name: 'أحذية', icon: '👟', isActive: true }
        ]);
        console.log('✅ Categories created');
    }

    // Create Coupons
    const couponsCount = await Coupon.countDocuments();
    if (couponsCount === 0) {
        await Coupon.insertMany([
            { code: 'WELCOME10', discountType: 'percentage', discountValue: 10, minOrder: 100, isActive: true },
            { code: 'RAAD40', discountType: 'percentage', discountValue: 40, minOrder: 200, isActive: true },
            { code: 'FLASH50', discountType: 'fixed', discountValue: 50, minOrder: 500, isActive: true }
        ]);
        console.log('✅ Coupons created');
    }
}

initData();

// ==================== Auth Middleware ====================
const auth = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'غير مصرح' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch { res.status(401).json({ error: 'رمز غير صالح' }); }
};

const adminOnly = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'غير مصرح' });
    try {
        const user = jwt.verify(token, JWT_SECRET);
        if (user.role !== 'superadmin' && user.role !== 'admin') {
            return res.status(403).json({ error: 'صلاحيات مدير مطلوبة' });
        }
        req.user = user;
        next();
    } catch { res.status(401).json({ error: 'رمز غير صالح' }); }
};

// ==================== Public Routes ====================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const user = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });
        if (!user) return res.status(401).json({ error: 'بيانات غير صحيحة' });
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'بيانات غير صحيحة' });
        if (!user.isActive) return res.status(403).json({ error: 'الحساب معطل' });
        
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ success: true, token, user: { id: user._id, fullName: user.fullName, email: user.email, phone: user.phone, role: user.role, loyaltyPoints: user.loyaltyPoints, loyaltyTier: user.loyaltyTier } });
    } catch (error) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, phone, password, country, city } = req.body;
        if (!fullName || !phone || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
        
        const existing = await User.findOne({ $or: [{ phone }, { email: `${phone}@user.com` }] });
        if (existing) return res.status(400).json({ error: 'رقم الجوال مسجل مسبقاً' });
        
        const hash = await bcrypt.hash(password, 10);
        const user = await User.create({
            fullName, phone, email: `${phone}@user.com`, password: hash,
            role: 'customer', country: country || 'السعودية', city: city || '', loyaltyPoints: 100
        });
        
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({ success: true, token, user: { id: user._id, fullName, email: user.email, phone, role: 'customer', loyaltyPoints: 100, loyaltyTier: 'برونزي' } });
    } catch (error) { res.status(500).json({ error: 'خطأ في التسجيل' }); }
});

app.get('/api/products', async (req, res) => {
    try {
        const { page = 1, limit = 12, category } = req.query;
        let query = { isActive: true };
        if (category && category !== 'all') query.category = category;
        
        const products = await Product.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
        const total = await Product.countDocuments(query);
        res.json({ success: true, data: products, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
    } catch (error) { res.status(500).json({ error: 'خطأ' }); }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'غير موجود' });
        res.json({ success: true, data: product });
    } catch (error) { res.status(500).json({ error: 'خطأ' }); }
});

app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true });
        res.json({ success: true, data: categories });
    } catch (error) { res.json({ success: true, data: [] }); }
});

app.get('/api/coupons', async (req, res) => {
    try {
        const coupons = await Coupon.find({ isActive: true });
        res.json({ success: true, data: coupons });
    } catch (error) { res.json({ success: true, data: [] }); }
});

app.post('/api/coupons/validate', async (req, res) => {
    try {
        const { code, subtotal } = req.body;
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
        if (!coupon) return res.status(400).json({ error: 'كوبون غير صالح' });
        if (coupon.minOrder && subtotal < coupon.minOrder) return res.status(400).json({ error: `الحد الأدنى ${coupon.minOrder} ريال` });
        
        let discount = coupon.discountType === 'percentage' ? subtotal * (coupon.discountValue / 100) : coupon.discountValue;
        res.json({ success: true, data: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue, discount } });
    } catch (error) { res.status(500).json({ error: 'خطأ' }); }
});

app.post('/api/orders', auth, async (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod, notes } = req.body;
        if (!items || items.length === 0) return res.status(400).json({ error: 'السلة فارغة' });
        
        const user = await User.findById(req.user.id);
        let subtotal = 0;
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (product) subtotal += product.price * item.quantity;
        }
        
        const shippingCost = subtotal >= 500 ? 0 : 25;
        const tax = subtotal * 0.15;
        const total = subtotal + shippingCost + tax;
        const orderNumber = `RAAD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        
        const order = await Order.create({ orderNumber, userId: req.user.id, userName: user.fullName, items, total, status: 'pending' });
        res.status(201).json({ success: true, message: 'تم إنشاء الطلب', data: { orderNumber, total } });
    } catch (error) { res.status(500).json({ error: 'خطأ' }); }
});

app.get('/api/user/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({ success: true, data: user });
    } catch (error) { res.status(500).json({ error: 'خطأ' }); }
});

// ==================== Admin Routes (محمية) ====================
app.get('/api/admin/stats', adminOnly, async (req, res) => {
    try {
        const orders = await Order.find();
        const products = await Product.find();
        const users = await User.find({ role: 'customer' });
        const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
        const today = new Date(); today.setHours(0,0,0,0);
        const todayOrders = orders.filter(o => new Date(o.createdAt) >= today).length;
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        const lowStock = products.filter(p => p.stock <= 5).length;
        
        res.json({ success: true, data: { totalOrders: orders.length, totalProducts: products.length, totalCustomers: users.length, totalRevenue, todayOrders, pendingOrders, lowStockProducts: lowStock, recentOrders: orders.slice(-10).reverse(), bestSelling: products.sort((a,b)=>(b.salesCount||0)-(a.salesCount||0)).slice(0,5) } });
    } catch (error) { res.json({ success: true, data: {} }); }
});

app.get('/api/admin/orders', adminOnly, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json({ success: true, data: orders });
    } catch (error) { res.json({ success: true, data: [] }); }
});

app.get('/api/admin/customers', adminOnly, async (req, res) => {
    try {
        const users = await User.find({ role: 'customer' }).select('-password');
        res.json({ success: true, data: users });
    } catch (error) { res.json({ success: true, data: [] }); }
});

app.get('/api/admin/products', adminOnly, async (req, res) => {
    try {
        const products = await Product.find();
        res.json({ success: true, data: products });
    } catch (error) { res.json({ success: true, data: [] }); }
});

app.put('/api/admin/orders/:id/status', adminOnly, async (req, res) => {
    try {
        await Order.findByIdAndUpdate(req.params.id, { status: req.body.status });
        res.json({ success: true, message: 'تم تحديث الحالة' });
    } catch (error) { res.status(500).json({ error: 'فشل' }); }
});

app.put('/api/admin/products/:id', adminOnly, async (req, res) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, req.body);
        res.json({ success: true, message: 'تم تحديث المنتج' });
    } catch (error) { res.status(500).json({ error: 'فشل' }); }
});

app.delete('/api/admin/products/:id', adminOnly, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'تم حذف المنتج' });
    } catch (error) { res.status(500).json({ error: 'فشل' }); }
});

app.post('/api/admin/coupons', adminOnly, async (req, res) => {
    try {
        const coupon = await Coupon.create(req.body);
        res.status(201).json({ success: true, data: coupon });
    } catch (error) { res.status(500).json({ error: 'فشل' }); }
});

app.delete('/api/admin/coupons/:code', adminOnly, async (req, res) => {
    try {
        await Coupon.findOneAndDelete({ code: req.params.code });
        res.json({ success: true, message: 'تم الحذف' });
    } catch (error) { res.status(500).json({ error: 'فشل' }); }
});

app.post('/api/admin/categories', adminOnly, async (req, res) => {
    try {
        const category = await Category.create(req.body);
        res.status(201).json({ success: true, data: category });
    } catch (error) { res.status(500).json({ error: 'فشل' }); }
});

app.delete('/api/admin/categories/:id', adminOnly, async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'تم الحذف' });
    } catch (error) { res.status(500).json({ error: 'فشل' }); }
});

// ==================== Serve Frontend ====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🔐 Admin: alradi@gmail.com / admin123`);
});
