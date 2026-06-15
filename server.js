/* ==========================================================================
   🚀 محرك تشغيل السيرفر الدولي لمتجر الرعدي المتصل بسحابة MongoDB (server.js)
   ========================================================================== */

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// تفعيل قراءة البيانات بصيغة JSON القادمة من المتجر
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🌐 رابط الاتصال المباشر بسحابتك (MongoDB)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://root:admin123@cluster0.mongodb.net/alradi_db?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
.then(() => console.log("🥭 تم تأمين الاتصال بنجاح بسحابة MongoDB العالمية!"))
.catch(err => console.error("❌ خطأ في الاتصال بالسحابة:", err));

// --- 📊 بناء الهياكل البرمجية (Schemas & Models) داخل MongoDB ---

// 1. هيكل المنتجات
const ProductSchema = new mongoose.Schema({
    id: Number,
    title_ar: String,
    title_en: String,
    category: String,
    price_new: Number,
    price_old: Number,
    stock: Number,
    image_url: String,
    description: String
});
const Product = mongoose.model('Product', ProductSchema);

// 2. هيكل فواتير المبيعات
const InvoiceSchema = new mongoose.Schema({
    invoiceId: String,
    date: String,
    clientName: String,
    clientIdentity: String,
    address: String,
    logisticsType: String,
    paymentType: String,
    currencyType: String,
    items: Array,
    subtotal: Number,
    discount: Number,
    grandTotal: Number
});
const Invoice = mongoose.model('Invoice', InvoiceSchema);


// --- 🔌 ممرات العمليات (API Routes) لربط الـ Frontend بالسحابة ---

// ممر [1]: جلب جميع المنتجات من MongoDB للكتالوج
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: "خطأ في جلب المنتجات من السحابة" });
    }
});

// ممر [2]: إضافة منتج جديد من لوحة المدير وحفظه في السحابة
app.post('/api/products', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.status(201).json({ success: true, message: "تم حفظ المنتج في MongoDB!" });
    } catch (err) {
        res.status(500).json({ error: "خطأ أثناء حفظ المنتج بالسحابة" });
    }
});

// ممر [3]: حذف منتج نهائياً من السحابة بواسطة المعرف (ID)
app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.deleteOne({ id: req.params.id });
        res.json({ success: true, message: "تم مسح المنتج من السحابة" });
    } catch (err) {
        res.status(500).json({ error: "خطأ في حذف المنتج" });
    }
});

// ممر [4]: حفظ فاتورة مشتريات جديدة للعميل (أبو يزن / الرعدي)
app.post('/api/invoices', async (req, res) => {
    try {
        const newInvoice = new Invoice(req.body);
        await newInvoice.save();
        res.status(201).json({ success: true, message: "تم توثيق وأرشفة الفاتورة سحابياً بنجاح!" });
    } catch (err) {
        res.status(500).json({ error: "خطأ في إصدار وأرشفة الفاتورة" });
    }
});


// توجيه السيرفر لقراءة ملفات الواجهة الأمامية بداخل مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// مسار افتراضي لتشغيل واجهة المتجر الرئيسية
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🦅 سيرفر الرعدي ومانجو جاهز للإقلاع الدولي على البورت: ${PORT}`);
});
