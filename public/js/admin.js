/* ==========================================================================
   👑 محرك غرف القيادة الإدارية وحساب الأرباح لمتجر الرعدي الدولي (admin.js)
   ========================================================================== */

// --- 🔓 فتح لوحة تحكم المدير وإخفاء الواجهة السابقة بدون تداخل ---
function openAdminDashboard() {
    if (loggedInUserSession.role !== "admin") {
        alert("🚨 حظر أمني: هذه المنطقة مخصصة لإدارة الرعدي الدولية فقط!");
        return;
    }
    document.getElementById('main-store-app').style.display = "none";
    document.getElementById('admin-dashboard-panel').style.display = "flex";
    
    // تهيئة الحقول والبيانات بشكل فوري
    switchAdminTab('analytics');
}

// --- 📑 نظام التنقل الناعم بين تبويبات لوحة المدير ---
function switchAdminTab(tabName) {
    // إخفاء كافة التبويبات أولاً لمنع أي تداخل برمي
    const tabPanes = document.querySelectorAll('.admin-tab-pane');
    tabPanes.forEach(pane => pane.style.display = "none");

    // إزالة الحالة النشطة من أزرار القائمة الجانبية
    const navLinks = document.querySelectorAll('.nav-lnk');
    navLinks.forEach(lnk => lnk.classList.remove('active'));

    // إظهار التبويب المطلوب فقط
    document.getElementById(`admin-tab-${tabName}`).style.display = "block";
    
    // تفعيل الزر برمجياً في القائمة
    event.currentTarget.classList.add('active');

    // تشغيل التحديثات التلقائية لكل قسم عند دخوله
    if (tabName === 'analytics') refreshAdminDashboardAnalytics();
    if (tabName === 'products-mgmt') rebuildAdminProductsTableUI();
    if (tabName === 'customers-mgmt') handleLiveCustomerSearch();
}

// --- 📊 نظام رصد الأرباح اليومية وإحصائيات المستهلكين (أبو يزن / الرعدي) ---
function refreshAdminDashboardAnalytics() {
    const dailyRevenueField = document.getElementById('stat-daily-revenue');
    const totalCustomersField = document.getElementById('stat-total-customers');
    const totalOrdersField = document.getElementById('stat-total-orders');

    // جلب الفواتير المسجلة في أرشيف النظام بالكامل
    const adminGlobalOrders = JSON.parse(localStorage.getItem('admin_global_orders_logs')) || [];
    
    // حساب الأرباح الإجمالية بالريال السعودي وتحويلها فوراً للعملة النشطة
    let totalRevenueSAR = adminGlobalOrders.reduce((acc, order) => acc + order.amountInSAR, 0);
    
    dailyRevenueField.innerText = formatPriceWithActiveCurrency(totalRevenueSAR);
    totalOrdersField.innerText = adminGlobalOrders.length;
    totalCustomersField.innerText = mockCustomersArray.length;

    // رصد المنتج الأكثر مبيعاً وعرضه في صندوق البطولة الملكي
    determineAndRenderTopSellingProduct(adminGlobalOrders);
}

// دالة فحص الأرباح حسب النطاق الزمني المخصص
function calculateRevenueByDateRange() {
    const start = document.getElementById('stats-start-date').value;
    const end = document.getElementById('stats-end-date').value;
    
    if(!start || !end) {
        alert("⚠️ يرجى تحديد تاريخ البداية والنهاية أولاً للفحص دقيق.");
        return;
    }

    const adminGlobalOrders = JSON.parse(localStorage.getItem('admin_global_orders_logs')) || [];
    
    // تصفية الفواتير التي تقع ضمن النطاق الزمني المحدد
    const filteredOrders = adminGlobalOrders.filter(order => {
        return order.date >= start && order.date <= end;
    });

    let rangeRevenueSAR = filteredOrders.reduce((acc, order) => acc + order.amountInSAR, 0);
    
    // تحديث شاشة العرض بالأرقام الجديدة فوراً
    document.getElementById('stat-daily-revenue').innerText = formatPriceWithActiveCurrency(rangeRevenueSAR);
    document.getElementById('stat-total-orders').innerText = filteredOrders.length;
    
    alert(`📈 تم تحديث الإحصائيات! إجمالي أرباح الفترة المحددة: ${formatPriceWithActiveCurrency(rangeRevenueSAR)}`);
}

