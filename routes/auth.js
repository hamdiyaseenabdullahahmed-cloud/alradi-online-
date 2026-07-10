// ================================================================
// متجر الرعدي أون لاين - Al-Radi Online
// مسارات المصادقة - النسخة النهائية المطورة
// ================================================================

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isGuest } = require('../middleware/auth');

// ================================================================
// صفحة تسجيل الدخول
// ================================================================
router.get('/login', isGuest, (req, res) => {
    res.render('auth/login', {
        pageTitle: 'تسجيل الدخول',
        returnTo: req.session.returnTo || '/',
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg'),
        info_msg: req.flash('info_msg')
    });
});

// ================================================================
// معالجة تسجيل الدخول (يدعم البريد الإلكتروني واسم المستخدم)
// ================================================================
router.post('/login', isGuest, async (req, res) => {
    try {
        const { email, login, username, password } = req.body;
        const identifier = email || login || username;

        // التحقق من وجود البيانات
        if (!identifier || !password) {
            req.flash('error_msg', '⚠️ يرجى إدخال البريد الإلكتروني وكلمة المرور');
            return res.redirect('/auth/login');
        }

        // البحث عن المستخدم (بالبريد أو اسم المستخدم)
        const user = await User.findOne({
            $or: [
                { email: identifier.toLowerCase().trim() },
                { username: identifier.toLowerCase().trim() }
            ]
        });

        if (!user) {
            req.flash('error_msg', '⚠️ البريد الإلكتروني أو اسم المستخدم غير صحيح');
            return res.redirect('/auth/login');
        }

        // التحقق من نشاط الحساب
        if (!user.isActive) {
            req.flash('error_msg', '⛔ هذا الحساب غير نشط. تواصل مع الدعم.');
            return res.redirect('/auth/login');
        }

        if (user.isBanned) {
            req.flash('error_msg', '⛔ تم حظر هذا الحساب.');
            return res.redirect('/auth/login');
        }

        // التحقق من قفل الحساب (محاولات فاشلة)
        if (user.lockedUntil && user.lockedUntil > Date.now()) {
            const minutesLeft = Math.ceil((user.lockedUntil - Date.now()) / 60000);
            req.flash('error_msg', `⏳ الحساب مقفل مؤقتاً، حاول بعد ${minutesLeft} دقيقة`);
            return res.redirect('/auth/login');
        }

        // التحقق من كلمة المرور
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            await user.incrementLoginAttempts();
            req.flash('error_msg', '❌ كلمة المرور غير صحيحة');
            return res.redirect('/auth/login');
        }

        // إعادة تعيين محاولات الدخول الفاشلة
        await user.resetLoginAttempts();
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

        // تسجيل نشاط الدخول
        await user.addActivity('login', 'تسجيل دخول ناجح', req.ip, req.headers['user-agent']);
        console.log(`✅ تم تسجيل الدخول بنجاح: ${user.name} (الدور: ${user.role})`);

        // ================================================================
        // التوجيه الذكي حسب دور المستخدم
        // ================================================================
        if (user.role === 'admin' || user.role === 'superadmin' || user.role === 'moderator') {
            req.flash('success_msg', `👑 مرحباً بك يا ${user.name} في لوحة التحكم`);
            return res.redirect('/admin/dashboard');
        }

        // العملاء العاديون
        req.flash('success_msg', `👋 مرحباً بك ${user.name} في متجر الرعدي`);
        return res.redirect('/');

    } catch (error) {
        console.error('❌ خطأ في تسجيل الدخول:', error.message);
        req.flash('error_msg', '❌ حدث خطأ في الخادم، حاول مجدداً');
        return res.redirect('/auth/login');
    }
});

// ================================================================
// تسجيل الخروج
// ================================================================
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('❌ خطأ في تسجيل الخروج:', err);
        res.clearCookie('connect.sid');
        res.redirect('/auth/login');
    });
});

// ================================================================
// صفحة إنشاء حساب جديد (للعملاء)
// ================================================================
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

        // التحقق من البيانات
        if (!name || !username || !email || !password || !password2) {
            req.flash('error_msg', '⚠️ جميع الحقول مطلوبة');
            return res.redirect('/auth/register');
        }
        if (password !== password2) {
            req.flash('error_msg', '⚠️ كلمات المرور غير متطابقة');
            return res.redirect('/auth/register');
        }
        if (password.length < 6) {
            req.flash('error_msg', '⚠️ كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return res.redirect('/auth/register');
        }

        // التحقق من عدم التكرار
        const existingUser = await User.findOne({
            $or: [
                { email: email.toLowerCase() },
                { username: username.toLowerCase() }
            ]
        });
        if (existingUser) {
            req.flash('error_msg', '⚠️ البريد الإلكتروني أو اسم المستخدم مسجل مسبقاً');
            return res.redirect('/auth/register');
        }

        // إنشاء المستخدم
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

        // تسجيل الدخول التلقائي
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

        req.flash('success_msg', `🎉 مرحباً بك ${newUser.name}! تم إنشاء حسابك بنجاح`);
        return res.redirect('/');

    } catch (error) {
        console.error('❌ خطأ في التسجيل:', error.message);
        req.flash('error_msg', '❌ حدث خطأ أثناء التسجيل، حاول مرة أخرى');
        return res.redirect('/auth/register');
    }
});

module.exports = router;
