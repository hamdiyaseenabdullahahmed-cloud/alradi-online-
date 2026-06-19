const User = require('../models/User');
const ErrorLog = require('../models/ErrorLog');

exports.isAuthenticated = async (req, res, next) => {
    if (req.session && req.session.user) {
        try {
            const user = await User.findById(req.session.user._id);
            if (user && user.isActive) {
                req.user = user;
                return next();
            }
        } catch (err) { console.error('خطأ في التحقق:', err); }
    }
    req.flash('error_msg', 'يرجى تسجيل الدخول أولاً');
    res.redirect('/auth/login');
};

exports.isAdmin = async (req, res, next) => {
    if (req.session && req.session.user) {
        try {
            const user = await User.findById(req.session.user._id);
            if (user && (user.role === 'admin' || user.role === 'superadmin')) {
                req.user = user;
                return next();
            } else {
                // تسجيل محاولة الاختراق
                await ErrorLog.create({
                    errorType: 'access_denied',
                    message: `محاولة وصول غير مصرح للوحة التحكم`,
                    userId: user._id,
                    ipAddress: req.ip,
                    severity: 'high'
                });
                req.flash('error_msg', '⛔ تم تسجيل محاولتك. لا تملك صلاحية الوصول.');
                return res.redirect('/');
            }
        } catch (err) { console.error('خطأ في صلاحيات المدير:', err); }
    }
    req.flash('error_msg', 'يرجى تسجيل الدخول كمدير');
    res.redirect('/auth/login');
};