// دالة رصد وعرض المنتج الأكثر مبيعاً (Hero Product)
function determineAndRenderTopSellingProduct(ordersArray) {
    const viewBox = document.getElementById('top-product-view-box');
    if(!viewBox) return;

    if(ordersArray.length === 0) {
        viewBox.innerHTML = `<p class="no-data-text">لم يتم تسجيل عمليات شراء بعد لتحديد البطل الحالي.</p>`;
        return;
    }

    // احتساب تكرار المنتجات في الفواتير
    let productCounts = {};
    ordersArray.forEach(order => {
        order.items.forEach(item => {
            productCounts[item.title] = (productCounts[item.title] || 0) + item.qty;
        });
    });

    // العثور على الاسم الأكثر تكراراً ومبيعاً
    let topProductName = Object.keys(productCounts).reduce((a, b) => productCounts[a] > productCounts[b] ? a : b);

    viewBox.innerHTML = `
        <div class="top-selling-badge-card">
            <div class="crown-icon"><i class="fa-solid fa-gem"></i></div>
            <div class="meta">
                <h4>${topProductName}</h4>
                <p>إجمالي الوحدات المباعة دولياً: <span class="gold-text-highlight">${productCounts[topProductName]} قطعة</span></p>
            </div>
        </div>
    `;
}

// --- ➕ إضافة وحقن المنتجات الجديدة من قبل المدير باللغتين وعمل الخصم المباشر ---
function handleProductSubmission(event) {
    event.preventDefault();

    const titleAr = document.getElementById('prod-name-ar').value.trim();
    const titleEn = document.getElementById('prod-name-en').value.trim();
    const category = document.getElementById('prod-category-select').value;
    const priceNew = parseFloat(document.getElementById('prod-price-new').value);
    const priceOldInput = document.getElementById('prod-price-old').value;
    const priceOld = priceOldInput ? parseFloat(priceOldInput) : priceNew;
    const stock = parseInt(document.getElementById('prod-stock-count').value);
    const imageUrl = document.getElementById('prod-image-url').value.trim();
    const description = document.getElementById('prod-description').value.trim();

    // بناء كائن المنتج الملكي الجديد
    const newProductObj = {
        id: Date.now(), // توليد رقم تعريفي فريد لحظي
        title_ar: titleAr,
        title_en: titleEn,
        category: category,
        price_new: priceNew,
        price_old: priceOld,
        stock: stock,
        image_url: imageUrl,
        description: description
    };

    // حفظ المنتج في الذاكرة المحلية السحابية للمتجر
    let storedAdminProducts = JSON.parse(localStorage.getItem('admin_added_products')) || [];
    storedAdminProducts.push(newProductObj);
    localStorage.setItem('admin_added_products', JSON.stringify(storedAdminProducts));

    // تصفير الاستمارة وإعادة إنعاش البيانات في المتجر تلقائياً
    document.getElementById('admin-product-form').reset();
    document.getElementById('prod-discount-calculated').value = "0%";
    
    fetchProductsFromDatabase(); // تحديث فوري للموقع والكتالوج
    rebuildAdminProductsTableUI(); // تحديث جدول المدير
    
    alert(`🎉 تم بنجاح حقن وتعميم المنتج الفاخر "${titleAr}" وعرضه للعملاء الآن!`);
}

