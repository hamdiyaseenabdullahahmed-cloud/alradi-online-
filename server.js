// ⚡ الرعدي أونلاين – الخادم النهائي v21.0
// 🦅 يعمل مع MongoDB Atlas على Render

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'alradi-ultimate-secret-2024';

// ==================== الاتصال بـ MongoDB Atlas ====================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://alradi:alradi12345@cluster0.njjwehg.mongodb.net/alradi_store?retryWrites=true&w=majority&appName=Cluster0';

let DB;
let dbConnected = false;

// تعريف النماذج
const userSchema = new mongoose.Schema({
    fullName: String, email: String, phone: String, password: String,
    role: { type: String, default: 'customer' },
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    loyaltyPoints: { type: Number, default: 0 },
    loyaltyTier: { type: String, default: 'برونزي' },
    country: String, city: String,
    createdAt: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
    name: String, category: String, price: Number, comparePrice: Number,
    stock: Number, description: String, images: [mongoose.Schema.Types.Mixed],
    tags: [String], isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    salesCount: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
    orderNumber: String, userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String, items: [mongoose.Schema.Types.Mixed],
    shippingAddress: mongoose.Schema.Types.Mixed,
    paymentMethod: String, subtotal: Number, shippingCost: Number,
    tax: Number, total: Number, status: { type: String, default: 'pending' },
    notes: String, createdAt: { type: Date, default: Date.now }
});

const couponSchema = new mongoose.Schema({
    code: String, discountType: String, discountValue: Number,
    minOrder: { type: Number, default: 0 }, maxUses: Number,
    usedCount: { type: Number, default: 0 }, isActive: { type: Boolean, default: true },
    description: String, expiryDate: Date
});

const categorySchema = new mongoose.Schema({
    name: String, icon: String, isActive: { type: Boolean, default: true }, order: Number
});

const bannerSchema = new mongoose.Schema({
    title: String, subtitle: String, imageUrl: String, link: String,
    isActive: { type: Boolean, default: true }, order: Number
});

const settingSchema = new mongoose.Schema({
    type: String, data: mongoose.Schema.Types.Mixed
});

const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const Coupon = mongoose.model('Coupon', couponSchema);
const Category = mongoose.model('Category', categorySchema);
const Banner = mongoose.model('Banner', bannerSchema);
const Setting = mongoose.model('Setting', settingSchema);

DB = { User, Product, Order, Coupon, Category, Banner, Setting };

// الاتصال بقاعدة البيانات
async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        dbConnected = true;
        console.log('✅ MongoDB Atlas متصل بنجاح');
        
        // تهيئة البيانات الأساسية
        await initializeData();
        
    } catch (error) {
        console.error('❌ فشل الاتصال بـ MongoDB:', error.message);
        dbConnected = false;
        process.exit(1);
    }
}

