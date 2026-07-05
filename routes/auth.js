// =============================================
// متجر الرعدي أون لاين - alradi-online
// مسارات المصادقة وتسجيل الدخول (نسخة مطورة)
// =============================================

// استيراد المكتبات المطلوبة
const express = require('express'); // إطار العمل لبناء التطبيقات
const router = express.Router(); // إنشاء راوتر للمسارات
const User = require('../models/User'); // نموذج المستخدم للتعامل مع قاعدة البيانات
const ErrorLog = require('../models/ErrorLog'); // نموذج تسجيل الأخطاء
const { isAuthenticated, isGuest } = require('../middleware/auth'); // دوال التحقق من المصادقة

// =============================================
// صفحة تسجيل الدخول - عرض النموذج
// =============================================

// مسار GET لعرض صفحة تسجيل الدخول
router.get('/login', isGuest, (req, res) => {
    // عرض صفحة تسجيل الدخول مع رسائل الفلاش
    res.render('auth/login', {
        pageTitle: 'تسجيل الدخول', // عنوان الصفحة
        returnTo: req.session.returnTo || '/', // رابط العودة بعد تسجيل الدخول
        success_msg: req.flash('success_msg'), // رسائل النجاح
        error_msg: req.flash('error_msg'), // رسائل الخطأ
        info_msg: req.flash('info_msg') // رسائل معلوماتية
    });
});

// =============================================
// معالجة تسجيل الدخول - التحقق من البيانات
// =============================================

// مسار POST لمعالجة بيانات تسجيل الدخول
router.post('/login', isGuest, async (req, res) => {
    try {
        // استخراج بيانات الدخول من الطلب
        const { login, password } = req.body;
        
        // التحقق من وجود جميع البيانات المطلوبة
        if (!login || !password) {
            req.flash('error_msg', 'يرجى إدخال جميع البيانات المطلوبة'); // رسالة خطأ
            return res.redirect('/auth/login'); // إعادة التوجيه لصفحة تسجيل الدخول
        }
        
        // البحث عن المستخدم باستخدام البريد الإلكتروني أو اسم المستخدم
        const user = await User.findByLogin(login.trim());
        
        // التحقق من وجود المستخدم
        if (!user) {
            req.flash('error_msg', 'بيانات الدخول غير صحيحة');
            return res.redirect('/auth/login');
        }
        
        // التحقق من نشاط الحساب
        if (!user.isActive) {
            req.flash('error_msg', 'تم تعطيل حسابك');
            return res.redirect('/auth/login');
        }
        
        // التحقق من حظر الحساب
        if (user.isBanned) {
            req.flash('error_msg', 'تم حظر حسابك');
            return res.redirect('/auth/login');
        }
        
        // التحقق من قفل الحساب بسبب محاولات فاشلة
        if (user.lockedUntil && user.lockedUntil > Date.now()) {
            const minutesLeft = Math.ceil((user.lockedUntil - Date.now()) / 60000);
            req.flash('error_msg', `الحساب مقفل. حاول بعد ${minutesLeft} دقيقة`);
            return res.redirect('/auth/login');
        }
        
        // مقارنة كلمة المرور المدخلة مع المخزنة
        const isMatch = await user.comparePassword(password);
        
        // إذا كانت كلمة المرور غير صحيحة
        if (!isMatch) {
            await user.incrementLoginAttempts(); // زيادة عدد المحاولات الفاشلة
            req.flash('error_msg', 'كلمة المرور غير صحيحة');
            return res.redirect('/auth/login');
        }
        
        // إعادة تعيين محاولات الدخول الفاشلة بعد نجاح تسجيل الدخول
        await user.resetLoginAttempts();
        user.lastLogin = new Date(); // تحديث تاريخ آخر تسجيل دخول
        user.lastLoginIp = req.ip; // تحديث عنوان IP
        await user.save(); // حفظ التغييرات في قاعدة البيانات
        
        // إنشاء جلسة للمستخدم
        req.session.user = {
            _id: user._id, // معرف المستخدم
            name: user.name, // اسم المستخدم
            username: user.username, // اسم المستخدم للدخول
            email: user.email, // البريد الإلكتروني
            role: user.role, // دور المستخدم (admin, customer, etc.)
            profileImage: user.profileImage, // صورة الملف الشخصي
            loyaltyPoints: user.loyaltyPoints // نقاط الولاء
        };
        req.session.createdAt = Date.now(); // تاريخ إنشاء الجلسة
        
        // تسجيل نشاط تسجيل الدخول
        await user.addActivity('login', 'تسجيل دخول ناجح', req.ip, req.headers['user-agent']);
        
        // طباعة في سجل السيرفر لتتبع تسجيل الدخول
        console.log('✅ تسجيل دخول: ' + user.name + ' (' + user.role + ')');
        
        // =============================================
        // التوجيه الذكي حسب دور المستخدم (تم التطوير)
        // =============================================
        
        // التحقق من دور المستخدم وتوجيهه للصفحة المناسبة
        if (user.role === 'admin' || user.role === 'superadmin' || user.role === 'moderator') {
            // إذا كان المستخدم مديراً أو مشرفاً
            console.log('👑 توجيه المدير إلى لوحة التحكم');
            req.flash('success_msg', 'مرحباً بك ' + user.name + ' في لوحة التحكم');
            return res.redirect('/admin/dashboard'); // توجيه للوحة التحكم
        } else if (user.role === 'customer') {
            // إذا كان المستخدم عميلاً
            console.log('👤 توجيه العميل إلى الرئيسية');
            req.flash('success_msg', 'مرحباً بك ' + user.name + ' في متجر الرعدي أون لاين');
            return res.redirect('/'); // توجيه للصفحة الرئيسية
        } else {
            // إذا كان دور غير معروف
            console.log('❓ دور غير معروف: ' + user.role);
            req.flash('success_msg', 'مرحباً بك ' + user.name);
            return res.redirect('/'); // توجيه للصفحة الرئيسية كحل آمن
        }
        
    } catch (error) {
        // معالجة الأخطاء غير المتوقعة
        console.error('❌ خطأ في تسجيل الدخول:', error.message || error);
        req.flash('error_msg', 'حدث خطأ غير متوقع');
        return res.redirect('/auth/login');
    }
});

