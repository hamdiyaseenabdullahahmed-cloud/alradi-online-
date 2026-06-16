// =============================================
// متجر الرعدي أون لاين - alradi-online
// نموذج سجل الأخطاء والأمان
// =============================================

const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
    
    // ========== بيانات الخطأ ==========
    errorType: {
        type: String,
        enum: [
            'server_error',
            'validation_error',
            'auth_error',
            'not_found',
            'access_denied',
            'rate_limit',
            'database_error',
            'payment_error',
            'security_breach',
            'unauthorized_access',
            'suspicious_activity',
            'other'
        ],
        default: 'server_error'
    },
    message: {
        type: String,
        required: [true, 'رسالة الخطأ مطلوبة']
    },
    stack: {
        type: String,
        default: ''
    },
    code: {
        type: String,
        default: ''
    },
    
    // ========== مكان الخطأ ==========
    url: {
        type: String,
        default: ''
    },
    method: {
        type: String,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
        default: 'GET'
    },
    route: {
        type: String,
        default: ''
    },
    controller: {
        type: String,
        default: ''
    },
    action: {
        type: String,
        default: ''
    },
    
    // ========== بيانات المستخدم ==========
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    username: {
        type: String,
        default: ''
    },
    userRole: {
        type: String,
        default: 'visitor'
    },
    
    // ========== بيانات الطلب ==========
    requestBody: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    requestParams: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    requestQuery: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    requestHeaders: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // ========== بيانات الجهاز والشبكة ==========
    ipAddress: {
        type: String,
        default: ''
    },
    userAgent: {
        type: String,
        default: ''
    },
    browser: {
        type: String,
        default: ''
    },
    operatingSystem: {
        type: String,
        default: ''
    },
    device: {
        type: String,
        default: ''
    },
    
    // ========== خطورة الخطأ ==========
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    
    // ========== حالة المعالجة ==========
    isResolved: {
        type: Boolean,
        default: false
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    resolution: {
        type: String,
        default: ''
    },
    
    // ========== بيانات إضافية ==========
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    tags: [String],
    notes: {
        type: String,
        default: ''
    }
    
}, { 
    timestamps: true 
});

// =============================================
// INDEXES
// =============================================

errorLogSchema.index({ errorType: 1 });
errorLogSchema.index({ severity: 1 });
errorLogSchema.index({ isResolved: 1 });
errorLogSchema.index({ userId: 1 });
errorLogSchema.index({ ipAddress: 1 });
errorLogSchema.index({ createdAt: -1 });
errorLogSchema.index({ url: 1 });
errorLogSchema.index({ method: 1 });

// =============================================
// MIDDLEWARE - تحليل User Agent قبل الحفظ
// =============================================

errorLogSchema.pre('save', function(next) {
    if (this.userAgent && (!this.browser || !this.operatingSystem)) {
        const ua = this.userAgent.toLowerCase();
        
        // تحليل المتصفح
        if (ua.includes('chrome') && !ua.includes('edg')) {
            this.browser = 'Chrome';
        } else if (ua.includes('firefox')) {
            this.browser = 'Firefox';
        } else if (ua.includes('safari') && !ua.includes('chrome')) {
            this.browser = 'Safari';
        } else if (ua.includes('edg')) {
            this.browser = 'Edge';
        } else if (ua.includes('opera') || ua.includes('opr')) {
            this.browser = 'Opera';
        } else {
            this.browser = 'Unknown';
        }
        
        // تحليل نظام التشغيل
        if (ua.includes('windows')) {
            this.operatingSystem = 'Windows';
        } else if (ua.includes('mac os') || ua.includes('macintosh')) {
            this.operatingSystem = 'macOS';
        } else if (ua.includes('linux')) {
            this.operatingSystem = 'Linux';
        } else if (ua.includes('android')) {
            this.operatingSystem = 'Android';
        } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
            this.operatingSystem = 'iOS';
        } else {
            this.operatingSystem = 'Unknown';
        }
        
        // تحليل الجهاز
        if (ua.includes('mobile')) {
            this.device = 'Mobile';
        } else if (ua.includes('tablet')) {
            this.device = 'Tablet';
        } else {
            this.device = 'Desktop';
        }
    }
    
    next();
});

// =============================================
// METHODS - تعليم الخطأ كمعالج
// =============================================

errorLogSchema.methods.resolve = async function(resolvedBy, resolution = '') {
    this.isResolved = true;
    this.resolvedBy = resolvedBy;
    this.resolvedAt = new Date();
    this.resolution = resolution;
    return this.save();
};

// =============================================
// METHODS - تحديث درجة الخطورة
// =============================================

errorLogSchema.methods.updateSeverity = async function(severity) {
    this.severity = severity;
    return this.save();
};

// =============================================
// METHODS - إضافة ملاحظة
// =============================================

