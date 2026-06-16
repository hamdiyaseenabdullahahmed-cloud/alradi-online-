const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// قاعدة البيانات الحية المؤقتة بداخل السيرفر
let products = [
    { id: 1, name: "شاشة ذكية 55 بوصة Ultra HD", price_sar: 1499, category: "electronics", stock: 10 },
    { id: 2, name: "مكيف سبليت روتاري فخم", price_sar: 2199, category: "appliances", stock: 5 },
    { id: 3, name: "خلاط كهربائي متكامل 1000 واط", price_sar: 250, category: "appliances", stock: 14 },
    { id: 4, name: "هاتف آل تي ذكي متطور", price_sar: 400, category: "electronics", stock: 40 }
];

let orders = [];
let salesTotal = 0;

// حساب المدير الافتراضي للدخول المباشر
const ADMIN_USER = {
    email: "alradi@gmail.com",
    password: "adminpassword",
    name: "أبو يزن الرعدي"
};

// مسار تشغيل الواجهة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// [API] تسجيل الدخول والتحقق من رتبة العميل أو المدير
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    if (email === ADMIN_USER.email && password === ADMIN_USER.password) {
        return res.json({ success: true, role: "admin", name: ADMIN_USER.name });
    }
    
    // تسجيل دخول افتراضي للعملاء العاديين لتسهيل التجربة
    if (email && password && email.includes('@')) {
        return res.json({ success: true, role: "customer", name: email.split('@')[0] });
    }

    res.status(401).json({ success: false, message: "بيانات الدخول غير صحيحة!" });
});

// [API] جلب قائمة المنتجات الحية للمتجر وللوحة التحكم
app.get('/api/products', (req, res) => {
    res.json(products);
});

// [API] إضافة منتج جديد من لوحة تحكم المدير
app.post('/api/products/add', (req, res) => {
    const { name, price_sar, category, stock } = req.body;
    if (!name || !price_sar || !stock) {
        return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة لإدخال المنتج!" });
    }

    const newProduct = {
        id: Date.now(),
        name,
        price_sar: Number(price_sar),
        category,
        stock: Number(stock)
    };
    products.push(newProduct);
    res.json({ success: true, message: "تم ضخ المنتج الجديد في المخازن بنجاح!" });
});

// [API] حذف منتج نهائيًا من النظام
app.delete('/api/products/delete/:id', (req, res) => {
    const id = Number(req.params.id);
    products = products.filter(p => p.id !== id);
    res.json({ success: true, message: "تم حذف المنتج وتحديث المخزن الإداري!" });
});

// [API] إنشاء الطلب، خصم المخزون، وحساب الأرباح الحية للوحة
app.post('/api/orders/create', (req, res) => {
    const { customerName, cartItems, totalAmount } = req.body;
    
    // تحديث كميات المخزون في السيرفر
    cartItems.forEach(item => {
        const product = products.find(p => p.id === item.id);
        if (product) {
            product.stock = Math.max(0, product.stock - item.quantity);
        }
    });

    const newOrder = {
        orderId: "RAD-" + Math.floor(100000 + Math.random() * 900000),
        customerName,
        items: cartItems,
        total: totalAmount,
        date: new Date().toLocaleDateString('ar-SA'),
        policy: "الاستبدال مسموح خلال 14 يوماً من تاريخ الاستلام بشرط أن يكون المنتج بحالته الأصلية."
    };

    orders.push(newOrder);
    salesTotal += Number(totalAmount);

    res.json({ success: true, order: newOrder, salesTotal, ordersCount: orders.length });
});

// [API] جلب الإحصائيات الفورية للوحة تحكم المدير
app.get('/api/admin/stats', (req, res) => {
    res.json({
        salesTotal,
        ordersCount: orders.length,
        productsCount: products.length
    });
});

app.listen(PORT, () => {
    console.log(`سيرفر الرعدي أونلاين يعمل بكفاءة عظمى على المنفذ: ${PORT}`);
});