// ==================== تهيئة البيانات الأساسية ====================
async function initializeData() {
    try {
        // إنشاء المدير
        const adminExists = await DB.User.findOne({ email: 'alradi@gmail.com' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await DB.User.create({
                fullName: 'الرعدي',
                email: 'alradi@gmail.com',
                phone: '+966500000000',
                password: hashedPassword,
                role: 'superadmin',
                isActive: true,
                loyaltyPoints: 10000,
                loyaltyTier: 'أسطوري'
            });
            console.log('✅ تم إنشاء حساب المدير: alradi@gmail.com / admin123');
        }

        // إنشاء العميل التجريبي
        const customerExists = await DB.User.findOne({ email: 'customer@alradi.com' });
        if (!customerExists) {
            const hashedPassword = await bcrypt.hash('customer123', 10);
            await DB.User.create({
                fullName: 'أبو يزن',
                email: 'customer@alradi.com',
                phone: '+966511111111',
                password: hashedPassword,
                role: 'customer',
                isActive: true,
                loyaltyPoints: 1250,
                loyaltyTier: 'ذهبي'
            });
            console.log('✅ تم إنشاء حساب العميل: customer@alradi.com / customer123');
        }

        // إنشاء المنتجات
        const productsCount = await DB.Product.countDocuments();
        if (productsCount === 0) {
            const products = [
                { name: '📱 ساعة ذكية فاخرة Pro Max', price: 599, comparePrice: 899, stock: 50, category: 'إلكترونيات', description: 'شاشة AMOLED، مقاومة للماء، GPS', isActive: true, isFeatured: true, salesCount: 45, rating: 4.5, ratingCount: 120, images: [{ url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', type: 'main' }] },
                { name: '🎧 سماعات لاسلكية بريميوم ANC', price: 349, stock: 100, category: 'إلكترونيات', description: 'إلغاء الضوضاء، جودة Hi-Res', isActive: true, isFeatured: true, salesCount: 72, rating: 4.2, ratingCount: 85, images: [{ url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', type: 'main' }] },
                { name: '🧴 عطر شرقي فاخر 100ml', price: 450, comparePrice: 600, stock: 30, category: 'عطور', description: 'العود، المسك، العنبر', isActive: true, salesCount: 150, rating: 4.8, ratingCount: 200, images: [{ url: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400', type: 'main' }] },
                { name: '👜 حقيبة يد جلد طبيعي', price: 799, stock: 15, category: 'أزياء', description: 'جلد طبيعي 100%', isActive: true, salesCount: 20, rating: 4.0, ratingCount: 45, images: [{ url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400', type: 'main' }] },
                { name: '📱 هاتف ذكي Ultra 5G', price: 2999, comparePrice: 3499, stock: 12, category: 'إلكترونيات', description: 'شاشة 6.8 بوصة، كاميرا 200MP', isActive: true, isFeatured: true, salesCount: 90, rating: 4.7, ratingCount: 310, images: [{ url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400', type: 'main' }] }
            ];
            await DB.Product.insertMany(products);
            console.log('✅ تم إنشاء 5 منتجات افتراضية');
        }

        // إنشاء الأقسام
        const categoriesCount = await DB.Category.countDocuments();
        if (categoriesCount === 0) {
            const categories = [
                { name: 'إلكترونيات', icon: '📱', isActive: true, order: 1 },
                { name: 'أزياء', icon: '👕', isActive: true, order: 2 },
                { name: 'عطور', icon: '🧴', isActive: true, order: 3 },
                { name: 'ساعات', icon: '⌚', isActive: true, order: 4 },
                { name: 'أحذية', icon: '👟', isActive: true, order: 5 }
            ];
            await DB.Category.insertMany(categories);
            console.log('✅ تم إنشاء 5 أقسام افتراضية');
        }

        // إنشاء الكوبونات
        const couponsCount = await DB.Coupon.countDocuments();
        if (couponsCount === 0) {
            const coupons = [
                { code: 'WELCOME10', discountType: 'percentage', discountValue: 10, minOrder: 100, maxUses: 1000, usedCount: 0, isActive: true, description: 'خصم 10% للعملاء الجدد' },
                { code: 'RAAD40', discountType: 'percentage', discountValue: 40, minOrder: 200, maxUses: 500, usedCount: 0, isActive: true, description: 'خصم 40% على جميع المنتجات' },
                { code: 'FLASH50', discountType: 'fixed', discountValue: 50, minOrder: 500, maxUses: 500, usedCount: 0, isActive: true, description: 'خصم 50 ريال' }
            ];
            await DB.Coupon.insertMany(coupons);
            console.log('✅ تم إنشاء 3 كوبونات افتراضية');
        }

        // إنشاء الإعدادات
        const shippingSetting = await DB.Setting.findOne({ type: 'shipping' });
        if (!shippingSetting) {
            await DB.Setting.create({ type: 'shipping', data: { freeShippingThreshold: 500, internalCost: 25 } });
            await DB.Setting.create({ type: 'tax', data: { rate: 15 } });
            console.log('✅ تم إنشاء الإعدادات الافتراضية');
        }

    } catch (error) {
        console.error('خطأ في تهيئة البيانات:', error);
    }
}

// ==================== Middleware للمصادقة ====================
async function auth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }
    try {
        req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        next();
    } catch {
        req.user = null;
        next();
    }
}

function adminOnly(req, res, next) {
    if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'غير مصرح به - صلاحيات المدير مطلوبة' });
    }
    next();
}

app.use(auth);

// ==================== API Routes ====================

// المصادقة
app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        
        const user = await DB.User.findOne({ 
            $or: [{ email: identifier }, { phone: identifier }] 
        });
        
        if (!user) {
            return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
        }
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
        }
        
        if (!user.isActive) {
            return res.status(403).json({ error: 'الحساب معطل، يرجى التواصل مع الدعم' });
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
                loyaltyPoints: user.loyaltyPoints || 0,
                loyaltyTier: user.loyaltyTier || 'برونزي'
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullName, phone, password, email, country, city } = req.body;
        
        if (!fullName || !phone || !password) {
            return res.status(400).json({ error: 'الاسم الكامل ورقم الجوال وكلمة المرور مطلوبة' });
        }
        
        const existingUser = await DB.User.findOne({ 
            $or: [{ phone }, { email }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ error: 'رقم الجوال أو البريد الإلكتروني مسجل مسبقاً' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = await DB.User.create({
            fullName,
            phone,
            email: email || `${phone}@alradi.com`,
            password: hashedPassword,
            role: 'customer',
            country: country || 'السعودية',
            city: city || '',
            isActive: true,
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
        res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
});

// المنتجات
app.get('/api/products', async (req, res) => {
    try {
        const { page = 1, limit = 12, category, search, sort = '-createdAt' } = req.query;
        
        let query = { isActive: true };
        if (category && category !== 'all') query.category = category;
        
        let productsQuery = DB.Product.find(query);
        
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
        
        const total = await DB.Product.countDocuments(query);
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
        res.status(500).json({ error: 'حدث خطأ في جلب المنتجات' });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await DB.Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'المنتج غير موجود' });
        }
        res.json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// الأقسام
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await DB.Category.find({ isActive: true }).sort({ order: 1 });
        res.json({ success: true, data: categories });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// البانرات
app.get('/api/banners', async (req, res) => {
    try {
        const banners = await DB.Banner.find({ isActive: true }).sort({ order: 1 });
        res.json({ success: true, data: banners });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// الكوبونات
app.get('/api/coupons', async (req, res) => {
    try {
        const coupons = await DB.Coupon.find({ isActive: true });
        res.json({ success: true, data: coupons });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

app.post('/api/coupons/validate', async (req, res) => {
    try {
        const { code, subtotal } = req.body;
        const coupon = await DB.Coupon.findOne({ code: code.toUpperCase(), isActive: true });
        
        if (!coupon) {
            return res.status(400).json({ error: 'الكوبون غير صالح' });
        }
        
        if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
            return res.status(400).json({ error: 'انتهت صلاحية الكوبون' });
        }
        
        if (coupon.minOrder && subtotal < coupon.minOrder) {
            return res.status(400).json({ error: `الحد الأدنى للطلب ${coupon.minOrder} ريال` });
        }
        
        let discount = 0;
        if (coupon.discountType === 'percentage') {
            discount = subtotal * (coupon.discountValue / 100);
        } else {
            discount = coupon.discountValue;
        }
        
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
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// الطلبات
app.post('/api/orders', auth, async (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod, notes } = req.body;
        
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'السلة فارغة' });
        }
        
        const user = await DB.User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }
        
        let subtotal = 0;
        for (const item of items) {
            const product = await DB.Product.findById(item.productId);
            if (!product) {
                return res.status(400).json({ error: `المنتج ${item.name} غير موجود` });
            }
            subtotal += product.price * item.quantity;
        }
        
        const shippingCost = subtotal >= 500 ? 0 : 25;
        const tax = subtotal * 0.15;
        const total = subtotal + shippingCost + tax;
        
        const orderNumber = `RAAD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        
        const newOrder = await DB.Order.create({
            orderNumber,
            userId: req.user.id,
            userName: user.fullName,
            items,
            shippingAddress,
            paymentMethod,
            subtotal,
            shippingCost,
            tax,
            total,
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
        res.status(500).json({ error: 'حدث خطأ في إنشاء الطلب' });
    }
});

// لوحة المدير - إحصائيات
app.get('/api/admin/stats', adminOnly, async (req, res) => {
    try {
        const orders = await DB.Order.find();
        const products = await DB.Product.find();
        const users = await DB.User.find({ role: 'customer' });
        
        const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        const lowStock = products.filter(p => p.stock <= 5).length;
        
        res.json({
            success: true,
            data: {
                totalOrders: orders.length,
                totalProducts: products.length,
                totalCustomers: users.length,
                totalRevenue,
                pendingOrders,
                lowStockProducts: lowStock,
                recentOrders: orders.slice(-10).reverse(),
                bestSelling: products.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0)).slice(0, 5)
            }
        });
    } catch (error) {
        res.json({ success: true, data: {} });
    }
});

// لوحة المدير - جميع الطلبات
app.get('/api/admin/orders', adminOnly, async (req, res) => {
    try {
        const orders = await DB.Order.find().sort({ createdAt: -1 });
        res.json({ success: true, data: orders });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// لوحة المدير - جميع العملاء
app.get('/api/admin/customers', adminOnly, async (req, res) => {
    try {
        const users = await DB.User.find({ role: 'customer' }).select('-password');
        res.json({ success: true, data: users });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// لوحة المدير - جميع المنتجات
app.get('/api/admin/products', adminOnly, async (req, res) => {
    try {
        const products = await DB.Product.find();
        res.json({ success: true, data: products });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// لوحة المدير - تحديث حالة الطلب
app.put('/api/admin/orders/:id/status', adminOnly, async (req, res) => {
    try {
        const { status } = req.body;
        await DB.Order.findByIdAndUpdate(req.params.id, { status });
        res.json({ success: true, message: 'تم تحديث حالة الطلب' });
    } catch (error) {
        res.status(500).json({ error: 'فشل التحديث' });
    }
});

// لوحة المدير - تحديث المنتج
app.put('/api/admin/products/:id', adminOnly, async (req, res) => {
    try {
        await DB.Product.findByIdAndUpdate(req.params.id, req.body);
        res.json({ success: true, message: 'تم تحديث المنتج' });
    } catch (error) {
        res.status(500).json({ error: 'فشل التحديث' });
    }
});

// لوحة المدير - حذف المنتج
app.delete('/api/admin/products/:id', adminOnly, async (req, res) => {
    try {
        await DB.Product.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'تم حذف المنتج' });
    } catch (error) {
        res.status(500).json({ error: 'فشل الحذف' });
    }
});

// ملف تعريف المستخدم
app.get('/api/user/profile', auth, async (req, res) => {
    try {
        const user = await DB.User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// إضافة كوبون (للمدير)
app.post('/api/admin/coupons', adminOnly, async (req, res) => {
    try {
        const coupon = await DB.Coupon.create(req.body);
        res.status(201).json({ success: true, data: coupon });
    } catch (error) {
        res.status(500).json({ error: 'فشل إضافة الكوبون' });
    }
});

// حذف كوبون (للمدير)
app.delete('/api/admin/coupons/:code', adminOnly, async (req, res) => {
    try {
        await DB.Coupon.findOneAndDelete({ code: req.params.code });
        res.json({ success: true, message: 'تم حذف الكوبون' });
    } catch (error) {
        res.status(500).json({ error: 'فشل الحذف' });
    }
});

// إضافة قسم (للمدير)
app.post('/api/admin/categories', adminOnly, async (req, res) => {
    try {
        const category = await DB.Category.create(req.body);
        res.status(201).json({ success: true, data: category });
    } catch (error) {
        res.status(500).json({ error: 'فشل إضافة القسم' });
    }
});

// حذف قسم (للمدير)
app.delete('/api/admin/categories/:id', adminOnly, async (req, res) => {
    try {
        await DB.Category.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'تم حذف القسم' });
    } catch (error) {
        res.status(500).json({ error: 'فشل الحذف' });
    }
});

// إضافة بانر (للمدير)
app.post('/api/admin/banners', adminOnly, async (req, res) => {
    try {
        const banner = await DB.Banner.create(req.body);
        res.status(201).json({ success: true, data: banner });
    } catch (error) {
        res.status(500).json({ error: 'فشل إضافة البانر' });
    }
});

// حذف بانر (للمدير)
app.delete('/api/admin/banners/:id', adminOnly, async (req, res) => {
    try {
        await DB.Banner.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'تم حذف البانر' });
    } catch (error) {
        res.status(500).json({ error: 'فشل الحذف' });
    }
});

// إعدادات المتجر
app.get('/api/settings/:type', async (req, res) => {
    try {
        const setting = await DB.Setting.findOne({ type: req.params.type });
        res.json({ success: true, data: setting?.data || null });
    } catch (error) {
        res.json({ success: true, data: null });
    }
});

app.put('/api/settings/:type', adminOnly, async (req, res) => {
    try {
        await DB.Setting.findOneAndUpdate(
            { type: req.params.type },
            { data: req.body },
            { upsert: true, new: true }
        );
        res.json({ success: true, message: 'تم حفظ الإعدادات' });
    } catch (error) {
        res.status(500).json({ error: 'فشل الحفظ' });
    }
});

// ==================== الصفحات ====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin/*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ==================== بدء التشغيل ====================
async function startServer() {
    await connectDB();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║  🦅 الرعدي أونلاين – النسخة النهائية v21.0                         ║
║  ⚡ نظام تجارة إلكترونية متكامل مع MongoDB Atlas                    ║
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
}

startServer();
