// ================================================================
// متجر الرعدي أون لاين - Al-Radi Online
// نموذج إعدادات المتجر - النسخة العبقرية الشاملة (v4.0)
// تدعم التخزين المحلي والروابط مع نظام إدارة وسائط متكامل
// ================================================================

const mongoose = require('mongoose');

// ================================================================
// مخطط مساعد لعنصر الوسائط (صورة أو صوت) لدعم التخزين المزدوج
// ================================================================
const MediaItemSchema = new mongoose.Schema({
    local: { type: String, default: '' },      // المسار المحلي (ملف مرفوع)
    url: { type: String, default: '' },        // الرابط الخارجي
    source: { type: String, enum: ['local', 'url'], default: 'local' } // المصدر النشط
}, { _id: false });

// ================================================================
// مخطط الإعدادات الرئيسي
// ================================================================
const storeSettingsSchema = new mongoose.Schema({

    // ========== الهوية الأساسية ==========
    branding: {
        storeName: { type: String, default: 'متجر الرعدي أون لاين' },
        storeNameEn: { type: String, default: 'Al-Radi Online Store' },
        tagline: { type: String, default: 'تسوق بثقة واستمتع بتجربة فاخرة' },
        taglineEn: { type: String, default: 'Shop with confidence and enjoy a luxury experience' },
        storeDescription: { type: String, default: 'متجر إلكتروني متكامل للتسوق العالمي - تجربة فائقة وآمنة' },
        storeDescriptionEn: { type: String, default: 'Integrated online store for global shopping' },
        copyrightText: { type: String, default: 'جميع الحقوق محفوظة © 2026 لمجموعة متاجر الرعدي أونلاين الفاخرة' },
        copyrightTextEn: { type: String, default: 'All Rights Reserved © 2026 Al-Radi Online Luxury Stores Group' },
    },

    // ========== الوسائط المتعددة (الشعار، الأيقونات، الصور، الصوتيات) ==========
    media: {
        // الشعار
        logo: MediaItemSchema,
        // الأيقونة المفضلة
        favicon: MediaItemSchema,
        // صورة القسم الافتراضية
        defaultCategoryImage: MediaItemSchema,
        // صورة المنتج الافتراضية
        defaultProductImage: MediaItemSchema,
        // خلفية الهيدر
        heroBackground: MediaItemSchema,
        // صورة البانر الترويجي
        promoBannerImage: MediaItemSchema,

        // ====== نظام الصوتيات العملاق (مع أصوات افتراضية مدمجة) ======
        audio: {
            // صوت الترحيب
            greeting: { 
                local: { type: String, default: '/audio/welcome.mp3' },
                url: { type: String, default: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3' },
                source: { type: String, enum: ['local', 'url'], default: 'url' }
            },
            // صوت الإضافة للسلة
            addToCart: { 
                local: { type: String, default: '/audio/add-to-cart.mp3' },
                url: { type: String, default: 'https://www.soundjay.com/button/sounds/button-09.mp3' },
                source: { type: String, enum: ['local', 'url'], default: 'url' }
            },
            // صوت الحفظ
            save: { 
                local: { type: String, default: '/audio/save.mp3' },
                url: { type: String, default: 'https://www.soundjay.com/button/sounds/button-19.mp3' },
                source: { type: String, enum: ['local', 'url'], default: 'url' }
            },
            // صوت الطباعة
            print: { 
                local: { type: String, default: '/audio/print.mp3' },
                url: { type: String, default: 'https://www.soundjay.com/button/sounds/button-15.mp3' },
                source: { type: String, enum: ['local', 'url'], default: 'url' }
            },
            // صوت الفرز
            sort: { 
                local: { type: String, default: '/audio/sort.mp3' },
                url: { type: String, default: 'https://www.soundjay.com/button/sounds/button-12.mp3' },
                source: { type: String, enum: ['local', 'url'], default: 'url' }
            },
            // صوت الإشعار
            notification: { 
                local: { type: String, default: '/audio/notification.mp3' },
                url: { type: String, default: 'https://www.soundjay.com/button/sounds/button-10.mp3' },
                source: { type: String, enum: ['local', 'url'], default: 'url' }
            },
            // صوت الخطأ
            error: { 
                local: { type: String, default: '/audio/error.mp3' },
                url: { type: String, default: 'https://www.soundjay.com/button/sounds/button-20.mp3' },
                source: { type: String, enum: ['local', 'url'], default: 'url' }
            },
            // صوت النجاح
            success: { 
                local: { type: String, default: '/audio/success.mp3' },
                url: { type: String, default: 'https://www.soundjay.com/button/sounds/button-13.mp3' },
                source: { type: String, enum: ['local', 'url'], default: 'url' }
            },
            // صوت الحذف
            delete: { 
                local: { type: String, default: '/audio/delete.mp3' },
                url: { type: String, default: 'https://www.soundjay.com/button/sounds/button-21.mp3' },
                source: { type: String, enum: ['local', 'url'], default: 'url' }
            }
        },
        
        // الإعدادات العامة للصوتيات
        voiceSettings: {
            greetingEnabled: { type: Boolean, default: true },
            interactionsEnabled: { type: Boolean, default: true },
            volume: { type: Number, min: 0, max: 1, default: 0.7 }
        }
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

    // ========== المالية والدفع ==========
    finance: {
        currency: { type: String, default: 'SAR' },
        currencySymbol: { type: String, default: 'ر.س' },
        taxRate: { type: Number, default: 0, min: 0, max: 100 },
        minOrderAmount: { type: Number, default: 0 },
        enableCOD: { type: Boolean, default: true },
        enableOnlinePayment: { type: Boolean, default: false },
        paymentGateways: {
            paypal: { enabled: { type: Boolean, default: false }, clientId: { type: String, default: '' }, secret: { type: String, default: '' } },
            stripe: { enabled: { type: Boolean, default: false }, publicKey: { type: String, default: '' }, secretKey: { type: String, default: '' } },
            tap: { enabled: { type: Boolean, default: false }, merchantId: { type: String, default: '' }, secretKey: { type: String, default: '' } }
        },
        discounts: {
            newUserDiscount: { type: Number, default: 10, min: 0, max: 100 },
            bulkDiscountThreshold: { type: Number, default: 500 },
            bulkDiscountPercent: { type: Number, default: 5, min: 0, max: 100 }
        }
    },

    // ========== الشحن ==========
    shipping: {
        internal: { type: Number, default: 25 },
        international: { type: Number, default: 75 },
        freeShippingMin: { type: Number, default: 300 },
        enableInternational: { type: Boolean, default: false },
        estimatedDeliveryDays: { type: String, default: '3-5 أيام عمل' },
        shippingPolicy: { type: String, default: 'نوفر شحن سريع وآمن لجميع الطلبات' },
    },

    // ========== المظهر والتخصيص ==========
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
        layout: { type: String, enum: ['full-width', 'boxed', 'fluid'], default: 'full-width' },
        enableDarkModeToggle: { type: Boolean, default: true },
        enableRTL: { type: Boolean, default: true },
    },

    // ========== الصفحة الرئيسية ==========
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

    // ========== السياسات ==========
    policies: {
        returnPolicy: { type: String, default: 'يمنع منعاً باتاً استرجاع السلع نقداً بعد الشراء لأي سبب كان. يحق للزبون استبدال السلعة بأخرى خلال 3 أيام فقط من تاريخ الاستلام في حال وجود خلل مصنعي واضح، بشرط ألا يكون الخلل ناتجاً عن سوء الاستخدام. أي كشط أو تلف في ملصقات الضمان أو العبوات الأصلية يلغي الضمان بشكل فوري ويسقط حق الاستبدال.' },
        returnPolicyEn: { type: String, default: 'Cash refunds are strictly prohibited after purchase for any reason. The customer has the right to exchange the product within 3 days only from the date of receipt in case of a clear manufacturing defect, provided that the defect is not caused by misuse. Any scratching or damage to the warranty stickers or original packaging immediately voids the warranty and cancels the right to exchange.' },
        privacyPolicy: { type: String, default: 'نحن في متجر الرعدي أون لاين نلتزم بحماية خصوصية عملائنا. جميع البيانات الشخصية تستخدم فقط لأغراض تنفيذ الطلبات وتحسين تجربة التسوق ولا يتم مشاركتها مع أي طرف ثالث.' },
        privacyPolicyEn: { type: String, default: 'We are committed to protecting our customers\' privacy. All personal data is used only for order fulfillment and improving the shopping experience and is not shared with any third party.' },
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

    // ========== SEO والتحليلات ==========
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

    // ========== الأمان ==========
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

    // ========== الإشعارات ==========
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

    // ========== الولاء والمكافآت ==========
    loyalty: {
        enable: { type: Boolean, default: true },
        pointsPerRiyal: { type: Number, default: 1 },
        pointsValueInRiyal: { type: Number, default: 0.01 },
        minimumPointsToRedeem: { type: Number, default: 100 },
        pointsExpiryDays: { type: Number, default: 365 },
        welcomePoints: { type: Number, default: 50 },
        birthdayPoints: { type: Number, default: 100 },
    },

    // ========== الإعدادات المتقدمة ==========
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

    // ========== بيانات مخصصة للمطورين ==========
    custom: {
        jsonData: { type: mongoose.Schema.Types.Mixed, default: {} },
        features: { type: Map, of: Boolean, default: {} },
        metadata: { type: Map, of: String, default: {} },
    }

}, { timestamps: true });

// ================================================================
// الدوال المساعدة العملاقة
// ================================================================

// الحصول على الإعدادات (إنشاء افتراضي إن لم توجد)
storeSettingsSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    if (!settings) {
        settings = new this();
        await settings.save();
        console.log('✅ تم إنشاء إعدادات المتجر الافتراضية');
    }
    return settings;
};

// تحديث الإعدادات مع دمج عميق
storeSettingsSchema.statics.updateSettings = async function(updateData) {
    let settings = await this.findOne();
    if (!settings) {
        settings = new this(updateData);
    } else {
        // دمج عميق يدوي للتعامل مع الكائنات المتداخلة
        const deepMerge = (target, source) => {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        };
        deepMerge(settings._doc, updateData);
    }
    await settings.save();
    console.log('✅ تم تحديث إعدادات المتجر');
    return settings;
};

// الحصول على قيمة الوسائط النشطة (تلقائياً)
storeSettingsSchema.methods.getMediaValue = function(mediaPath) {
    // mediaPath مثال: 'media.logo' أو 'media.audio.greeting'
    const parts = mediaPath.split('.');
    let current = this;
    for (const part of parts) {
        if (!current) return null;
        current = current[part];
    }
    if (!current || typeof current !== 'object') return current;
    // إذا كان كائن MediaItem
    if (current.source === 'url' && current.url) return current.url;
    if (current.local) return current.local;
    return current.url || current.local || null;
};

// الحصول على مسار صوتي معين
storeSettingsSchema.methods.getAudio = function(key) {
    const audio = this.media.audio[key];
    if (!audio) return null;
    if (audio.source === 'url' && audio.url) return audio.url;
    return audio.local || null;
};

// إعادة تعيين الصوتيات إلى الوضع الافتراضي
storeSettingsSchema.methods.resetAudioToDefault = async function() {
    const defaults = {
        greeting: { local: '/audio/welcome.mp3', url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3', source: 'url' },
        addToCart: { local: '/audio/add-to-cart.mp3', url: 'https://www.soundjay.com/button/sounds/button-09.mp3', source: 'url' },
        save: { local: '/audio/save.mp3', url: 'https://www.soundjay.com/button/sounds/button-19.mp3', source: 'url' },
        print: { local: '/audio/print.mp3', url: 'https://www.soundjay.com/button/sounds/button-15.mp3', source: 'url' },
        sort: { local: '/audio/sort.mp3', url: 'https://www.soundjay.com/button/sounds/button-12.mp3', source: 'url' },
        notification: { local: '/audio/notification.mp3', url: 'https://www.soundjay.com/button/sounds/button-10.mp3', source: 'url' },
        error: { local: '/audio/error.mp3', url: 'https://www.soundjay.com/button/sounds/button-20.mp3', source: 'url' },
        success: { local: '/audio/success.mp3', url: 'https://www.soundjay.com/button/sounds/button-13.mp3', source: 'url' },
        delete: { local: '/audio/delete.mp3', url: 'https://www.soundjay.com/button/sounds/button-21.mp3', source: 'url' }
    };
    for (const key in defaults) {
        if (this.media.audio[key]) {
            this.media.audio[key].local = defaults[key].local;
            this.media.audio[key].url = defaults[key].url;
            this.media.audio[key].source = defaults[key].source;
        }
    }
    await this.save();
    return this;
};

// ================================================================
// تصدير النموذج
// ================================================================
module.exports = mongoose.model('StoreSettings', storeSettingsSchema);
