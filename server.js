// ⚡ الرعدي أونلاين – الخادم الأسطوري النهائي v25.0
// 🦅 جميع الحقوق محفوظة – الرعدي أونلاين 2025
// يعمل على Render مع MongoDB Atlas – جميع المسارات تعمل

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// ==================== Middleware ====================
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== JWT Secret ====================
const JWT_SECRET = process.env.JWT_SECRET || 'alradi-super-secret-key-2024';

// ==================== MongoDB Atlas Connection ====================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://alradi:alradi12345@cluster0.njjwehg.mongodb.net/alradi_store?retryWrites=true&w=majority&appName=Cluster0';

// ==================== Mongoose Schemas ====================
const UserSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'customer' },
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    loyaltyPoints: { type: Number, default: 0 },
    loyaltyTier: { type: String, default: 'برونزي' },
    country: { type: String, default: 'السعودية' },
    city: String,
    createdAt: { type: Date, default: Date.now }
});

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: String,
    price: { type: Number, required: true },
    comparePrice: Number,
    stock: { type: Number, default: 0 },
    description: String,
    images: [String],
    tags: [String],
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    salesCount: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const OrderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    userPhone: String,
    userAddress: String,
    items: [{
        productId: mongoose.Schema.Types.ObjectId,
        name: String,
        price: Number,
        quantity: Number
    }],
    subtotal: Number,
    shippingCost: Number,
    tax: Number,
    total: Number,
    paymentMethod: { type: String, default: 'cod' },
    status: { type: String, default: 'pending' },
    notes: String,
    createdAt: { type: Date, default: Date.now }
});

const CouponSchema = new mongoose.Schema({
    code: { type: String, unique: true, required: true },
    discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    discountValue: { type: Number, required: true },
    minOrder: { type: Number, default: 0 },
    maxUses: Number,
    usedCount: { type: Number, default: 0 },
    expiryDate: Date,
    isActive: { type: Boolean, default: true },
    description: String
});

const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    icon: { type: String, default: '📦' },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
});

const BannerSchema = new mongoose.Schema({
    title: String,
    subtitle: String,
    imageUrl: String,
    link: String,
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
});

const SettingSchema = new mongoose.Schema({
    type: { type: String, unique: true },
    data: mongoose.Schema.Types.Mixed
});

// ==================== Models ====================
const User = mongoose.model('User', UserSchema);
const Product = mongoose.model('Product', ProductSchema);
const Order = mongoose.model('Order', OrderSchema);
const Coupon = mongoose.model('Coupon', CouponSchema);
const Category = mongoose.model('Category', CategorySchema);
const Banner = mongoose.model('Banner', BannerSchema);
const Setting = mongoose.model('Setting', SettingSchema);

