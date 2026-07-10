// ================================================================
// متجر الرعدي أون لاين - Al-Radi Online
// نموذج إعدادات المتجر - النسخة العملاقة المطورة (v3.0)
// هندسة عبقرية تدعم الوسائط المتعددة، التخزين المحلي، الروابط، والإعدادات المتقدمة
// ================================================================

const mongoose = require('mongoose');

// ================================================================
// 1. مخطط الإعدادات الأساسية
// ================================================================
const storeSettingsSchema = new mongoose.Schema({

    // ========== الهوية الأساسية والعلامة التجارية ==========
    branding: {
        storeName: { type: String, default: 'متجر الرعدي أون لاين' },
        storeNameEn: { type: String, default: 'Al-Radi Online Store' },
        tagline: { type: String, default: 'تسوق بثقة واستمتع بتجربة فاخرة' },
        taglineEn: { type: String, default: 'Shop with confidence and enjoy a luxury experience' },
        storeDescription: { type: String, default: 'متجر إلكتروني متكامل للتسوق العالمي - تجربة فائقة وآمنة' },
        storeDescriptionEn: { type: String, default: 'Integrated online store for global shopping - Superior and safe experience' },
        copyrightText: { type: String, default: 'جميع الحقوق محفوظة © 2026 لمجموعة متاجر الرعدي أونلاين الفاخرة' },
        copyrightTextEn: { type: String, default: 'All Rights Reserved © 2026 Al-Radi Online Luxury Stores Group' },
    },

    // ========== إعدادات الوسائط المتعددة (متطورة) ==========
    media: {
        // تحديد طريقة التخزين: 'local' للملفات المرفوعة، 'url' للروابط، 'hybrid' للمزيج
        storageMode: { type: String, enum: ['local', 'url', 'hybrid'], default: 'local' },
        
        // الشعار والأيقونات
        logo: { type: String, default: '/images/default-logo.png' },
        logoUrl: { type: String, default: '' },
        favicon: { type: String, default: '/images/favicon.png' },
        faviconUrl: { type: String, default: '' },
        
        // صور القسم الافتراضية
        defaultCategoryImage: { type: String, default: '/images/default-category.png' },
        defaultCategoryImageUrl: { type: String, default: '' },
        defaultProductImage: { type: String, default: '/images/default-product.png' },
        defaultProductImageUrl: { type: String, default: '' },
        
        // صور الخلفيات والبنرات
        heroBackground: { type: String, default: '/images/hero-bg.jpg' },
        heroBackgroundUrl: { type: String, default: '' },
        promoBannerImage: { type: String, default: '/images/promo-banner.jpg' },
        promoBannerImageUrl: { type: String, default: '' },
        
        // الصوتيات مع دعم الروابط
        audio: {
            greeting: { 
                local: { type: String, default: '/audio/welcome.mp3' },
                url: { type: String, default: '' }
            },
            addToCart: { 
                local: { type: String, default: '/audio/add-to-cart.mp3' },
                url: { type: String, default: '' }
            },
            save: { 
                local: { type: String, default: '/audio/save.mp3' },
                url: { type: String, default: '' }
            },
            print: { 
                local: { type: String, default: '/audio/print.mp3' },
                url: { type: String, default: '' }
            },
            sort: { 
                local: { type: String, default: '/audio/sort.mp3' },
                url: { type: String, default: '' }
            },
            notification: { 
                local: { type: String, default: '/audio/notification.mp3' },
                url: { type: String, default: '' }
            },
            error: { 
                local: { type: String, default: '/audio/error.mp3' },
                url: { type: String, default: '' }
            },
            success: { 
                local: { type: String, default: '/audio/success.mp3' },
                url: { type: String, default: '' }
            }
        },
        
        // تفعيل الصوتيات
        voiceGreetingEnabled: { type: Boolean, default: true },
        voiceInteractionsEnabled: { type: Boolean, default: true },
        voiceVolume: { type: Number, min: 0, max: 1, default: 0.8 },
    },

    // ========== معلومات الاتصال ==========
    contact: {
        email: { type: String, default: 'alradi@gmil.com' },
        phone: { type: String, default: '+966500000000' },
        whatsapp: { type: String, default: '+966500000000' },
        telegram: { type: String, default: '' },
        address: { type: String, default: 'المملكة العربية السعودية' },
        addressEn: { type: String, default: 'Saudi Arabia' },
        mapLocation: { type: String, default: '' },
        workingHours: { type: String, default: '9:00 ص - 11:00 م' },
    },

    // ========== الإعدادات المالية والدفع ==========
    finance: {
        currency: { type: String, default: 'SAR' },
        currencySymbol: { type: String, default: 'ر.س' },
        taxRate: { type: Number, default: 0, min: 0, max: 100 },
        minOrderAmount: { type: Number, default: 0 },
        enableCOD: { type: Boolean, default: true },
        enableOnlinePayment: { type: Boolean, default: false },
        paymentGateways: {
            paypal: { 
                enabled: { type: Boolean, default: false },
                clientId: { type: String, default: '' },
                secret: { type: String, default: '' }
            },
            stripe: {
                enabled: { type: Boolean, default: false },
                publicKey: { type: String, default: '' },
                secretKey: { type: String, default: '' }
            },
            tap: {
                enabled: { type: Boolean, default: false },
                merchantId: { type: String, default: '' },
                secretKey: { type: String, default: '' }
            },
        },
        discounts: {
            newUserDiscount: { type: Number, default: 10, min: 0, max: 100 },
            bulkDiscountThreshold: { type: Number, default: 500 },
            bulkDiscountPercent: { type: Number, default: 5, min: 0, max: 100 },
        }
    },

    // ========== إعدادات الشحن والتوصيل ==========
    shipping: {
        internal: { type: Number, default: 25 },
        international: { type: Number, default: 75 },
        freeShippingMin: { type: Number, default: 300 },
        enableInternational: { type: Boolean, default: false },
        estimatedDeliveryDays: { type: String, default: '3-5 أيام عمل' },
        shippingPolicy: { type: String, default: 'نوفر شحن سريع وآمن لجميع الطلبات' },
    },

    // ========== المظهر والتصميم ==========
    appearance: {
        theme: { type: String, enum: ['default', 'dark', 'golden', 'modern', 'classic', 'custom'], default: 'default' },
        primaryColor: { type: String, default: '#1a1a2e' },
        secondaryColor: { type: String, default: '#e94560' },
        accentColor: { type: String, default: '#0f3460' },
        goldColor: { type: String, default: '#ffd700' },
        backgroundColor: { type: String, default: '#f8f9fa' },
        textColor: { type: String, default: '#333333' },
        fontFamily: { type: String, default: 'Cairo, sans-serif' },
        customCSS: { type: String, default: '' },
        customJS: { type: String, default: '' },
        layout: { 
            type: String, 
            enum: ['full-width', 'boxed', 'fluid'], 
            default: 'full-width' 
        },
        enableDarkModeToggle: { type: Boolean, default: true },
        enableRTL: { type: Boolean, default: true },
    },

    // ========== الصفحة الرئيسية والمحتوى ==========
    homepage: {
        showHeroSlider: { type: Boolean, default: true },
        heroSlides: { type: Array, default: [] },
        showFeaturedProducts: { type: Boolean, default: true },
        showNewArrivals: { type: Boolean, default: true },
        showBestSellers: { type: Boolean, default: true },
        showPromoBanner: { type: Boolean, default: true },
        promoBannerText: { type: String, default: '🚀 شحن مجاني للطلبات فوق 300 ريال | خصم 15% على أول طلب' },
        promoBannerTextEn: { type: String, default: '🚀 Free shipping for orders over 300 SAR | 15% off first order' },
        promoBannerLink: { type: String, default: '/products' },
        productsPerPage: { type: Number, default: 12 },
        defaultGridView: { type: Number, default: 3 },
        enableCategoriesInHome: { type: Boolean, default: true },
        categoriesDisplayLimit: { type: Number, default: 8 },
    },

    // ========== السياسات والقوانين ==========
    policies: {
        returnPolicy: { type: String, default: 'يمنع منعاً باتاً استرجاع السلع نقداً بعد الشراء لأي سبب كان. يحق للزبون استبدال السلعة بأخرى خلال 3 أيام فقط من تاريخ الاستلام في حال وجود خلل مصنعي واضح، بشرط ألا يكون الخلل ناتجاً عن سوء الاستخدام. أي كشط أو تلف في ملصقات الضمان أو العبوات الأصلية يلغي الضمان بشكل فوري ويسقط حق الاستبدال.' },
        returnPolicyEn: { type: String, default: 'Cash refunds are strictly prohibited after purchase for any reason. The customer has the right to exchange the product within 3 days only from the date of receipt in case of a clear manufacturing defect, provided that the defect is not caused by misuse. Any scratching or damage to the warranty stickers or original packaging immediately voids the warranty and cancels the right to exchange.' },
        privacyPolicy: { type: String, default: 'نحن في متجر الرعدي أون لاين نلتزم بحماية خصوصية عملائنا. جميع البيانات الشخصية تستخدم فقط لأغراض تنفيذ الطلبات وتحسين تجربة التسوق ولا يتم مشاركتها مع أي طرف ثالث.' },
        privacyPolicyEn: { type: String, default: 'We at Al-Radi Online Store are committed to protecting our customers\' privacy. All personal data is used only for order fulfillment and improving the shopping experience and is not shared with any third party.' },
        termsAndConditions: { type: String, default: 'باستخدامك لمتجر الرعدي أون لاين فإنك توافق على جميع الشروط والأحكام. يخضع جميع المستخدمين للقوانين والأنظمة المعمول بها في المملكة العربية السعودية.' },
        termsAndConditionsEn: { type: String, default: 'By using Al-Radi Online Store, you agree to all terms and conditions. All users are subject to the laws and regulations in force in the Kingdom of Saudi Arabia.' },
    },

    // ========== وسائل التواصل الاجتماعي ==========
    social: {
        facebook: { type: String, default: '' },
        twitter: { type: String, default: '' },
        instagram: { type: String, default: '' },
        youtube: { type: String, default: '' },
        tiktok: { type: String, default: '' },
        snapchat: { type: String, default: '' },
        linkedin: { type: String, default: '' },
        pinterest: { type: String, default: '' },
        threads: { type: String, default: '' },
    },

    // ========== إعدادات SEO والميتا ==========
    seo: {
        metaTitle: { type: String, default: 'متجر الرعدي أون لاين - التسوق الإلكتروني العالمي' },
        metaDescription: { type: String, default: 'متجر الرعدي أون لاين - تجربة تسوق فائقة وآمنة مع أفضل المنتجات العالمية' },
        metaKeywords: { type: String, default: 'متجر, الرعدي, تسوق, إلكتروني, أون لاين, منتجات, عالمي' },
        googleAnalyticsId: { type: String, default: '' },
        facebookPixelId: { type: String, default: '' },
        tiktokPixelId: { type: String, default: '' },
        snapchatPixelId: { type: String, default: '' },
        enableSitemap: { type: Boolean, default: true },
        enableRobots: { type: Boolean, default: true },
    },

    // ========== الأمان والمصادقة ==========
    security: {
        enableOTP: { type: Boolean, default: true },
        otpExpiryMinutes: { type: Number, default: 10 },
        maxLoginAttempts: { type: Number, default: 5 },
        sessionTimeout: { type: Number, default: 30 },
        enableTwoFactorAuth: { type: Boolean, default: false },
        enableCaptcha: { type: Boolean, default: true },
        captchaSiteKey: { type: String, default: '' },
        captchaSecretKey: { type: String, default: '' },
    },

    // ========== الإشعارات والتنبيهات ==========
    notifications: {
        enableEmail: { type: Boolean, default: true },
        enableSMS: { type: Boolean, default: false },
        enableWhatsApp: { type: Boolean, default: false },
        orderConfirmation: { type: Boolean, default: true },
        shippingUpdate: { type: Boolean, default: true },
        lowStockAlert: { type: Boolean, default: true },
        lowStockThreshold: { type: Number, default: 5 },
        newOrderAlert: { type: Boolean, default: true },
        newUserAlert: { type: Boolean, default: false },
    },

    // ========== برنامج الولاء والمكافآت ==========
    loyalty: {
        enable: { type: Boolean, default: true },
        pointsPerRiyal: { type: Number, default: 1 },
        pointsValueInRiyal: { type: Number, default: 0.01 },
        minimumPointsToRedeem: { type: Number, default: 100 },
        pointsExpiryDays: { type: Number, default: 365 },
        welcomePoints: { type: Number, default: 50 },
        birthdayPoints: { type: Number, default: 100 },
    },

    // ========== الإعدادات المتقدمة والمرونة ==========
    advanced: {
        maintenanceMode: { type: Boolean, default: false },
        maintenanceMessage: { type: String, default: 'المتجر قيد الصيانة حالياً، سنعود قريباً' },
        enableWishlist: { type: Boolean, default: true },
        enableProductComparison: { type: Boolean, default: true },
        enableReviews: { type: Boolean, default: true },
        reviewsAutoApprove: { type: Boolean, default: false },
        enableGuestCheckout: { type: Boolean, default: false },
        enableMultilingual: { type: Boolean, default: true },
        defaultLanguage: { type: String, enum: ['ar', 'en'], default: 'ar' },
        enableCache: { type: Boolean, default: true },
        cacheDuration: { type: Number, default: 3600 },
        enableDebugMode: { type: Boolean, default: false },
    },

    // ========== إعدادات مخصصة للمطورين ==========
    custom: {
        jsonData: { type: mongoose.Schema.Types.Mixed, default: {} },
        features: { type: Map, of: Boolean, default: {} },
        metadata: { type: Map, of: String, default: {} },
    }

}, { 
    timestamps: true,
    indexes: [
        { fields: { 'branding.storeName': 1 } },
        { fields: { 'contact.email': 1 } },
        { fields: { 'media.storageMode': 1 } }
    ]
});

