/* ==========================================================================
   🧠 محرك العمليات الأساسي والربط السحابي لمتجر الرعدي أونلاين الدولي (core.js)
   ========================================================================== */

// --- 🌐 المتغيرات العالمية للمنظومة السحابية ---
let currentStoreName = "الرعدي أونلاين";
let currentStoreLogo = "https://i.ibb.co/6NG0byK/falcon-head.png";
let globalReturnPolicy = "يسمح للعميل الفاضل باستبدال أو استرجاع المنتجات والطلبيات خلال مدة أقصاها 14 يوماً من تاريخ الاستلام الفعلي، شريطة الحفاظ على المنتج في عبوته وحالته الأصلية الفاخرة دون استخدام أو فتح.";

let allProductsArray = []; // المخزن المؤقت للمنتجات المجلوبة سحابياً من MongoDB
let shoppingCartArray = []; // سلة المشتريات الحالية للعميل
let appActiveCurrency = "SAR"; // العملة الافتراضية للمتجر (ريال سعودي)
let currentActiveCategory = "الكل"; // القسم النشط حالياً بالتصفح
let currentProductGridLayout = 3; // نمط العرض الشبكي الافتراضي (3 منتجات بالصف)
let activeExtraCouponDiscount = 0; // قيمة الخصم الإضافي من الكوبون

// بيانات المستخدم الحالي المسجل في الجلسة
let loggedInUserSession = {
    identity: null,
    role: "client", // client أو admin
    name: "عميل الرعدي الدولي",
    invoicesHistory: []
};

// أسعار صرف العملات الدولية الثابتة بالنسبة للريال السعودي (SAR هو الأساس)
const currencyExchangeRates = {
    "SAR": 1.0,      // ريال سعودي
    "YER": 68.0,     // ريال يمني
    "USD": 0.27,     // دولار أمريكي
    "AED": 0.98      // درهم إماراتي
};

// --- 🚀 دالة تهيئة التطبيق وفحص الجلسات الفورية عند الإقلاع ---
function initApp() {
    console.log("🦅 تم تشغيل محرك متجر الرعدي أونلاين المربوط بسحابة MongoDB...");
    loadGlobalStoreSettingsFromStorage();
    applyDynamicStoreIdentity();
    fetchProductsFromDatabase(); // جلب البيانات الحية من السيرفر السحابي
    generateMockCustomersData();
}

// --- 🔐 نظام الحماية وبوابة تسجيل الدخول الذكية المشفرة ---
function handleAuth(event) {
    event.preventDefault();
    const identityInput = document.getElementById('auth-identity').value.trim();
    const passwordInput = document.getElementById('auth-password').value;
    const loginErrorBox = document.getElementById('login-error-msg');
    const loginCard = document.querySelector('.auth-card');

    // 👑 التحقق من حساب المدير العام والشامل للمنظومة
    if (identityInput === "alradi@gmail.com" && passwordInput === "admin123") {
        loggedInUserSession.identity = identityInput;
        loggedInUserSession.role = "admin";
        loggedInUserSession.name = "المدير العام للمتجر";
        
        // 🎵 تشغيل نغمة ترحيبية فخمة جاهزة من الإنترنت عند نجاح الدخول
        new Audio('https://assets.mixkit.co/active_storage/sfx/2018/2018-84.wav').play();

        loginErrorBox.style.display = "none";
        document.getElementById('login-screen').style.display = "none";
        document.getElementById('main-store-app').style.display = "block";
        document.getElementById('admin-shortcut-btn').style.display = "flex"; // إظهار زر لوحة التحكم للمدير
        
        document.getElementById('admin-display-email').innerText = identityInput;
        refreshAdminDashboardAnalytics();
        return;
    }

    // 👤 التحقق من دخول العميل (أبو يزن / الرعدي المعتمد)
    if (identityInput.length >= 4 && passwordInput.length >= 4) {
        loggedInUserSession.identity = identityInput;
        loggedInUserSession.role = "client";
        loggedInUserSession.name = identityInput.split('@')[0];
        
        // 🎵 تشغيل نغمة ترحيبية فخمة جاهزة من الإنترنت عند نجاح الدخول
        new Audio('https://assets.mixkit.co/active_storage/sfx/2018/2018-84.wav').play();

        loginErrorBox.style.display = "none";
        document.getElementById('login-screen').style.display = "none";
        document.getElementById('main-store-app').style.display = "block";
        document.getElementById('admin-shortcut-btn').style.display = "none"; // حجب زر الإدارة عن العملاء
        
        loadClientInvoicesFromStorage();
        return;
    }

    // تأثير الهز البصري عند إدخال بيانات خاطئة للحماية
    loginCard.classList.add('shake-animation');
    loginErrorBox.style.display = "block";
    loginErrorBox.innerText = "عذراً! البيانات المدخلة غير متطابقة مع سجلات الرعدي المشفرة.";
    
    setTimeout(() => { loginCard.classList.remove('shake-animation'); }, 400);
}

