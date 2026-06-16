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

// ربط قاعدة البيانات
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alradiStore');
        console.log('✅ تم الاتصال بقاعدة البيانات');
    } catch (err) {
        console.error('❌ فشل الاتصال:', err.message);
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
    await connectDB();
    server.listen(PORT, () => {
        console.log('╔══════════════════════════════════════════╗');
        console.log('║   🦅 الرعدي أونلاين – الإصدار الأسطوري  ║');
        console.log(`║   🌐 التشغيل على المنفذ: ${PORT}           ║`);
        console.log('╚══════════════════════════════════════════╝');
    });
})();