// =============================================
// صفحة إنشاء حساب جديد - عرض النموذج
// =============================================

// مسار GET لعرض صفحة إنشاء حساب جديد
router.get('/register', isGuest, (req, res) => {
    // عرض صفحة التسجيل مع رسائل الفلاش
    res.render('auth/register', {
        pageTitle: 'إنشاء حساب جديد', // عنوان الصفحة
        success_msg: req.flash('success_msg'), // رسائل النجاح
        error_msg: req.flash('error_msg') // رسائل الخطأ
    });
});

// =============================================
// معالجة إنشاء حساب جديد - التحقق من البيانات
// =============================================

// مسار POST لمعالجة بيانات إنشاء حساب جديد
router.post('/register', isGuest, async (req, res) => {
    try {
        // استخراج بيانات التسجيل من الطلب
        const { name, username, email, phone, password, password2 } = req.body;
        
        // التحقق من وجود جميع البيانات المطلوبة
        if (!name || !username || !email || !password || !password2) {
            req.flash('error_msg', 'يرجى إدخال جميع البيانات المطلوبة');
            return res.redirect('/auth/register');
        }
        
        // التحقق من تطابق كلمات المرور
        if (password !== password2) {
            req.flash('error_msg', 'كلمات المرور غير متطابقة');
            return res.redirect('/auth/register');
        }
        
        // التحقق من طول كلمة المرور (6 أحرف على الأقل)
        if (password.length < 6) {
            req.flash('error_msg', 'كلمة المرور 6 أحرف على الأقل');
            return res.redirect('/auth/register');
        }
        
        // التحقق من صحة اسم المستخدم (أحرف إنجليزية وأرقام فقط)
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(username)) {
            req.flash('error_msg', 'اسم المستخدم: أحرف إنجليزية وأرقام فقط بدون مسافات');
            return res.redirect('/auth/register');
        }
        
        // التحقق من عدم تكرار البريد الإلكتروني
        const emailExists = await User.findOne({ email: email.toLowerCase() });
        if (emailExists) {
            req.flash('error_msg', 'البريد الإلكتروني مسجل مسبقاً');
            return res.redirect('/auth/register');
        }
        
        // التحقق من عدم تكرار اسم المستخدم
        const usernameExists = await User.findOne({ username: username.toLowerCase() });
        if (usernameExists) {
            req.flash('error_msg', 'اسم المستخدم مستخدم مسبقاً');
            return res.redirect('/auth/register');
        }
        
        // إنشاء مستخدم جديد
        const newUser = new User({
            name: name.trim(), // اسم المستخدم
            username: username.toLowerCase().trim(), // اسم المستخدم (بحروف صغيرة)
            email: email.toLowerCase().trim(), // البريد الإلكتروني (بحروف صغيرة)
            // استخدام undefined بدلاً من مسافة فارغة لتجنب خطأ التكرار في قاعدة البيانات
            phone: phone && phone.trim() !== '' ? phone.trim() : undefined, 
            password: password, // كلمة المرور (سيتم تشفيرها تلقائياً في النموذج)
            role: 'customer', // دور المستخدم (عميل افتراضياً)
            isActive: true // تفعيل الحساب تلقائياً
        });
        
        // حفظ المستخدم في قاعدة البيانات
        await newUser.save();
        
        // تسجيل الدخول التلقائي بعد إنشاء الحساب
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
        
        // تسجيل نشاط إنشاء الحساب
        await newUser.addActivity('register', 'إنشاء حساب جديد', req.ip, req.headers['user-agent']);
        
        // طباعة في سجل السيرفر
        console.log('✅ حساب جديد: ' + newUser.name + ' - ' + newUser.email);
        
        // عرض رسالة نجاح وتوجيه للصفحة الرئيسية
        req.flash('success_msg', 'مرحباً بك ' + newUser.name + '! تم إنشاء حسابك بنجاح');
        return res.redirect('/');
        
    } catch (error) {
        // إضافة تفاصيل الخطأ للكونسول لتسهيل تتبعه في سجلات السيرفر
        console.error('❌ تفاصيل خطأ إنشاء الحساب:', error.message || error);
        
        // معالجة أخطاء التحقق من الصحة (ValidationError)
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            req.flash('error_msg', messages.join('. '));
            return res.redirect('/auth/register');
        }
        
        // معالجة أخطاء التكرار (Duplicate Key)
        if (error.code === 11000) {
            // جلب الحقل المتكرر لإظهار رسالة أدق
            const duplicateField = Object.keys(error.keyValue)[0];
            req.flash('error_msg', `عذراً، هذا الـ ${duplicateField} مسجل مسبقاً لدينا.`);
            return res.redirect('/auth/register');
        }
        
        // معالجة أي خطأ غير متوقع
        req.flash('error_msg', 'حدث خطأ أثناء التسجيل، يرجى المحاولة مرة أخرى.');
        return res.redirect('/auth/register');
    }
});

