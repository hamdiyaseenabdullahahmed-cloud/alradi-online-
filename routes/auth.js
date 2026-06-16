// =============================================
// متجر الرعدي أون لاين - alradi-online
// مسارات المصادقة وتسجيل الدخول
// =============================================

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ErrorLog = require('../models/ErrorLog');
const { isAuthenticated, isGuest, redirectAfterLogin } = require('../middleware/auth');

// =============================================
// صفحة تسجيل الدخول (موحدة للكل)
// =============================================

router.get('/login', isGuest, (req, res) => {
    res.render('auth/login', {
        pageTitle: 'تسجيل الدخول',
        returnTo: req.session.returnTo || '/',
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg'),
        info_msg: req.flash('info_msg')
    });
});

// =============================================
// معالجة تسجيل الدخول (البوابة الموحدة)
// =============================================

router.post('/login', isGuest, async (req, res) => {
    try {
        const { login, password } = req.body;
        
        // التحقق من وجود البيانات
        if (!login || !password) {
            req.flash('error_msg', 'يرجى إدخال جميع البيانات المطلوبة');
            return res.redirect('/auth/login');
        }
        
        // البحث عن المستخدم بالبريد الإلكتروني أو اسم المستخدم
        const user = await User.findByLogin(login.trim());
        
        // إذا لم يوجد المستخدم
        if (!user) {
            req.flash('error_msg', 'بيانات الدخول غير صحيحة');
            return res.redirect('/auth/login');
        }
        
        // التحقق من أن الحساب نشط
        if (!user.isActive) {
            req.flash('error_msg', 'تم تعطيل حسابك، يرجى التواصل مع الإدارة');
            return res.redirect('/auth/login');
        }
        
        // التحقق من أن الحساب غير محظور
        if (user.isBanned) {
            req.flash('error_msg', `تم حظر حسابك. السبب: ${user.banReason || 'غير محدد'}`);
            return res.redirect('/auth/login');
        }
        
        // التحقق من قفل الحساب
        if (user.lockedUntil && user.lockedUntil > Date.now()) {
            const minutesLeft = Math.ceil((user.lockedUntil - Date.now()) / 60000);
            req.flash('error_msg', `الحساب مقفل مؤقتاً. يرجى المحاولة بعد ${minutesLeft} دقيقة`);
            return res.redirect('/auth/login');
        }
        
        // مقارنة كلمة المرور
        const isMatch = await user.comparePassword(password);
        
        if (!isMatch) {
            // زيادة محاولات الدخول الفاشلة
            await user.incrementLoginAttempts();
            
            const remainingAttempts = 5 - user.loginAttempts;
            if (remainingAttempts > 0) {
                req.flash('error_msg', `كلمة المرور غير صحيحة. المحاولات المتبقية: ${remainingAttempts}`);
            } else {
                req.flash('error_msg', 'تم قفل الحساب مؤقتاً بسبب كثرة المحاولات الفاشلة. الرجاء المحاولة بعد 15 دقيقة');
            }
            
            return res.redirect('/auth/login');
        }
        
        // إعادة تعيين محاولات الدخول
        await user.resetLoginAttempts();
        
        // تحديث آخر دخول
        user.lastLogin = new Date();
        user.lastLoginIp = req.ip;
        await user.save();
        
        // إنشاء جلسة المستخدم
        req.session.user = {
            _id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role,
            profileImage: user.profileImage,
            loyaltyPoints: user.loyaltyPoints
        };
        req.session.createdAt = Date.now();
        req.session.lastActivity = new Date();
        
        // تسجيل النشاط
        await user.addActivity(
            'login',
            'تسجيل دخول ناجح',
            req.ip,
            req.headers['user-agent']
        );
        
        console.log(`✅ تسجيل دخول: ${user.name} (${user.role}) - ${new Date().toLocaleString()}`);
        
        // =============================================
        // التوجيه الذكي بناءً على الدور
        // =============================================
        
        // حفظ الرابط السابق للعودة إليه
        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        
        // إذا كان مديراً، توجيه إلى لوحة التحكم
        if (user.role === 'admin' || user.role === 'superadmin' || user.role === 'moderator') {
            req.flash('success_msg', `مرحباً بك ${user.name} في لوحة التحكم`);
            return res.redirect('/admin/dashboard');
        }
        
        // إذا كان عميلاً، توجيه إلى الصفحة الرئيسية أو الرابط السابق
        req.flash('success_msg', `مرحباً بك ${user.name} في متجر الرعدي أون لاين`);
        return res.redirect(returnTo);
        
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        
        await ErrorLog.logError({
            errorType: 'auth_error',
            message: 'خطأ في عملية تسجيل الدخول',
            stack: error.stack,
            url: '/auth/login',
            method: 'POST',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        req.flash('error_msg', 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً');
        return res.redirect('/auth/login');
    }
});

// =============================================
// صفحة إنشاء حساب جديد
// =============================================

router.get('/register', isGuest, (req, res) => {
    res.render('auth/register', {
        pageTitle: 'إنشاء حساب جديد',
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
    });
});

// =============================================
// معالجة إنشاء حساب جديد
// =============================================

router.post('/register', isGuest, async (req, res) => {
    try {
        const { name, username, email, phone, password, password2 } = req.body;
        
        // التحقق من وجود جميع البيانات
        if (!name || !username || !email || !password || !password2) {
            req.flash('error_msg', 'يرجى إدخال جميع البيانات المطلوبة');
            return res.redirect('/auth/register');
        }
        
        // التحقق من تطابق كلمة المرور
        if (password !== password2) {
            req.flash('error_msg', 'كلمات المرور غير متطابقة');
            return res.redirect('/auth/register');
        }
        
        // التحقق من طول كلمة المرور
        if (password.length < 6) {
            req.flash('error_msg', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return res.redirect('/auth/register');
        }
        
        // التحقق من صحة اسم المستخدم
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(username)) {
            req.flash('error_msg', 'اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام وشرطة سفلية فقط');
            return res.redirect('/auth/register');
        }
        
        // التحقق من عدم وجود مستخدم بنفس البريد الإلكتروني
        const emailExists = await User.findOne({ email: email.toLowerCase() });
        if (emailExists) {
            req.flash('error_msg', 'البريد الإلكتروني مسجل مسبقاً');
            return res.redirect('/auth/register');
        }
        
        // التحقق من عدم وجود مستخدم بنفس اسم المستخدم
        const usernameExists = await User.findOne({ username: username.toLowerCase() });
        if (usernameExists) {
            req.flash('error_msg', 'اسم المستخدم مستخدم مسبقاً، يرجى اختيار اسم آخر');
            return res.redirect('/auth/register');
        }
        
        // إنشاء المستخدم الجديد
        const newUser = new User({
            name: name.trim(),
            username: username.toLowerCase().trim(),
            email: email.toLowerCase().trim(),
            phone: phone ? phone.trim() : '',
            password: password,
            role: 'customer',
            isActive: true,
            isVerified: false,
            preferences: {
                language: 'ar',
                currency: 'SAR',
                darkMode: false,
                emailNotifications: true,
                smsNotifications: false
            }
        });
        
        await newUser.save();
        
        // إنشاء جلسة للمستخدم الجديد
        req.session.user = {
            _id: newUser._id,
            name: newUser.name,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            profileImage: newUser.profileImage,
            loyaltyPoints: 0
        };
        req.session.createdAt = Date.now();
        
        // تسجيل النشاط
        await newUser.addActivity(
            'register',
            'إنشاء حساب جديد',
            req.ip,
            req.headers['user-agent']
        );
        
        console.log(`✅ حساب جديد: ${newUser.name} - ${newUser.email}`);
        
        req.flash('success_msg', `مرحباً بك ${newUser.name}! تم إنشاء حسابك بنجاح في متجر الرعدي أون لاين`);
        return res.redirect('/');
        
    } catch (error) {
        console.error('خطأ في إنشاء الحساب:', error);
        
        await ErrorLog.logError({
            errorType: 'auth_error',
            message: 'خطأ في عملية إنشاء حساب جديد',
            stack: error.stack,
            url: '/auth/register',
            method: 'POST',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        // معالجة أخطاء التحقق من Mongoose
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            req.flash('error_msg', messages.join('. '));
            return res.redirect('/auth/register');
        }
        
        // معالجة الخطأ 11000 (مفتاح مكرر)
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            req.flash('error_msg', `${field === 'email' ? 'البريد الإلكتروني' : 'اسم المستخدم'} مسجل مسبقاً`);
            return res.redirect('/auth/register');
        }
        
        req.flash('error_msg', 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً');
        return res.redirect('/auth/register');
    }
});

// =============================================
// تسجيل الخروج
// =============================================

router.get('/logout', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const userName = req.session.user.name;
        
        // تسجيل النشاط
        const user = await User.findById(userId);
        if (user) {
            await user.addActivity(
                'logout',
                'تسجيل خروج',
                req.ip,
                req.headers['user-agent']
            );
        }
        
        // تدمير الجلسة
        req.session.destroy((err) => {
            if (err) {
                console.error('خطأ في تسجيل الخروج:', err);
            }
            
            console.log(`👋 تسجيل خروج: ${userName} - ${new Date().toLocaleString()}`);
            
            res.clearCookie('connect.sid');
            req.flash('success_msg', 'تم تسجيل الخروج بنجاح');
            return res.redirect('/auth/login');
        });
        
    } catch (error) {
        console.error('خطأ في تسجيل الخروج:', error);
        req.session.destroy();
        res.redirect('/auth/login');
    }
});

// =============================================
// استعادة كلمة المرور - الصفحة
// =============================================

router.get('/forgot-password', isGuest, (req, res) => {
    res.render('auth/forgot-password', {
        pageTitle: 'استعادة كلمة المرور',
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
    });
});

// =============================================
// استعادة كلمة المرور - إرسال الرابط
// =============================================

router.post('/forgot-password', isGuest, async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            req.flash('error_msg', 'يرجى إدخال البريد الإلكتروني');
            return res.redirect('/auth/forgot-password');
        }
        
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            // لا نخبر المستخدم أن البريد غير موجود لأسباب أمنية
            req.flash('success_msg', 'إذا كان البريد الإلكتروني مسجلاً، سيتم إرسال رابط استعادة كلمة المرور');
            return res.redirect('/auth/forgot-password');
        }
        
        // توليد رمز OTP
        const otp = user.generateOTP();
        await user.save();
        
        // TODO: إرسال OTP عبر البريد الإلكتروني
        console.log(`🔑 OTP لاستعادة كلمة المرور للمستخدم ${user.email}: ${otp}`);
        
        // حفظ البريد في الجلسة للتحقق لاحقاً
        req.session.resetEmail = email;
        
        req.flash('success_msg', 'تم إرسال رمز التحقق إلى بريدك الإلكتروني');
        return res.redirect('/auth/verify-otp');
        
    } catch (error) {
        console.error('خطأ في استعادة كلمة المرور:', error);
        req.flash('error_msg', 'حدث خطأ غير متوقع');
        return res.redirect('/auth/forgot-password');
    }
});

