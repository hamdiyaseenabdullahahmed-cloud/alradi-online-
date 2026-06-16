// =============================================
// متجر الرعدي أون لاين - alradi-online
// الملف الرئيسي للسيرفر
// =============================================

const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();

// =============================================
// إعدادات الحماية المتقدمة
// =============================================

// Helmet - حماية من الثغرات الشائعة
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            mediaSrc: ["'self'", "data:", "blob:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'", "ws:", "wss:"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// CORS - التحكم في النطاقات
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
}));

// Rate Limiting - الحماية من هجمات القوة الغاشمة
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'عدد الطلبات كبير جداً، الرجاء المحاولة لاحقاً',
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api', globalLimiter);

// Rate Limiter مخصص لصفحة تسجيل الدخول
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
    message: 'محاولات تسجيل دخول كثيرة جداً، الرجاء الانتظار 15 دقيقة',
    skipSuccessfulRequests: true
});
app.use('/auth/login', loginLimiter);

// حماية من حقن MongoDB
app.use(mongoSanitize());

// حماية من هجمات XSS
app.use(xss());

// حماية من تلويث المعاملات
app.use(hpp());

// ضغط الملفات لتسريع الموقع
app.use(compression());

// تسجيل سجلات الزوار
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// =============================================
// إعدادات قاعدة البيانات
// =============================================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alradi_online';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');
    
    // إنشاء حساب المدير الافتراضي تلقائياً
    const User = require('./models/User');
    const StoreSettings = require('./models/StoreSettings');
    
    // إنشاء إعدادات المتجر الافتراضية
    let settings = await StoreSettings.findOne();
    if (!settings) {
        settings = new StoreSettings({
            storeName: process.env.STORE_NAME_AR || 'متجر الرعدي أون لاين',
            storeNameEn: process.env.STORE_NAME_EN || 'Al-Radi Online Store',
            storeLogo: '/images/default-logo.png',
            storeDescription: 'متجر إلكتروني متكامل للتسوق العالمي',
            contactEmail: process.env.ADMIN_EMAIL || 'alradi@gmil.com',
            phoneNumber: process.env.STORE_WHATSAPP || '966500000000',
            currency: process.env.STORE_CURRENCY || 'SAR',
            shippingInternal: parseFloat(process.env.DEFAULT_SHIPPING_INTERNAL) || 25,
            shippingInternational: parseFloat(process.env.DEFAULT_SHIPPING_INTERNATIONAL) || 75,
            voiceGreetingEnabled: process.env.VOICE_GREETING_ENABLED === 'true',
            voiceInteractionsEnabled: process.env.VOICE_INTERACTIONS_ENABLED === 'true'
        });
        await settings.save();
        console.log('✅ تم إنشاء إعدادات المتجر الافتراضية');
    }
    
    // إنشاء حساب المدير الافتراضي
    const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL || 'alradi@gmil.com' });
    if (!adminExists) {
        const admin = new User({
            name: 'مدير النظام',
            username: process.env.ADMIN_USERNAME || 'AlRadiAdmin',
            email: process.env.ADMIN_EMAIL || 'alradi@gmil.com',
            password: process.env.ADMIN_PASSWORD || 'admin123',
            role: 'admin',
            isActive: true
        });
        await admin.save();
        console.log('✅ تم إنشاء حساب المدير الافتراضي');
        console.log('📧 البريد الإلكتروني:', process.env.ADMIN_EMAIL || 'alradi@gmil.com');
        console.log('🔑 كلمة المرور:', process.env.ADMIN_PASSWORD || 'admin123');
    }
}).catch(err => {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err);
});

// =============================================
// إعدادات المحرك والمسارات
// =============================================

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// =============================================
// Middleware
// =============================================

// الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// معالجة البيانات
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// إعدادات الجلسات
app.use(session({
    secret: process.env.SESSION_SECRET || 'alradi-thunder-session-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 يوم
        sameSite: 'lax'
    }
}));

// Flash messages
app.use(flash());

// =============================================
// المتغيرات العامة لجميع القوالب
// =============================================

