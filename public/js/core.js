 ];
}
/* ==========================================================================
   🧠 محرك العمليات الأساسي والربط السحابي لمتجر الرعدي أونلاين الدولي (core.js)
   ========================================================================== */

// --- 🌐 المتغيرات العالمية للمنظومة السحابية ---
let currentStoreName = "الرعدي أونلاين";
let currentStoreLogo = "https://i.ibb.co/6NG0byK/falcon-head.png";
let globalReturnPolicy = "يسمح للعميل الفاضل باستبدال أو استرجاع المنتجات والطلبيات خلال مدة أقصاها 14 يوماً من تاريخ الاستلام الفعلي، شريطة الحفاظ على المنتج في عبوته وحالته الأصلية الفاخرة دون استخدام أو فتح.";

let allProductsArray = []; // المخزن المؤقت للمنتجات المجلوبة سحابياً
let shoppingCartArray = []; // سلة المشتريات الحالية للعميل
let appActiveCurrency = "SAR"; // العملة الافتراضية للمتجر (ريال سعودي)
let currentActiveCategory = "الكل"; // القسم النشط حالياً بالتصفح
let currentProductGridLayout = 3; // نمط العرض الشبكي الافتراضي (3 منتجات بالصف)
let activeExtraCouponDiscount = 0; // قيمة الخصم الإضافي من الكوبون

// بيانات المستخدم الحالي المسجل
let loggedInUserSession = {
    identity: null,
    role: "client", // client أو admin
    name: "عميل الرعدي الدولي",
    invoicesHistory: []
};

// أسعار صرف العملات الدولية الثابتة بالنسبة للريال السعودي (SAR هو الأساس)
const currencyExchangeRates = {
    "SAR": 1.0,      // ريال سعودي
    "YER": 68.0,     // ريال يمني (سعر تقريبي تشغيلي)
    "USD": 0.27,     // دولار أمريكي
    "AED": 0.98      // درهم إماراتي
};

// --- 🚀 دالة تهيئة التطبيق وفحص الجلسات الفورية ---
function initApp() {
    console.log("🦅 تم تشغيل محرك متجر الرعدي أونلاين الدولي...");
    loadGlobalStoreSettingsFromStorage();
    applyDynamicStoreIdentity();
    fetchProductsFromDatabase();
    generateMockCustomersData();
}

// --- 🔐 نظام الحماية وبوابة تسجيل الدخول الذكية ---
function handleAuth(event) {
    event.preventDefault();
    const identityInput = document.getElementById('auth-identity').value.trim();
    const passwordInput = document.getElementById('auth-password').value;
    const loginErrorBox = document.getElementById('login-error-msg');
    const loginCard = document.querySelector('.auth-card');

    // 👑 التحقق من حساب المدير الافتراضي والشامل
    if (identityInput === "alradi@gmail.com" && passwordInput === "admin123") {
        loggedInUserSession.identity = identityInput;
        loggedInUserSession.role = "admin";
        loggedInUserSession.name = "المدير العام للمتجر";
        
        loginErrorBox.style.display = "none";
        document.getElementById('login-screen').style.display = "none";
        document.getElementById('main-store-app').style.display = "block";
        document.getElementById('admin-shortcut-btn').style.display = "flex"; // إظهار زر لوحة التحكم للمدير
        
        // تحديث بيانات لوحة التحكم للمدير فوراً
        document.getElementById('admin-display-email').innerText = identityInput;
        refreshAdminDashboardAnalytics();
        return;
    }

    // 👤 التحقق من دخول العميل (أي حساب آخر يعتبر عميل دولي تلقائي)
    if (identityInput.length >= 4 && passwordInput.length >= 4) {
        loggedInUserSession.identity = identityInput;
        loggedInUserSession.role = "client";
        // استخلاص اسم افتراضي أنيق من البريد أو الرقم
        loggedInUserSession.name = identityInput.split('@')[0];
        
        loginErrorBox.style.display = "none";
        document.getElementById('login-screen').style.display = "none";
        document.getElementById('main-store-app').style.display = "block";
        document.getElementById('admin-shortcut-btn').style.display = "none"; // إخفاء لوحة المدير عن العميل
        
        // تحميل فواتير العميل السابقة إن وجدت
        loadClientInvoicesFromStorage();
        return;
    }

    // ⚠️ التعامل مع الخطأ البرمي (حركية الاهتزاز والذكاء العاطفي)
    loginCard.classList.add('shake-animation');
    loginErrorBox.style.display = "block";
    loginErrorBox.innerText = "عذراً! البيانات المدخلة غير متطابقة مع سجلات الرعدي المشفرة.";
    
    // إزالة فئة الاهتزاز بعد انتهاء الحركة لكي تتكرر عند الخطأ التالي
    setTimeout(() => {
        loginCard.classList.remove('shake-animation');
    }, 400);
}