// ==================== Database Connection ====================
mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB Atlas Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ==================== Initialize Data ====================
async function initializeData() {
    try {
        // Create Admin User
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
                loyaltyTier: 'أسطوري',
                country: 'السعودية',
                city: 'الرياض'
            });
            console.log('✅ Admin created: alradi@gmail.com / admin123');
        }

        // Create Sample Customer
        const customerExists = await User.findOne({ email: 'customer@alradi.com' });
        if (!customerExists) {
            const hashedPassword = await bcrypt.hash('customer123', 10);
            await User.create({
                fullName: 'أبو يزن',
                email: 'customer@alradi.com',
                phone: '+966511111111',
                password: hashedPassword,
                role: 'customer',
                isActive: true,
                loyaltyPoints: 1250,
                loyaltyTier: 'ذهبي',
                country: 'السعودية',
                city: 'الرياض'
            });
            console.log('✅ Customer created: customer@alradi.com / customer123');
        }

        // Create Sample Products
        const productsCount = await Product.countDocuments();
        if (productsCount === 0) {
            const products = [
                { name: '📱 ساعة ذكية فاخرة Pro Max', price: 599, comparePrice: 899, stock: 50, category: 'إلكترونيات', description: 'شاشة AMOLED، مقاومة للماء، GPS، مراقبة الصحة', isFeatured: true, salesCount: 45, rating: 4.5, ratingCount: 120, images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'] },
                { name: '🎧 سماعات لاسلكية بريميوم ANC', price: 349, stock: 100, category: 'إلكترونيات', description: 'إلغاء الضوضاء، جودة Hi-Res، بطارية 30 ساعة', isFeatured: true, salesCount: 72, rating: 4.2, ratingCount: 85, images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'] },
                { name: '🧴 عطر شرقي فاخر 100ml', price: 450, comparePrice: 600, stock: 30, category: 'عطور', description: 'العود، المسك، العنبر، الورد، الزعفران', salesCount: 150, rating: 4.8, ratingCount: 200, images: ['https://images.unsplash.com/photo-1541643600914-78b084683601?w=400'] },
                { name: '👜 حقيبة يد جلد طبيعي', price: 799, stock: 15, category: 'أزياء', description: 'جلد طبيعي 100%، صناعة يدوية', salesCount: 20, rating: 4.0, ratingCount: 45, images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400'] },
                { name: '📱 هاتف ذكي Ultra 5G', price: 2999, comparePrice: 3499, stock: 12, category: 'إلكترونيات', description: 'شاشة 6.8 بوصة، كاميرا 200MP', isFeatured: true, salesCount: 90, rating: 4.7, ratingCount: 310, images: ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400'] },
                { name: '⌚ ساعة رياضية ذكية', price: 299, stock: 75, category: 'ساعات', description: 'مقاومة للماء 50 متر، تتبع اللياقة', salesCount: 234, rating: 4.3, ratingCount: 89, images: ['https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400'] },
                { name: '👟 حذاء رياضي', price: 399, stock: 45, category: 'أحذية', description: 'خفيف الوزن، نعل مريح', salesCount: 67, rating: 4.4, ratingCount: 56, images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400'] },
                { name: '🏠 مصباح ذكي LED', price: 89, stock: 200, category: 'منزل', description: 'يتحكم عن بعد، 16 مليون لون', salesCount: 312, rating: 4.6, ratingCount: 78, images: ['https://images.unsplash.com/photo-1565814636199-ae8133055c1c?w=400'] }
            ];
            await Product.insertMany(products);
            console.log('✅ 8 sample products created');
        }

        // Create Categories
        const categoriesCount = await Category.countDocuments();
        if (categoriesCount === 0) {
            const categories = [
                { name: 'إلكترونيات', icon: '📱', order: 1 },
                { name: 'أزياء', icon: '👕', order: 2 },
                { name: 'عطور', icon: '🧴', order: 3 },
                { name: 'منزل', icon: '🏠', order: 4 },
                { name: 'ساعات', icon: '⌚', order: 5 },
                { name: 'أحذية', icon: '👟', order: 6 },
                { name: 'رياضة', icon: '⚽', order: 7 }
            ];
            await Category.insertMany(categories);
            console.log('✅ 7 categories created');
        }

        // Create Coupons
        const couponsCount = await Coupon.countDocuments();
        if (couponsCount === 0) {
            const coupons = [
                { code: 'WELCOME10', discountType: 'percentage', discountValue: 10, minOrder: 100, maxUses: 1000, isActive: true, description: 'خصم 10% للعملاء الجدد' },
                { code: 'RAAD40', discountType: 'percentage', discountValue: 40, minOrder: 200, maxUses: 500, isActive: true, description: 'خصم 40% على جميع المنتجات' },
                { code: 'FLASH50', discountType: 'fixed', discountValue: 50, minOrder: 500, maxUses: 500, isActive: true, description: 'خصم 50 ريال' }
            ];
            await Coupon.insertMany(coupons);
            console.log('✅ 3 coupons created');
        }

        // Create Settings
        const shippingSetting = await Setting.findOne({ type: 'shipping' });
        if (!shippingSetting) {
            await Setting.create({ type: 'shipping', data: { freeShippingThreshold: 500, internalCost: 25, externalCost: 50 } });
            await Setting.create({ type: 'tax', data: { rate: 15 } });
            console.log('✅ Settings created');
        }

    } catch (error) {
        console.error('Init error:', error);
    }
}

initializeData();

// ==================== Auth Middleware ====================
const auth = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        req.user = null;
        return next();
    }
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        req.user = null;
        next();
    }
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
    } catch {
        return res.status(401).json({ error: 'رمز غير صالح' });
    }
};

app.use(auth);

// ==================== Public Routes ====================

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
        }

        const user = await User.findOne({
            $or: [{ email: identifier }, { phone: identifier }]
        });

        if (!user) {
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        }

        if (!user.isActive) {
            return res.status(403).json({ error: 'الحساب معطل' });
        }

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                loyaltyPoints: user.loyaltyPoints,
                loyaltyTier: user.loyaltyTier
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, phone, password, country, city, email } = req.body;
        if (!fullName || !phone || !password) {
            return res.status(400).json({ error: 'الاسم ورقم الجوال وكلمة المرور مطلوبة' });
        }

        const existing = await User.findOne({ $or: [{ phone }, { email }] });
        if (existing) {
            return res.status(400).json({ error: 'رقم الجوال أو البريد مسجل مسبقاً' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            fullName,
            phone,
            email: email || `${phone}@user.com`,
            password: hashedPassword,
            role: 'customer',
            country: country || 'السعودية',
            city: city || '',
            loyaltyPoints: 100,
            loyaltyTier: 'برونزي'
        });

        const token = jwt.sign(
            { id: newUser._id, email: newUser.email, role: newUser.role },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                phone: newUser.phone,
                role: newUser.role,
                loyaltyPoints: 100,
                loyaltyTier: 'برونزي'
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'خطأ في التسجيل' });
    }
});