// =============================================
// التحقق من OTP - الصفحة
// =============================================

router.get('/verify-otp', isGuest, (req, res) => {
    if (!req.session.resetEmail) {
        return res.redirect('/auth/forgot-password');
    }
    
    res.render('auth/verify-otp', {
        pageTitle: 'التحقق من الرمز',
        email: req.session.resetEmail,
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
    });
});

// =============================================
// التحقق من OTP - المعالجة
// =============================================

router.post('/verify-otp', isGuest, async (req, res) => {
    try {
        const { otp } = req.body;
        const email = req.session.resetEmail;
        
        if (!email || !otp) {
            req.flash('error_msg', 'يرجى إدخال رمز التحقق');
            return res.redirect('/auth/verify-otp');
        }
        
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            req.flash('error_msg', 'المستخدم غير موجود');
            return res.redirect('/auth/forgot-password');
        }
        
        if (!user.verifyOTP(otp)) {
            req.flash('error_msg', 'رمز التحقق غير صحيح أو منتهي الصلاحية');
            return res.redirect('/auth/verify-otp');
        }
        
        // مسح OTP بعد التحقق
        user.clearOTP();
        await user.save();
        
        // السماح بتغيير كلمة المرور
        req.session.resetVerified = true;
        
        return res.redirect('/auth/reset-password');
        
    } catch (error) {
        console.error('خطأ في التحقق من OTP:', error);
        req.flash('error_msg', 'حدث خطأ غير متوقع');
        return res.redirect('/auth/verify-otp');
    }
});

