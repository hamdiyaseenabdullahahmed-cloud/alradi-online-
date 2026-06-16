// =============================================
// متجر الرعدي أون لاين - alradi-online
// نموذج الطلبات والفواتير
// =============================================

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    
    // ========== رقم الطلب ==========
    orderNumber: {
        type: String,
        unique: true,
        required: true
    },
    
    // ========== بيانات العميل ==========
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'العميل مطلوب']
    },
    customerName: {
        type: String,
        required: [true, 'اسم العميل مطلوب']
    },
    customerEmail: {
        type: String,
        required: [true, 'بريد العميل مطلوب']
    },
    customerPhone: {
        type: String,
        required: [true, 'هاتف العميل مطلوب']
    },
    
    // ========== عنوان الشحن ==========
    shippingAddress: {
        street: {
            type: String,
            required: [true, 'الشارع مطلوب']
        },
        city: {
            type: String,
            required: [true, 'المدينة مطلوبة']
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
            required: [true, 'الدولة مطلوبة'],
            default: 'المملكة العربية السعودية'
        },
        fullAddress: {
            type: String,
            default: ''
        }
    },
    
    // ========== عنوان الفوترة ==========
    billingAddress: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
        fullAddress: String
    },
    
    // ========== محتويات الطلب ==========
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        name: {
            type: String,
            required: true
        },
        nameEn: {
            type: String,
            default: ''
        },
        sku: {
            type: String,
            default: ''
        },
        price: {
            type: Number,
            required: true
        },
        comparePrice: {
            type: Number,
            default: null
        },
        quantity: {
            type: Number,
            required: true,
            min: [1, 'الكمية يجب أن تكون 1 على الأقل']
        },
        total: {
            type: Number,
            required: true
        },
        image: {
            type: String,
            default: ''
        },
        options: [{
            name: String,
            value: String,
            additionalPrice: Number
        }],
        discount: {
            type: Number,
            default: 0
        }
    }],
    
    // ========== الحسابات المالية ==========
    subtotal: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    couponCode: {
        type: String,
        default: ''
    },
    couponDiscount: {
        type: Number,
        default: 0
    },
    loyaltyPointsUsed: {
        type: Number,
        default: 0
    },
    loyaltyPointsDiscount: {
        type: Number,
        default: 0
    },
    taxAmount: {
        type: Number,
        default: 0
    },
    shippingCost: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'SAR'
    },
    
    // ========== الشحن ==========
    shippingMethod: {
        type: String,
        enum: ['internal', 'international', 'pickup', 'free'],
        default: 'internal'
    },
    shippingType: {
        type: String,
        enum: ['standard', 'express', 'overnight'],
        default: 'standard'
    },
    shippingTrackingNumber: {
        type: String,
        default: ''
    },
    shippingCompany: {
        type: String,
        default: ''
    },
    shippingNotes: {
        type: String,
        default: ''
    },
    estimatedDeliveryDate: {
        type: Date,
        default: null
    },
    actualDeliveryDate: {
        type: Date,
        default: null
    },
    
    // ========== حالة الطلب ==========
    status: {
        type: String,
        enum: [
            'pending',
            'confirmed',
            'processing',
            'shipped',
            'in_transit',
            'out_for_delivery',
            'delivered',
            'cancelled',
            'refunded',
            'returned',
            'on_hold',
            'failed'
        ],
        default: 'pending'
    },
    statusHistory: [{
        status: String,
        note: String,
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    
    // ========== الدفع ==========
    paymentMethod: {
        type: String,
        enum: ['cash_on_delivery', 'credit_card', 'bank_transfer', 'wallet', 'paypal'],
        default: 'cash_on_delivery'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
        default: 'pending'
    },
    paymentDetails: {
        transactionId: String,
        paymentDate: Date,
        amount: Number,
        gateway: String,
        cardLastFour: String,
        receiptUrl: String
    },
    
    // ========== الفاتورة ==========
    invoiceNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    invoiceDate: {
        type: Date,
        default: Date.now
    },
    invoiceDueDate: {
        type: Date,
        default: null
    },
    invoicePdfUrl: {
        type: String,
        default: ''
    },
    
    // ========== التوقيع ==========
    signature: {
        image: {
            type: String,
            default: ''
        },
        name: {
            type: String,
            default: ''
        },
        date: {
            type: Date,
            default: null
        },
        coordinates: {
            x: Number,
            y: Number
        }
    },
    
    // ========== ملاحظات ==========
    notes: {
        type: String,
        default: '',
        maxlength: [1000, 'الملاحظات يجب أن لا تتجاوز 1000 حرف']
    },
    adminNotes: {
        type: String,
        default: ''
    },
    customerNotes: {
        type: String,
        default: ''
    },
    
    // ========== مرتجعات واستبدال ==========
    returnRequest: {
        isRequested: {
            type: Boolean,
            default: false
        },
        reason: String,
        requestDate: Date,
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'completed'],
            default: 'pending'
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        approvedDate: Date,
        returnTrackingNumber: String,
        refundAmount: Number,
        notes: String
    },
    
    // ========== إشعارات ==========
    notificationsSent: {
        orderConfirmation: {
            type: Boolean,
            default: false
        },
        shippingConfirmation: {
            type: Boolean,
            default: false
        },
        deliveryConfirmation: {
            type: Boolean,
            default: false
        },
        smsSent: {
            type: Boolean,
            default: false
        },
        whatsappSent: {
            type: Boolean,
            default: false
        }
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
    source: {
        type: String,
        default: 'website'
    },
    affiliateCode: {
        type: String,
        default: ''
    },
    tags: [String],
    
    // ========== الحذف المنطقي ==========
    isArchived: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
    
}, { 
    timestamps: true 
});

