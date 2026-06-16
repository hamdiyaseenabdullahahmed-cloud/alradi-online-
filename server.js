const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// قاعدة بيانات داخلية مؤقتة (تخزين في الذاكرة الحية للسيرفر)
let products = [
    {
        id: 1,
        name: "شاشة ذكية 55 بوصة Ultra HD",
        price_sar: 1499,
        category: "electronics",
        stock: 10,
        img: "https://via.placeholder.com/300?text=TV+55"
    },
    {
        id: 2,
        name: "مكيف سبليت روتاري فخم",
        price_sar: 2199,
        category: "appliances",
        stock: 5,
        img: "https://via.placeholder.com/300?text=Air+Conditioner"
    },
    {
        id: 3,
        name: "خلاط كهربائي متكامل بقوة 1000 واط",
        price_sar: 250,
        category: "appliances",
        stock: 15,
        img: "https://via.placeholder.com/300?text=Blender"
    }
];

let orders = [];
let users = [
    { username: "admin", password: "adminpassword", role: "admin" } // حساب مدير افتراضي للدخول للوحة التحكم
];

// إعدادات قراءة الملفات من المجلد العام public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// توجيه الواجهة الرئيسية للموقع
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== APIs نظام المستخدمين والدخول ====================

// تسجيل حساب جديد للعملاء
app.post('/api/auth/register', (req, res) => {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password) {
        return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة لتسجيل الحساب!" });
    }
    
    const userExists = users.find(u => u.username === phone);
    if (userExists) {
        return res.status(400).json({ success: false, message: "هذا الرقم مسجل مسبقاً في المتجر!" });
    }

    users.push({ username: phone, name: name, password: password, role: "customer" });
    res.json({ success: true, message: "تم إنشاء حسابك الفاخر بنجاح في مَتْجَر الرَّعْدِي!" });
});

// تسجيل الدخول (للعملاء والمدير)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    
    if (!user) {
        return res.status(401).json({ success: false, message: "خطأ في اسم المستخدم أو كلمة المرور!" });
    }

    res.json({ 
        success: true, 
        message: `مرحباً بك مجدداً في الرعدي أونلاين`,
        user: { name: user.name || user.username, role: user.role }
    });
});

// ==================== APIs إدارة المنتجات (المتجر واللوحة) ====================

// جلب المنتجات
app.get('/api/products', (req, res) => {
    res.json(products);
});

// إضافة منتج جديد (من لوحة التحكم للمدير)
app.post('/api/products/add', (req, res) => {
    const { name, price_sar, category, stock, img } = req.body;
    
    if (!name || !price_sar || !stock) {
        return res.status(400).json({ success: false, message: "الاسم، السعر والمخزون حقول إجبارية!" });
    }

    const newProduct = {
        id: products.length + 1,
        name,
        price_sar: Number(price_sar),
        category: category || "general",
        stock: Number(stock),
        img: img || "https://via.placeholder.com/300?text=Product"
    };

    products.push(newProduct);
    res.json({ success: true, message: "تم إضافة المنتج بنجاح إلى مخزون المتجر!", product: newProduct });
});

// حذف منتج (من لوحة التحكم للمدير)
app.delete('/api/products/delete/:id', (req, res) => {
    const id = Number(req.params.id);
    products = products.filter(p => p.id !== id);
    res.json({ success: true, message: "تم حذف المنتج بنجاح من النظام!" });
});


// ==================== APIs الطلبات والفواتير وإحصائيات المدير ====================

// إنشاء طلب شراء جديد وتوليد بيانات الفاتورة الرسمية
app.post('/api/orders/create', (req, res) => {
    const { customerName, customerPhone, cartItems, totalAmount } = req.body;

    if (!cartItems || cartItems.length === 0) {
        return res.status(400).json({ success: false, message: "السلة فارغة، لا يمكن إتمام الطلب!" });
    }

    // خصم الكميات من المخزون وتحديث المنتجات
    cartItems.forEach(item => {
        const product = products.find(p => p.id === item.id);
        if (product && product.stock >= item.quantity) {
            product.stock -= item.quantity;
        }
    });

    const newOrder = {
        orderId: "RAD-" + Math.floor(100000 + Math.random() * 900000),
        customerName,
        customerPhone,
        items: cartItems,
        total: totalAmount,
        currency: "SAR",
        date: new Date().toLocaleDateString('ar-SA'),
        policy: "الاستبدال مسموح خلال 14 يوماً من تاريخ الاستلام بشرط أن يكون المنتج بحالته الأصلية."
    };

    orders.push(newOrder);
    res.json({ success: true, message: "تم تسجيل طلبك وإصدار الفاتورة الفاخرة!", order: newOrder });
});

// جلب الإحصائيات الحية ولوحة التحكم للمدير
app.get('/api/admin/dashboard', (req, res) => {
    const totalSales = orders.reduce((sum, order) => sum + Number(order.total), 0);
    res.json({
        totalSales: totalSales,
        ordersCount: orders.length,
        productsCount: products.length,
        recentOrders: orders
    });
});

// تشغيل واستماع السيرفر
app.listen(PORT, () => {
    console.log(`سيرفر منصة الرعدي أونلاين المتكامل يعمل بكفاءة على المنفذ: ${PORT}`);
});
