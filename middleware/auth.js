// =============================================
// متجر الرعدي أون لاين - alradi-online
// نظام الحماية والصلاحيات - Middleware
// =============================================

const User = require('../models/User');
const ErrorLog = require('../models/ErrorLog');

// =============================================
// التحقق من تسجيل الدخول (للعملاء والمديرين)
// =============================================

const isAuthenticated = async (req, res, next) => {
    try {
        // التحقق من وجود جلسة صالحة
        if (!req.session || !req.session.user || !req.session.user._id) {
            // حفظ الرابط الحالي للعودة إليه بعد تسجيل الدخول
            req.session.returnTo = req.originalUrl;
            
            req.flash('error_msg', 'يرجى تسجيل الدخول أولاً للوصول إلى هذه الصفحة');
            return res.redirect('/auth/login');
        }
        
        // التحقق من أن المستخدم ما زال موجوداً وفعالاً في قاعدة البيانات
        const user = await User.findById(req.session.user._id).select('-password');
        
        if (!user) {
            // المستخدم لم يعد موجوداً في قاعدة البيانات
            req.session.destroy();
            req.flash('error_msg', 'الحساب غير موجود، يرجى التسجيل مرة أخرى');
            return res.redirect('/auth/login');
        }
        
        if (!user.isActive) {
            // الحساب معطل
            req.session.destroy();
            req.flash('error_msg', 'تم تعطيل حسابك، يرجى التواصل مع الإدارة');
            return res.redirect('/auth/login');
        }
        
        if (user.isBanned) {
            // الحساب محظور
            req.session.destroy();
            req.flash('error_msg', `تم حظر حسابك. السبب: ${user.banReason || 'غير محدد'}`);
            return res.redirect('/auth/login');
        }
        
        // التحقق من انتهاء الجلسة
        const sessionTimeout = 30 * 24 * 60 * 60 * 1000; // 30 يوم
        if (req.session.createdAt && (Date.now() - req.session.createdAt) > sessionTimeout) {
            req.session.destroy();
            req.flash('error_msg', 'انتهت جلستك، يرجى تسجيل الدخول مرة أخرى');
            return res.redirect('/auth/login');
        }
        
        // تحديث بيانات المستخدم في الجلسة
        req.session.user = {
            _id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role,
            profileImage: user.profileImage,
            loyaltyPoints: user.loyaltyPoints
        };
        
        // إضافة المستخدم إلى الطلب
        req.user = user;
        
        // تسجيل آخر نشاط
        req.session.lastActivity = new Date();
        
        next();
    } catch (error) {
        console.error('خطأ في التحقق من المصادقة:', error);
        req.flash('error_msg', 'حدث خطأ في التحقق من الجلسة');
        return res.redirect('/auth/login');
    }
};

// =============================================
// التحقق من صلاحيات المدير (للوحة التحكم)
// =============================================

const isAdmin = async (req, res, next) => {
    try {
        // التحقق من المصادقة أولاً
        if (!req.session || !req.session.user || !req.session.user._id) {
            // تسجيل محاولة الوصول غير المصرح
            await ErrorLog.logUnauthorizedAccess({
                url: req.originalUrl,
                method: req.method,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                sessionId: req.sessionID || ''
            });
            
            req.flash('error_msg', 'يرجى تسجيل الدخول للوصول إلى لوحة التحكم');
            return res.redirect('/auth/login');
        }
        
        // التحقق من دور المستخدم
        const userRole = req.session.user.role;
        
        if (userRole !== 'admin' && userRole !== 'superadmin' && userRole !== 'moderator') {
            // مستخدم عادي يحاول الوصول للوحة التحكم - تسجيل المحاولة
            await ErrorLog.logUnauthorizedAccess({
                url: req.originalUrl,
                method: req.method,
                userId: req.session.user._id,
                username: req.session.user.username || '',
                userRole: userRole,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                sessionId: req.sessionID || ''
            });
            
            // إنهاء الجلسة فوراً للمستخدم العادي الذي يحاول اختراق لوحة التحكم
            req.session.destroy();
            
            req.flash('error_msg', 'تم تسجيل محاولة وصول غير مصرح بها. تم إنهاء جلستك.');
            return res.redirect('/auth/login');
        }
        
        // التحقق من وجود المستخدم في قاعدة البيانات
        const user = await User.findById(req.session.user._id).select('-password');
        
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin' && user.role !== 'moderator')) {
            req.session.destroy();
            req.flash('error_msg', 'صلاحيات غير كافية');
            return res.redirect('/auth/login');
        }
        
        // إضافة المستخدم إلى الطلب
        req.user = user;
        
        // تسجيل الدخول إلى لوحة التحكم
        console.log(`🔑 دخول لوحة التحكم: ${user.name} (${user.role}) - ${new Date().toLocaleString()}`);
        
        next();
    } catch (error) {
        console.error('خطأ في التحقق من صلاحيات المدير:', error);
        req.flash('error_msg', 'حدث خطأ في التحقق من الصلاحيات');
        return res.redirect('/auth/login');
    }
};

// =============================================
// التحقق من صلاحيات المدير العام (Super Admin)
// =============================================