// دالة عرض وتدوير المنتجات في جدول المدير مع خيارات الحذف والتعديل
function rebuildAdminProductsTableUI() {
    const tableBody = document.getElementById('admin-products-list-rows');
    if(!tableBody) return;

    tableBody.innerHTML = "";
    allProductsArray.forEach(product => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${product.image_url}" class="admin-table-thumb-img"></td>
            <td><strong>${product.title_ar}</strong></td>
            <td><span class="table-cat-badge">${product.category}</span></td>
            <td><span class="gold-total-text">${formatPriceWithActiveCurrency(product.price_new)}</span></td>
            <td>${product.stock} ق</td>
            <td>${product.stock > 0 ? '<span class="stock-ok">متوفر ✅</span>' : '<span class="stock-out">نفذت الكمية 🚫</span>'}</td>
            <td>
                <button class="btn-delete-prod" onclick="deleteProductFromSystem(${product.id})"><i class="fa-solid fa-trash-can"></i> حذف</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function deleteProductFromSystem(productId) {
    if(confirm("❗ هل أنت متأكد تماماً من رغبتك في سحب وإلغاء هذا المنتج من واجهات متجر الرعدي؟")) {
        let storedAdminProducts = JSON.parse(localStorage.getItem('admin_added_products')) || [];
        // فلترة وحذف المنتج المطلوبة
        storedAdminProducts = storedAdminProducts.filter(p => p.id !== productId);
        localStorage.setItem('admin_added_products', JSON.stringify(storedAdminProducts));

        fetchProductsFromDatabase();
        rebuildAdminProductsTableUI();
    }
}

// --- 🔍 محرك البحث الفوري والسري عن بيانات وفواتير العملاء (أبو يزن / الرعدي) ---
function handleLiveCustomerSearch() {
    const searchKey = document.getElementById('search-customer-input').value.toLowerCase().trim();
    const rowsContainer = document.getElementById('admin-customers-list-rows');
    if(!rowsContainer) return;

    rowsContainer.innerHTML = "";

    // فلترة المستهلكين بناءً على مدخلات المدير اللحظية
    const filteredCustomers = mockCustomersArray.filter(cust => {
        return cust.name.toLowerCase().includes(searchKey) || cust.identity.toLowerCase().includes(searchKey);
    });

    if(filteredCustomers.length === 0) {
        rowsContainer.innerHTML = `<tr><td colspan="5" class="table-empty-notice">لا يوجد أي عميل مسجل يطابق معايير البحث الحالية.</td></tr>`;
        return;
    }

    filteredCustomers.forEach(cust => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${cust.name}</strong></td>
            <td><span class="client-id-tag">${cust.identity}</span></td>
            <td>${cust.joined}</td>
            <td>${cust.ordersCount} فواتير المبيعات</td>
            <td>
                <button class="btn-grid-action-view" onclick="alert('👤 العميل: ${cust.name}\\n📧 الهوية: ${cust.identity}\\n💳 مستوى الثقة: عميل دولي مميز الملكي 🦅')"><i class="fa-solid fa-circle-info"></i> معاينة الحساب</button>
            </td>
        `;
        rowsContainer.appendChild(tr);
    });
}

// --- 📑 المعالجة المتكاملة لتوليد وإتمام طلب الشراء وتصدير الفاتورة الرسمية (Checkout) ---
function processFinalOrderCheckout() {
    if (shoppingCartArray.length === 0) {
        alert("⚠️ سلتك الملكية فارغة! يرجى إضافة المنتجات أولاً لإصدار وثيقة المبيعات.");
        return;
    }

    const shippingAddress = document.getElementById('checkout-address').value.trim();
    if (shippingAddress.length < 8) {
        alert("📍 عذراً الفاضل! يرجى كتابة عنوان الشحن الدولي بالتفصيل (الدولة، المدينة، الشارع) لتأمين النقل.");
        return;
    }

    // استخراج حسابات الإجمالي النهائي والخصومات لضخها في الفاتورة
    let subtotalSAR = 0;
    let itemsInvoiceRowsHTML = "";

    shoppingCartArray.forEach((item, index) => {
        const rowTotalSAR = item.product.price_new * item.quantity;
        subtotalSAR += rowTotalSAR;

        itemsInvoiceRowsHTML += `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${item.product.title_ar}</strong><br><small>${item.product.title_en ? item.product.title_en : ''}</small></td>
                <td>${item.quantity}</td>
                <td>${formatPriceWithActiveCurrency(item.product.price_new)}</td>
                <td><strong>${formatPriceWithActiveCurrency(rowTotalSAR)}</strong></td>
            </tr>
        `;
        
        // تحديث المخزون برمجياً وتلقائياً ونفاد الكمية فور الشراء!
        item.product.stock -= item.quantity;
    });

    const totalDiscountSAR = subtotalSAR * activeExtraCouponDiscount;
    const grandTotalSAR = subtotalSAR - totalDiscountSAR;

    const uniqueInvoiceNumber = `RAD-${Math.floor(100000 + Math.random() * 900000)}`;
    const todayDateStr = new Date().toLocaleDateString('ar-YE');

    // حقن البيانات والسطور بداخل كود واجهة الفاتورة (index.html) برمجياً وبدون تداخل
    document.getElementById('inv-meta-id').innerText = `#${uniqueInvoiceNumber}`;
    document.getElementById('inv-meta-date').innerText = todayDateStr;
    document.getElementById('inv-cust-name').innerText = loggedInUserSession.name + " (أبو يزن / الرعدي المعتمد)";
    document.getElementById('inv-cust-phone').innerText = loggedInUserSession.identity;
    document.getElementById('inv-cust-address').innerText = shippingAddress;

    document.getElementById('inv-logistics-type').innerText = document.getElementById('checkout-shipping-method').value;
    document.getElementById('inv-payment-type').innerText = document.getElementById('checkout-payment-method').value;
    document.getElementById('inv-currency-type').innerText = document.getElementById('global-currency').options[document.getElementById('global-currency').selectedIndex].text;

    document.getElementById('invoice-table-rows-injector').innerHTML = itemsInvoiceRowsHTML;
    
    document.getElementById('inv-summary-subtotal').innerText = formatPriceWithActiveCurrency(subtotalSAR);
    document.getElementById('inv-summary-discount').innerText = formatPriceWithActiveCurrency(totalDiscountSAR);
    document.getElementById('inv-summary-grandtotal').innerText = formatPriceWithActiveCurrency(grandTotalSAR);

    // تجهيز كائن الفاتورة لحفظه في أرشيف العميل وبوابة المدير معاً
    const finalInvoiceObject = {
        invoiceId: uniqueInvoiceNumber,
        date: todayDateStr,
        finalAmount: formatPriceWithActiveCurrency(grandTotalSAR),
        amountInSAR: grandTotalSAR,
        items: shoppingCartArray.map(i => ({ title: i.product.title_ar, qty: i.quantity }))
    };

    saveInvoiceToClientArchive(finalInvoiceObject);
    
    // إخفاء نافذة السلة وفتح واجهة الفاتورة الكبرى الفاخرة فوراً
    document.getElementById('cart-modal-overlay').style.display = "none";
    document.getElementById('invoice-modal-overlay').style.display = "flex";

    // تفعيل وتأمين لوحة التوقيع الإلكتروني الحية للمستلم
    initSignatureCanvasPad();
}

// دالة تفعيل الكانفاس لتوقيع العميل يدوياً على الشاشة
let sigCanvas, sigCtx, isDrawingSig = false;
function initSignatureCanvasPad() {
    sigCanvas = document.getElementById('invoice-signature-pad');
    if(!sigCanvas) return;
    sigCtx = sigCanvas.getContext('2d');
    sigCtx.strokeStyle = "#121212";
    sigCtx.lineWidth = 2;

    sigCanvas.onmousedown = (e) => { isDrawingSig = true; sigCtx.moveTo(e.offsetX, e.offsetY); };
    sigCanvas.onmousemove = (e) => { if(isDrawingSig) { sigCtx.lineTo(e.offsetX, e.offsetY); sigCtx.stroke(); } };
    window.onmouseup = () => { isDrawingSig = false; };
}

function clearSignatureCanvas() {
    if(sigCanvas && sigCtx) {
        sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
        sigCtx.beginPath();
    }
}

// تحميل وحفظ الفاتورة كملف PDF سحابي متكامل
function triggerInvoicePDFDownload() {
    alert("📥 جاري تحضير التشفير السحابي وتحميل وثيقة مبيعات متجر الرعدي الدولي كملف PDF الفاخر...");
    window.print(); // تفعيل الطباعة والحفظ المتكامل المتوافق مع المتصفحات والأجهزة
}

// دالة إغلاق الفاتورة وتصفير السلة بالكامل للبدء بعملية جديدة فريدة
function closeInvoiceAndResetCart() {
    shoppingCartArray = [];
    activeExtraCouponDiscount = 0;
    document.getElementById('coupon-input-code').value = "";
    document.getElementById('checkout-address').value = "";
    
    updateCartBadgeCounter();
    document.getElementById('invoice-modal-overlay').style.display = "none";
    
    // إعادة فرز وعرض تحديثات المخزون المتأثرة بالشراء فوراً
    renderProductsCatalogView();
}

function logoutAdminSystem() {
    loggedInUserSession = { identity: null, role: "client", name: "عميل الرعدي الدولي", invoicesHistory: [] };
    document.getElementById('admin-dashboard-panel').style.display = "none";
    document.getElementById('main-store-app').style.display = "none";
    document.getElementById('login-screen').style.display = "flex";
    document.getElementById('authForm').reset();
}