// =============================================
// INDEXES
// =============================================

orderSchema.index({ orderNumber: 1 });
orderSchema.index({ invoiceNumber: 1 });
orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ shippingMethod: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'shippingAddress.country': 1 });
orderSchema.index({ customerEmail: 1 });
orderSchema.index({ customerPhone: 1 });

// =============================================
// MIDDLEWARE - توليد أرقام تلقائية قبل الحفظ
// =============================================

orderSchema.pre('save', async function(next) {
    if (this.isNew) {
        // توليد رقم الطلب
        if (!this.orderNumber) {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            this.orderNumber = `ORD-${year}${month}${day}-${random}`;
        }
        
        // توليد رقم الفاتورة
        if (!this.invoiceNumber) {
            const count = await this.constructor.countDocuments();
            this.invoiceNumber = `INV-${(count + 1).toString().padStart(6, '0')}`;
        }
        
        // حساب تاريخ التسليم المتوقع
        if (!this.estimatedDeliveryDate) {
            const deliveryDays = this.shippingMethod === 'international' ? 14 : 5;
            if (this.shippingType === 'express') {
                this.estimatedDeliveryDate = new Date(Date.now() + (this.shippingMethod === 'international' ? 7 : 2) * 24 * 60 * 60 * 1000);
            } else if (this.shippingType === 'overnight') {
                this.estimatedDeliveryDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
            } else {
                this.estimatedDeliveryDate = new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000);
            }
        }
        
        // تجميع العنوان الكامل
        if (this.shippingAddress) {
            const parts = [
                this.shippingAddress.street,
                this.shippingAddress.city,
                this.shippingAddress.state,
                this.shippingAddress.zipCode,
                this.shippingAddress.country
            ].filter(Boolean);
            this.shippingAddress.fullAddress = parts.join('، ');
        }
        
        if (this.billingAddress && this.billingAddress.street) {
            const parts = [
                this.billingAddress.street,
                this.billingAddress.city,
                this.billingAddress.state,
                this.billingAddress.zipCode,
                this.billingAddress.country
            ].filter(Boolean);
            this.billingAddress.fullAddress = parts.join('، ');
        }
        
        // إضافة الحالة الأولى في السجل
        this.statusHistory.push({
            status: this.status || 'pending',
            note: 'تم إنشاء الطلب',
            timestamp: new Date()
        });
    }
    
    next();
});

// =============================================
// MIDDLEWARE - مزامنة حالة الدفع
// =============================================

orderSchema.pre('save', function(next) {
    if (this.isModified('paymentStatus') && this.paymentStatus === 'paid') {
        if (!this.paymentDetails.paymentDate) {
            this.paymentDetails.paymentDate = new Date();
        }
    }
    next();
});

// =============================================
// METHODS - تحديث حالة الطلب
// =============================================