const isSuperAdmin = async (req, res, next) => {
    try {
        if (!req.session || !req.session.user || req.session.user.role !== 'superadmin') {
            await ErrorLog.logUnauthorizedAccess({
                url: req.originalUrl,
                method: req.method,
                userId: req.session?.user?._id || null,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
            
            req.flash('error_msg', 'هذه الصلاحيات متاحة فقط للمدير العام');
            return res.redirect('/admin/dashboard');
        }
        
        const user = await User.findById(req.session.user._id);
        if (!user || user.role !== 'superadmin') {
            req.flash('error_msg', 'صلاحيات غير كافية');
            return res.redirect('/admin/dashboard');
        }
        
        req.user = user;
        next();
    } catch (error) {
        console.error('خطأ في التحقق من صلاحيات المدير العام:', error);
        res.redirect('/admin/dashboard');
    }
};

// =============================================
// التوجيه الذكي بعد تسجيل الدخول
// =============================================

const redirectAfterLogin = (req, res, next) => {
    if (req.session && req.session.user) {
        const userRole = req.session.user.role;
        
        // إذا كان مديراً، توجيه إلى لوحة التحكم
        if (userRole === 'admin' || userRole === 'superadmin' || userRole === 'moderator') {
            // لكن إذا كان في طريقه لصفحة معينة، دعه يكمل
            if (req.path === '/auth/login' || req.path === '/auth/register') {
                return res.redirect('/admin/dashboard');
            }
        }
        
        // إذا كان عميلاً، توجيه إلى الصفحة الرئيسية
        if (userRole === 'customer') {
            if (req.path === '/auth/login' || req.path === '/auth/register') {
                // إذا كان هناك رابط سابق محفوظ، العودة إليه
                const returnTo = req.session.returnTo || '/';
                delete req.session.returnTo;
                return res.redirect(returnTo);
            }
        }
    }
    next();
};

// =============================================
// منع المستخدمين المسجلين من دخول صفحات التسجيل والدخول
// =============================================

const isGuest = (req, res, next) => {
    if (req.session && req.session.user) {
        const userRole = req.session.user.role;
        
        if (userRole === 'admin' || userRole === 'superadmin' || userRole === 'moderator') {
            return res.redirect('/admin/dashboard');
        }
        
        return res.redirect('/');
    }
    next();
};

// =============================================
// التحقق من صلاحية الوصول لصفحات معينة
// =============================================

const hasPermission = (permission) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                req.flash('error_msg', 'يرجى تسجيل الدخول أولاً');
                return res.redirect('/auth/login');
            }
            
            if (!req.user.hasPermission(permission)) {
                req.flash('error_msg', 'ليس لديك صلاحية للقيام بهذا الإجراء');
                return res.redirect('back');
            }
            
            next();
        } catch (error) {
            console.error('خطأ في التحقق من الصلاحية:', error);
            res.redirect('back');
        }
    };
};

// =============================================
// تسجيل نشاطات المدير في لوحة التحكم
// =============================================

const logAdminActivity = (action, description) => {
    return async (req, res, next) => {
        try {
            if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
                await req.user.addActivity(
                    action,
                    description,
                    req.ip,
                    req.headers['user-agent']
                );
            }
            next();
        } catch (error) {
            // حتى لو فشل التسجيل، نكمل العملية
            next();
        }
    };
};

// =============================================
// التحقق من ملكية الحساب (للعملاء)
// =============================================

const isAccountOwner = async (req, res, next) => {
    try {
        const userId = req.params.userId || req.body.userId;
        
        if (!req.session.user || req.session.user._id.toString() !== userId.toString()) {
            // المدير يمكنه الوصول
            if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'superadmin')) {
                return next();
            }
            
            req.flash('error_msg', 'غير مصرح لك بالوصول إلى هذا الحساب');
            return res.redirect('/');
        }
        
        next();
    } catch (error) {
        console.error('خطأ في التحقق من ملكية الحساب:', error);
        res.redirect('/');
    }
};

// =============================================
// Rate Limiting مخصص للمسارات الحساسة
// =============================================

const sensitiveActionLimiter = (maxAttempts = 3, windowMinutes = 15) => {
    const attempts = new Map();
    
    return (req, res, next) => {
        const key = req.ip + ':' + req.path;
        const now = Date.now();
        const windowMs = windowMinutes * 60 * 1000;
        
        if (!attempts.has(key)) {
            attempts.set(key, []);
        }
        
        const userAttempts = attempts.get(key);
        
        // تنظيف المحاولات القديمة
        const recentAttempts = userAttempts.filter(time => now - time < windowMs);
        attempts.set(key, recentAttempts);
        
        if (recentAttempts.length >= maxAttempts) {
            return res.status(429).json({
                success: false,
                message: `عدد المحاولات كبير جداً. الرجاء الانتظار ${windowMinutes} دقيقة`
            });
        }
        
        recentAttempts.push(now);
        next();
    };
};

// =============================================
// التحقق من IP (حماية إضافية)
// =============================================

const ipWhitelist = (allowedIPs = []) => {
    return (req, res, next) => {
        if (allowedIPs.length === 0) {
            return next();
        }
        
        const clientIP = req.ip || req.connection.remoteAddress;
        
        if (allowedIPs.includes(clientIP) || allowedIPs.includes('*')) {
            return next();
        }
        
        console.warn(`⚠️ محاولة وصول من IP غير مصرح: ${clientIP}`);
        return res.status(403).json({
            success: false,
            message: 'غير مصرح بالوصول من هذا العنوان'
        });
    };
};

// =============================================
// إضافة بيانات المستخدم إلى جميع القوالب
// =============================================

const setUserLocals = async (req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    res.locals.isAuthenticated = !!req.session.user;
    res.locals.isAdmin = req.session.user && 
        (req.session.user.role === 'admin' || req.session.user.role === 'superadmin');
    res.locals.isSuperAdmin = req.session.user && req.session.user.role === 'superadmin';
    next();
};

module.exports = {
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    isGuest,
    redirectAfterLogin,
    hasPermission,
    logAdminActivity,
    isAccountOwner,
    sensitiveActionLimiter,
    ipWhitelist,
    setUserLocals
};