// Get Products
app.get('/api/products', async (req, res) => {
    try {
        const { page = 1, limit = 12, category, search, sort = '-createdAt' } = req.query;
        
        let query = { isActive: true };
        if (category && category !== 'all') query.category = category;
        
        let productsQuery = Product.find(query);
        
        if (search) {
            productsQuery = productsQuery.find({
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ]
            });
        }
        
        if (sort === 'price-asc') productsQuery = productsQuery.sort({ price: 1 });
        else if (sort === 'price-desc') productsQuery = productsQuery.sort({ price: -1 });
        else if (sort === 'bestselling') productsQuery = productsQuery.sort({ salesCount: -1 });
        else productsQuery = productsQuery.sort({ createdAt: -1 });
        
        const total = await Product.countDocuments(query);
        const products = await productsQuery.skip((page - 1) * limit).limit(parseInt(limit));
        
        res.json({
            success: true,
            data: products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Products error:', error);
        res.status(500).json({ error: 'خطأ في جلب المنتجات' });
    }
});

// Get Single Product
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });
        res.json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في جلب المنتج' });
    }
});

// Get Categories
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).sort({ order: 1 });
        res.json({ success: true, data: categories });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// Get Banners
app.get('/api/banners', async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true }).sort({ order: 1 });
        res.json({ success: true, data: banners });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// Get Coupons
