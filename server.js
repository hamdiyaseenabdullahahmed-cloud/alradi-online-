const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// خدمة الملفات من الجذر (بدون مجلد public)
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 متجر الرعدي يعمل على المنفذ ${PORT}`);
});