// =============================================
// تسجيل الخروج - إنهاء الجلسة
// =============================================

// مسار GET لتسجيل الخروج
router.get('/logout', (req, res) => {
    // تدمير الجلسة
    req.session.destroy((err) => {
        if (err) console.error('❌ خطأ في تسجيل الخروج:', err);
        res.clearCookie('connect.sid'); // مسح الكوكيز
        res.redirect('/auth/login'); // توجيه لصفحة تسجيل الدخول
    });
});

// =============================================
// استعادة كلمة المرور - عرض نموذج طلب إعادة التعيين
// =============================================

// مسار GET لعرض صفحة طلب استعادة كلمة المرور
router.get('/forgot-password', isGuest, (req, res) => {
    // عرض صفحة استعادة كلمة المرور
    res.render('auth/forgot-password', {
        pageTitle: 'استعادة كلمة المرور', // عنوان الصفحة
        success_msg: req.flash('success_msg'), // رسائل النجاح
        error_msg: req.flash('error_msg') // رسائل الخطأ
    });
});

// =============================================
// استعادة كلمة المرور - إرسال رمز التحقق (OTP)
// =============================================

// مسار POST لمعالجة طلب إرسال OTP
router.post('/forgot-password', isGuest, async (req, res) => {
    try {
        // استخراج البريد الإلكتروني من الطلب
        const { email } = req.body;
        
        // التحقق من وجود البريد الإلكتروني
        if (!email) {
            req.flash('error_msg', 'يرجى إدخال البريد الإلكتروني');
            return res.redirect('/auth/forgot-password');
        }
        
        // البحث عن المستخدم بالبريد الإلكتروني
        const user = await User.findOne({ email: email.toLowerCase() });
        
        // إذا لم يتم العثور على المستخدم (لأسباب أمنية، لا نكشف عن وجود المستخدم)
        if (!user) {
            req.flash('success_msg', 'إذا كان البريد مسجلاً، سيتم إرسال رمز التحقق');
            return res.redirect('/auth/forgot-password');
        }
        
        // توليد رمز التحقق (OTP)
        const otp = user.generateOTP();
        await user.save(); // حفظ الرمز في قاعدة البيانات
        
        // طباعة الرمز في سجل السيرفر (للتطوير، سيتم إرساله عبر البريد في الإنتاج)
        console.log('🔑 OTP للمستخدم ' + user.email + ': ' + otp);
        
        // حفظ البريد الإلكتروني في الجلسة للتحقق لاحقاً
        req.session.resetEmail = email;
        
        // عرض رسالة نجاح وتوجيه لصفحة التحقق من OTP
        req.flash('success_msg', 'تم إرسال رمز التحقق إلى بريدك الإلكتروني');
        return res.redirect('/auth/verify-otp');
        
    } catch (error) {
        // معالجة الأخطاء
        console.error('❌ خطأ في استعادة كلمة المرور:', error.message || error);
        req.flash('error_msg', 'حدث خطأ غير متوقع');
        return res.redirect('/auth/forgot-password');
    }
});

