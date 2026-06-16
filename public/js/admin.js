/* ==========================================================================
   👑 محرك لوحة الإدارة، معالجة الأرباح، وصياغة الفواتير الفاخرة (admin.js)
   ========================================================================== */

// متغيرات لوحة التحكم الإدارية للأرباح والمبيعات المحدثة لحظياً
let storeTotalSalesRevenueSAR = 0;
let storeTotalOrdersCount = 0;
let storeTotalProductsCount = 0;

// --- 🎛️ نظام التنقل التبادلي بين واجهة المتجر ولوحة تحكم المدير ---
function openAdminDashboardPanel() {
    if (loggedInUserSession.role !== "admin") {
        alert("🔒 عذراً، هذه اللوحة مخصصة لإدارة الرعدي أونلاين المشفرة فقط!");
        return;
    }
    document.getElementById('main-store-app').style.display = "none";
    document.getElementById('admin-dashboard-panel').style.display = "block";
    
    refreshAdminDashboardAnalytics();
    buildAdminProductsTableUI();
}

// --- 📊 دالة تحديث الحسابات، الأرباح، والإحصائيات اللحظية للمدير ---
function refreshAdminDashboardAnalytics() {
    storeTotalProductsCount = allProductsArray.length;
    
    // حساب المبيعات من أرشيف فواتير جلسة المستخدم الحالي كنموذج فوري
    const userArchive = JSON.parse(localStorage.getItem(`archive_${loggedInUserSession.identity}`)) || [];
    storeTotalOrdersCount = userArchive.length;
    
    storeTotalSalesRevenueSAR = userArchive.reduce((sum, inv) => sum + (inv.amountInSAR || 0), 0);

    // ضخ الأرقام المحدثة في بطاقات العرض الإدارية مع تحويل العملة النشطة
    document.getElementById('stat-total-revenue').innerText = formatPriceWithActiveCurrency(storeTotalSalesRevenueSAR);
    document.getElementById('stat-total-orders').innerText = storeTotalOrdersCount;
    document.getElementById('stat-total-products').innerText = storeTotalProductsCount;
    
    buildAdminCustomersTableUI();
}

