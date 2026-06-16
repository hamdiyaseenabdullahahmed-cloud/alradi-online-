// workers/pdfWorker.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateInvoiceWorker = async (orderData) => {
    return new Promise((resolve, reject) => {
        const dir = path.join(__dirname, '../public/invoices');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        const filePath = path.join(dir, `invoice-${orderData.id}.pdf`);
        const doc = new PDFDocument();
        
        doc.pipe(fs.createWriteStream(filePath));
        doc.fontSize(25).text('فاتورة الرعدي أونلاين', { align: 'center' });
        doc.moveDown();
        doc.fontSize(15).text(`رقم الطلب: ${orderData.id}`);
        doc.text(`الإجمالي: ${orderData.total} ريال سعودي`);
        doc.end();
        
        doc.on('finish', () => resolve(filePath));
        doc.on('error', reject);
    });
};

module.exports = { generateInvoiceWorker };
