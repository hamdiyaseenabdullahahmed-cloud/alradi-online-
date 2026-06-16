// =============================================
// متجر الرعدي أون لاين - alradi-online
// مسارات حساب العميل
// =============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAuthenticated } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const StoreSettings = require('../models/StoreSettings');

// =============================================
// إعدادات رفع الصورة الشخصية
// =============================================

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadPath = 'public/uploads/profiles/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function(req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('يرجى رفع صورة بصيغة jpg, png, gif, webp'));
        }
    }
});

// =============================================
// تطبيق middleware المصادقة
// =============================================

router.use(isAuthenticated);

// =============================================
// لوحة حساب العميل الرئيسية
// =============================================

router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id)
            .populate('wishlist')
            .select('-password');
        
        if (!user) {
            req.flash('error_msg', 'المستخدم غير موجود');
            return res.redirect('/auth/login');
        }
        
        // آخر 5 طلبات
        const recentOrders = await Order.find({ user: user._id })
            .sort('-createdAt')
            .limit(5)
            .select('orderNumber totalAmount status createdAt');
        
        // عدد الطلبات لكل حالة
        const orderStats = await Order.aggregate([
            { $match: { user: user._id } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        
        const statusCounts = {};
        orderStats.forEach(stat => {
            statusCounts[stat._id] = stat.count;
        });
        
        const storeSettings = await StoreSettings.getSettings();
        
        res.render('account/dashboard', {
            pageTitle: 'حسابي',
            activeMenu: 'dashboard',
            user,
            recentOrders,
            orderStats: statusCounts,
            storeSettings,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
        
    } catch (error) {
        console.error('خطأ في لوحة الحساب:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل بيانات الحساب');
        res.redirect('/');
    }
});

// =============================================
// الملف الشخصي
// =============================================

router.get('/profile', async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id).select('-password');
        
        if (!user) {
            req.flash('error_msg', 'المستخدم غير موجود');
            return res.redirect('/auth/login');
        }
        
        res.render('account/profile', {
            pageTitle: 'الملف الشخصي',
            activeMenu: 'profile',
            user,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg'),
            info_msg: req.flash('info_msg')
        });
        
    } catch (error) {
        console.error('خطأ في صفحة الملف الشخصي:', error);
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('/account');
    }
});

// =============================================
// تحديث الملف الشخصي
// =============================================

router.post('/profile', upload.single('profileImage'), async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id);
        
        if (!user) {
            req.flash('error_msg', 'المستخدم غير موجود');
            return res.redirect('/auth/login');
        }
        
        const { name, phone, alternativePhone, street, city, state, zipCode, country } = req.body;
        
        // تحديث البيانات الأساسية
        user.name = name || user.name;
        user.phone = phone || user.phone;
        user.alternativePhone = alternativePhone || user.alternativePhone;
        
        // تحديث العنوان
        user.address = {
            street: street || user.address.street,
            city: city || user.address.city,
            state: state || user.address.state,
            zipCode: zipCode || user.address.zipCode,
            country: country || user.address.country
        };
        
        // تحديث الصورة الشخصية
        if (req.file) {
            user.profileImage = '/' + req.file.path.replace(/\\/g, '/').replace('public/', '');
        }
        
        await user.save();
        
        // تحديث الجلسة
        req.session.user.name = user.name;
        req.session.user.profileImage = user.profileImage;
        
        // تسجيل النشاط
        await user.addActivity(
            'update_profile',
            'تحديث الملف الشخصي',
            req.ip,
            req.headers['user-agent']
        );
        
        req.flash('success_msg', 'تم تحديث الملف الشخصي بنجاح');
        res.redirect('/account/profile');
        
    } catch (error) {
        console.error('خطأ في تحديث الملف الشخصي:', error);
        req.flash('error_msg', 'حدث خطأ في تحديث البيانات');
        res.redirect('/account/profile');
    }
});

// =============================================
// تغيير كلمة المرور
// =============================================

router.get('/change-password', async (req, res) => {
    res.render('account/change-password', {
        pageTitle: 'تغيير كلمة المرور',
        activeMenu: 'security',
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
    });
});