// دالة إظهار وإخفاء كلمات المرور (أيقونة العين الساحرة)
function togglePasswordVisibility(inputId) {
    const passwordField = document.getElementById(inputId);
    const eyeIcon = document.getElementById('eye-icon');
    if (passwordField.type === "password") {
        passwordField.type = "text";
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passwordField.type = "password";
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

// --- 📦 دالة ضخ وجلب المنتجات السحابية والمحلية المتكاملة ---
function fetchProductsFromDatabase() {
    // منتجات دولية ملكية افتراضية لتشغيل المتجر فوراً وبأعلى كفاءة على Render
    allProductsArray = [
        {
            id: 101,
            title_ar: "ساعة الرعدي الكرونوغراف الملكية السوداء",
            title_en: "Alradi Chronograph Royal Black Watch",
            category: "ساعات وأقلام فاخرة",
            price_new: 750.00,
            price_old: 1200.00,
            stock: 14,
            image_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500",
            description: "ساعة مقاومة للماء مع تدرجات ذهبية ناعمة صممت لرجال الأعمال والقيادات رفيعة المستوى."
        },
        {
            id: 102,
            title_ar: "عطر الصقر الملكي الشامل - 100 مل",
            title_en: "Royal Falcon Intense Perfume - 100ml",
            category: "عطور ملكية",
            price_new: 450.00,
            price_old: 450.00, // بدون سعر قديم (اختياري)
            stock: 8,
            image_url: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=500",
            description: "تركيبة شرقية فريدة تجمع بين دهن العود الكمبودي الفاخر والورد الطائفي النادر."
        },
        {
            id: 103,
            title_ar: "هاتف ردمي نوت 13 برو بلس - النسخة العالمية",
            title_en: "Redmi Note 13 Pro Plus - Global Edition",
            category: "إلكترونيات وهواتف",
            price_new: 1600.00,
            price_old: 1950.00,
            stock: 0, // هذا المنتج سيعرض (نفذت الكمية) تلقائياً بناءً على طلبك الإستراتيجي
            image_url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500",
            description: "شاشة منحنية أموليد بدقة فائقة، مع ذاكرة تخزين عملاقة 512 جيجابايت وكاميرا 200 ميجابكسل."
        }
    ];

    // دمج المنتجات المضافة بواسطة المدير والمخزنة في LocalStorage محلياً
    const storedAdminProducts = JSON.parse(localStorage.getItem('admin_added_products')) || [];
    allProductsArray = [...allProductsArray, ...storedAdminProducts];

    // استدعاء دالة بناء الواجهة وتوزيع البطاقات ديناميكياً
    renderProductsCatalogView();
    renderCategoriesCrescentNavigation();
}

// --- 📊 العمليات الحسابية التلقائية والذكية لنسب الخصم ---
function autoCalculateDiscountPercentage() {
    const priceNew = parseFloat(document.getElementById('prod-price-new').value);
    const priceOld = parseFloat(document.getElementById('prod-price-old').value);
    const discountDisplayField = document.getElementById('prod-discount-calculated');

    if (!isNaN(priceNew) && !isNaN(priceOld) && priceOld > priceNew) {
        const discountPercentage = Math.round(((priceOld - priceNew) / priceOld) * 100);
        discountDisplayField.value = `${discountPercentage}%`;
    } else {
        discountDisplayField.value = "0%";
    }
}

// --- 🪙 دالة تحويل العملات الدولية المعتمدة واللحظية ---
function formatPriceWithActiveCurrency(priceInSAR) {
    const convertedPrice = priceInSAR * currencyExchangeRates[appActiveCurrency];
    // إرجاع النص منسقاً مع رمز العملة النشط دولياً
    return `${convertedPrice.toFixed(2)} ${appActiveCurrency}`;
}

function updateCurrencyAndPrices() {
    appActiveCurrency = document.getElementById('global-currency').value;
    renderProductsCatalogView(); // إعادة تدوير وعرض المنتجات بالأسعار الجديدة فوراً
    updateCartPanelTotalsUI(); // تحديث أرقام وإجمالي السلة الجانبية
}

// --- 💾 حفظ وإدارة إعدادات الهوية وسيطرة المدير السحابية ---
function saveGlobalStoreSettings() {
    const nameInput = document.getElementById('settings-store-name-input').value.trim();
    const logoInput = document.getElementById('settings-store-logo-input').value.trim();
    const policyInput = document.getElementById('settings-legal-policy-input').value.trim();

    if(nameInput) currentStoreName = nameInput;
    if(logoInput) currentStoreLogo = logoInput;
    if(policyInput) globalReturnPolicy = policyInput;

    // حفظها في ذاكرة النظام لكي لا يختفي التعديل عند التحديث
    const globalSettingsObj = { currentStoreName, currentStoreLogo, globalReturnPolicy };
    localStorage.setItem('alradi_store_global_settings', JSON.stringify(globalSettingsObj));

    applyDynamicStoreIdentity();
    alert("🚀 تم حفظ وتعميم الإعدادات وتحديث الهوية البصرية للمنظومة بالكامل بنجاح!");
}

function loadGlobalStoreSettingsFromStorage() {
    const savedSettings = JSON.parse(localStorage.getItem('alradi_store_global_settings'));
    if (savedSettings) {
        currentStoreName = savedSettings.currentStoreName;
        currentStoreLogo = savedSettings.currentStoreLogo;
        globalReturnPolicy = savedSettings.globalReturnPolicy;
    }
}

function applyDynamicStoreIdentity() {
    // تطبيق الاسم واللوغو الجديد في واجهة الدخول، شريط التنقل، والفواتير الملكية
    document.title = `${currentStoreName} | سوق الفخامة الدولي`;
    document.getElementById('site-title-tag').innerText = `${currentStoreName} | سوق الفخامة الدولي`;
    document.getElementById('login-store-name').innerText = currentStoreName;
    document.getElementById('store-name-current').innerText = currentStoreName;
    document.getElementById('invoice-store-title-text').innerText = currentStoreName;

    document.getElementById('login-logo').src = currentStoreLogo;
    document.getElementById('store-logo-current').src = currentStoreLogo;
    document.getElementById('invoice-logo-img').src = currentStoreLogo;
    document.getElementById('admin-current-avatar').src = currentStoreLogo;
    
    // حقن نص قوانين الاسترجاع المحدث بداخل هيكل الفاتورة
    document.getElementById('invoice-legal-text-content').innerText = globalReturnPolicy;
}

// --- 📑 إدارة أرشيف الفواتير للعميل محلياً وسحابياً ---
function saveInvoiceToClientArchive(invoiceObj) {
    let clientArchive = JSON.parse(localStorage.getItem(`archive_${loggedInUserSession.identity}`)) || [];
    clientArchive.push(invoiceObj);
    localStorage.setItem(`archive_${loggedInUserSession.identity}`, JSON.stringify(clientArchive));
    
    // حفظ نسخة عامة في أرشيف المدير أيضاً لضمان الرصد
    let adminGlobalOrders = JSON.parse(localStorage.getItem('admin_global_orders_logs')) || [];
    adminGlobalOrders.push({
        ...invoiceObj,
        clientIdentity: loggedInUserSession.identity
    });
    localStorage.setItem('admin_global_orders_logs', JSON.stringify(adminGlobalOrders));
}

function loadClientInvoicesFromStorage() {
    const clientArchive = JSON.parse(localStorage.getItem(`archive_${loggedInUserSession.identity}`)) || [];
    loggedInUserSession.invoicesHistory = clientArchive;
    rebuildClientInvoicesTableUI();
}

// دالة تفريغ محاكاة بيانات مستهلكين للوحة تحكم المدير
let mockCustomersArray = [];
function generateMockCustomersData() {
    mockCustomersArray = [
        { name: "الشيخ خالد بن عبد الله", identity: "khaled.uae@gmail.com", joined: "2026/01/10", ordersCount: 5 },
        { name: "الأستاذ محمد الرعدي الفاضل", identity: "967777123456", joined: "2026/03/15", ordersCount: 12 },
        { name: "المهندس أحمد السعودي", identity: "ahmed.sa@hotmail.com", joined: "2026/05/01", ordersCount: 2 }
    ];
}
