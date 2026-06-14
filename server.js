// ⚡ الرعدي أونلاين – الخادم النهائي v22.0
// 🦅 يعمل على Render مع MongoDB Atlas – جميع المسارات تعمل

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = 'alradi-super-secret-key';

// ==================== MongoDB Atlas Connection ====================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://alradi:alradi12345@cluster0.njjwehg.mongodb.net/alradi_store?retryWrites=true&w=majority';

// ==================== Mongoose Schemas ====================
const UserSchema = new mongoose.Schema({
    fullName: String, email: String, phone: String, password: String,
    role: { type: String, default: 'customer' }, isActive: { type: Boolean, default: true },
    loyaltyPoints: { type: Number, default: 0 }, loyaltyTier: { type: String, default: 'برونزي' },
    country: String, city: String, createdAt: { type: Date, default: Date.now }
});

const ProductSchema = new mongoose.Schema({
    name: String, category: String, price: Number, comparePrice: Number,
    stock: Number, description: String, images: [String], isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false }, salesCount: { type: Number, default: 0 }
}, { timestamps: true });

const OrderSchema = new mongoose.Schema({
    orderNumber: String, userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String, items: Array, total: Number, status: { type: String, default: 'pending' },
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

// ==================== Database Connection ====================
mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB Atlas Connected'))
    .catch(err => console.error('MongoDB Error:', err));

// ==================== Create Admin ====================
async function createAdmin() {
    const adminExists = await User.findOne({ email: 'alradi@gmail.com' });
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await User.create({
            fullName: 'الرعدي',
            email: 'alradi@gmail.com',
            phone: '+966500000000',
            password: hashedPassword,
            role: 'superadmin',
            isActive: true,
            loyaltyPoints: 9999,
            loyaltyTier: 'أسطوري'
        });
        console.log('✅ Admin created: alradi@gmail.com / admin123');
    }
}

// ==================== Create Sample Products ====================
async function createSampleProducts() {
    const count = await Product.countDocuments();
    if (count === 0) {
        const products = [
            { name: 'ساعة ذكية فاخرة', price: 599, comparePrice: 899, stock: 50, category: 'إلكترونيات', description: 'ساعة ذكية متطورة', isFeatured: true, images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'] },
            { name: 'سماعات لاسلكية', price: 349, stock: 100, category: 'إلكترونيات', description: 'سماعات عالية الجودة', isFeatured: true, images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'] },
            { name: 'عطر فاخر', price: 450, comparePrice: 600, stock: 30, category: 'عطور', description: 'عطر شرقي أصيل', images: ['https://images.unsplash.com/photo-1541643600914-78b084683601?w=400'] },
            { name: 'حقيبة يد جلدية', price: 799, stock: 15, category: 'أزياء', description: 'حقيبة جلد طبيعي', images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400'] },
            { name: 'هاتف ذكي 5G', price: 2999, comparePrice: 3499, stock: 12, category: 'إلكترونيات', description: 'هاتف متطور', isFeatured: true, images: ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400'] }
        ];
        await Product.insertMany(products);
        console.log('✅ Sample products created');
    }
}

// ==================== Create Sample Categories ====================
async function createSampleCategories() {
    const count = await Category.countDocuments();
    if (count === 0) {
        const categories = [
            { name: 'إلكترونيات', icon: '📱', isActive: true },
            { name: 'أزياء', icon: '👕', isActive: true },
            { name: 'عطور', icon: '🧴', isActive: true },
            { name: 'ساعات', icon: '⌚', isActive: true },
            { name: 'أحذية', icon: '👟', isActive: true }
        ];
        await Category.insertMany(categories);
        console.log('✅ Sample categories created');
    }
}

// ==================== Auth Middleware ====================
const auth = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) { req.user = null; return next(); }
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch { req.user = null; next(); }
};

const adminOnly = (req, res, next) => {
    if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'غير مصرح' });
    }
    next();
};

app.use(auth);

// ==================== API Routes ====================

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const user = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });
        if (!user) return res.status(401).json({ error: 'بيانات غير صحيحة' });
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'بيانات غير صحيحة' });
        
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ success: true, token, user: { id: user._id, fullName: user.fullName, email: user.email, phone: user.phone, role: user.role, loyaltyPoints: user.loyaltyPoints, loyaltyTier: user.loyaltyTier } });
    } catch (error) { res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, phone, password, country, city } = req.body;
        if (!fullName || !phone || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
        
        const existing = await User.findOne({ $or: [{ phone }, { email: `${phone}@temp.com` }] });
        if (existing) return res.status(400).json({ error: 'رقم الجوال مسجل مسبقاً' });
        
        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ fullName, phone, email: `${phone}@user.com`, password: hashed, role: 'customer', country: country || 'السعودية', city: city || '', loyaltyPoints: 100 });
        
        const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({ success: true, token, user: { id: user._id, fullName, email: user.email, phone, role: 'customer', loyaltyPoints: 100, loyaltyTier: 'برونزي' } });
    } catch (error) { res.status(500).json({ error: 'خطأ في التسجيل' }); }
});