router.post('/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const user = await User.findById(req.session.user._id);
        
        if (!user) {
            req.flash('error_msg', 'المستخدم غير موجود');
            return res.redirect('/auth/login');
        }
        
        // التحقق من البيانات
        if (!currentPassword || !newPassword || !confirmPassword) {
            req.flash('error_msg', 'يرجى إدخال جميع البيانات المطلوبة');
            return res.redirect('/account/change-password');
        }
        
        // التحقق من تطابق كلمة المرور الجديدة
        if (newPassword !== confirmPassword) {
            req.flash('error_msg', 'كلمات المرور الجديدة غير متطابقة');
            return res.redirect('/account/change-password');
        }
        
        // التحقق من طول كلمة المرور
        if (newPassword.length < 6) {
            req.flash('error_msg', 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
            return res.redirect('/account/change-password');
        }
        
        // التحقق من كلمة المرور الحالية
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            req.flash('error_msg', 'كلمة المرور الحالية غير صحيحة');
            return res.redirect('/account/change-password');
        }
        
        // تحديث كلمة المرور
        user.password = newPassword;
        await user.save();
        
        // تسجيل النشاط
        await user.addActivity(
            'change_password',
            'تغيير كلمة المرور',
            req.ip,
            req.headers['user-agent']
        );
        
        req.flash('success_msg', 'تم تغيير كلمة المرور بنجاح');
        res.redirect('/account/profile');
        
    } catch (error) {
        console.error('خطأ في تغيير كلمة المرور:', error);
        req.flash('error_msg', 'حدث خطأ في تغيير كلمة المرور');
        res.redirect('/account/change-password');
    }
});

// =============================================
// تغيير اسم المستخدم (يتطلب تحقق OTP)
// =============================================