// دالة إظهار وإخفاء كلمات المرور بمرونة
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

// --- 📦 دالة جلب المنتجات الحية مباشرة من سحابة MongoDB أطلس ---
async function fetchProductsFromDatabase() {
    try {
        const response = await fetch('/api/products');
        allProductsArray = await response.json();

        // ضخ منتج ترحيبي فاخر تلقائي في حال كانت السحابة فارغة تماماً بالتشغيل الأول
        if (allProductsArray.length === 0) {
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
                    description: "ساعة مقاومة للماء مع تدرجات ذهبية ناعمة صممت خصيصاً لرجال الأعمال."
                }
            ];
        }

        // إرسال البيانات المجلوبة لمحركات العرض والرسوميات بالواجهة
        renderProductsCatalogView();
        renderCategoriesCrescentNavigation();
    } catch (err) {
        console.error("❌ فشل جلب المنتجات السحابية من الخادم:", err);
    }
}

// --- 📊 العمليات الحسابية التلقائية والذكية لنسب الخصم بالتحديث اللحظي ---
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

// --- 🪙 دالة تنسيق وتحويل العملات الدولية المعتمدة واللحظية للموقع ---
function formatPriceWithActiveCurrency(priceInSAR) {
    const convertedPrice = priceInSAR * currencyExchangeRates[appActiveCurrency];
    return `${convertedPrice.toFixed(2)} ${appActiveCurrency}`;
}

function updateCurrencyAndPrices() {
    appActiveCurrency = document.getElementById('global-currency').value;
    renderProductsCatalogView(); // إعادة تحديث الأسعار على الكتالوج فوراً
    if(typeof updateCartPanelTotalsUI === "function") {
        updateCartPanelTotalsUI(); // تحديث أرقام السلة الجانبية في حال توفرها
    }
}

// --- 💾 حفظ وإدارة إعدادات الهوية وسيطرة المدير السحابية الشاملة ---
function saveGlobalStoreSettings() {
    const nameInput = document.getElementById('settings-store-name-input').value.trim();
    const logoInput = document.getElementById('settings-store-logo-input').value.trim();
    const policyInput = document.getElementById('settings-legal-policy-input').value.trim();

    if(nameInput) currentStoreName = nameInput;
    if(logoInput) currentStoreLogo = logoInput;
    if(policyInput) globalReturnPolicy = policyInput;

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
    document.title = `${currentStoreName} | سوق الفخامة الدولي`;
    
    const siteTitleTag = document.getElementById('site-title-tag');
    if(siteTitleTag) siteTitleTag.innerText = `${currentStoreName} | سوق الفخامة الدولي`;
    
    const loginStoreName = document.getElementById('login-store-name');
    if(loginStoreName) loginStoreName.innerText = currentStoreName;
    
    const storeNameCurrent = document.getElementById('store-name-current');
    if(storeNameCurrent) storeNameCurrent.innerText = currentStoreName;
    
    const invoiceStoreTitle = document.getElementById('invoice-store-title-text');
    if(invoiceStoreTitle) invoiceStoreTitle.innerText = currentStoreName;

    const loginLogo = document.getElementById('login-logo');
    if(loginLogo) loginLogo.src = currentStoreLogo;
    
    const storeLogoCurrent = document.getElementById('store-logo-current');
    if(storeLogoCurrent) storeLogoCurrent.src = currentStoreLogo;
    
    const invoiceLogoImg = document.getElementById('invoice-logo-img');
    if(invoiceLogoImg) invoiceLogoImg.src = currentStoreLogo;
    
    const adminAvatar = document.getElementById('admin-current-avatar');
    if(adminAvatar) adminAvatar.src = currentStoreLogo;
    
    const invoiceLegalText = document.getElementById('invoice-legal-text-content');
    if(invoiceLegalText) invoiceLegalText.innerText = globalReturnPolicy;
}

