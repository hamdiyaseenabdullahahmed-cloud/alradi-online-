// =============================================
// متجر الرعدي أون لاين - مسارات المصادقة
// النسخة النهائية المطورة (تدعم البريد/اسم المستخدم + تجاوز OTP للمدير)
// =============================================

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAuthenticated, isGuest } = require('../middleware/auth');

// =============================================
// صفحة تسجيل الدخول
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
// معالجة تسجيل الدخول (المطور السحري ✨)
// =============================================
router.post('/login', isGuest, async (req, res) => {
    try {
        // 1. استقبال البيانات من الواجهة (تدعم email أو login أو username)
        const { login, email, username, password } = req.body;
        
        // نختار الحقل الموجود
        const identifier = login || email || username;
        
        // التأكد من وجود البريد/اسم المستخدم وكلمة المرور
        if (!identifier || !password) {
            req.flash('error_msg', 'يرجى إدخال البريد الإلكتروني وكلمة المرور');
            return res.redirect('/auth/login');
        }

        // 2. البحث عن المستخدم (بالبريد الإلكتروني أو اسم المستخدم)
        const user = await User.findOne({
            $or: [
                { email: identifier.toLowerCase().trim() },
                { username: identifier.toLowerCase().trim() }
            ]
        });

        // 3. التحقق من وجود المستخدم
        if (!user) {
            console.log('❌ محاولة دخول فاشلة: المستغير غير موجود (' + identifier + ')');
            req.flash('error_msg', 'البريد الإلكتروني أو اسم المستخدم غير صحيح');
            return res.redirect('/auth/login');
        }

        // 4. التحقق من نشاط الحساب
        if (!user.isActive) {
            req.flash('error_msg', 'هذا الحساب غير نشط، تواصل مع الدعم');
            return res.redirect('/auth/login');
        }

        // 5. التحقق من الحظر
        if (user.isBanned) {
            req.flash('error_msg', 'تم حظر هذا الحساب');
            return res.redirect('/auth/login');
        }

        // 6. التحقق من قفل الحساب بسبب المحاولات الفاشلة
        if (user.lockedUntil && user.lockedUntil > Date.now()) {
            const minutesLeft = Math.ceil((user.lockedUntil - Date.now()) / 60000);
            req.flash('error_msg', `الحساب مقفل مؤقتاً، حاول بعد ${minutesLeft} دقيقة`);
            return res.redirect('/auth/login');
        }

        // 7. مقارنة كلمة المرور
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            await user.incrementLoginAttempts();
            console.log('❌ كلمة مرور خاطئة للمستخدم: ' + user.email);
            req.flash('error_msg', 'كلمة المرور غير صحيحة');
            return res.redirect('/auth/login');
        }

        // 8. reset محاولات الدخول الفاشلة وتسجيل تاريخ الدخول
        await user.resetLoginAttempts();
        user.lastLogin = new Date();
        user.lastLoginIp = req.ip;
        await user.save();

        // =============================================
        // 9. [🔥 التعديل السحري] إنشاء جلسة المستخدم
        // =============================================
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

        // تسجيل نشاط الدخول
        await user.addActivity('login', 'تسجيل دخول ناجح', req.ip, req.headers['user-agent']);

        // =============================================
        // 10. [🎯 الأهم] التوجيه حسب الدور (المدير يتجاوز كل شيء)
        // =============================================
        console.log('✅ تم تسجيل الدخول بنجاح: ' + user.name + ' (الدور: ' + user.role + ')');

        // إذا كان المدير أو المشرف => يذهب فوراً للوحة التحكم بدون OTP
        if (user.role === 'admin' || user.role === 'superadmin' || user.role === 'moderator') {
            console.log('👑 توجيه المدير ' + user.name + ' إلى لوحة التحكم');
            req.flash('success_msg', 'مرحباً بك يا ' + user.name + ' في لوحة التحكم');
            return res.redirect('/admin/dashboard');
        }

        // إذا كان عميلاً عادياً => يذهب للصفحة الرئيسية
        console.log('👤 توجيه العميل ' + user.name + ' إلى الصفحة الرئيسية');
        req.flash('success_msg', 'مرحباً بك ' + user.name + ' في متجر الرعدي');
        return res.redirect('/');

    } catch (error) {
        console.error('❌ خطأ في تسجيل الدخول:', error.message);
        req.flash('error_msg', 'حدث خطأ في الخادم، حاول مجدداً');
        return res.redirect('/auth/login');
    }
});

// =============================================
// صفحة إنشاء حساب جديد (تسجيل عميل)
// =============================================
router.get('/register', isGuest, (req, res) => {
    res.render('auth/register', {
        pageTitle: 'إنشاء حساب جديد',
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
    });
});

