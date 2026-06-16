// =============================================
// متجر الرعدي أون لاين - alradi-online
// مسارات المحادثات المباشرة
// =============================================

const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// =============================================
// الحصول على قائمة المحادثات
// =============================================

router.get('/conversations', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user._id.toString();
        const userRole = req.session.user.role;
        
        const conversations = await Message.getConversationsList(userId, userRole);
        
        res.json({
            success: true,
            conversations
        });
        
    } catch (error) {
        console.error('خطأ في جلب المحادثات:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في جلب المحادثات' });
    }
});

// =============================================
// الحصول على رسائل محادثة محددة
// =============================================

router.get('/conversations/:conversationId', isAuthenticated, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        
        const userId = req.session.user._id.toString();
        
        // التحقق من أن المستخدم طرف في المحادثة
        const participants = conversationId.split('_');
        const isParticipant = participants.includes(userId);
        const isAdminUser = req.session.user.role === 'admin' || req.session.user.role === 'superadmin';
        
        if (!isParticipant && !isAdminUser) {
            return res.status(403).json({ success: false, message: 'غير مصرح بالوصول لهذه المحادثة' });
        }
        
        const result = await Message.getConversation(conversationId, { page, limit });
        
        // تعليم الرسائل كمقروءة
        await Message.markConversationAsRead(conversationId, userId);
        
        res.json({
            success: true,
            messages: result.messages,
            pagination: result.pagination
        });
        
    } catch (error) {
        console.error('خطأ في جلب رسائل المحادثة:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// إرسال رسالة جديدة
// =============================================

router.post('/send', isAuthenticated, async (req, res) => {
    try {
        const { content, recipientId, messageType = 'text', attachments = [] } = req.body;
        
        if (!content && attachments.length === 0) {
            return res.status(400).json({ success: false, message: 'محتوى الرسالة مطلوب' });
        }
        
        if (content && content.length > 5000) {
            return res.status(400).json({ success: false, message: 'الرسالة يجب أن لا تتجاوز 5000 حرف' });
        }
        
        const senderId = req.session.user._id.toString();
        const senderName = req.session.user.name;
        const senderRole = req.session.user.role;
        
        // إنشاء معرف المحادثة
        let conversationId;
        if (recipientId) {
            const participants = [senderId, recipientId].sort();
            conversationId = participants.join('_');
        } else {
            // إذا لم يحدد مستقبل، يتم الإرسال للإدارة
            conversationId = senderId + '_admin';
        }
        
        const message = new Message({
            senderId,
            senderName,
            senderRole,
            senderEmail: req.session.user.email || '',
            recipientId: recipientId || 'admin',
            content: content || '',
            messageType,
            attachments,
            conversationId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            language: req.session.language || 'ar'
        });
        
        await message.save();
        
        // إرسال عبر Socket.io إذا كان متصلاً
        const io = req.app.get('io');
        const connectedUsers = req.app.get('connectedUsers');
        
        if (io && connectedUsers) {
            // إرسال للمستقبل المحدد
            if (recipientId) {
                for (const [socketId, user] of connectedUsers) {
                    if (user.userId === recipientId) {
                        io.to(socketId).emit('new-message', message.getPublicData());
                    }
                }
            }
            
            // إرسال لجميع المسؤولين إذا كان المرسل عميلاً
            if (senderRole === 'customer' || senderRole === 'visitor') {
                for (const [socketId, user] of connectedUsers) {
                    if (user.role === 'admin' || user.role === 'superadmin') {
                        io.to(socketId).emit('new-message', message.getPublicData());
                    }
                }
            }
        }
        
        res.json({
            success: true,
            message: message.getPublicData(),
            conversationId
        });
        
    } catch (error) {
        console.error('خطأ في إرسال الرسالة:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ في إرسال الرسالة' });
    }
});

// =============================================
// تعليم رسالة كمقروءة
// =============================================

router.put('/read/:messageId', isAuthenticated, async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        
        if (!message) {
            return res.status(404).json({ success: false, message: 'الرسالة غير موجودة' });
        }
        
        await message.markAsRead();
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('خطأ في تعليم الرسالة كمقروءة:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// تعليم جميع رسائل محادثة كمقروءة
// =============================================

router.put('/read-all/:conversationId', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user._id.toString();
        await Message.markConversationAsRead(req.params.conversationId, userId);
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('خطأ في تعليم الكل كمقروء:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// حذف رسالة
// =============================================

router.delete('/delete/:messageId', isAuthenticated, async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        
        if (!message) {
            return res.status(404).json({ success: false, message: 'الرسالة غير موجودة' });
        }
        
        // التحقق من أن المستخدم هو صاحب الرسالة أو مدير
        const isOwner = message.senderId === req.session.user._id.toString();
        const isAdminUser = req.session.user.role === 'admin' || req.session.user.role === 'superadmin';
        
        if (!isOwner && !isAdminUser) {
            return res.status(403).json({ success: false, message: 'غير مصرح بحذف هذه الرسالة' });
        }
        
        await message.softDelete(req.session.user._id.toString());
        
        res.json({ success: true, message: 'تم حذف الرسالة' });
        
    } catch (error) {
        console.error('خطأ في حذف الرسالة:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// الحصول على عدد الرسائل غير المقروءة
// =============================================

router.get('/unread-count', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user._id.toString();
        const count = await Message.getUnreadCount(userId);
        
        res.json({ success: true, count });
        
    } catch (error) {
        console.error('خطأ في جلب عدد الرسائل:', error);
        res.status(500).json({ success: false, count: 0 });
    }
});

// =============================================
// بدء محادثة مع مسؤول (للعملاء)
// =============================================

router.post('/start-with-admin', isAuthenticated, async (req, res) => {
    try {
        const { content } = req.body;
        const senderId = req.session.user._id.toString();
        
        // البحث عن مسؤول متصل
        const connectedUsers = req.app.get('connectedUsers');
        let adminId = 'admin';
        
        if (connectedUsers) {
            for (const [socketId, user] of connectedUsers) {
                if (user.role === 'admin' || user.role === 'superadmin') {
                    adminId = user.userId;
                    break;
                }
            }
        }
        
        const conversationId = [senderId, adminId].sort().join('_');
        
        const message = new Message({
            senderId,
            senderName: req.session.user.name,
            senderRole: req.session.user.role,
            senderEmail: req.session.user.email || '',
            recipientId: adminId,
            content: content || 'مرحباً، أحتاج إلى مساعدة',
            messageType: 'text',
            conversationId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        await message.save();
        
        // إشعار المسؤولين
        const io = req.app.get('io');
        if (io && connectedUsers) {
            for (const [socketId, user] of connectedUsers) {
                if (user.role === 'admin' || user.role === 'superadmin') {
                    io.to(socketId).emit('new-conversation', {
                        conversationId,
                        message: message.getPublicData()
                    });
                }
            }
        }
        
        res.json({
            success: true,
            message: message.getPublicData(),
            conversationId
        });
        
    } catch (error) {
        console.error('خطأ في بدء محادثة:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// إحصائيات المحادثات (للمدير)
// =============================================

router.get('/stats', isAdmin, async (req, res) => {
    try {
        const stats = await Message.getStats();
        
        // عدد المستخدمين المتصلين حالياً
        const connectedUsers = req.app.get('connectedUsers');
        const onlineCount = connectedUsers ? connectedUsers.size : 0;
        
        // عدد العملاء المتصلين
        let onlineCustomers = 0;
        if (connectedUsers) {
            for (const [socketId, user] of connectedUsers) {
                if (user.role === 'customer' || user.role === 'visitor') {
                    onlineCustomers++;
                }
            }
        }
        
        res.json({
            success: true,
            stats: {
                ...stats,
                onlineUsers: onlineCount,
                onlineCustomers
            }
        });
        
    } catch (error) {
        console.error('خطأ في إحصائيات المحادثات:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// الحصول على العملاء المتصلين حالياً (للمدير)
// =============================================

router.get('/online-users', isAdmin, (req, res) => {
    try {
        const connectedUsers = req.app.get('connectedUsers');
        const users = [];
        
        if (connectedUsers) {
            for (const [socketId, user] of connectedUsers) {
                users.push({
                    socketId,
                    userId: user.userId,
                    name: user.name,
                    role: user.role
                });
            }
        }
        
        res.json({ success: true, users, count: users.length });
        
    } catch (error) {
        console.error('خطأ في جلب المستخدمين:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

module.exports = router;
