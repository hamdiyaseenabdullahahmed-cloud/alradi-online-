// =============================================
// متجر الرعدي أون لاين - alradi-online
// نموذج المحادثات والرسائل
// =============================================

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    
    // ========== بيانات المرسل ==========
    senderId: {
        type: String,
        required: [true, 'معرف المرسل مطلوب']
    },
    senderName: {
        type: String,
        required: [true, 'اسم المرسل مطلوب']
    },
    senderRole: {
        type: String,
        enum: ['customer', 'admin', 'moderator', 'visitor'],
        default: 'visitor'
    },
    senderEmail: {
        type: String,
        default: ''
    },
    
    // ========== بيانات المستقبل ==========
    recipientId: {
        type: String,
        default: ''
    },
    recipientSocketId: {
        type: String,
        default: ''
    },
    
    // ========== محتوى الرسالة ==========
    content: {
        type: String,
        required: [true, 'محتوى الرسالة مطلوب'],
        maxlength: [5000, 'الرسالة يجب أن لا تتجاوز 5000 حرف']
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'file', 'order', 'product', 'system'],
        default: 'text'
    },
    attachments: [{
        fileName: String,
        fileUrl: String,
        fileType: String,
        fileSize: Number
    }],
    
    // ========== حالة الرسالة ==========
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    },
    isDelivered: {
        type: Boolean,
        default: false
    },
    deliveredAt: {
        type: Date,
        default: null
    },
    
    // ========== المحادثة ==========
    conversationId: {
        type: String,
        required: true
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null
    },
    
    // ========== بيانات إضافية ==========
    ipAddress: {
        type: String,
        default: ''
    },
    userAgent: {
        type: String,
        default: ''
    },
    language: {
        type: String,
        default: 'ar'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // ========== حذف ==========
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedBy: {
        type: String,
        default: ''
    },
    deletedAt: {
        type: Date,
        default: null
    }
    
}, { 
    timestamps: true 
});

// =============================================
// INDEXES
// =============================================

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ recipientId: 1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ senderRole: 1 });
messageSchema.index({ createdAt: -1 });

// =============================================
// MIDDLEWARE - توليد معرف المحادثة تلقائياً
// =============================================

messageSchema.pre('save', function(next) {
    if (!this.conversationId) {
        const participants = [this.senderId, this.recipientId].filter(Boolean).sort();
        this.conversationId = participants.join('_');
    }
    next();
});

// =============================================
// METHODS - تعليم الرسالة كمقروءة
// =============================================

messageSchema.methods.markAsRead = async function() {
    if (!this.isRead) {
        this.isRead = true;
        this.readAt = new Date();
        return this.save();
    }
    return this;
};

// =============================================
// METHODS - تعليم الرسالة كمستلمة
// =============================================

messageSchema.methods.markAsDelivered = async function() {
    if (!this.isDelivered) {
        this.isDelivered = true;
        this.deliveredAt = new Date();
        return this.save();
    }
    return this;
};

// =============================================
// METHODS - حذف الرسالة (حذف منطقي)
// =============================================

messageSchema.methods.softDelete = async function(deletedBy) {
    this.isDeleted = true;
    this.deletedBy = deletedBy;
    this.deletedAt = new Date();
    return this.save();
};

// =============================================
// METHODS - الحصول على بيانات الرسالة للعرض
// =============================================

messageSchema.methods.getPublicData = function() {
    return {
        id: this._id,
        senderId: this.senderId,
        senderName: this.senderName,
        senderRole: this.senderRole,
        content: this.content,
        messageType: this.messageType,
        attachments: this.attachments,
        isRead: this.isRead,
        createdAt: this.createdAt,
        conversationId: this.conversationId,
        replyTo: this.replyTo
    };
};

// =============================================
// STATICS - الحصول على محادثة كاملة
// =============================================

messageSchema.statics.getConversation = async function(conversationId, options = {}) {
    const {
        page = 1,
        limit = 50,
        includeDeleted = false
    } = options;
    
    const filter = { conversationId };
    if (!includeDeleted) {
        filter.isDeleted = false;
    }
    
    const skip = (page - 1) * limit;
    
    const [messages, total] = await Promise.all([
        this.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('replyTo'),
        this.countDocuments(filter)
    ]);
    
    return {
        messages: messages.reverse(),
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    };
};

// =============================================
// STATICS - الحصول على قائمة المحادثات
// =============================================

messageSchema.statics.getConversationsList = async function(userId = null, userRole = null) {
    const match = { isDeleted: false };
    
    if (userId && userRole === 'admin') {
        // المدير يرى كل المحادثات
        match.$or = [
            { senderRole: { $ne: 'admin' } },
            { senderId: userId }
        ];
    } else if (userId) {
        // العميل يرى محادثاته فقط
        match.$or = [
            { senderId: userId },
            { recipientId: userId }
        ];
    }
    
    const conversations = await this.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: '$conversationId',
                lastMessage: { $first: '$$ROOT' },
                unreadCount: {
                    $sum: {
                        $cond: [
                            { $and: [
                                { $eq: ['$isRead', false] },
                                { $ne: ['$senderId', userId] }
                            ]},
                            1,
                            0
                        ]
                    }
                },
                totalMessages: { $sum: 1 }
            }
        },
        { $sort: { 'lastMessage.createdAt': -1 } }
    ]);
    
    return conversations;
};

// =============================================
// STATICS - تعليم جميع رسائل المحادثة كمقروءة
// =============================================

messageSchema.statics.markConversationAsRead = async function(conversationId, userId) {
    return await this.updateMany(
        {
            conversationId,
            senderId: { $ne: userId },
            isRead: false
        },
        {
            isRead: true,
            readAt: new Date()
        }
    );
};

// =============================================
// STATICS - الحصول على عدد الرسائل غير المقروءة
// =============================================

messageSchema.statics.getUnreadCount = async function(userId) {
    const count = await this.countDocuments({
        recipientId: userId,
        isRead: false,
        isDeleted: false
    });
    
    return count;
};

// =============================================
// STATICS - الحصول على إحصائيات المحادثات
// =============================================

messageSchema.statics.getStats = async function() {
    const stats = await this.aggregate([
        { $match: { isDeleted: false } },
        {
            $group: {
                _id: null,
                totalMessages: { $sum: 1 },
                totalConversations: { $addToSet: '$conversationId' },
                unreadMessages: {
                    $sum: { $cond: ['$isRead', 0, 1] }
                },
                messagesByRole: {
                    $push: '$senderRole'
                },
                messagesByType: {
                    $push: '$messageType'
                }
            }
        }
    ]);
    
    if (stats.length === 0) {
        return {
            totalMessages: 0,
            totalConversations: 0,
            unreadMessages: 0
        };
    }
    
    const result = stats[0];
    
    // حساب توزيع الأدوار
    const roleDistribution = {};
    result.messagesByRole.forEach(role => {
        roleDistribution[role] = (roleDistribution[role] || 0) + 1;
    });
    
    // حساب توزيع أنواع الرسائل
    const typeDistribution = {};
    result.messagesByType.forEach(type => {
        typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    });
    
    return {
        totalMessages: result.totalMessages,
        totalConversations: result.totalConversations.length,
        unreadMessages: result.unreadMessages,
        roleDistribution,
        typeDistribution
    };
};

module.exports = mongoose.model('Message', messageSchema);