app.use(async (req, res, next) => {
    try {
        const StoreSettings = require('./models/StoreSettings');
        let storeSettings = await StoreSettings.findOne();
        
        if (!storeSettings) {
            storeSettings = {
                storeName: 'متجر الرعدي أون لاين',
                storeNameEn: 'Al-Radi Online Store',
                storeLogo: '/images/default-logo.png',
                storeDescription: 'متجر إلكتروني متكامل',
                currency: 'SAR',
                voiceGreetingEnabled: true,
                voiceInteractionsEnabled: true
            };
        }
        
        // حساب عدد عناصر السلة
        let cartCount = 0;
        if (req.session.cart) {
            cartCount = req.session.cart.reduce((total, item) => total + item.quantity, 0);
        }
        
        res.locals.store = storeSettings;
        res.locals.user = req.session.user || null;
        res.locals.cartCount = cartCount;
        res.locals.currentLanguage = req.session.language || 'ar';
        res.locals.currentPath = req.path;
        res.locals.success_msg = req.flash('success_msg');
        res.locals.error_msg = req.flash('error_msg');
        res.locals.info_msg = req.flash('info_msg');
        
        next();
    } catch (error) {
        next();
    }
});

// =============================================
// المسارات الرئيسية
// =============================================

// الصفحة الرئيسية
app.use('/', require('./routes/index'));

// المنتجات
app.use('/products', require('./routes/products'));

// السلة والدفع
app.use('/cart', require('./routes/cart'));

// المصادقة وتسجيل الدخول
app.use('/auth', require('./routes/auth'));

// حساب العميل
app.use('/account', require('./routes/account'));

// لوحة تحكم المدير
app.use('/admin', require('./routes/admin'));

// المحادثات المباشرة
app.use('/chat', require('./routes/chat'));

// API للعمليات الحيوية
app.use('/api', require('./routes/api'));

// =============================================
// نظام المحادثات المباشرة Socket.io
// =============================================

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// تخزين المستخدمين المتصلين
const connectedUsers = new Map();

io.on('connection', (socket) => {
    console.log('🔌 مستخدم جديد متصل:', socket.id);
    
    // تسجيل دخول المستخدم للمحادثة
    socket.on('user-join', (userData) => {
        if (userData && userData.userId) {
            connectedUsers.set(socket.id, {
                userId: userData.userId,
                name: userData.name || 'زائر',
                role: userData.role || 'customer',
                socketId: socket.id
            });
            
            // إشعار المسؤولين بوجود مستخدم جديد
            const admins = Array.from(connectedUsers.values()).filter(u => u.role === 'admin');
            admins.forEach(admin => {
                io.to(admin.socketId).emit('new-visitor', {
                    userId: userData.userId,
                    name: userData.name || 'زائر',
                    socketId: socket.id
                });
            });
        }
    });
    
    // استقبال رسالة جديدة
    socket.on('send-message', (messageData) => {
        const sender = connectedUsers.get(socket.id);
        if (sender && messageData) {
            const message = {
                senderId: sender.userId,
                senderName: sender.name,
                senderRole: sender.role,
                content: messageData.content,
                timestamp: new Date(),
                socketId: socket.id
            };
            
            if (sender.role === 'admin' && messageData.recipientSocketId) {
                // رسالة من المسؤول لعميل محدد
                io.to(messageData.recipientSocketId).emit('new-message', message);
                io.to(socket.id).emit('new-message', message);
            } else {
                // رسالة من عميل - ترسل لجميع المسؤولين
                const admins = Array.from(connectedUsers.values()).filter(u => u.role === 'admin');
                admins.forEach(admin => {
                    io.to(admin.socketId).emit('new-message', message);
                });
                io.to(socket.id).emit('new-message', message);
            }
            
            // حفظ الرسالة في قاعدة البيانات
            try {
                const Message = require('./models/Message');
                const newMessage = new Message({
                    senderId: sender.userId,
                    senderName: sender.name,
                    senderRole: sender.role,
                    content: messageData.content,
                    recipientSocketId: messageData.recipientSocketId || null
                });
                newMessage.save();
            } catch (error) {
                console.error('خطأ في حفظ الرسالة:', error);
            }
        }
    });
    
    // انقطاع الاتصال
    socket.on('disconnect', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            // إشعار المسؤولين بمغادرة المستخدم
            const admins = Array.from(connectedUsers.values()).filter(u => u.role === 'admin');
            admins.forEach(admin => {
                io.to(admin.socketId).emit('user-disconnected', {
                    userId: user.userId,
                    socketId: socket.id
                });
            });
        }
        connectedUsers.delete(socket.id);
        console.log('🔌 مستخدم قطع الاتصال:', socket.id);
    });
});