router.post('/change-username', async (req, res) => {
    try {
        const { newUsername, password, otp } = req.body;
        const user = await User.findById(req.session.user._id);
        
        if (!user) {
            return res.json({ success: false, message: 'المستخدم غير موجود' });
        }
        
        // التحقق من كلمة المرور
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.json({ success: false, message: 'كلمة المرور غير صحيحة' });
        }
        
        // التحقق من OTP
        if (!user.verifyOTP(otp)) {
            return res.json({ success: false, message: 'رمز التحقق غير صحيح أو منتهي الصلاحية' });
        }
        
        // التحقق من صحة اسم المستخدم
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(newUsername)) {
            return res.json({ success: false, message: 'اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام وشرطة سفلية فقط' });
        }
        
        // التحقق من عدم وجود مستخدم آخر بنفس الاسم
        const existingUser = await User.findOne({ username: newUsername.toLowerCase(), _id: { $ne: user._id } });
        if (existingUser) {
            return res.json({ success: false, message: 'اسم المستخدم مستخدم مسبقاً' });
        }
        
        // تحديث اسم المستخدم
        user.username = newUsername.toLowerCase();
        user.clearOTP();
        await user.save();
        
        // تحديث الجلسة
        req.session.user.username = user.username;
        
        // تسجيل النشاط
        await user.addActivity(
            'change_username',
            'تغيير اسم المستخدم',
            req.ip,
            req.headers['user-agent']
        );
        
        res.json({ success: true, message: 'تم تغيير اسم المستخدم بنجاح' });
        
    } catch (error) {
        console.error('خطأ في تغيير اسم المستخدم:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// تغيير البريد الإلكتروني (يتطلب تحقق OTP)
// =============================================

router.post('/change-email', async (req, res) => {
    try {
        const { newEmail, password, otp } = req.body;
        const user = await User.findById(req.session.user._id);
        
        if (!user) {
            return res.json({ success: false, message: 'المستخدم غير موجود' });
        }
        
        // التحقق من كلمة المرور
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.json({ success: false, message: 'كلمة المرور غير صحيحة' });
        }
        
        // التحقق من OTP
        if (!user.verifyOTP(otp)) {
            return res.json({ success: false, message: 'رمز التحقق غير صحيح أو منتهي الصلاحية' });
        }
        
        // التحقق من عدم وجود مستخدم آخر بنفس البريد
        const existingUser = await User.findOne({ email: newEmail.toLowerCase(), _id: { $ne: user._id } });
        if (existingUser) {
            return res.json({ success: false, message: 'البريد الإلكتروني مسجل مسبقاً' });
        }
        
        // تحديث البريد
        user.email = newEmail.toLowerCase();
        user.clearOTP();
        await user.save();
        
        // تحديث الجلسة
        req.session.user.email = user.email;
        
        // تسجيل النشاط
        await user.addActivity(
            'change_email',
            'تغيير البريد الإلكتروني',
            req.ip,
            req.headers['user-agent']
        );
        
        res.json({ success: true, message: 'تم تغيير البريد الإلكتروني بنجاح' });
        
    } catch (error) {
        console.error('خطأ في تغيير البريد الإلكتروني:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// سجل الطلبات
// =============================================

router.get('/orders', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const status = req.query.status || '';
        
        const filter = { user: req.session.user._id };
        if (status) filter.status = status;
        
        const skip = (page - 1) * limit;
        
        const [orders, total] = await Promise.all([
            Order.find(filter)
                .sort('-createdAt')
                .skip(skip)
                .limit(limit)
                .select('orderNumber invoiceNumber totalAmount status paymentStatus shippingMethod createdAt estimatedDeliveryDate items'),
            Order.countDocuments(filter)
        ]);
        
        res.render('account/orders', {
            pageTitle: 'طلباتي',
            activeMenu: 'orders',
            orders,
            status,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
        
    } catch (error) {
        console.error('خطأ في سجل الطلبات:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل الطلبات');
        res.redirect('/account');
    }
});

// =============================================
// تفاصيل طلب محدد
// =============================================

router.get('/orders/:id', async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.session.user._id
        }).populate('items.product', 'name images slug');
        
        if (!order) {
            req.flash('error_msg', 'الطلب غير موجود');
            return res.redirect('/account/orders');
        }
        
        res.render('account/order-detail', {
            pageTitle: 'تفاصيل الطلب: ' + order.orderNumber,
            activeMenu: 'orders',
            order,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
        
    } catch (error) {
        console.error('خطأ في تفاصيل الطلب:', error);
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('/account/orders');
    }
});

// =============================================
// طلب استبدال/مرتجع
// =============================================

router.post('/orders/:id/return', async (req, res) => {
    try {
        const { reason, notes } = req.body;
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.session.user._id
        });
        
        if (!order) {
            req.flash('error_msg', 'الطلب غير موجود');
            return res.redirect('/account/orders');
        }
        
        await order.requestReturn(reason, notes);
        
        req.flash('success_msg', 'تم تقديم طلب الاستبدال بنجاح. سنراجعه ونتواصل معك قريباً');
        res.redirect('/account/orders/' + order._id);
        
    } catch (error) {
        console.error('خطأ في طلب الاستبدال:', error);
        req.flash('error_msg', error.message || 'حدث خطأ في تقديم طلب الاستبدال');
        res.redirect('/account/orders/' + req.params.id);
    }
});

// =============================================
// المفضلة
// =============================================

router.get('/wishlist', async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id)
            .populate({
                path: 'wishlist',
                match: { isActive: true, isHidden: false },
                select: 'name nameEn price comparePrice images rating stockStatus slug'
            });
        
        const wishlistProducts = user.wishlist.filter(p => p !== null);
        
        res.render('account/wishlist', {
            pageTitle: 'المفضلة',
            activeMenu: 'wishlist',
            products: wishlistProducts,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
        
    } catch (error) {
        console.error('خطأ في المفضلة:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل المفضلة');
        res.redirect('/account');
    }
});

// =============================================
// برنامج الولاء والنقاط
// =============================================

router.get('/loyalty', async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id).select('loyaltyPoints totalPointsEarned totalPointsRedeemed');
        const storeSettings = await StoreSettings.getSettings();
        
        res.render('account/loyalty', {
            pageTitle: 'برنامج الولاء',
            activeMenu: 'loyalty',
            user,
            storeSettings,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
        
    } catch (error) {
        console.error('خطأ في صفحة الولاء:', error);
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('/account');
    }
});