// ================================================================
// 2. دوال مساعدة قوية للتعامل مع الإعدادات
// ================================================================

// الحصول على الإعدادات (إنشاء افتراضي إذا لم توجد)
storeSettingsSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    if (!settings) {
        settings = new this();
        await settings.save();
        console.log('✅ تم إنشاء إعدادات المتجر الافتراضية');
    }
    return settings;
};

// تحديث الإعدادات مع دمج البيانات
storeSettingsSchema.statics.updateSettings = async function(updateData) {
    let settings = await this.findOne();
    if (!settings) {
        settings = new this(updateData);
    } else {
        Object.keys(updateData).forEach(key => {
            if (updateData[key] && typeof updateData[key] === 'object' && !Array.isArray(updateData[key])) {
                settings[key] = { ...settings[key], ...updateData[key] };
            } else {
                settings[key] = updateData[key];
            }
        });
    }
    await settings.save();
    console.log('✅ تم تحديث إعدادات المتجر');
    return settings;
};

// الحصول على مسار ملف محدد بناءً على وضع التخزين
storeSettingsSchema.methods.getMediaPath = function(mediaKey) {
    const media = this.media;
    if (media.storageMode === 'url') {
        const urlKey = mediaKey + 'Url';
        if (media[urlKey]) return media[urlKey];
    }
    return media[mediaKey] || null;
};