// =============================================
// التحقق من OTP - عرض نموذج إدخال الرمز
// =============================================

// مسار GET لعرض صفحة التحقق من OTP
router.get('/verify-otp', isGuest, (req, res) => {
    // التحقق من وجود بريد إلكتروني في الجلسة
    if (!req.session.resetEmail) {
        return res.redirect('/auth/forgot-password'); // إعادة التوجيه إذا لم يوجد
    }
    
    // عرض صفحة التحقق من OTP
    res.render('auth/verify-otp', {
        pageTitle: 'التحقق من الرمز', // عنوان الصفحة
        email: req.session.resetEmail, // عرض البريد الإلكتروني للمستخدم
        success_msg: req.flash('success_msg'), // رسائل النجاح
        error_msg: req.flash('error_msg') // رسائل الخطأ
    });
});

// =============================================
// التحقق من OTP - معالجة الرمز المدخل
// =============================================

// مسار POST لمعالجة التحقق من OTP
router.post('/verify-otp', isGuest, async (req, res) => {
    try {
        // استخراج الرمز من الطلب
        const { otp } = req.body;
        const email = req.session.resetEmail; // استخراج البريد من الجلسة
        
        // التحقق من وجود البيانات المطلوبة
        if (!email || !otp) {
            req.flash('error_msg', 'يرجى إدخال رمز التحقق');
            return res.redirect('/auth/verify-otp');
        }
        
        // البحث عن المستخدم بالبريد الإلكتروني
        const user = await User.findOne({ email: email.toLowerCase() });
        
        // التحقق من وجود المستخدم
        if (!user) {
            req.flash('error_msg', 'المستخدم غير موجود');
            return res.redirect('/auth/forgot-password');
        }
        
        // التحقق من صحة رمز OTP
        if (!user.verifyOTP(otp)) {
            req.flash('error_msg', 'رمز التحقق غير صحيح أو منتهي الصلاحية');
            return res.redirect('/auth/verify-otp');
        }
        
        // مسح رمز OTP بعد التحقق الناجح
        user.clearOTP();
        await user.save(); // حفظ التغييرات
        
        // تأكيد التحقق في الجلسة
        req.session.resetVerified = true;
        
        // توجيه لصفحة إعادة تعيين كلمة المرور
        return res.redirect('/auth/reset-password');
        
    } catch (error) {
        // معالجة الأخطاء
        console.error('❌ خطأ في التحقق من OTP:', error.message || error);
        req.flash('error_msg', 'حدث خطأ غير متوقع');
        return res.redirect('/auth/verify-otp');
    }
});

// =============================================
// إعادة تعيين كلمة المرور - عرض نموذج كلمة المرور الجديدة
// =============================================

// مسار GET لعرض صفحة إعادة تعيين كلمة المرور
router.get('/reset-password', isGuest, (req, res) => {
    // التحقق من تأكيد التحقق من OTP
    if (!req.session.resetVerified) {
        return res.redirect('/auth/forgot-password'); // إعادة التوجيه إذا لم يتم التحقق
    }
    
    // عرض صفحة إعادة تعيين كلمة المرور
    res.render('auth/reset-password', {
        pageTitle: 'إعادة تعيين كلمة المرور', // عنوان الصفحة
        success_msg: req.flash('success_msg'), // رسائل النجاح
        error_msg: req.flash('error_msg') // رسائل الخطأ
    });
});