// =============================================
// إعادة تعيين كلمة المرور - الصفحة
// =============================================

router.get('/reset-password', isGuest, (req, res) => {
    if (!req.session.resetVerified) {
        return res.redirect('/auth/forgot-password');
    }
    
    res.render('auth/reset-password', {
        pageTitle: 'إعادة تعيين كلمة المرور',
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
    });
});

// =============================================
// إعادة تعيين كلمة المرور - المعالجة
// =============================================

router.post('/reset-password', isGuest, async (req, res) => {
    try {
        const { password, password2 } = req.body;
        const email = req.session.resetEmail;
        
        if (!email || !req.session.resetVerified) {
            req.flash('error_msg', 'انتهت صلاحية الجلسة');
            return res.redirect('/auth/forgot-password');
        }
        
        if (!password || !password2) {
            req.flash('error_msg', 'يرجى إدخال كلمة المرور الجديدة');
            return res.redirect('/auth/reset-password');
        }
        
        if (password !== password2) {
            req.flash('error_msg', 'كلمات المرور غير متطابقة');
            return res.redirect('/auth/reset-password');
        }
        
        if (password.length < 6) {
            req.flash('error_msg', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return res.redirect('/auth/reset-password');
        }
        
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            req.flash('error_msg', 'المستخدم غير موجود');
            return res.redirect('/auth/forgot-password');
        }
        
        user.password = password;
        await user.save();
        
        // تنظيف الجلسة
        delete req.session.resetEmail;
        delete req.session.resetVerified;
        
        req.flash('success_msg', 'تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول');
        return res.redirect('/auth/login');
        
    } catch (error) {
        console.error('خطأ في إعادة تعيين كلمة المرور:', error);
        req.flash('error_msg', 'حدث خطأ غير متوقع');
        return res.redirect('/auth/reset-password');
    }
});

