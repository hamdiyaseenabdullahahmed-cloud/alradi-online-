// =============================================
// متجر الرعدي أون لاين - alradi-online
// نموذج المستخدمين (عملاء + مديرين)
// =============================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    
    // ========== البيانات الأساسية ==========
    name: {
        type: String,
        required: [true, 'الاسم الكامل مطلوب'],
        trim: true,
        minlength: [3, 'الاسم يجب أن يكون 3 أحرف على الأقل'],
        maxlength: [100, 'الاسم يجب أن لا يتجاوز 100 حرف']
    },
    username: {
        type: String,
        required: [true, 'اسم المستخدم مطلوب'],
        unique: true,
        trim: true,
        lowercase: true,
        minlength: [3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل'],
        maxlength: [30, 'اسم المستخدم يجب أن لا يتجاوز 30 حرف'],
        match: [/^[a-zA-Z0-9_]+$/, 'اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام وشرطة سفلية فقط']
    },
    email: {
        type: String,
        required: [true, 'البريد الإلكتروني مطلوب'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'يرجى إدخال بريد إلكتروني صحيح']
    },
    password: {
        type: String,
        required: [true, 'كلمة المرور مطلوبة'],
        minlength: [6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل']
    },
    
    // ========== بيانات الاتصال ==========
    phone: {
        type: String,
        trim: true,
        default: ''
    },
    alternativePhone: {
        type: String,
        trim: true,
        default: ''
    },
    
    // ========== الصلاحيات والدور ==========
    role: {
        type: String,
        enum: {
            values: ['customer', 'moderator', 'admin', 'superadmin'],
            message: 'الدور {VALUE} غير صالح'
        },
        default: 'customer'
    },
    
    // ========== حالة الحساب ==========
    isActive: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isBanned: {
        type: Boolean,
        default: false
    },
    banReason: {
        type: String,
        default: ''
    },
    
    // ========== الصورة الشخصية ==========
    profileImage: {
        type: String,
        default: '/images/default-avatar.png'
    },
    
    // ========== العنوان ==========
    address: {
        street: {
            type: String,
            default: ''
        },
        city: {
            type: String,
            default: ''
        },
        state: {
            type: String,
            default: ''
        },
        zipCode: {
            type: String,
            default: ''
        },
        country: {
            type: String,
            default: 'المملكة العربية السعودية'
        }
    },
    
    // ========== الأمان ==========
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockedUntil: {
        type: Date,
        default: null
    },
    lastLogin: {
        type: Date,
        default: null
    },
    lastLoginIp: {
        type: String,
        default: ''
    },
    passwordChangedAt: {
        type: Date,
        default: null
    },
    passwordResetToken: {
        type: String,
        default: null
    },
    passwordResetExpires: {
        type: Date,
        default: null
    },
    
    // ========== التحقق بخطوتين ==========
    otpCode: {
        type: String,
        default: null
    },
    otpExpires: {
        type: Date,
        default: null
    },
    otpRequestedAt: {
        type: Date,
        default: null
    },
    
    // ========== برنامج الولاء ==========
    loyaltyPoints: {
        type: Number,
        default: 0
    },
    totalPointsEarned: {
        type: Number,
        default: 0
    },
    totalPointsRedeemed: {
        type: Number,
        default: 0
    },
    
    // ========== الإحصائيات ==========
    totalOrders: {
        type: Number,
        default: 0
    },
    totalSpent: {
        type: Number,
        default: 0
    },
    lastOrderDate: {
        type: Date,
        default: null
    },
    
    // ========== التفضيلات ==========
    preferences: {
        language: {
            type: String,
            enum: ['ar', 'en'],
            default: 'ar'
        },
        currency: {
            type: String,
            default: 'SAR'
        },
        darkMode: {
            type: Boolean,
            default: false
        },
        emailNotifications: {
            type: Boolean,
            default: true
        },
        smsNotifications: {
            type: Boolean,
            default: false
        }
    },
    
    // ========== قائمة المفضلة ==========
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    
    // ========== سجل النشاطات ==========
    activityLog: [{
        action: String,
        description: String,
        ip: String,
        userAgent: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
    
}, { 
    timestamps: true 
});

// =============================================
// INDEXES - الفهارس لتسريع البحث
// =============================================

userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// =============================================
// MIDDLEWARE - تشفير كلمة المرور قبل الحفظ
// =============================================

userSchema.pre('save', async function(next) {
    // إذا لم تتغير كلمة المرور، تخطى التشفير
    if (!this.isModified('password')) return next();
    
    try {
        // تشفير كلمة المرور
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        
        // تسجيل تاريخ تغيير كلمة المرور
        this.passwordChangedAt = new Date();
        
        next();
    } catch (error) {
        next(error);
    }
});

// =============================================
// MIDDLEWARE - تحديث إحصائيات بعد الحفظ
// =============================================

userSchema.post('save', function(doc) {
    if (doc.role === 'customer') {
        // يمكن إضافة إشعارات أو عمليات أخرى هنا
    }
});

// =============================================
// METHODS - مقارنة كلمة المرور
// =============================================

userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('خطأ في مقارنة كلمة المرور');
    }
};

// =============================================
// METHODS - التحقق من تغيير كلمة المرور بعد إصدار JWT
// =============================================

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

// =============================================
// METHODS - زيادة محاولات تسجيل الدخول الفاشلة
// =============================================

userSchema.methods.incrementLoginAttempts = async function() {
    // إذا كان الحساب مقفلاً وانتهت مدة القفل، أعد تعيين المحاولات
    if (this.lockedUntil && this.lockedUntil < Date.now()) {
        this.loginAttempts = 1;
        this.lockedUntil = null;
    } else {
        this.loginAttempts += 1;
        
        // قفل الحساب بعد 5 محاولات فاشلة
        if (this.loginAttempts >= 5) {
            this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 دقيقة
        }
    }
    
    return this.save();
};