errorLogSchema.methods.addNote = async function(note) {
    this.notes = this.notes ? this.notes + '\n' + note : note;
    return this.save();
};

// =============================================
// STATICS - تسجيل خطأ جديد
// =============================================

errorLogSchema.statics.logError = async function(errorData) {
    try {
        const errorLog = new this({
            errorType: errorData.errorType || 'server_error',
            message: errorData.message || 'Unknown error',
            stack: errorData.stack || '',
            code: errorData.code || '',
            url: errorData.url || '',
            method: errorData.method || 'GET',
            route: errorData.route || '',
            userId: errorData.userId || null,
            username: errorData.username || '',
            userRole: errorData.userRole || 'visitor',
            requestBody: errorData.requestBody || {},
            requestParams: errorData.requestParams || {},
            requestQuery: errorData.requestQuery || {},
            ipAddress: errorData.ipAddress || '',
            userAgent: errorData.userAgent || '',
            severity: errorData.severity || 'medium',
            metadata: errorData.metadata || {}
        });
        
        await errorLog.save();
        return errorLog;
    } catch (err) {
        console.error('فشل في تسجيل الخطأ:', err);
        return null;
    }
};

// =============================================
// STATICS - تسجيل محاولة وصول غير مصرح
// =============================================

errorLogSchema.statics.logUnauthorizedAccess = async function(data) {
    return await this.logError({
        errorType: 'unauthorized_access',
        message: `محاولة وصول غير مصرح بها إلى: ${data.url}`,
        url: data.url,
        method: data.method || 'GET',
        userId: data.userId || null,
        username: data.username || '',
        userRole: data.userRole || 'visitor',
        ipAddress: data.ipAddress || '',
        userAgent: data.userAgent || '',
        severity: 'high',
        metadata: {
            attemptedUrl: data.url,
            timestamp: new Date(),
            sessionId: data.sessionId || ''
        }
    });
};

// =============================================
// STATICS - تسجيل نشاط مشبوه
// =============================================

errorLogSchema.statics.logSuspiciousActivity = async function(data) {
    return await this.logError({
        errorType: 'suspicious_activity',
        message: data.message || 'نشاط مشبوه تم اكتشافه',
        url: data.url || '',
        method: data.method || 'GET',
        userId: data.userId || null,
        ipAddress: data.ipAddress || '',
        userAgent: data.userAgent || '',
        severity: 'critical',
        metadata: data.metadata || {}
    });
};

// =============================================
// STATICS - الحصول على إحصائيات الأخطاء
// =============================================

errorLogSchema.statics.getStats = async function(startDate = null, endDate = null) {
    const match = {};
    
    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = new Date(startDate);
        if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    
    const stats = await this.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalErrors: { $sum: 1 },
                resolvedErrors: {
                    $sum: { $cond: ['$isResolved', 1, 0] }
                },
                unresolvedErrors: {
                    $sum: { $cond: ['$isResolved', 0, 1] }
                },
                criticalErrors: {
                    $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
                },
                highSeverityErrors: {
                    $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] }
                },
                errorsByType: { $push: '$errorType' },
                errorsByUrl: { $push: '$url' },
                uniqueIPs: { $addToSet: '$ipAddress' }
            }
        }
    ]);
    
    if (stats.length === 0) {
        return {
            totalErrors: 0,
            resolvedErrors: 0,
            unresolvedErrors: 0,
            criticalErrors: 0,
            highSeverityErrors: 0,
            uniqueIPs: 0
        };
    }
    
    const result = stats[0];
    
    // توزيع أنواع الأخطاء
    const typeDistribution = {};
    result.errorsByType.forEach(type => {
        typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    });
    
    // أكثر الصفحات خطأً
    const urlFrequency = {};
    result.errorsByUrl.forEach(url => {
        if (url) {
            urlFrequency[url] = (urlFrequency[url] || 0) + 1;
        }
    });
    
    const topErrorUrls = Object.entries(urlFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([url, count]) => ({ url, count }));
    
    return {
        totalErrors: result.totalErrors,
        resolvedErrors: result.resolvedErrors,
        unresolvedErrors: result.unresolvedErrors,
        criticalErrors: result.criticalErrors,
        highSeverityErrors: result.highSeverityErrors,
        uniqueIPs: result.uniqueIPs.length,
        typeDistribution,
        topErrorUrls
    };
};

// =============================================
// STATICS - تنظيف السجلات القديمة
// =============================================

errorLogSchema.statics.cleanOldLogs = async function(daysToKeep = 30) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const result = await this.deleteMany({
        createdAt: { $lt: cutoffDate },
        severity: { $in: ['low', 'medium'] },
        isResolved: true
    });
    
    return result.deletedCount;
};

module.exports = mongoose.model('ErrorLog', errorLogSchema);