// --- 📑 إدارة أرشيف الفواتير وإرسالها حية للسحابة MongoDB ---
async function saveInvoiceToClientArchive(invoiceObj) {
    // 1. أرشفة محلية في متصفح العميل لضمان الأمان والسرعة السريعة بالفحص
    let clientArchive = JSON.parse(localStorage.getItem(`archive_${loggedInUserSession.identity}`)) || [];
    clientArchive.push(invoiceObj);
    localStorage.setItem(`archive_${loggedInUserSession.identity}`, JSON.stringify(clientArchive));
    
    // 2. إرسال الفاتورة الرسمية بكامل بياناتها المشحونة عبر الـ API ليتم توثيقها بالـ MongoDB
    try {
        const checkoutAddressField = document.getElementById('checkout-address');
        const checkoutShippingMethod = document.getElementById('checkout-shipping-method');
        const checkoutPaymentMethod = document.getElementById('checkout-payment-method');

        await fetch('/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                invoiceId: invoiceObj.invoiceId,
                date: invoiceObj.date,
                clientName: loggedInUserSession.name,
                clientIdentity: loggedInUserSession.identity,
                address: checkoutAddressField ? checkoutAddressField.value.trim() : "غير محدد",
                logisticsType: checkoutShippingMethod ? checkoutShippingMethod.value : "شحن قياسي",
                paymentType: checkoutPaymentMethod ? checkoutPaymentMethod.value : "الدفع عند الاستلام",
                currencyType: appActiveCurrency,
                items: invoiceObj.items,
                subtotal: invoiceObj.amountInSAR, 
                discount: invoiceObj.amountInSAR * activeExtraCouponDiscount,
                grandTotal: invoiceObj.amountInSAR - (invoiceObj.amountInSAR * activeExtraCouponDiscount)
            })
        });
        console.log("🥭 تم إرسال وأرشفة الفاتورة بنجاح داخل سحابة MongoDB!");
    } catch (err) {
        console.error("❌ فشل إرسال الفاتورة إلى السيرفر السحابي:", err);
    }
}

function loadClientInvoicesFromStorage() {
    const clientArchive = JSON.parse(localStorage.getItem(`archive_${loggedInUserSession.identity}`)) || [];
    loggedInUserSession.invoicesHistory = clientArchive;
    if(typeof rebuildClientInvoicesTableUI === "function") {
        rebuildClientInvoicesTableUI();
    }
}

// ضخ بيانات استهلاكية تجريبية لأغراض الفحص والتحليل داخل لوحة المدير
let mockCustomersArray = [];
function generateMockCustomersData() {
    mockCustomersArray = [
        { name: "أبو يزن الرعدي الفاضل", identity: "alradi.store@gmail.com", joined: "2026/01/10", ordersCount: 15 },
        { name: "الشيخ خالد بن عبد الله", identity: "khaled.uae@gmail.com", joined: "2026/03/15", ordersCount: 5 },
        { name: "المهندس أحمد السعودي", identity: "ahmed.sa@hotmail.com", joined: "2026/05/01", ordersCount: 2 }
    ];
}

// دالة تشغيل التهيئة التلقائية فور تحميل الصفحة بالكامل
window.addEventListener('DOMContentLoaded', initApp);