app.get('/api/coupons', async (req, res) => {
    try {
        const coupons = await Coupon.find({ isActive: true });
        res.json({ success: true, data: coupons });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// Validate Coupon
app.post('/api/coupons/validate', async (req, res) => {
    try {
        const { code, subtotal } = req.body;
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
        
        if (!coupon) return res.status(400).json({ error: 'الكوبون غير صالح' });
        if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
            return res.status(400).json({ error: 'انتهت صلاحية الكوبون' });
        }
        if (coupon.minOrder && subtotal < coupon.minOrder) {
            return res.status(400).json({ error: `الحد الأدنى للطلب ${coupon.minOrder} ريال` });
        }
        
        let discount = coupon.discountType === 'percentage' 
            ? subtotal * (coupon.discountValue / 100) 
            : coupon.discountValue;
        
        res.json({
            success: true,
            data: {
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                discount
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في التحقق من الكوبون' });
    }
});

// Create Order
app.post('/api/orders', auth, async (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod, notes } = req.body;
        
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'السلة فارغة' });
        }
        
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
        
        let subtotal = 0;
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (product) {
                subtotal += product.price * item.quantity;
            }
        }
        
        const shippingCost = subtotal >= 500 ? 0 : 25;
        const tax = subtotal * 0.15;
        const total = subtotal + shippingCost + tax;
        const orderNumber = `RAAD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        
        const order = await Order.create({
            orderNumber,
            userId: req.user.id,
            userName: user.fullName,
            userPhone: user.phone,
            userAddress: shippingAddress?.address || '',
            items: items.map(i => ({
                productId: i.productId,
                name: i.name,
                price: i.price,
                quantity: i.quantity
            })),
            subtotal,
            shippingCost,
            tax,
            total,
            paymentMethod: paymentMethod || 'cod',
            status: 'pending',
            notes: notes || ''
        });
        
        res.status(201).json({
            success: true,
            message: 'تم إنشاء الطلب بنجاح',
            data: { orderNumber, total }
        });
    } catch (error) {
        console.error('Order error:', error);
        res.status(500).json({ error: 'خطأ في إنشاء الطلب' });
    }
});

// Get User Profile
app.get('/api/user/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في جلب البيانات' });
    }
});

// ==================== Admin Routes (Protected) ====================

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
    } catch (error) {
        res.json({ success: true, data: {} });
    }
});

// Admin Orders
app.get('/api/admin/orders', adminOnly, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json({ success: true, data: orders });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// Admin Customers
app.get('/api/admin/customers', adminOnly, async (req, res) => {
    try {
        const users = await User.find({ role: 'customer' }).select('-password').sort({ createdAt: -1 });
        res.json({ success: true, data: users });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// Admin Products
app.get('/api/admin/products', adminOnly, async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json({ success: true, data: products });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// Update Order Status
app.put('/api/admin/orders/:id/status', adminOnly, async (req, res) => {
    try {
        const { status } = req.body;
        await Order.findByIdAndUpdate(req.params.id, { status });
        res.json({ success: true, message: 'تم تحديث حالة الطلب' });
    } catch (error) {
        res.status(500).json({ error: 'فشل التحديث' });
    }
});

// Update Product
app.put('/api/admin/products/:id', adminOnly, async (req, res) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, req.body);
        res.json({ success: true, message: 'تم تحديث المنتج' });
    } catch (error) {
        res.status(500).json({ error: 'فشل التحديث' });
    }
});

// Delete Product
app.delete('/api/admin/products/:id', adminOnly, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'تم حذف المنتج' });
    } catch (error) {
        res.status(500).json({ error: 'فشل الحذف' });
    }
});

// Create Product (Admin)
app.post('/api/admin/products', adminOnly, async (req, res) => {
    try {
        const product = await Product.create(req.body);
        res.status(201).json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ error: 'فشل الإضافة' });
    }
});

// Create Coupon (Admin)
app.post('/api/admin/coupons', adminOnly, async (req, res) => {
    try {
        const coupon = await Coupon.create(req.body);
        res.status(201).json({ success: true, data: coupon });
    } catch (error) {
        res.status(500).json({ error: 'فشل الإضافة' });
    }
});

// Delete Coupon (Admin)
app.delete('/api/admin/coupons/:code', adminOnly, async (req, res) => {
    try {
        await Coupon.findOneAndDelete({ code: req.params.code });
        res.json({ success: true, message: 'تم حذف الكوبون' });
    } catch (error) {
        res.status(500).json({ error: 'فشل الحذف' });
    }
});

// Create Category (Admin)
app.post('/api/admin/categories', adminOnly, async (req, res) => {
    try {
        const category = await Category.create(req.body);
        res.status(201).json({ success: true, data: category });
    } catch (error) {
        res.status(500).json({ error: 'فشل الإضافة' });
    }
});

// Delete Category (Admin)
app.delete('/api/admin/categories/:id', adminOnly, async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'تم حذف القسم' });
    } catch (error) {
        res.status(500).json({ error: 'فشل الحذف' });
    }
});

// Create Banner (Admin)
app.post('/api/admin/banners', adminOnly, async (req, res) => {
    try {
        const banner = await Banner.create(req.body);
        res.status(201).json({ success: true, data: banner });
    } catch (error) {
        res.status(500).json({ error: 'فشل الإضافة' });
    }
});

// Delete Banner (Admin)
app.delete('/api/admin/banners/:id', adminOnly, async (req, res) => {
    try {
        await Banner.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'تم حذف البانر' });
    } catch (error) {
        res.status(500).json({ error: 'فشل الحذف' });
    }
});

// Get Settings
app.get('/api/settings/:type', async (req, res) => {
    try {
        const setting = await Setting.findOne({ type: req.params.type });
        res.json({ success: true, data: setting?.data || null });
    } catch (error) {
        res.json({ success: true, data: null });
    }
});

// Update Settings
app.put('/api/settings/:type', adminOnly, async (req, res) => {
    try {
        await Setting.findOneAndUpdate(
            { type: req.params.type },
            { data: req.body },
            { upsert: true, new: true }
        );
        res.json({ success: true, message: 'تم حفظ الإعدادات' });
    } catch (error) {
        res.status(500).json({ error: 'فشل الحفظ' });
    }
});

// ==================== Serve Frontend ====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin/*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ==================== Start Server ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║  🦅 الرعدي أونلاين – الخادم النهائي v25.0                           ║
║  ⚡ نظام تجارة إلكترونية متكامل                                     ║
╠══════════════════════════════════════════════════════════════════════╣
║  🌐 الخادم: http://localhost:${PORT}                                 ║
║  👑 لوحة المدير: http://localhost:${PORT}/admin                      ║
╠══════════════════════════════════════════════════════════════════════╣
║  🔐 بيانات الدخول:                                                  ║
║  👤 المدير: alradi@gmail.com  |  كلمة السر: admin123               ║
║  👤 العميل: customer@alradi.com  |  كلمة السر: customer123         ║
╠══════════════════════════════════════════════════════════════════════╣
║  💾 قاعدة البيانات: MongoDB Atlas ✅                                 ║
║  🚀 جاهز للتشغيل الفوري على Render                                   ║
╚══════════════════════════════════════════════════════════════════════╝
    `);
});
