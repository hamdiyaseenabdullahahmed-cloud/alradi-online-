const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// مصفوفات برمجية مؤقتة لتخزين البيانات داخل السيرفر
let products = [
    { id: 1, name: "شاشة ذكية 55 بوصة", price_sar: 1500, category: "electronics", stock: 12, img: "https://via.placeholder.com/150" },
    { id: 2, name: "مكيف سبليت فاخر", price_sar: 2200, category: "appliances", stock: 5, img: "https://via.placeholder.com/150" }
];
let orders = [];

// تشغيل وقراءة المجلد العام public الذي يحتوي على واجهاتك
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 1️⃣ تشغيل الواجهة الرئيسية التلقائية لمتجر الرعدي
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2️⃣ [API] جلب قائمة المنتجات للمتجر ولوحة التحكم
app.get('/api/products', (req, res) => {
    res.json(products);
});

// 3️⃣ [API] إضافة منتج جديد من لوحة تحكم المدير (تتكامل مع admin.js)
app.post('/api/products/add', (req, res) => {
    const { name, price_sar, category, stock, img } = req.body;
    
    if (!name || !price_sar) {
        return res.status(400).json({ success: false, message: "الاسم والسعر مطلوبان!" });
    }

    const newProduct = {
        id: products.length + 1,
        name,
        price_sar: Number(price_sar),
        category: category || "عام",
        stock: Number(stock) || 0,
        img: img || "https://via.placeholder.com/150"
    };

    products.push(newProduct);
    res.json({ success: true, message: "تم إضافة المنتج بنجاح لمتجر الرعدي!", products });
});

// 4️⃣ [API] استقبال الطلبات وإنشاء الفاتورة مع سياسة الـ 14 يوماً
app.post('/api/orders/create', (req, res) => {
    const { customerName, cartItems, totalAmount } = req.body;

    const newOrder = {
        orderId: "RAD-" + Math.floor(100000 + Math.random() * 900000),
        customerName,
        cartItems,
        totalAmount,
        currency: "SAR",
        policy: "الاستبدال مسموح خلال 14 يوماً من تاريخ الاستلام بشرط أن يكون المنتج بحالته الأصلية",
        date: new Date()
    };

    orders.push(newOrder);
    res.json({ success: true, message: "تم تسجيل طلبك بنجاح!", order: newOrder });
});

// تشغيل السيرفر والاستماع للطلبات عبر رندر
app.listen(PORT, () => {
    console.log(`سيرفر متجر الرعدي اون لاين المطور يعمل بنجاح على المنفذ: ${PORT}`);
});