// =============================================
// إعادة تعيين كلمة المرور - معالجة كلمة المرور الجديدة
// =============================================

// مسار POST لمعالجة إعادة تعيين كلمة المرور
router.post('/reset-password', isGuest, async (req, res) => {
    try {
        // استخراج كلمات المرور من الطلب
        const { password, password2 } = req.body;
        const email = req.session.resetEmail; // استخراج البريد من الجلسة
        
        // التحقق من صلاحية الجلسة
        if (!email || !req.session.resetVerified) {
            req.flash('error_msg', 'انتهت صلاحية الجلسة');
            return res.redirect('/auth/forgot-password');
        }
        
        // التحقق من وجود كلمات المرور
        if (!password || !password2) {
            req.flash('error_msg', 'يرجى إدخال كلمة المرور الجديدة');
            return res.redirect('/auth/reset-password');
        }
        
        // التحقق من تطابق كلمات المرور
        if (password !== password2) {
            req.flash('error_msg', 'كلمات المرور غير متطابقة');
            return res.redirect('/auth/reset-password');
        }
        
        // التحقق من طول كلمة المرور
        if (password.length < 6) {
            req.flash('error_msg', 'كلمة المرور 6 أحرف على الأقل');
            return res.redirect('/auth/reset-password');
        }
        
        // البحث عن المستخدم بالبريد الإلكتروني
        const user = await User.findOne({ email: email.toLowerCase() });
        
        // التحقق من وجود المستخدم
        if (!user) {
            req.flash('error_msg', 'المستخدم غير موجود');
            return res.redirect('/auth/forgot-password');
        }
        
        // تحديث كلمة المرور (سيتم تشفيرها تلقائياً في النموذج)
        user.password = password;
        await user.save(); // حفظ التغييرات
        
        // مسح بيانات الجلسة المؤقتة
        delete req.session.resetEmail;
        delete req.session.resetVerified;
        
        // عرض رسالة نجاح وتوجيه لصفحة تسجيل الدخول
        req.flash('success_msg', 'تم تغيير كلمة المرور بنجاح');
        return res.redirect('/auth/login');
        
    } catch (error) {
        // معالجة الأخطاء
        console.error('❌ خطأ في إعادة تعيين كلمة المرور:', error.message || error);
        req.flash('error_msg', 'حدث خطأ غير متوقع');
        return res.redirect('/auth/reset-password');
    }
});

// =============================================
// إرسال OTP للمستخدم المسجل (API)
// =============================================

// مسار POST لإرسال OTP للمستخدم المسجل (API)
router.post('/send-otp', isAuthenticated, async (req, res) => {
    try {
        // البحث عن المستخدم باستخدام المعرف من الجلسة
        const user = await User.findById(req.session.user._id);
        
        // التحقق من وجود المستخدم
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }
        
        // توليد رمز OTP جديد
        const otp = user.generateOTP();
        await user.save(); // حفظ الرمز في قاعدة البيانات
        
        // طباعة الرمز في سجل السيرفر (للتطوير)
        console.log('🔑 OTP للمستخدم ' + user.email + ': ' + otp);
        
        // إرجاع استجابة نجاح
        return res.json({ success: true, message: 'تم إرسال رمز التحقق' });
        
    } catch (error) {
        // معالجة الأخطاء
        return res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// التحقق من OTP للمستخدم المسجل (API)
// =============================================

// مسار POST للتحقق من OTP للمستخدم المسجل (API)
router.post('/verify-otp-action', isAuthenticated, async (req, res) => {
    try {
        // استخراج الرمز من الطلب
        const { otp } = req.body;
        
        // البحث عن المستخدم باستخدام المعرف من الجلسة
        const user = await User.findById(req.session.user._id);
        
        // التحقق من وجود المستخدم
        if (!user) {
            return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }
        
        // التحقق من صحة رمز OTP
        if (!user.verifyOTP(otp)) {
            return res.status(400).json({ success: false, message: 'رمز التحقق غير صحيح' });
        }
        
        // مسح رمز OTP بعد التحقق الناجح
        user.clearOTP();
        await user.save(); // حفظ التغييرات
        
        // إرجاع استجابة نجاح مع تأكيد التحقق
        return res.json({ success: true, verified: true });
        
    } catch (error) {
        // معالجة الأخطاء
        return res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// تصدير الراوتر لاستخدامه في الملف الرئيسي
module.exports = router;