// Get Products
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

// Get Single Product
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'غير موجود' });
        res.json({ success: true, data: product });
    } catch (error) { res.status(500).json({ error: 'خطأ' }); }
});

// Get Categories
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true });
        res.json({ success: true, data: categories });
    } catch (error) { res.json({ success: true, data: [] }); }
});

// Get Coupons
app.get('/api/coupons', async (req, res) => {
    try {
        const coupons = await Coupon.find({ isActive: true });
        res.json({ success: true, data: coupons });
    } catch (error) { res.json({ success: true, data: [] }); }
});

// Validate Coupon
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

// Create Order
app.post('/api/orders', auth, async (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod, notes } = req.body;
        if (!items || items.length === 0) return res.status(400).json({ error: 'السلة فارغة' });
        
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'مستخدم غير موجود' });
        
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
    } catch (error) { res.status(500).json({ error: 'خطأ في إنشاء الطلب' }); }
});

// Admin Stats
app.get('/api/admin/stats', adminOnly, async (req, res) => {
    try {
        const orders = await Order.find();
        const products = await Product.find();
        const users = await User.find({ role: 'customer' });
        const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayOrders = orders.filter(o => new Date(o.createdAt) >= today).length;
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        const lowStock = products.filter(p => p.stock <= 5).length;
        
        res.json({
            success: true,
            data: {
                totalOrders: orders.length,
                totalProducts: products.length,
                totalCustomers: users.length,
                totalRevenue,
                todayOrders,
                pendingOrders,
                lowStockProducts: lowStock,
                recentOrders: orders.slice(-10).reverse(),
                bestSelling: products.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0)).slice(0, 5),
                lowStockProductsList: products.filter(p => p.stock <= 5).slice(0, 10)
            }
        });
    } catch (error) { res.json({ success: true, data: {} }); }
});

// Admin Orders
app.get('/api/admin/orders', adminOnly, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json({ success: true, data: orders });
    } catch (error) { res.json({ success: true, data: [] }); }
});

// Admin Customers
app.get('/api/admin/customers', adminOnly, async (req, res) => {
    try {
        const users = await User.find({ role: 'customer' }).select('-password');
        res.json({ success: true, data: users });
    } catch (error) { res.json({ success: true, data: [] }); }
});

// Admin Products
app.get('/api/admin/products', adminOnly, async (req, res) => {
    try {
        const products = await Product.find();
        res.json({ success: true, data: products });
    } catch (error) { res.json({ success: true, data: [] }); }
});

// Update Order Status
app.put('/api/admin/orders/:id/status', adminOnly, async (req, res) => {
    try {
        const { status } = req.body;
        await Order.findByIdAndUpdate(req.params.id, { status });
        res.json({ success: true, message: 'تم تحديث الحالة' });
    } catch (error) { res.status(500).json({ error: 'فشل' }); }
});

// Update Product
app.put('/api/admin/products/:id', adminOnly, async (req, res) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, req.body);
        res.json({ success: true, message: 'تم تحديث المنتج' });
    } catch (error) { res.status(500).json({ error: 'فشل' }); }
});

// Delete Product
app.delete('/api/admin/products/:id', adminOnly, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'تم حذف المنتج' });
    } catch (error) { res.status(500).json({ error: 'فشل' }); }
});

// Add Coupon
app.post('/api/admin/coupons', adminOnly, async (req, res) => {
    try {
        const coupon = await Coupon.create(req.body);
        res.status(201).json({ success: true, data: coupon });
    } catch (error) { res.status(500).json({ error: 'فشل' }); }
});

// Delete Coupon
app.delete('/api/admin/coupons/:code', adminOnly, async (req, res) => {
    try {
        await Coupon.findOneAndDelete({ code: req.params.code });
        res.json({ success: true, message: 'تم الحذف' });
    } catch (error) { res.status(500).json({ error: 'فشل' }); }
});

// Add Category
app.post('/api/admin/categories', adminOnly, async (req, res) => {
    try {
        const category = await Category.create(req.body);
        res.status(201).json({ success: true, data: category });
    } catch (error) { res.status(500).json({ error: 'فشل' }); }
});

// Delete Category
app.delete('/api/admin/categories/:id', adminOnly, async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'تم الحذف' });
    } catch (error) { res.status(500).json({ error: 'فشل' }); }
});

// User Profile
app.get('/api/user/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({ success: true, data: user });
    } catch (error) { res.status(500).json({ error: 'خطأ' }); }
});

// ==================== Initialize Data ====================
async function init() {
    await createAdmin();
    await createSampleProducts();
    await createSampleCategories();
    console.log('✅ Database initialized');
}

init();

// ==================== Serve Frontend ====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ==================== Start Server ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  🦅 الرعدي أونلاين – النسخة النهائية v22.0              ║
║  🔗 http://localhost:${PORT}                               ║
║  🔐 alradi@gmail.com / admin123                          ║
╚════════════════════════════════════════════════════════════╝
    `);
});