// --- 🛍️ [محرك إتمام الشراء وصياغة الفاتورة]: توليد الفاتورة الفخمة وحقن نغمة النجاح ---
function processFinalOrderCheckout() {
    if (shoppingCartArray.length === 0) {
        alert("⚠️ سلتك الملكية فارغة حالياً! لا يمكن إتمام عملية الشراء بدون منتجات.");
        return;
    }

    // 1. توليد رقم فاتورة عشوائي فريد فخم متناسق
    const generatedInvoiceId = "INV-2026-" + Math.floor(100000 + Math.random() * 900000);
    
    // 2. توثيق التاريخ والوقت الحالي بدقة بالغة
    const currentFormattedDate = new Date().toLocaleString('ar-SA', { hour12: true });

    // 3. حساب الإجماليات والمجاميع بالتفصيل بالريال السعودي
    let checkoutSubtotalSAR = shoppingCartArray.reduce((acc, item) => acc + (item.product.price_new * item.quantity), 0);
    let checkoutDiscountValueSAR = checkoutSubtotalSAR * activeExtraCouponDiscount;
    let checkoutGrandTotalSAR = checkoutSubtotalSAR - checkoutDiscountValueSAR;

    // 4. صياغة كائن الفاتورة الموحد لإرساله للأرشيف والسيرفر السحابي
    const invoiceMetadataObject = {
        invoiceId: generatedInvoiceId,
        date: currentFormattedDate,
        amountInSAR: checkoutGrandTotalSAR,
        finalAmount: formatPriceWithActiveCurrency(checkoutGrandTotalSAR),
        items: shoppingCartArray.map(item => ({
            title: item.product.title_ar,
            qty: item.quantity,
            singlePrice: formatPriceWithActiveCurrency(item.product.price_new),
            totalRowPrice: formatPriceWithActiveCurrency(item.product.price_new * item.quantity)
        }))
    };

    // 5. بناء محتوى جدول المواد والسلع بصرياً داخل قالب الفاتورة المخصص للطباعة
    const invoiceItemsTableBody = document.getElementById('invoice-items-table-body');
    if (invoiceItemsTableBody) {
        invoiceItemsTableBody.innerHTML = "";
        shoppingCartArray.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.product.title_ar}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: left;">${formatPriceWithActiveCurrency(item.product.price_new)}</td>
                <td style="text-align: left;">${formatPriceWithActiveCurrency(item.product.price_new * item.quantity)}</td>
            `;
            invoiceItemsTableBody.appendChild(tr);
        });
    }

    // 6. حقن وتحديث الأرقام الختامية والشروط القانونية بداخل لوحة الفاتورة البصرية
    document.getElementById('invoice-id-span').innerText = generatedInvoiceId;
    document.getElementById('invoice-date-span').innerText = currentFormattedDate;
    document.getElementById('invoice-client-name-span').innerText = loggedInUserSession.name;
    document.getElementById('invoice-client-identity-span').innerText = loggedInUserSession.identity;

    document.getElementById('invoice-subtotal-cost').innerText = formatPriceWithActiveCurrency(checkoutSubtotalSAR);
    document.getElementById('invoice-discount-cost').innerText = formatPriceWithActiveCurrency(checkoutDiscountValueSAR);
    document.getElementById('invoice-grand-total-cost').innerText = formatPriceWithActiveCurrency(checkoutGrandTotalSAR);
    
    // جلب نص سياسة الاستبدال والاسترجاع الشاملة وضخها
    document.getElementById('invoice-legal-text-content').innerText = globalReturnPolicy;

    // 7. حفظ وتمرير الفاتورة لمتصفح العميل وللسيرفر السحابي MongoDB
    saveInvoiceToClientArchive(invoiceMetadataObject);

    // 8. خصم الكميات المشتراة فوراً من المخزن المؤقت للحفاظ على دقة الجرد والتحديث السحابي
    shoppingCartArray.forEach(item => {
        const productInMainArray = allProductsArray.find(p => p.id === item.product.id);
        if (productInMainArray) {
            productInMainArray.stock -= item.quantity;
        }
    });

    // 🎵 [صوت النجاح والاحتفال الشامل]: نغمة تأكيد النجاح السعيدة والمبهجة فور إصدار الفاتورة وإتمام العملية
    new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav').play();

    // 9. تصفير السلة وإغلاق نوافذ الشراء المنبثقة لإتاحة عمليات تسوق جديدة
    shoppingCartArray = [];
    updateCartBadgeCounter();
    toggleCartModal();

    // 10. إظهار لوحة الفاتورة الملكية الفاخرة المجهزة بالكامل أمام العميل
    document.getElementById('invoice-view-overlay-modal').style.display = "flex";
}

// دالة إعادة طباعة وعرض فاتورة مؤرشفة قديمة مخزنة مسبقاً في أرشيف العميل
function reprintArchivedInvoiceDirectly(invoiceId) {
    const archive = JSON.parse(localStorage.getItem(`archive_${loggedInUserSession.identity}`)) || [];
    const targetedInvoice = archive.find(inv => inv.invoiceId === invoiceId);
    
    if (!targetedInvoice) {
        alert("❌ عذراً، لم نتمكن من العثور على بيانات هذه الفاتورة المحددة.");
        return;
    }

    // بناء وإعادة إحياء جدول الفاتورة القديمة
    const invoiceItemsTableBody = document.getElementById('invoice-items-table-body');
    if (invoiceItemsTableBody) {
        invoiceItemsTableBody.innerHTML = "";
        targetedInvoice.items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.title}</td>
                <td style="text-align: center;">${item.qty}</td>
                <td style="text-align: left;">${item.singlePrice}</td>
                <td style="text-align: left;">${item.totalRowPrice}</td>
            `;
            invoiceItemsTableBody.appendChild(tr);
        });
    }

    document.getElementById('invoice-id-span').innerText = targetedInvoice.invoiceId;
    document.getElementById('invoice-date-span').innerText = targetedInvoice.date;
    document.getElementById('invoice-subtotal-cost').innerText = targetedInvoice.finalAmount;
    document.getElementById('invoice-discount-cost').innerText = formatPriceWithActiveCurrency(0);
    document.getElementById('invoice-grand-total-cost').innerText = targetedInvoice.finalAmount;

    document.getElementById('client-profile-modal').style.display = "none";
    document.getElementById('invoice-view-overlay-modal').style.display = "flex";
}

// دالة إغلاق وإخفاء شاشة الفاتورة والعودة لتصفح كتالوج المتجر
function closeInvoiceModalOverlay() {
    document.getElementById('invoice-view-overlay-modal').style.display = "none";
    renderProductsCatalogView();
}