// جعل io متاحاً لجميع المسارات
app.set('io', io);
app.set('connectedUsers', connectedUsers);

// =============================================
// معالجة الأخطاء
// =============================================

// صفحة 404
app.use((req, res) => {
    res.status(404).render('404', {
        pageTitle: 'الصفحة غير موجودة - 404',
        path: req.url
    });
});

// معالج الأخطاء العام
app.use((err, req, res, next) => {
    console.error('❌ خطأ:', err.stack);
    
    // تسجيل الخطأ في قاعدة البيانات
    try {
        const ErrorLog = require('./models/ErrorLog');
        const errorLog = new ErrorLog({
            message: err.message,
            stack: err.stack,
            url: req.url,
            method: req.method,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            userId: req.session.user ? req.session.user._id : null
        });
        errorLog.save();
    } catch (logError) {
        console.error('خطأ في تسجيل الخطأ:', logError);
    }
    
    const statusCode = err.statusCode || 500;
    res.status(statusCode).render('error', {
        pageTitle: 'خطأ في الخادم',
        error: process.env.NODE_ENV === 'development' ? {
            message: err.message,
            stack: err.stack
        } : {
            message: 'حدث خطأ غير متوقع، الرجاء المحاولة لاحقاً'
        },
        statusCode: statusCode
    });
});

// =============================================
// نظام النسخ الاحتياطي التلقائي
// =============================================

const cron = require('node-cron');
const archiver = require('archiver');
const fs = require('fs');

// جدولة النسخ الاحتياطي (يومياً الساعة 2 صباحاً)
const backupSchedule = process.env.BACKUP_SCHEDULE || '0 2 * * *';

cron.schedule(backupSchedule, async () => {
    console.log('🔄 بدء النسخ الاحتياطي التلقائي...');
    
    try {
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const backupFile = path.join(backupDir, `backup-${timestamp}.zip`);
        
        const output = fs.createWriteStream(backupFile);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        archive.pipe(output);
        
        // نسخ احتياطي لقاعدة البيانات
        const collections = await mongoose.connection.db.listCollections().toArray();
        for (const collection of collections) {
            const data = await mongoose.connection.db.collection(collection.name).find({}).toArray();
            archive.append(JSON.stringify(data, null, 2), { name: `${collection.name}.json` });
        }
        
        await archive.finalize();
        console.log('✅ تم إنشاء النسخة الاحتياطية:', backupFile);
        
        // حذف النسخ القديمة
        const files = fs.readdirSync(backupDir);
        const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        
        for (const file of files) {
            const filePath = path.join(backupDir, file);
            const stats = fs.statSync(filePath);
            if (stats.mtime < cutoffDate) {
                fs.unlinkSync(filePath);
                console.log('🗑️ تم حذف النسخة القديمة:', file);
            }
        }
    } catch (error) {
        console.error('❌ خطأ في النسخ الاحتياطي:', error);
    }
});

// =============================================
// تشغيل السيرفر
// =============================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log('═══════════════════════════════════════════');
    console.log('🦅 متجر الرعدي أون لاين');
    console.log('📡 يعمل على المنفذ:', PORT);
    console.log('🌐 الرابط: http://localhost:' + PORT);
    console.log('📧 بريد المدير:', process.env.ADMIN_EMAIL || 'alradi@gmil.com');
    console.log('🔑 كلمة مرور المدير:', process.env.ADMIN_PASSWORD || 'admin123');
    console.log('═══════════════════════════════════════════');
});

module.exports = app;