orderSchema.methods.updateStatus = async function(newStatus, note = '', changedBy = null) {
    const validTransitions = {
        'pending': ['confirmed', 'cancelled', 'on_hold', 'failed'],
        'confirmed': ['processing', 'cancelled', 'on_hold'],
        'processing': ['shipped', 'cancelled', 'on_hold'],
        'shipped': ['in_transit', 'delivered'],
        'in_transit': ['out_for_delivery', 'delivered'],
        'out_for_delivery': ['delivered', 'failed'],
        'delivered': ['returned'],
        'cancelled': [],
        'refunded': [],
        'returned': ['refunded'],
        'on_hold': ['processing', 'cancelled'],
        'failed': ['pending']
    };
    
    if (!validTransitions[this.status] || !validTransitions[this.status].includes(newStatus)) {
        throw new Error(`لا يمكن تغيير الحالة من "${this.status}" إلى "${newStatus}"`);
    }
    
    const oldStatus = this.status;
    this.status = newStatus;
    
    this.statusHistory.push({
        status: newStatus,
        note: note || `تم تغيير الحالة من "${oldStatus}" إلى "${newStatus}"`,
        changedBy: changedBy,
        timestamp: new Date()
    });
    
    if (newStatus === 'delivered') {
        this.actualDeliveryDate = new Date();
    }
    
    return this.save();
};

// =============================================
// METHODS - تحديث حالة الدفع
// =============================================

orderSchema.methods.updatePaymentStatus = async function(paymentStatus, transactionDetails = {}) {
    this.paymentStatus = paymentStatus;
    
    if (paymentStatus === 'paid') {
        this.paymentDetails.paymentDate = new Date();
        this.paymentDetails.transactionId = transactionDetails.transactionId || '';
        this.paymentDetails.gateway = transactionDetails.gateway || '';
        this.paymentDetails.amount = transactionDetails.amount || this.totalAmount;
        this.paymentDetails.cardLastFour = transactionDetails.cardLastFour || '';
        this.paymentDetails.receiptUrl = transactionDetails.receiptUrl || '';
    }
    
    return this.save();
};

// =============================================
// METHODS - إضافة تتبع الشحن
// =============================================

orderSchema.methods.addTracking = async function(trackingNumber, shippingCompany, notes = '') {
    this.shippingTrackingNumber = trackingNumber;
    this.shippingCompany = shippingCompany;
    if (notes) this.shippingNotes = notes;
    
    return this.save();
};

// =============================================
// METHODS - طلب مرتجع
// =============================================

orderSchema.methods.requestReturn = async function(reason, notes = '') {
    if (this.status !== 'delivered') {
        throw new Error('لا يمكن طلب مرتجع لطلب لم يتم تسليمه');
    }
    
    const deliveryDate = this.actualDeliveryDate || this.updatedAt;
    const daysSinceDelivery = Math.floor((Date.now() - deliveryDate) / (1000 * 60 * 60 * 24));
    
    if (daysSinceDelivery > 3) {
        throw new Error('انتهت مدة الاستبدال المسموح بها (3 أيام)');
    }
    
    this.returnRequest = {
        isRequested: true,
        reason: reason,
        requestDate: new Date(),
        status: 'pending',
        notes: notes
    };
    
    return this.save();
};

// =============================================
// METHODS - الموافقة على المرتجع
// =============================================

orderSchema.methods.approveReturn = async function(adminId, refundAmount = null) {
    if (!this.returnRequest.isRequested) {
        throw new Error('لا يوجد طلب مرتجع');
    }
    
    this.returnRequest.status = 'approved';
    this.returnRequest.approvedBy = adminId;
    this.returnRequest.approvedDate = new Date();
    this.returnRequest.refundAmount = refundAmount || this.totalAmount;
    this.status = 'returned';
    
    this.statusHistory.push({
        status: 'returned',
        note: 'تمت الموافقة على طلب الاستبدال',
        changedBy: adminId,
        timestamp: new Date()
    });
    
    return this.save();
};

// =============================================
// METHODS - إضافة توقيع الاستلام
// =============================================

orderSchema.methods.addSignature = async function(signatureData) {
    this.signature = {
        image: signatureData.image || '',
        name: signatureData.name || this.customerName,
        date: new Date(),
        coordinates: signatureData.coordinates || { x: 0, y: 0 }
    };
    
    return this.save();
};

// =============================================
// METHODS - إلغاء الطلب
// =============================================