// --- 🔧 محرك إدارة المنتجات الحية وعرضها في جدول لوحة المدير ---
function buildAdminProductsTableUI() {
    const tableBody = document.getElementById('admin-products-table-rows');
    if (!tableBody) return;

    tableBody.innerHTML = "";
    allProductsArray.forEach(prod => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${prod.image_url}" class="admin-table-thumb-img" onerror="this.src='https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500'"></td>
            <td><strong>${prod.title_ar}</strong></td>
            <td><span class="category-table-badge">${prod.category}</span></td>
            <td><span class="price-table-text">${formatPriceWithActiveCurrency(prod.price_new)}</span></td>
            <td><span class="stock-table-count ${prod.stock <= 3 ? 'stock-warning' : ''}">${prod.stock} وحدة</span></td>
            <td>
                <button class="btn-table-action-delete" onclick="deleteProductFromAdminDatabase(${prod.id})"><i class="fa-solid fa-trash-can"></i> حذف</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// دالة حذف صنف منتج معين سحابياً ومحلياً بواسطة المدير
async function deleteProductFromAdminDatabase(productId) {
    if (!confirm("⚠️ هل أنت متأكد تماماً من رغبتك في حذف هذا المنتج نهائياً من سحابة MongoDB؟")) return;
    
    try {
        await fetch(`/api/products/${productId}`, { method: 'DELETE' });
        allProductsArray = allProductsArray.filter(p => p.id !== productId);
        buildAdminProductsTableUI();
        refreshAdminDashboardAnalytics();
        alert("🚀 تم حذف وإسقاط الصنف من قاعدة البيانات السحابية والمحلية بنجاح!");
    } catch (err) {
        console.error("❌ فشل حذف المنتج من خادم السحابية:", err);
    }
}

// دالة إضافة منتج جديد كلياً إلى قاعدة سجلات المتجر وسحابة MongoDB
async function createNewProductFromAdminForm(event) {
    event.preventDefault();

    const titleAr = document.getElementById('prod-title-ar').value.trim();
    const titleEn = document.getElementById('prod-title-en').value.trim();
    const category = document.getElementById('prod-category-select').value;
    const priceNew = parseFloat(document.getElementById('prod-price-new').value);
    const priceOld = parseFloat(document.getElementById('prod-price-old').value);
    const stock = parseInt(document.getElementById('prod-stock-qty').value);
    const imageUrl = document.getElementById('prod-image-url').value.trim();
    const description = document.getElementById('prod-desc').value.trim();

    // صياغة كائن المنتج الجديد بـ ID فريد مبني على بصمة الوقت
    const newProductPayload = {
        id: Date.now(),
        title_ar: titleAr,
        title_en: titleEn,
        category: category,
        price_new: priceNew,
        price_old: isNaN(priceOld) ? null : priceOld,
        stock: stock,
        image_url: imageUrl || "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500",
        description: description
    };

    // دفع وإرسال المنتج حياً إلى خادم الـ API والـ MongoDB أطلس
    try {
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProductPayload)
        });

        if (response.ok) {
            allProductsArray.push(newProductPayload);
            buildAdminProductsTableUI();
            refreshAdminDashboardAnalytics();
            
            // إعادة تهيئة وتصفير حقول النموذج بعد النجاح
            document.getElementById('admin-add-product-form').reset();
            document.getElementById('prod-discount-calculated').value = "0%";
            alert("👑 تهانينا! تم ضخ وحقن المنتج الفاخر الجديد في سحابة MongoDB بنجاح.");
        }
    } catch (err) {
        console.error("❌ فشل إرسال وحفظ المنتج الجديد بالسحابة:", err);
    }
}

// بناء وعرض جدول العملاء والمشترين الفعليين داخل لوحة المدير للتحليل
function buildAdminCustomersTableUI() {
    const tableBody = document.getElementById('admin-customers-table-rows');
    if (!tableBody) return;

    tableBody.innerHTML = "";
    mockCustomersArray.forEach(cust => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${cust.name}</strong></td>
            <td><span class="email-table-text">${cust.identity}</span></td>
            <td>${cust.joined}</td>
            <td style="text-align: center;"><span class="orders-count-badge">${cust.ordersCount} طلبية</span></td>
            <td><span class="status-badge-active"><i class="fa-solid fa-shield-halved"></i> موثق</span></td>
        `;
        tableBody.appendChild(tr);
    });
}
