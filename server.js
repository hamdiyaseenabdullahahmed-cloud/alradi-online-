// ⚡ الرعدي أونلاين – الخادم الأسطوري v10.0 FINAL
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

// استيراد الـ Worker الجديد
const { generateInvoiceWorker } = require('./workers/pdfWorker');

const app = express();
const server = require('http').createServer(app);

// الإعدادات الأمنية والأداء
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// ربط قاعدة البيانات السحابية (MongoDB Atlas)
const connectDB = async () => {
    try {
        // نعتمد على الرابط الموجود في متغيرات البيئة (Environment Variables) في Render
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ تم الاتصال بقاعدة البيانات السحابية بنجاح');
    } catch (err) {
        console.error('❌ فشل الاتصال بقاعدة البيانات، تأكد من الرابط في إعدادات Render:', err.message);
        process.exit(1);
    }
};

// مسار إنشاء الفاتورة (الربط الاحترافي)
app.post('/api/generate-invoice', async (req, res) => {
    try {
        const orderData = req.body; 
        
        // تشغيل الـ Worker في الخلفية (هندسة احترافية)
        generateInvoiceWorker(orderData)
            .then(filePath => console.log(`✅ تم إنشاء الفاتورة: ${filePath}`))
            .catch(err => console.error('❌ خطأ في الـ Worker:', err));

        res.status(202).json({ 
            success: true, 
            message: "جاري معالجة الفاتورة في الخلفية",
            invoiceUrl: `/invoices/invoice-${orderData.id}.pdf`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "فشل طلب إنشاء الفاتورة" });
    }
});

// باقي المسارات الأساسية
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// بدء التشغيل
const PORT = process.env.PORT || 3000;
(async () => {
    // التأكد من وجود المجلدات قبل التشغيل
    const dirs = ['public', 'uploads', 'public/invoices'];
    dirs.forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

    await connectDB();
    server.listen(PORT, () => {
        console.log('╔══════════════════════════════════════════╗');
        console.log('║   🦅 الرعدي أونلاين – الإصدار الأسطوري  ║');
        console.log(`║   🌐 التشغيل على المنفذ: ${PORT}           ║`);
        console.log('╚══════════════════════════════════════════╝');
    });
})();
