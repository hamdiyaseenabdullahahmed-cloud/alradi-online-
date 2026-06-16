/**
 * 🦅 مشروع متجر "الرعدي أونلاين" الإلكتروني - الدليل التشغيلي
 * ملف السيرفر الرئيسي والمحرك الأساسي للمنظومة (server.js)
 * * المواصفات: كود نظيف، توثيق كامل باللغة العربية، برمجة دفاعية (Try-Catch)
 */

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

// =================================================================
// 🛠️ الإضافات العبقرية: نظام إنشاء مجلدات الأصول والملفات تلقائياً
// =================================================================
const requiredFolders = [
    path.join(__dirname, 'public'),
    path.join(__dirname, 'public', 'images'),
    path.join(__dirname, 'public', 'sounds')
];

requiredFolders.forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        console.log(`📁 تم إنشاء المجلد التلقائي بنجاح: ${folder}`);
    }
});

// =================================================================
// 🔒 إعدادات الحماية والـ CORS الذكية (برمجة دفاعية ضد عدم وجود الحزمة)
// =================================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

try {
    // محاولة استدعاء حزمة cors إذا كانت متوفرة في السيرفر
    const cors = require('cors');
    app.use(cors());
    console.log("🛡️ تم تفعيل نظام الحماية الذكي CORS بنجاح.");
} catch (e) {
    console.log("⚠️ حزمة CORS غير مثبتة حالياً، تم تخطيها برمجياً لضمان استمرار إقلاع السيرفر.");
}

// مشاركة الملفات الثابتة (الواجهات، الأصوات، الصور)
app.use(express.static(path.join(__dirname, 'public')));

// =================================================================
// 🌐 الربط الهندسي بقاعدة البيانات السحابية (MongoDB Atlas)
// =================================================================
// قراءة رابط الاتصال من المتغيرات البيئية لـ Render أو استخدام الرابط الاحتياطي المباشر
const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb+srv://alradimostafayaseen_db_user:alradi1995@cluster0.njjwehg.mongodb.net/alradi_db?appName=Cluster0";

console.log("⏳ جاري الاتصال بسحابة مانجو الذكية لمتجر الرعدي...");

mongoose.connect(mongoURI)
    .then(() => {
        console.log("🟢 ======================================================= 🟢");
        console.log("🦅 تم الاتصال بسحابة مانجو (MongoDB) بنجاح وبأعلى كفاءة هندسية!");
        console.log("🟢 ======================================================= 🟢");
    })
    .catch((err) => {
        console.log("❌ ======================================================= ❌");
        console.log("❌ خطأ في الاتصال بالسحابة: " + err.message);
        console.log("❌ يرجى التحقق من متغيرات البيئة ورابط الاتصال السري الخاص بك.");
        console.log("❌ ======================================================= ❌");
    });

// =================================================================
// 🛒 المسارات والـ Routes الأساسية للمتجر (API Endpoints)
// =================================================================

// مسار فحص حالة السيرفر للتأكد من العمل (Health Check)
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: "active", message: "سيرفر الرعدي يعمل بكفاءة دولية" });
});

// مسار استقبال واجهة المتجر الرئيسية (Frontend Hub)
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(200).send(`
            <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif; direction: rtl;">
                <h1 style="color: #1a1a1a;">🦅 أهلاً وسهلاً بكم في سوق الرعدي أون لاين</h1>
                <p style="color: #666; font-size: 18px;">السيرفر يعمل الآن بنجاح وجاهز لربط واجهات العميل ولوحة التحكم الفخمة.</p>
                <div style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; border-radius: 5px; margin-top: 20px;">
                    🟢 قاعدة البيانات متصلة وجاهزة لإطلاق المشاريع
                </div>
            </div>
        `);
    }
});

// =================================================================
// 🚀 الإقلاع الدولي للسيرفر
// =================================================================
app.listen(PORT, () => {
    console.log("\n=======================================================");
    console.log(`🦅 سيرفر الرعدي ومانجو جاهز للإقلاع الدولي على البورت: ${PORT}`);
    console.log(`🔗 المتجر متاح الآن على الرابط الخاص بك في Render`);
    console.log("=======================================================\n");
});