// =============================================
// إرسال OTP للتحقق (للتعديلات الحساسة)
// =============================================

router.post('/send-otp', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }
        
        // التحقق من مرور وقت كافٍ منذ آخر طلب (دقيقتين)
        if (user.otpRequestedAt && (Date.now() - user.otpRequestedAt) < 2 * 60 * 1000) {
            return res.status(429).json({
                success: false,
                message: 'يرجى الانتظار دقيقتين قبل طلب رمز جديد'
            });
        }
        
        const otp = user.generateOTP();
        await user.save();
        
        // TODO: إرسال OTP فعلياً عبر البريد أو الهاتف
        console.log(`🔑 OTP للمستخدم ${user.email}: ${otp}`);
        
        return res.json({
            success: true,
            message: 'تم إرسال رمز التحقق'
        });
        
    } catch (error) {
        console.error('خطأ في إرسال OTP:', error);
        return res.status(500).json({ success: false, message: 'حدث خطأ غير متوقع' });
    }
});

// =============================================
// التحقق من OTP (للتعديلات الحساسة)
// =============================================

router.post('/verify-otp-action', isAuthenticated, async (req, res) => {
    try {
        const { otp } = req.body;
        const user = await User.findById(req.session.user._id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }
        
        if (!user.verifyOTP(otp)) {
            return res.status(400).json({
                success: false,
                message: 'رمز التحقق غير صحيح أو منتهي الصلاحية'
            });
        }
        
        user.clearOTP();
        await user.save();
        
        return res.json({
            success: true,
            message: 'تم التحقق بنجاح',
            verified: true
        });
        
    } catch (error) {
        console.error('خطأ في التحقق من OTP:', error);
        return res.status(500).json({ success: false, message: 'حدث خطأ غير متوقع' });
    }
});

module.exports = router;