router.post('/register', isGuest, async (req, res) => {
    try {
        const { name, username, email, phone, password, password2 } = req.body;

        if (!name || !username || !email || !password || !password2) {
            req.flash('error_msg', 'يرجى إدخال جميع البيانات');
            return res.redirect('/auth/register');
        }
        if (password !== password2) {
            req.flash('error_msg', 'كلمات المرور غير متطابقة');
            return res.redirect('/auth/register');
        }
        if (password.length < 6) {
            req.flash('error_msg', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return res.redirect('/auth/register');
        }

        const userExists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] });
        if (userExists) {
            req.flash('error_msg', 'البريد الإلكتروني أو اسم المستخدم مسجل مسبقاً');
            return res.redirect('/auth/register');
        }

        const newUser = new User({
            name: name.trim(),
            username: username.toLowerCase().trim(),
            email: email.toLowerCase().trim(),
            phone: phone && phone.trim() !== '' ? phone.trim() : undefined,
            password: password,
            role: 'customer',
            isActive: true
        });

        await newUser.save();
        await newUser.addActivity('register', 'إنشاء حساب جديد', req.ip, req.headers['user-agent']);

        // تسجيل الدخول التلقائي بعد التسجيل
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

        req.flash('success_msg', 'مرحباً بك ' + newUser.name + '! تم إنشاء حسابك بنجاح');
        return res.redirect('/');

    } catch (error) {
        console.error('❌ خطأ في التسجيل:', error.message);
        req.flash('error_msg', 'حدث خطأ أثناء التسجيل، حاول مرة أخرى');
        return res.redirect('/auth/register');
    }
});

// =============================================
// تسجيل الخروج
// =============================================
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('❌ خطأ في تسجيل الخروج:', err);
        res.clearCookie('connect.sid');
        res.redirect('/auth/login');
    });
});

// =============================================
// استعادة كلمة المرور (نسيتها) - مع OTP
// =============================================
router.get('/forgot-password', isGuest, (req, res) => {
    res.render('auth/forgot-password', {
        pageTitle: 'استعادة كلمة المرور',
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
    });
});

router.post('/forgot-password', isGuest, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            req.flash('error_msg', 'يرجى إدخال البريد الإلكتروني');
            return res.redirect('/auth/forgot-password');
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            req.flash('success_msg', 'إذا كان البريد مسجلاً، سيتم إرسال رمز التحقق');
            return res.redirect('/auth/forgot-password');
        }

        const otp = user.generateOTP();
        await user.save();
        console.log('🔑 OTP للمستخدم ' + user.email + ': ' + otp);

        req.session.resetEmail = email;
        req.flash('success_msg', 'تم إرسال رمز التحقق إلى بريدك');
        return res.redirect('/auth/verify-otp');

    } catch (error) {
        console.error('❌ خطأ في استعادة كلمة المرور:', error.message);
        req.flash('error_msg', 'حدث خطأ غير متوقع');
        return res.redirect('/auth/forgot-password');
    }
});

router.get('/verify-otp', isGuest, (req, res) => {
    if (!req.session.resetEmail) return res.redirect('/auth/forgot-password');
    res.render('auth/verify-otp', {
        pageTitle: 'التحقق من الرمز',
        email: req.session.resetEmail,
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
    });
});

router.post('/verify-otp', isGuest, async (req, res) => {
    try {
        const { otp } = req.body;
        const email = req.session.resetEmail;
        if (!email || !otp) {
            req.flash('error_msg', 'يرجى إدخال رمز التحقق');
            return res.redirect('/auth/verify-otp');
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || !user.verifyOTP(otp)) {
            req.flash('error_msg', 'رمز التحقق غير صحيح أو منتهي الصلاحية');
            return res.redirect('/auth/verify-otp');
        }

        user.clearOTP();
        await user.save();
        req.session.resetVerified = true;
        return res.redirect('/auth/reset-password');

    } catch (error) {
        console.error('❌ خطأ في التحقق من OTP:', error.message);
        req.flash('error_msg', 'حدث خطأ غير متوقع');
        return res.redirect('/auth/verify-otp');
    }
});

router.get('/reset-password', isGuest, (req, res) => {
    if (!req.session.resetVerified) return res.redirect('/auth/forgot-password');
    res.render('auth/reset-password', {
        pageTitle: 'إعادة تعيين كلمة المرور',
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
    });
});

router.post('/reset-password', isGuest, async (req, res) => {
    try {
        const { password, password2 } = req.body;
        const email = req.session.resetEmail;
        if (!email || !req.session.resetVerified) {
            req.flash('error_msg', 'انتهت صلاحية الجلسة');
            return res.redirect('/auth/forgot-password');
        }
        if (!password || !password2 || password !== password2 || password.length < 6) {
            req.flash('error_msg', 'تأكد من تطابق كلمة المرور (6 أحرف على الأقل)');
            return res.redirect('/auth/reset-password');
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            req.flash('error_msg', 'المستخدم غير موجود');
            return res.redirect('/auth/forgot-password');
        }

        user.password = password;
        await user.save();

        delete req.session.resetEmail;
        delete req.session.resetVerified;

        req.flash('success_msg', 'تم تغيير كلمة المرور بنجاح');
        return res.redirect('/auth/login');

    } catch (error) {
        console.error('❌ خطأ في إعادة تعيين كلمة المرور:', error.message);
        req.flash('error_msg', 'حدث خطأ غير متوقع');
        return res.redirect('/auth/reset-password');
    }
});

module.exports = router;