// =============================================
// استبدال نقاط الولاء
// =============================================

router.post('/loyalty/redeem', async (req, res) => {
    try {
        const { points } = req.body;
        const user = await User.findById(req.session.user._id);
        const storeSettings = await StoreSettings.getSettings();
        
        const pointsToRedeem = parseInt(points);
        
        if (!pointsToRedeem || pointsToRedeem < (storeSettings.minimumPointsToRedeem || 100)) {
            return res.json({ 
                success: false, 
                message: `الحد الأدنى للاستبدال هو ${storeSettings.minimumPointsToRedeem || 100} نقطة` 
            });
        }
        
        await user.redeemLoyaltyPoints(pointsToRedeem);
        
        // تحديث الجلسة
        req.session.user.loyaltyPoints = user.loyaltyPoints;
        
        // حساب قيمة الخصم
        const discountValue = pointsToRedeem * (storeSettings.pointsValueInRiyal || 0.01);
        
        res.json({
            success: true,
            message: `تم استبدال ${pointsToRedeem} نقطة بنجاح. قيمة الخصم: ${discountValue.toFixed(2)} ر.س`,
            remainingPoints: user.loyaltyPoints,
            discountValue: discountValue
        });
        
    } catch (error) {
        console.error('خطأ في استبدال النقاط:', error);
        res.status(500).json({ success: false, message: error.message || 'حدث خطأ' });
    }
});

// =============================================
// تفضيلات الإشعارات
// =============================================

router.get('/preferences', async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id).select('preferences');
        
        res.render('account/preferences', {
            pageTitle: 'الإعدادات والتفضيلات',
            activeMenu: 'preferences',
            user,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
        
    } catch (error) {
        console.error('خطأ في صفحة التفضيلات:', error);
        res.redirect('/account');
    }
});

router.post('/preferences', async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id);
        
        user.preferences = {
            language: req.body.language || 'ar',
            currency: req.body.currency || 'SAR',
            darkMode: req.body.darkMode === 'on',
            emailNotifications: req.body.emailNotifications === 'on',
            smsNotifications: req.body.smsNotifications === 'on'
        };
        
        await user.save();
        
        req.flash('success_msg', 'تم تحديث التفضيلات بنجاح');
        res.redirect('/account/preferences');
        
    } catch (error) {
        console.error('خطأ في تحديث التفضيلات:', error);
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('/account/preferences');
    }
});

// =============================================
// حذف الحساب
// =============================================

router.get('/delete-account', (req, res) => {
    res.render('account/delete-account', {
        pageTitle: 'حذف الحساب',
        activeMenu: 'security',
        success_msg: req.flash('success_msg'),
        error_msg: req.flash('error_msg')
    });
});

router.post('/delete-account', async (req, res) => {
    try {
        const { password, confirmText } = req.body;
        const user = await User.findById(req.session.user._id);
        
        if (!user) {
            req.flash('error_msg', 'المستخدم غير موجود');
            return res.redirect('/auth/login');
        }
        
        // التحقق من كلمة المرور
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            req.flash('error_msg', 'كلمة المرور غير صحيحة');
            return res.redirect('/account/delete-account');
        }
        
        // التحقق من نص التأكيد
        if (confirmText !== 'حذف') {
            req.flash('error_msg', 'يرجى كتابة "حذف" للتأكيد');
            return res.redirect('/account/delete-account');
        }
        
        // تعطيل الحساب بدلاً من حذفه نهائياً
        user.isActive = false;
        await user.save();
        
        // تسجيل النشاط
        await user.addActivity(
            'deactivate_account',
            'تعطيل الحساب',
            req.ip,
            req.headers['user-agent']
        );
        
        // تدمير الجلسة
        req.session.destroy();
        
        req.flash('success_msg', 'تم حذف حسابك بنجاح. نأسف لرحيلك');
        res.redirect('/');
        
    } catch (error) {
        console.error('خطأ في حذف الحساب:', error);
        req.flash('error_msg', 'حدث خطأ في حذف الحساب');
        res.redirect('/account/delete-account');
    }
});

module.exports = router;
