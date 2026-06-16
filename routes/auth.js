// =============================================
// متجر الرعدي أون لاين - alradi-online
// مسارات المصادقة وتسجيل الدخول
// =============================================

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ErrorLog = require('../models/ErrorLog');
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
// معالجة تسجيل الدخول
// =============================================

router.post('/login', isGuest, async (req, res) => {
    try {
        const { login, password } = req.body;
        
        if (!login || !password) {
            req.flash('error_msg', 'يرجى إدخال جميع البيانات المطلوبة');
            return res.redirect('/auth/login');
        }
        
        const user = await User.findByLogin(login.trim());
        
        if (!user) {
            req.flash('error_msg', 'بيانات الدخول غير صحيحة');
            return res.redirect('/auth/login');
        }
        
        if (!user.isActive) {
            req.flash('error_msg', 'تم تعطيل حسابك');
            return res.redirect('/auth/login');
        }
        
        if (user.isBanned) {
            req.flash('error_msg', 'تم حظر حسابك');
            return res.redirect('/auth/login');
        }
        
        if (user.lockedUntil && user.lockedUntil > Date.now()) {
            const minutesLeft = Math.ceil((user.lockedUntil - Date.now()) / 60000);
            req.flash('error_msg', `الحساب مقفل. حاول بعد ${minutesLeft} دقيقة`);
            return res.redirect('/auth/login');
        }
        
        const isMatch = await user.comparePassword(password);
        
        if (!isMatch) {
            await user.incrementLoginAttempts();
            req.flash('error_msg', 'كلمة المرور غير صحيحة');
            return res.redirect('/auth/login');
        }
        
        await user.resetLoginAttempts();
        user.lastLogin = new Date();
        user.lastLoginIp = req.ip;
        await user.save();
        
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
        
        await user.addActivity('login', 'تسجيل دخول ناجح', req.ip, req.headers['user-agent']);
        
        console.log('✅ تسجيل دخول: ' + user.name + ' (' + user.role + ')');
        
        // =============================================
        // التوجيه الذكي
        // =============================================
        
        if (user.role === 'admin' || user.role === 'superadmin' || user.role === 'moderator') {
            console.log('👑 توجيه المدير إلى لوحة التحكم');
            req.flash('success_msg', 'مرحباً بك ' + user.name + ' في لوحة التحكم');
            return res.redirect('/admin/dashboard');
        }
        
        console.log('👤 توجيه العميل إلى الرئيسية');
        req.flash('success_msg', 'مرحباً بك ' + user.name + ' في متجر الرعدي أون لاين');
        return res.redirect('/');
        
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        req.flash('error_msg', 'حدث خطأ غير متوقع');
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
        
        if (!name || !username || !email || !password || !password2) {
            req.flash('error_msg', 'يرجى إدخال جميع البيانات المطلوبة');
            return res.redirect('/auth/register');
        }
        
        if (password !== password2) {
            req.flash('error_msg', 'كلمات المرور غير متطابقة');
            return res.redirect('/auth/register');
        }
        
        if (password.length < 6) {
            req.flash('error_msg', 'كلمة المرور 6 أحرف على الأقل');
            return res.redirect('/auth/register');
        }
        
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(username)) {
            req.flash('error_msg', 'اسم المستخدم: أحرف إنجليزية وأرقام فقط');
            return res.redirect('/auth/register');
        }
        
        const emailExists = await User.findOne({ email: email.toLowerCase() });
        if (emailExists) {
            req.flash('error_msg', 'البريد الإلكتروني مسجل مسبقاً');
            return res.redirect('/auth/register');
        }
        
        const usernameExists = await User.findOne({ username: username.toLowerCase() });
        if (usernameExists) {
            req.flash('error_msg', 'اسم المستخدم مستخدم مسبقاً');
            return res.redirect('/auth/register');
        }
        
        const newUser = new User({
            name: name.trim(),
            username: username.toLowerCase().trim(),
            email: email.toLowerCase().trim(),
            phone: phone ? phone.trim() : '',
            password: password,
            role: 'customer',
            isActive: true
        });
        
        await newUser.save();
        
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
        
        await newUser.addActivity('register', 'إنشاء حساب جديد', req.ip, req.headers['user-agent']);
        
        console.log('✅ حساب جديد: ' + newUser.name + ' - ' + newUser.email);
        
        req.flash('success_msg', 'مرحباً بك ' + newUser.name + '! تم إنشاء حسابك بنجاح');
        return res.redirect('/');
        
    } catch (error) {
        console.error('خطأ في إنشاء الحساب:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            req.flash('error_msg', messages.join('. '));
            return res.redirect('/auth/register');
        }
        
        if (error.code === 11000) {
            req.flash('error_msg', 'البريد أو اسم المستخدم مسجل مسبقاً');
            return res.redirect('/auth/register');
        }
        
        req.flash('error_msg', 'حدث خطأ غير متوقع');
        return res.redirect('/auth/register');
    }
});

// =============================================
// تسجيل الخروج
// =============================================

router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('خطأ في تسجيل الخروج:', err);
        res.clearCookie('connect.sid');
        res.redirect('/auth/login');
    });
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
// استعادة كلمة المرور - إرسال OTP
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
            req.flash('success_msg', 'إذا كان البريد مسجلاً، سيتم إرسال رمز التحقق');
            return res.redirect('/auth/forgot-password');
        }
        
        const otp = user.generateOTP();
        await user.save();
        
        console.log('🔑 OTP للمستخدم ' + user.email + ': ' + otp);
        
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
        
        user.clearOTP();
        await user.save();
        
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
            req.flash('error_msg', 'كلمة المرور 6 أحرف على الأقل');
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
        console.error('خطأ في إعادة تعيين كلمة المرور:', error);
        req.flash('error_msg', 'حدث خطأ غير متوقع');
        return res.redirect('/auth/reset-password');
    }
});

// =============================================
// إرسال OTP
// =============================================

router.post('/send-otp', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }
        
        const otp = user.generateOTP();
        await user.save();
        
        console.log('🔑 OTP للمستخدم ' + user.email + ': ' + otp);
        
        return res.json({ success: true, message: 'تم إرسال رمز التحقق' });
        
    } catch (error) {
        return res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// التحقق من OTP
// =============================================

router.post('/verify-otp-action', isAuthenticated, async (req, res) => {
    try {
        const { otp } = req.body;
        const user = await User.findById(req.session.user._id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }
        
        if (!user.verifyOTP(otp)) {
            return res.status(400).json({ success: false, message: 'رمز التحقق غير صحيح' });
        }
        
        user.clearOTP();
        await user.save();
        
        return res.json({ success: true, verified: true });
        
    } catch (error) {
        return res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

module.exports = router;