// الحصول على مسار صوتي محدد
storeSettingsSchema.methods.getAudioPath = function(audioKey) {
    const audio = this.media.audio[audioKey];
    if (!audio) return null;
    if (this.media.storageMode === 'url' && audio.url) return audio.url;
    return audio.local || null;
};

// ================================================================
// 3. دوال للتحقق من الصلاحية والبيانات
// ================================================================

// التحقق من وجود صورة شعار صالحة
storeSettingsSchema.methods.hasValidLogo = function() {
    const logo = this.media.logo || this.media.logoUrl;
    return logo && logo.trim() !== '';
};

// التحقق من تفعيل الصوتيات
storeSettingsSchema.methods.isVoiceEnabled = function() {
    return this.media.voiceGreetingEnabled || this.media.voiceInteractionsEnabled;
};

// الحصول على رابط الخريطة
storeSettingsSchema.methods.getMapLink = function() {
    return this.contact.mapLocation || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.contact.address)}`;
};

// ================================================================
// 4. دوال للمساعدة في إدارة الوسائط (إضافة/حذف)
// ================================================================

// إضافة مسار وسائط جديد (للصور والصوتيات)
storeSettingsSchema.methods.updateMedia = async function(key, value, isUrl = false) {
    if (isUrl) {
        const urlKey = key + 'Url';
        this.media[urlKey] = value;
    } else {
        this.media[key] = value;
    }
    await this.save();
    return this;
};

// إعادة تعيين جميع الصوتيات إلى الوضع الافتراضي
storeSettingsSchema.methods.resetAudio = async function() {
    const defaultAudio = {
        greeting: { local: '/audio/welcome.mp3', url: '' },
        addToCart: { local: '/audio/add-to-cart.mp3', url: '' },
        save: { local: '/audio/save.mp3', url: '' },
        print: { local: '/audio/print.mp3', url: '' },
        sort: { local: '/audio/sort.mp3', url: '' },
        notification: { local: '/audio/notification.mp3', url: '' },
        error: { local: '/audio/error.mp3', url: '' },
        success: { local: '/audio/success.mp3', url: '' },
    };
    this.media.audio = defaultAudio;
    await this.save();
    return this;
};

// ================================================================
// 5. تصدير النموذج
// ================================================================

module.exports = mongoose.model('StoreSettings', storeSettingsSchema);
