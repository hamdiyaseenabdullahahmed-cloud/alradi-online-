/* ==========================================================================
   🧠 محرك العمليات الأساسي والربط السحابي لمتجر الرعدي أونلاين الدولي (core.js)
   ========================================================================== */

let currentStoreName = "الرعدي أونلاين";
let currentStoreLogo = "https://i.ibb.co/6NG0byK/falcon-head.png";
let globalReturnPolicy = "يسمح للعميل الفاضل باستبدال أو استرجاع المنتجات والطلبيات خلال مدة أقصاها 14 يوماً من تاريخ الاستلام الفعلي، شريطة الحفاظ على المنتج في عبوته وحالته الأصلية الفاخرة دون استخدام أو فتح.";

let allProductsArray = []; 
let shoppingCartArray = []; 
let appActiveCurrency = "SAR"; 
let currentActiveCategory = "الكل"; 
let currentProductGridLayout = 3; 
let activeExtraCouponDiscount = 0; 

let loggedInUserSession = {
    identity: null,
    role: "client", 
    name: "عميل الرعدي الدولي",
    invoicesHistory: []
};

const currencyExchangeRates = {
    "SAR": 1.0,      
    "YER": 68.0,     
    "USD": 0.27,     
    "AED": 0.98      
};

function initApp() {
    console.log("🦅 تم تشغيل محرك متجر الرعدي أونلاين المربوط بسحابة MongoDB...");
    loadGlobalStoreSettingsFromStorage();
    applyDynamicStoreIdentity();
    fetchProductsFromDatabase(); 
    generateMockCustomersData();
}

function handleAuth(event) {
    event.preventDefault();
    const identityInput = document.getElementById('auth-identity').value.trim();
    const passwordInput = document.getElementById('auth-password').value;
    const loginErrorBox = document.getElementById('login-error-msg');
    const loginCard = document.querySelector('.auth-card');

    // 👑 دخول المدير
    if (identityInput === "alradi@gmail.com" && passwordInput === "admin123") {
        loggedInUserSession.identity = identityInput;
        loggedInUserSession.role = "admin";
        loggedInUserSession.name = "المدير العام للمتجر";
        
        // 🎵 تشغيل نغمة ترحيبية فخمة جاهزة من الإنترنت
        new Audio('https://assets.mixkit.co/active_storage/sfx/2018/2018-84.wav').play();

        loginErrorBox.style.display = "none";
        document.getElementById('login-screen').style.display = "none";
        document.getElementById('main-store-app').style.display = "block";
        document.getElementById('admin-shortcut-btn').style.display = "flex"; 
        
        document.getElementById('admin-display-email').innerText = identityInput;
        refreshAdminDashboardAnalytics();
        return;
    }

    // 👤 دخول العميل (أبو يزن / الرعدي)
    if (identityInput.length >= 4 && passwordInput.length >= 4) {
        loggedInUserSession.identity = identityInput;
        loggedInUserSession.role = "client";
        loggedInUserSession.name = identityInput.split('@')[0];
        
        // 🎵 تشغيل نغمة ترحيبية فخمة جاهزة من الإنترنت
        new Audio('https://assets.mixkit.co/active_storage/sfx/2018/2018-84.wav').play();

        loginErrorBox.style.display = "none";
        document.getElementById('login-screen').style.display = "none";
        document.getElementById('main-store-app').style.display = "block";
        document.getElementById('admin-shortcut-btn').style.display = "none";
        
        loadClientInvoicesFromStorage();
        return;
    }

    loginCard.classList.add('shake-animation');
    loginErrorBox.style.display = "block";
    loginErrorBox.innerText = "عذراً! البيانات المدخلة غير متطابقة مع سجلات الرعدي المشفرة.";
    
    setTimeout(() => { loginCard.classList.remove('shake-animation'); }, 400);
}

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

async function fetchProductsFromDatabase() {
    try {
        const response = await fetch('/api/products');
        allProductsArray = await response.json();

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

        renderProductsCatalogView();
        renderCategoriesCrescentNavigation();
    } catch (err) {
        console.error("❌ فشل جلب المنتجات السحابية:", err);
    }
}

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

function formatPriceWithActiveCurrency(priceInSAR) {
    const convertedPrice = priceInSAR * currencyExchangeRates[appActiveCurrency];
    return `${convertedPrice.toFixed(2)} ${appActiveCurrency}`;
}

function updateCurrencyAndPrices() {
    appActiveCurrency = document.getElementById('global-currency').value;
    renderProductsCatalogView(); 
    updateCartPanelTotalsUI(); 
}

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
    document.getElementById('site-title-tag').innerText = `${currentStoreName} | سوق الفخامة الدولي`;
    document.getElementById('login-store-name').innerText = currentStoreName;
    document.getElementById('store-name-current').innerText = currentStoreName;
    document.getElementById('invoice-store-title-text').innerText = currentStoreName;

    document.getElementById('login-logo').src = currentStoreLogo;
    document.getElementById('store-logo-current').src = currentStoreLogo;
    document.getElementById('invoice-logo-img').src = currentStoreLogo;
    document.getElementById('admin-current-avatar').src = currentStoreLogo;
    
    document.getElementById('invoice-legal-text-content').innerText = globalReturnPolicy;
}

async function saveInvoiceToClientArchive(invoiceObj) {
    let clientArchive = JSON.parse(localStorage.getItem(`archive_${loggedInUserSession.identity}`)) || [];
    clientArchive.push(invoiceObj);
    localStorage.setItem(`archive_${loggedInUserSession.identity}`, JSON.stringify(clientArchive));
    
    try {
        await fetch('/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                invoiceId: invoiceObj.invoiceId,
                date: invoiceObj.date,
                clientName: loggedInUserSession.name,
                clientIdentity: loggedInUserSession.identity,
                address: document.getElementById('checkout-address').value.trim(),
                logisticsType: document.getElementById('checkout-shipping-method').value,
                paymentType: document.getElementById('checkout-payment-method').value,
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
    rebuildClientInvoicesTableUI();
}

let mockCustomersArray = [];
function generateMockCustomersData() {
    mockCustomersArray = [
        { name: "أبو يزن الرعدي الفاضل", identity: "alradi.store@gmail.com", joined: "2026/01/10", ordersCount: 15 },
        { name: "الشيخ خالد بن عبد الله", identity: "khaled.uae@gmail.com", joined: "2026/03/15", ordersCount: 5 },
        { name: "المهندس أحمد السعودي", identity: "ahmed.sa@hotmail.com", joined: "2026/05/01", ordersCount: 2 }
    ];
}
