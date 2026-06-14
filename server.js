// ⚡ الرعدي أونلاين – النظام المتكامل النهائي v20.0
// 🦅 منصة تجارة إلكترونية عالمية – جميع الحقوق محفوظة

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = 'alradi-ultimate-secret-2024';

// ==================== قاعدة البيانات المتقدمة ====================
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

class AdvancedDatabase {
    constructor() {
        this.collections = ['users', 'products', 'orders', 'coupons', 'categories', 'banners', 'settings'];
        this.init();
    }

    init() {
        this.collections.forEach(coll => {
            const file = path.join(DATA_DIR, `${coll}.json`);
            if (!fs.existsSync(file)) {
                fs.writeFileSync(file, JSON.stringify([], null, 2));
            }
        });
    }

    read(collection) {
        try {
            return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${collection}.json`), 'utf8'));
        } catch {
            return [];
        }
    }

    write(collection, data) {
        fs.writeFileSync(path.join(DATA_DIR, `${collection}.json`), JSON.stringify(data, null, 2));
    }

    async find(collection, filter = {}) {
        let data = this.read(collection);
        
        if (filter.id) data = data.filter(item => item.id === filter.id);
        if (filter._id) data = data.filter(item => item._id === filter._id);
        if (filter.email) data = data.filter(item => item.email === filter.email);
        if (filter.phone) data = data.filter(item => item.phone === filter.phone);
        if (filter.role) data = data.filter(item => item.role === filter.role);
        if (filter.isActive !== undefined) data = data.filter(item => item.isActive === filter.isActive);
        if (filter.category) data = data.filter(item => item.category === filter.category);
        if (filter.status) data = data.filter(item => item.status === filter.status);
        
        if (filter.$or) {
            data = data.filter(item => 
                filter.$or.some(cond => 
                    (cond.email && item.email === cond.email) ||
                    (cond.phone && item.phone === cond.phone)
                )
            );
        }
        
        return data;
    }

    async findOne(collection, filter) {
        const data = await this.find(collection, filter);
        return data[0] || null;
    }

    async insert(collection, doc) {
        const data = this.read(collection);
        const newDoc = {
            ...doc,
            _id: Date.now().toString() + Math.random().toString(36).substring(2, 10),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        data.push(newDoc);
        this.write(collection, data);
        return newDoc;
    }

    async update(collection, filter, update) {
        const data = this.read(collection);
        const index = data.findIndex(item => 
            (filter._id && item._id === filter._id) ||
            (filter.email && item.email === filter.email)
        );
        
        if (index !== -1) {
            if (update.$set) Object.assign(data[index], update.$set);
            if (update.$inc) {
                Object.keys(update.$inc).forEach(key => {
                    data[index][key] = (data[index][key] || 0) + update.$inc[key];
                });
            }
            data[index].updatedAt = new Date().toISOString();
            this.write(collection, data);
            return { modified: 1 };
        }
        return { modified: 0 };
    }

    async delete(collection, filter) {
        let data = this.read(collection);
        const newData = data.filter(item => item._id !== filter._id);
        this.write(collection, newData);
        return { deleted: data.length - newData.length };
    }

    async count(collection, filter = {}) {
        const data = await this.find(collection, filter);
        return data.length;
    }
}

const db = new AdvancedDatabase();

// ==================== Middleware ====================
const auth = async (req, res, next) => {
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
};

const adminOnly = (req, res, next) => {
    if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'غير مصرح به - صلاحيات المدير مطلوبة' });
    }
    next();
};

app.use(auth);

// ==================== تهيئة البيانات الأساسية ====================
async function initializeData() {
    // إنشاء المدير
    const admin = await db.findOne('users', { email: 'alradi@gmail.com' });
    if (!admin) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await db.insert('users', {
            fullName: 'الرعدي',
            email: 'alradi@gmail.com',
            phone: '+966500000000',
            password: hashedPassword,
            role: 'superadmin',
            isActive: true,
            loyaltyPoints: 10000,
            loyaltyTier: 'أسطوري',
            createdAt: new Date().toISOString()
        });
        console.log('✅ تم إنشاء حساب المدير: alradi@gmail.com / admin123');
    }

    // إنشاء عملاء تجريبيين
    const customer = await db.findOne('users', { email: 'customer@alradi.com' });
    if (!customer) {
        const hashedPassword = await bcrypt.hash('customer123', 10);
        await db.insert('users', {
            fullName: 'أبو يزن',
            email: 'customer@alradi.com',
            phone: '+966511111111',
            password: hashedPassword,
            role: 'customer',
            isActive: true,
            loyaltyPoints: 1250,
            loyaltyTier: 'ذهبي',
            createdAt: new Date().toISOString()
        });
        console.log('✅ تم إنشاء حساب العميل: customer@alradi.com / customer123');
    }

    // إنشاء المنتجات
    const productsCount = await db.count('products');
    if (productsCount === 0) {
        const products = [
            { name: '📱 ساعة ذكية فاخرة Pro Max', price: 599, comparePrice: 899, stock: 50, category: 'إلكترونيات', description: 'شاشة AMOLED، مقاومة للماء، GPS، مراقبة الصحة', isActive: true, isFeatured: true, salesCount: 45, rating: 4.5, ratingCount: 120, images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'] },
            { name: '🎧 سماعات لاسلكية بريميوم ANC', price: 349, stock: 100, category: 'إلكترونيات', description: 'إلغاء الضوضاء، جودة Hi-Res، بطارية 30 ساعة', isActive: true, isFeatured: true, salesCount: 72, rating: 4.2, ratingCount: 85, images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'] },
            { name: '🧴 عطر شرقي فاخر 100ml', price: 450, comparePrice: 600, stock: 30, category: 'عطور', description: 'العود، المسك، العنبر، الورد، الزعفران', isActive: true, salesCount: 150, rating: 4.8, ratingCount: 200, images: ['https://images.unsplash.com/photo-1541643600914-78b084683601?w=400'] },
            { name: '👜 حقيبة يد جلد طبيعي', price: 799, stock: 15, category: 'أزياء', description: 'جلد طبيعي 100%، صناعة يدوية', isActive: true, salesCount: 20, rating: 4.0, ratingCount: 45, images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400'] },
            { name: '📱 هاتف ذكي Ultra 5G', price: 2999, comparePrice: 3499, stock: 12, category: 'إلكترونيات', description: 'شاشة 6.8 بوصة، كاميرا 200MP', isActive: true, isFeatured: true, salesCount: 90, rating: 4.7, ratingCount: 310, images: ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400'] },
            { name: '⌚ ساعة رياضية ذكية', price: 299, stock: 75, category: 'ساعات', description: 'مقاومة للماء 50 متر، تتبع اللياقة', isActive: true, salesCount: 234, rating: 4.3, ratingCount: 89, images: ['https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400'] },
            { name: '👟 حذاء رياضي', price: 399, stock: 45, category: 'أحذية', description: 'خفيف الوزن، نعل مريح', isActive: true, salesCount: 67, rating: 4.4, ratingCount: 56, images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400'] }
        ];
        
        for (const p of products) {
            await db.insert('products', p);
        }
        console.log('✅ تم إنشاء 7 منتجات افتراضية');
    }

    // إنشاء الأقسام
    const categoriesCount = await db.count('categories');
    if (categoriesCount === 0) {
        const categories = [
            { name: 'إلكترونيات', icon: '📱', isActive: true, order: 1 },
            { name: 'أزياء', icon: '👕', isActive: true, order: 2 },
            { name: 'عطور', icon: '🧴', isActive: true, order: 3 },
            { name: 'ساعات', icon: '⌚', isActive: true, order: 4 },
            { name: 'أحذية', icon: '👟', isActive: true, order: 5 }
        ];
        for (const c of categories) {
            await db.insert('categories', c);
        }
        console.log('✅ تم إنشاء 5 أقسام افتراضية');
    }

    // إنشاء الكوبونات
    const couponsCount = await db.count('coupons');
    if (couponsCount === 0) {
        const coupons = [
            { code: 'WELCOME10', discountType: 'percentage', discountValue: 10, minOrder: 100, maxUses: 1000, usedCount: 0, isActive: true, description: 'خصم 10% للعملاء الجدد' },
            { code: 'RAAD40', discountType: 'percentage', discountValue: 40, minOrder: 200, maxUses: 500, usedCount: 0, isActive: true, description: 'خصم 40% على جميع المنتجات' },
            { code: 'FLASH50', discountType: 'fixed', discountValue: 50, minOrder: 500, maxUses: 500, usedCount: 0, isActive: true, description: 'خصم 50 ريال' }
        ];
        for (const c of coupons) {
            await db.insert('coupons', c);
        }
        console.log('✅ تم إنشاء 3 كوبونات افتراضية');
    }
}

// ==================== API Routes ====================

// المصادقة
app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        
        const user = await db.findOne('users', { 
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
        
        const existingUser = await db.findOne('users', { 
            $or: [{ phone }, { email }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ error: 'رقم الجوال أو البريد الإلكتروني مسجل مسبقاً' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = await db.insert('users', {
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
        
        let products = await db.find('products', { isActive: true });
        
        if (category && category !== 'all') {
            products = products.filter(p => p.category === category);
        }
        
        if (search) {
            const term = search.toLowerCase();
            products = products.filter(p => 
                p.name.toLowerCase().includes(term) || 
                (p.description && p.description.toLowerCase().includes(term))
            );
        }
        
        // الترتيب
        if (sort === 'price-asc') products.sort((a, b) => a.price - b.price);
        else if (sort === 'price-desc') products.sort((a, b) => b.price - a.price);
        else if (sort === 'bestselling') products.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
        else products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        const total = products.length;
        const start = (page - 1) * limit;
        const paginated = products.slice(start, start + limit);
        
        res.json({
            success: true,
            data: paginated,
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
        const product = await db.findOne('products', { _id: req.params.id });
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
        const categories = await db.find('categories', { isActive: true });
        res.json({ success: true, data: categories });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// البانرات
app.get('/api/banners', async (req, res) => {
    try {
        const banners = await db.find('banners', { isActive: true });
        res.json({ success: true, data: banners });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// الكوبونات
app.get('/api/coupons', async (req, res) => {
    try {
        const coupons = await db.find('coupons', { isActive: true });
        res.json({ success: true, data: coupons });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

app.post('/api/coupons/validate', async (req, res) => {
    try {
        const { code, subtotal } = req.body;
        const coupon = await db.findOne('coupons', { code: code.toUpperCase(), isActive: true });
        
        if (!coupon) {
            return res.status(400).json({ error: 'الكوبون غير صالح' });
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
        
        const user = await db.findOne('users', { _id: req.user.id });
        if (!user) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }
        
        let subtotal = 0;
        for (const item of items) {
            const product = await db.findOne('products', { _id: item.productId });
            if (!product) {
                return res.status(400).json({ error: `المنتج ${item.name} غير موجود` });
            }
            subtotal += product.price * item.quantity;
        }
        
        const shippingCost = subtotal >= 500 ? 0 : 25;
        const tax = subtotal * 0.15;
        const total = subtotal + shippingCost + tax;
        
        const orderNumber = `RAAD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        
        const newOrder = await db.insert('orders', {
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
        const orders = await db.find('orders');
        const products = await db.find('products');
        const users = await db.find('users', { role: 'customer' });
        
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
        const orders = await db.find('orders');
        res.json({ success: true, data: orders.reverse() });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// لوحة المدير - جميع العملاء
app.get('/api/admin/customers', adminOnly, async (req, res) => {
    try {
        const users = await db.find('users', { role: 'customer' });
        res.json({ success: true, data: users });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// لوحة المدير - جميع المنتجات
app.get('/api/admin/products', adminOnly, async (req, res) => {
    try {
        const products = await db.find('products');
        res.json({ success: true, data: products });
    } catch (error) {
        res.json({ success: true, data: [] });
    }
});

// لوحة المدير - تحديث حالة الطلب
app.put('/api/admin/orders/:id/status', adminOnly, async (req, res) => {
    try {
        const { status } = req.body;
        await db.update('orders', { _id: req.params.id }, { $set: { status } });
        res.json({ success: true, message: 'تم تحديث حالة الطلب' });
    } catch (error) {
        res.status(500).json({ error: 'فشل التحديث' });
    }
});

// لوحة المدير - تحديث المنتج
app.put('/api/admin/products/:id', adminOnly, async (req, res) => {
    try {
        await db.update('products', { _id: req.params.id }, { $set: req.body });
        res.json({ success: true, message: 'تم تحديث المنتج' });
    } catch (error) {
        res.status(500).json({ error: 'فشل التحديث' });
    }
});

// لوحة المدير - حذف المنتج
app.delete('/api/admin/products/:id', adminOnly, async (req, res) => {
    try {
        await db.delete('products', { _id: req.params.id });
        res.json({ success: true, message: 'تم حذف المنتج' });
    } catch (error) {
        res.status(500).json({ error: 'فشل الحذف' });
    }
});

// ملف تعريف المستخدم
app.get('/api/user/profile', auth, async (req, res) => {
    try {
        const user = await db.findOne('users', { _id: req.user.id });
        if (!user) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }
        const { password, ...userData } = user;
        res.json({ success: true, data: userData });
    } catch (error) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// الصفحات
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin/*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// بدء التشغيل
async function startServer() {
    await initializeData();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║  🦅 الرعدي أونلاين – النسخة النهائية v20.0                         ║
║  ⚡ نظام تجارة إلكترونية متكامل                                     ║
╠══════════════════════════════════════════════════════════════════════╣
║  🌐 الخادم: http://localhost:${PORT}                                 ║
║  👑 لوحة المدير: http://localhost:${PORT}/admin                      ║
╠══════════════════════════════════════════════════════════════════════╣
║  🔐 بيانات الدخول:                                                  ║
║  👤 المدير: alradi@gmail.com  |  كلمة السر: admin123               ║
║  👤 العميل: customer@alradi.com  |  كلمة السر: customer123         ║
╠══════════════════════════════════════════════════════════════════════╣
║  💾 التخزين: JSON Files (LocalDB)                                   ║
║  🚀 جاهز للتشغيل الفوري                                             ║
╚══════════════════════════════════════════════════════════════════════╝
        `);
    });
}

startServer();
