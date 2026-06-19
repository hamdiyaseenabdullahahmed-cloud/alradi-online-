// =============================================
// نظام الصلاحيات والحماية - Premium Middleware
// =============================================
const User = require('../models/User');

// 1. التحقق من تسجيل الدخول (للعملاء)
exports.isAuthenticated = async (req, res, next) => {
    if (req.session && req.session.user) {
        try {
            const user = await User.findById(req.session.user._id);
            if (user && user.isActive) {
                req.user = user; // حقن المستخدم في الطلب
                return next();
            }
        } catch (err) { console.error('خطأ في التحقق:', err); }
    }
    req.flash('error_msg', '🔒 يرجى تسجيل الدخول أولاً');
    res.redirect('/auth/login');
};

// 2. منع المستخدمين المسجلين من رؤية صفحات الدخول
exports.isGuest = (req, res, next) => {
    if (req.session && req.session.user) {
        return res.redirect('/');
    }
    next();
};

// 3. التحقق من صلاحيات المدير (للوحة التحكم)
exports.isAdmin = async (req, res, next) => {
    if (req.session && req.session.user) {
        try {
            const user = await User.findById(req.session.user._id);
            if (user && (user.role === 'admin' || user.role === 'superadmin')) {
                req.user = user;
                return next();
            } else {
                // تسجيل محاولة الاختراق
                console.warn(`⛔ محاولة وصول غير مصرح: ${user.name} حاول دخول لوحة التحكم`);
                req.flash('error_msg', '⛔ تم تسجيل محاولتك. لا تملك صلاحية الوصول.');
                return res.redirect('/');
            }
        } catch (err) { console.error('خطأ في صلاحيات المدير:', err); }
    }
    req.flash('error_msg', '🔒 يرجى تسجيل الدخول كمدير');
    res.redirect('/auth/login');
};
