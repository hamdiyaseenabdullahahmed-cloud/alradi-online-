// =============================================
// متجر الرعدي أون لاين - alradi-online
// نموذج إعدادات المتجر
// =============================================

const mongoose = require('mongoose');

const storeSettingsSchema = new mongoose.Schema({
    
    // ========== الهوية الأساسية ==========
    storeName: {
        type: String,
        required: true,
        default: 'متجر الرعدي أون لاين'
    },
    storeNameEn: {
        type: String,
        default: 'Al-Radi Online Store'
    },
    storeLogo: {
        type: String,
        default: '/images/default-logo.png'
    },
    storeFavicon: {
        type: String,
        default: '/images/favicon.png'
    },
    storeDescription: {
        type: String,
        default: 'متجر إلكتروني متكامل للتسوق العالمي - تجربة تسوق فائقة وآمنة'
    },
    storeDescriptionEn: {
        type: String,
        default: 'Integrated online store for global shopping - Superior and safe shopping experience'
    },
    
    // ========== معلومات الاتصال ==========
    contactEmail: {
        type: String,
        default: 'alradi@gmil.com'
    },
    phoneNumber: {
        type: String,
        default: '966500000000'
    },
    whatsappNumber: {
        type: String,
        default: '966500000000'
    },
    address: {
        type: String,
        default: 'المملكة العربية السعودية'
    },
    addressEn: {
        type: String,
        default: 'Saudi Arabia'
    },
    
    // ========== الإعدادات المالية ==========
    currency: {
        type: String,
        default: 'SAR'
    },
    currencySymbol: {
        type: String,
        default: 'ر.س'
    },
    taxRate: {
        type: Number,
        default: 0
    },
    minOrderAmount: {
        type: Number,
        default: 0
    },
    
    // ========== إعدادات الشحن ==========
    shippingInternal: {
        type: Number,
        default: 25
    },
    shippingInternational: {
        type: Number,
        default: 75
    },
    freeShippingMin: {
        type: Number,
        default: 300
    },
    enableInternationalShipping: {
        type: Boolean,
        default: false
    },
    
    // ========== إعدادات الصوتيات ==========
    voiceGreetingEnabled: {
        type: Boolean,
        default: true
    },
    voiceInteractionsEnabled: {
        type: Boolean,
        default: true
    },
    voiceGreetingFile: {
        type: String,
        default: '/audio/welcome.mp3'
    },
    voiceAddToCartFile: {
        type: String,
        default: '/audio/add-to-cart.mp3'
    },
    voiceSaveFile: {
        type: String,
        default: '/audio/save.mp3'
    },
    voicePrintFile: {
        type: String,
        default: '/audio/print.mp3'
    },
    voiceSortFile: {
        type: String,
        default: '/audio/sort.mp3'
    },
    voiceNotificationFile: {
        type: String,
        default: '/audio/notification.mp3'
    },
    voiceErrorFile: {
        type: String,
        default: '/audio/error.mp3'
    },
    voiceSuccessFile: {
        type: String,
        default: '/audio/success.mp3'
    },
    
    // ========== إعدادات المظهر ==========
    theme: {
        type: String,
        enum: ['default', 'dark', 'golden', 'modern', 'classic'],
        default: 'default'
    },
    primaryColor: {
        type: String,
        default: '#1a1a2e'
    },
    secondaryColor: {
        type: String,
        default: '#e94560'
    },
    accentColor: {
        type: String,
        default: '#0f3460'
    },
    goldColor: {
        type: String,
        default: '#ffd700'
    },
    backgroundColor: {
        type: String,
        default: '#f8f9fa'
    },
    textColor: {
        type: String,
        default: '#333333'
    },
    fontFamily: {
        type: String,
        default: 'Cairo, sans-serif'
    },
    
    // ========== إعدادات الصفحة الرئيسية ==========
    showHeroSlider: {
        type: Boolean,
        default: true
    },
    showFeaturedProducts: {
        type: Boolean,
        default: true
    },
    showNewArrivals: {
        type: Boolean,
        default: true
    },
    showBestSellers: {
        type: Boolean,
        default: true
    },
    showPromoBanner: {
        type: Boolean,
        default: true
    },
    promoBannerText: {
        type: String,
        default: '🚀 شحن مجاني للطلبات فوق 300 ريال | خصم 15% على أول طلب'
    },
    promoBannerTextEn: {
        type: String,
        default: '🚀 Free shipping for orders over 300 SAR | 15% off first order'
    },
    productsPerPage: {
        type: Number,
        default: 12
    },
    defaultGridView: {
        type: Number,
        default: 3
    },
    
    // ========== سياسات المتجر ==========
    returnPolicy: {
        type: String,
        default: 'يمنع منعاً باتاً استرجاع السلع نقداً بعد الشراء لأي سبب كان. يحق للزبون استبدال السلعة بأخرى خلال 3 أيام فقط من تاريخ الاستلام في حال وجود خلل مصنعي واضح، بشرط ألا يكون الخلل ناتجاً عن سوء الاستخدام. أي كشط أو تلف في ملصقات الضمان أو العبوات الأصلية يلغي الضمان بشكل فوري ويسقط حق الاستبدال.'
    },
    returnPolicyEn: {
        type: String,
        default: 'Cash refunds are strictly prohibited after purchase for any reason. The customer has the right to exchange the product within 3 days only from the date of receipt in case of a clear manufacturing defect, provided that the defect is not caused by misuse. Any scratching or damage to the warranty stickers or original packaging immediately voids the warranty and cancels the right to exchange.'
    },
    privacyPolicy: {
        type: String,
        default: 'نحن في متجر الرعدي أون لاين نلتزم بحماية خصوصية عملائنا. جميع البيانات الشخصية تستخدم فقط لأغراض تنفيذ الطلبات وتحسين تجربة التسوق ولا يتم مشاركتها مع أي طرف ثالث.'
    },
    termsAndConditions: {
        type: String,
        default: 'باستخدامك لمتجر الرعدي أون لاين فإنك توافق على جميع الشروط والأحكام. يخضع جميع المستخدمين للقوانين والأنظمة المعمول بها في المملكة العربية السعودية.'
    },
    
    // ========== وسائل التواصل الاجتماعي ==========
    socialMedia: {
        facebook: {
            type: String,
            default: ''
        },
        twitter: {
            type: String,
            default: ''
        },
        instagram: {
            type: String,
            default: ''
        },
        youtube: {
            type: String,
            default: ''
        },
        tiktok: {
            type: String,
            default: ''
        },
        snapchat: {
            type: String,
            default: ''
        }
    },
    
    // ========== إعدادات SEO ==========
    metaTitle: {
        type: String,
        default: 'متجر الرعدي أون لاين - التسوق الإلكتروني العالمي'
    },
    metaDescription: {
        type: String,
        default: 'متجر الرعدي أون لاين - تجربة تسوق فائقة وآمنة مع أفضل المنتجات العالمية'
    },
    metaKeywords: {
        type: String,
        default: 'متجر, الرعدي, تسوق, إلكتروني, أون لاين, منتجات, عالمي'
    },
    googleAnalyticsId: {
        type: String,
        default: ''
    },
    
    // ========== إعدادات الأمان ==========
    enableOTP: {
        type: Boolean,
        default: true
    },
    otpExpiryMinutes: {
        type: Number,
        default: 10
    },
    maxLoginAttempts: {
        type: Number,
        default: 5
    },
    sessionTimeout: {
        type: Number,
        default: 30
    },
    enableTwoFactorAuth: {
        type: Boolean,
        default: false
    },
    
    // ========== إعدادات الإشعارات ==========
    enableEmailNotifications: {
        type: Boolean,
        default: true
    },
    enableSMSNotifications: {
        type: Boolean,
        default: false
    },
    enableWhatsAppNotifications: {
        type: Boolean,
        default: false
    },
    orderConfirmationEmail: {
        type: Boolean,
        default: true
    },
    shippingUpdateEmail: {
        type: Boolean,
        default: true
    },
    lowStockAlert: {
        type: Boolean,
        default: true
    },
    lowStockThreshold: {
        type: Number,
        default: 5
    },
    
    // ========== إعدادات برنامج الولاء ==========
    enableLoyaltyProgram: {
        type: Boolean,
        default: true
    },
    pointsPerRiyal: {
        type: Number,
        default: 1
    },
    pointsValueInRiyal: {
        type: Number,
        default: 0.01
    },
    minimumPointsToRedeem: {
        type: Number,
        default: 100
    },
    
    // ========== إعدادات متقدمة ==========
    maintenanceMode: {
        type: Boolean,
        default: false
    },
    maintenanceMessage: {
        type: String,
        default: 'المتجر قيد الصيانة حالياً، سنعود قريباً'
    },
    enableWishlist: {
        type: Boolean,
        default: true
    },
    enableProductComparison: {
        type: Boolean,
        default: true
    },
    enableReviews: {
        type: Boolean,
        default: true
    },
    reviewsAutoApprove: {
        type: Boolean,
        default: false
    },
    enableGuestCheckout: {
        type: Boolean,
        default: false
    },
    copyrightText: {
        type: String,
        default: 'جميع الحقوق محفوظة © 2026 لمجموعة متاجر الرعدي أونلاين الفاخرة - تجربة تسوق فائقة وآمنة.'
    },
    copyrightTextEn: {
        type: String,
        default: 'All Rights Reserved © 2026 Al-Radi Online Luxury Stores Group - Superior and Safe Shopping Experience.'
    }
    
}, { 
    timestamps: true 
});

// =============================================
// دالة للحصول على إعدادات المتجر (واحدة فقط)
// =============================================

storeSettingsSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    if (!settings) {
        settings = new this();
        await settings.save();
    }
    return settings;
};

// =============================================
// دالة لتحديث الإعدادات
// =============================================

storeSettingsSchema.statics.updateSettings = async function(updateData) {
    let settings = await this.findOne();
    if (!settings) {
        settings = new this(updateData);
    } else {
        Object.assign(settings, updateData);
    }
    await settings.save();
    return settings;
};

module.exports = mongoose.model('StoreSettings', storeSettingsSchema);