orderSchema.methods.cancelOrder = async function(reason = '', cancelledBy = null) {
    if (['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(this.status)) {
        throw new Error('لا يمكن إلغاء الطلب في هذه المرحلة');
    }
    
    this.status = 'cancelled';
    this.statusHistory.push({
        status: 'cancelled',
        note: reason || 'تم إلغاء الطلب',
        changedBy: cancelledBy,
        timestamp: new Date()
    });
    
    return this.save();
};

// =============================================
// METHODS - الحصول على ملخص الطلب
// =============================================

orderSchema.methods.getSummary = function() {
    return {
        orderNumber: this.orderNumber,
        invoiceNumber: this.invoiceNumber,
        status: this.status,
        paymentStatus: this.paymentStatus,
        totalAmount: this.totalAmount,
        currency: this.currency,
        itemsCount: this.items.reduce((sum, item) => sum + item.quantity, 0),
        shippingMethod: this.shippingMethod,
        createdAt: this.createdAt,
        estimatedDeliveryDate: this.estimatedDeliveryDate,
        actualDeliveryDate: this.actualDeliveryDate,
        customerName: this.customerName
    };
};

// =============================================
// METHODS - الحصول على بيانات الفاتورة كاملة
// =============================================

orderSchema.methods.getInvoiceData = function() {
    return {
        invoiceNumber: this.invoiceNumber,
        invoiceDate: this.invoiceDate,
        orderNumber: this.orderNumber,
        orderDate: this.createdAt,
        customer: {
            name: this.customerName,
            email: this.customerEmail,
            phone: this.customerPhone
        },
        shippingAddress: this.shippingAddress,
        billingAddress: this.billingAddress.street ? this.billingAddress : this.shippingAddress,
        items: this.items,
        subtotal: this.subtotal,
        discount: this.discount,
        couponDiscount: this.couponDiscount,
        loyaltyPointsDiscount: this.loyaltyPointsDiscount,
        taxAmount: this.taxAmount,
        shippingCost: this.shippingCost,
        shippingMethod: this.shippingMethod,
        totalAmount: this.totalAmount,
        currency: this.currency,
        paymentMethod: this.paymentMethod,
        paymentStatus: this.paymentStatus,
        status: this.status,
        signature: this.signature,
        estimatedDeliveryDate: this.estimatedDeliveryDate,
        actualDeliveryDate: this.actualDeliveryDate,
        returnPolicy: 'يمنع منعاً باتاً استرجاع السلع نقداً بعد الشراء لأي سبب كان. يحق للزبون استبدال السلعة بأخرى خلال 3 أيام فقط من تاريخ الاستلام في حال وجود خلل مصنعي واضح.'
    };
};

// =============================================
// STATICS - توليد رقم طلب فريد
// =============================================

orderSchema.statics.generateOrderNumber = async function() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    const orderNumber = `ORD-${year}${month}${day}-${random}`;
    
    // التأكد من عدم وجود رقم مكرر
    const exists = await this.findOne({ orderNumber });
    if (exists) {
        return this.generateOrderNumber();
    }
    
    return orderNumber;
};

// =============================================
// STATICS - الحصول على إحصائيات الطلبات
// =============================================

orderSchema.statics.getStats = async function(startDate = null, endDate = null) {
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
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: '$totalAmount' },
                averageOrderValue: { $avg: '$totalAmount' },
                totalItems: { $sum: { $sum: '$items.quantity' } },
                totalShipping: { $sum: '$shippingCost' },
                totalDiscount: { $sum: '$discount' },
                ordersByStatus: {
                    $push: '$status'
                },
                ordersByPayment: {
                    $push: '$paymentMethod'
                }
            }
        }
    ]);
    
    if (stats.length === 0) {
        return {
            totalOrders: 0,
            totalRevenue: 0,
            averageOrderValue: 0,
            totalItems: 0,
            totalShipping: 0,
            totalDiscount: 0
        };
    }
    
    const result = stats[0];
    
    // حساب توزيع الحالات
    const statusDistribution = {};
    result.ordersByStatus.forEach(status => {
        statusDistribution[status] = (statusDistribution[status] || 0) + 1;
    });
    
    // حساب توزيع طرق الدفع
    const paymentDistribution = {};
    result.ordersByPayment.forEach(method => {
        paymentDistribution[method] = (paymentDistribution[method] || 0) + 1;
    });
    
    return {
        totalOrders: result.totalOrders,
        totalRevenue: result.totalRevenue,
        averageOrderValue: Math.round(result.averageOrderValue * 100) / 100,
        totalItems: result.totalItems,
        totalShipping: result.totalShipping,
        totalDiscount: result.totalDiscount,
        statusDistribution,
        paymentDistribution
    };
};

module.exports = mongoose.model('Order', orderSchema);