// =============================================
// METHODS - إعادة تعيين محاولات الدخول
// =============================================

userSchema.methods.resetLoginAttempts = async function() {
    this.loginAttempts = 0;
    this.lockedUntil = null;
    this.lastLogin = new Date();
    return this.save();
};

// =============================================
// METHODS - توليد رمز OTP
// =============================================

userSchema.methods.generateOTP = function() {
    // توليد رمز مكون من 6 أرقام
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    this.otpCode = otp;
    this.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 دقائق
    this.otpRequestedAt = new Date();
    
    return otp;
};

// =============================================
// METHODS - التحقق من صحة OTP
// =============================================

userSchema.methods.verifyOTP = function(code) {
    if (!this.otpCode || !this.otpExpires) {
        return false;
    }
    
    if (this.otpExpires < Date.now()) {
        return false;
    }
    
    if (this.otpCode !== code) {
        return false;
    }
    
    return true;
};

// =============================================
// METHODS - مسح OTP بعد الاستخدام
// =============================================

userSchema.methods.clearOTP = function() {
    this.otpCode = null;
    this.otpExpires = null;
    this.otpRequestedAt = null;
};

// =============================================
// METHODS - إضافة نقاط ولاء
// =============================================

userSchema.methods.addLoyaltyPoints = async function(points) {
    this.loyaltyPoints += points;
    this.totalPointsEarned += points;
    return this.save();
};

// =============================================
// METHODS - استبدال نقاط الولاء
// =============================================

userSchema.methods.redeemLoyaltyPoints = async function(points) {
    if (this.loyaltyPoints < points) {
        throw new Error('نقاط غير كافية');
    }
    this.loyaltyPoints -= points;
    this.totalPointsRedeemed += points;
    return this.save();
};

// =============================================
// METHODS - إضافة نشاط للسجل
// =============================================

userSchema.methods.addActivity = async function(action, description, ip, userAgent) {
    this.activityLog.push({
        action,
        description,
        ip: ip || '',
        userAgent: userAgent || '',
        timestamp: new Date()
    });
    
    // الاحتفاظ بآخر 100 نشاط فقط
    if (this.activityLog.length > 100) {
        this.activityLog = this.activityLog.slice(-100);
    }
    
    return this.save();
};

// =============================================
// METHODS - الحصول على الملف الشخصي الآمن
// =============================================

userSchema.methods.getSafeProfile = function() {
    return {
        id: this._id,
        name: this.name,
        username: this.username,
        email: this.email,
        phone: this.phone,
        role: this.role,
        profileImage: this.profileImage,
        address: this.address,
        loyaltyPoints: this.loyaltyPoints,
        totalOrders: this.totalOrders,
        totalSpent: this.totalSpent,
        preferences: this.preferences,
        wishlist: this.wishlist,
        isVerified: this.isVerified,
        createdAt: this.createdAt,
        lastLogin: this.lastLogin
    };
};

// =============================================
// METHODS - التحقق من صلاحيات المدير
// =============================================

userSchema.methods.isAdmin = function() {
    return this.role === 'admin' || this.role === 'superadmin';
};

userSchema.methods.isSuperAdmin = function() {
    return this.role === 'superadmin';
};

userSchema.methods.isModerator = function() {
    return this.role === 'moderator';
};

userSchema.methods.hasPermission = function(permission) {
    const permissions = {
        'customer': ['view_products', 'add_to_cart', 'place_order', 'view_own_orders'],
        'moderator': ['view_products', 'add_to_cart', 'place_order', 'view_own_orders', 
                      'view_all_orders', 'manage_products', 'view_customers'],
        'admin': ['view_products', 'add_to_cart', 'place_order', 'view_own_orders',
                  'view_all_orders', 'manage_products', 'manage_categories',
                  'view_customers', 'manage_customers', 'view_reports',
                  'manage_settings', 'manage_admins', 'send_notifications'],
        'superadmin': ['view_products', 'add_to_cart', 'place_order', 'view_own_orders',
                       'view_all_orders', 'manage_products', 'manage_categories',
                       'view_customers', 'manage_customers', 'view_reports',
                       'manage_settings', 'manage_admins', 'send_notifications',
                       'delete_store', 'manage_backups', 'view_logs']
    };
    
    return permissions[this.role] && permissions[this.role].includes(permission);
};

// =============================================
// STATICS - البحث عن مستخدم بالبريد أو اسم المستخدم
// =============================================

userSchema.statics.findByLogin = async function(login) {
    // البحث بالبريد الإلكتروني أو اسم المستخدم
    const user = await this.findOne({
        $or: [
            { email: login.toLowerCase() },
            { username: login.toLowerCase() }
        ]
    });
    
    return user;
};

// =============================================
// STATICS - الحصول على إحصائيات المستخدمين
// =============================================

userSchema.statics.getStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                totalCustomers: {
                    $sum: { $cond: [{ $eq: ['$role', 'customer'] }, 1, 0] }
                },
                totalAdmins: {
                    $sum: { $cond: [{ $in: ['$role', ['admin', 'superadmin']] }, 1, 0] }
                },
                activeUsers: {
                    $sum: { $cond: ['$isActive', 1, 0] }
                },
                totalLoyaltyPoints: { $sum: '$loyaltyPoints' },
                totalSpent: { $sum: '$totalSpent' }
            }
        }
    ]);
    
    return stats.length > 0 ? stats[0] : {
        totalUsers: 0,
        totalCustomers: 0,
        totalAdmins: 0,
        activeUsers: 0,
        totalLoyaltyPoints: 0,
        totalSpent: 0
    };
};

module.exports = mongoose.model('User', userSchema);
