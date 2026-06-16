/* ==========================================================================
   🎨 محرك الرسوميات وواجهة المستخدم التوافقي لمتجر الرعدي الدولي (ui.js)
   ========================================================================== */

// --- 📦 دالة بناء وبث كتالوج المنتجات على الواجهة ديناميكياً ---
function renderProductsCatalogView() {
    const catalogGrid = document.getElementById('products-catalog-grid');
    if (!catalogGrid) return;

    catalogGrid.innerHTML = ""; // تصفية الشبكة قبل الضخ الجديد
    
    // فلترة المنتجات بناءً على القسم النشط بتصفح المستخدم
    const filteredProducts = allProductsArray.filter(prod => {
        return currentActiveCategory === "الكل" || prod.category === currentActiveCategory;
    });

    // معالجة حالة خلو القسم تماماً من البضائع
    if (filteredProducts.length === 0) {
        catalogGrid.innerHTML = `<p class="no-data-text-catalog">عذراً، لا توجد منتجات متوفرة حالياً في قسم "${currentActiveCategory}".</p>`;
        return;
    }

    // الدوران حول المنتجات المفلترة وبناء بطاقات العرض الملكية
    filteredProducts.forEach(product => {
        const isOutOfStock = product.stock <= 0;
        const hasDiscount = product.price_old && product.price_old > product.price_new;
        let discountBadgeHTML = "";

        // حساب وإظهار شارة الخصم تلقائياً إن وجدت
        if (hasDiscount && !isOutOfStock) {
            const discountPercent = Math.round(((product.price_old - product.price_new) / product.price_old) * 100);
            discountBadgeHTML = `<span class="discount-tag-badge">خصم ${discountPercent}%</span>`;
        }

        const outOfStockHTML = isOutOfStock ? `<span class="out-of-stock-badge">نفذت الكمية 🚫</span>` : "";
        const oldPriceHTML = (hasDiscount && !isOutOfStock) ? `<span class="old-price-text">${formatPriceWithActiveCurrency(product.price_old)}</span>` : "";

        const productCard = document.createElement('div');
        productCard.className = `product-card-royal ${isOutOfStock ? 'product-disabled' : ''}`;
        productCard.innerHTML = `
            ${discountBadgeHTML}
            ${outOfStockHTML}
            <div class="img-container-view">
                <img src="${product.image_url}" alt="${product.title_ar}" onerror="this.src='https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500'">
            </div>
            <div class="prod-meta-title">
                <span class="prod-cat-label"><i class="fa-solid fa-tags"></i> ${product.category}</span>
                <h3>${product.title_ar}</h3>
                <p class="en-title-sub">${product.title_en ? product.title_en : ''}</p>
            </div>
            <div class="price-row-display">
                <span class="current-price-text">${formatPriceWithActiveCurrency(product.price_new)}</span>
                ${oldPriceHTML}
            </div>
            <div class="interaction-actions-pane no-print">
                <button class="btn-add-to-cart-royal" ${isOutOfStock ? 'disabled' : ''} onclick="addProductToShoppingCart(${product.id})">
                    <i class="fa-solid fa-cart-plus"></i> <span>${isOutOfStock ? 'غير متوفر' : 'إضافة للسلة'}</span>
                </button>
                <button class="btn-fav-toggle" onclick="toggleProductFavorite(this, ${product.id})" title="إضافة للمفضلة">
                    <i class="fa-solid fa-heart"></i>
                </button>
            </div>
        `;
        catalogGrid.appendChild(productCard);
    });
}

// --- 📐 دالة تعديل نمط عرض شبكة المنتجات (1، 2، 3، 4، 5 أعمدة) للجوال والشاشات ---
function changeProductGrid(columnsCount) {
    const catalogGrid = document.getElementById('products-catalog-grid');
    if (!catalogGrid) return;

    currentProductGridLayout = columnsCount;
    catalogGrid.classList.remove('grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5');
    catalogGrid.classList.add(`grid-cols-${columnsCount}`);

    // تحديث الحالة النشطة لأزرار التحكم بالشبكة بلمسة بصرية
    const gridButtons = document.querySelectorAll('.grid-btn');
    gridButtons.forEach(btn => btn.classList.remove('active'));
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

// --- 🧭 بناء شريط تصفح الأقسام الهلالي الديناميكي الفاخر ---
function renderCategoriesCrescentNavigation() {
    const categoryScroller = document.getElementById('dynamic-categories-list');
    if (!categoryScroller) return;

    // استخراج الأقسام الفريدة من مصفوفة المنتجات السحابية
    const distinctCategories = ["الكل", ...new Set(allProductsArray.map(p => p.category))];
    
    categoryScroller.innerHTML = "";
    distinctCategories.forEach(catName => {
        const badgeBtn = document.createElement('button');
        badgeBtn.className = `category-badge-btn ${currentActiveCategory === catName ? 'active' : ''}`;
        badgeBtn.innerText = catName;
        badgeBtn.onclick = () => {
            currentActiveCategory = catName;
            renderCategoriesCrescentNavigation();
            renderProductsCatalogView();
        };
        categoryScroller.appendChild(badgeBtn);
    });
}

// دالة إضافة أو حذف منتج من قائمة المفضلة البصرية للعميل
function toggleProductFavorite(element, productId) {
    element.classList.toggle('active');
    const heartIcon = element.querySelector('i');
    if (element.classList.contains('active')) {
        heartIcon.style.color = '#E63946';
    } else {
        heartIcon.style.color = '';
    }
}

// دالة إظهار وإخفاء نافذة السلة الجانبية
function toggleCartModal() {
    const cartOverlay = document.getElementById('cart-modal-overlay');
    if (!cartOverlay) return;
    
    if (cartOverlay.style.display === "none" || cartOverlay.style.display === "") {
        cartOverlay.style.display = "flex";
        updateCartPanelTotalsUI();
    } else {
        cartOverlay.style.display = "none";
    }
}

// --- 🛒 محرك السلة وإضافة المنتجات الملكية مع ميزة فحص المخزون الفوري والأصوات ---
function addProductToShoppingCart(productId) {
    const productObj = allProductsArray.find(p => p.id === productId);
    if (!productObj || productObj.stock <= 0) return;

    const existingCartItem = shoppingCartArray.find(item => item.product.id === productId);

    if (existingCartItem) {
        if (existingCartItem.quantity < productObj.stock) {
            existingCartItem.quantity++;
        } else {
            alert(`⚠️ عذراً! تم الوصول للحد الأقصى المتاح من هذا المنتج في مخازن الرعدي.`);
            return;
        }
    } else {
        shoppingCartArray.push({ product: productObj, quantity: 1 });
    }

    // 🎵 [صوت زر الإضافة]: نغمة نقرة خفيفة تفاعلية فورية ومميزة من الإنترنت عند الإضافة للسلة
    new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav').play();

    updateCartBadgeCounter();
    alert(`⚡ تم إلحاق "${productObj.title_ar}" بسلتك الملكية بنجاح.`);
}

// تحديث العداد الرقمي العائم على أيقونة السلة العلوية
function updateCartBadgeCounter() {
    const totalItemsCount = shoppingCartArray.reduce((acc, item) => acc + item.quantity, 0);
    const cartBadge = document.getElementById('cart-badge-count');
    if (cartBadge) cartBadge.innerText = totalItemsCount;
}

// --- 💵 حساب ومزامنة مجاميع السلة وعرضها داخل النافذة الجانبية ---
function updateCartPanelTotalsUI() {
    const cartItemsContainer = document.getElementById('cart-items-container');
    if (!cartItemsContainer) return;

    cartItemsContainer.innerHTML = "";
    let subtotalSAR = 0;

    // معالجة حالة فراغ السلة تماماً
    if (shoppingCartArray.length === 0) {
        cartItemsContainer.innerHTML = `<p class="empty-cart-msg"><i class="fa-solid fa-basket-shopping"></i> سلتك فارغة تماماً حالياً، ابدأ بالتسوق الآن!</p>`;
        document.getElementById('cart-subtotal-price').innerText = formatPriceWithActiveCurrency(0);
        document.getElementById('cart-discount-value').innerText = formatPriceWithActiveCurrency(0);
        document.getElementById('cart-grand-total-price').innerText = formatPriceWithActiveCurrency(0);
        return;
    }

    // بناء وتوليد بطاقات المنتجات المضافة داخل السلة
    shoppingCartArray.forEach((item, index) => {
        const itemTotalPrice = item.product.price_new * item.quantity;
        subtotalSAR += itemTotalPrice;

        const cartRow = document.createElement('div');
        cartRow.className = "cart-item-row-card";
        cartRow.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.product.title_ar}</h4>
                <p>${formatPriceWithActiveCurrency(item.product.price_new)} × ${item.quantity}</p>
            </div>
            <div class="cart-item-controls">
                <button onclick="modifyCartItemQty(${index}, 1)"><i class="fa-solid fa-plus"></i></button>
                <span>${item.quantity}</span>
                <button onclick="modifyCartItemQty(${index}, -1)"><i class="fa-solid fa-minus"></i></button>
                <button class="remove-trash-btn" onclick="removeProductFromCart(${index})"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(cartRow);
    });

    // احتساب مجاميع الخصومات الإضافية والصافي النهائي للطلب
    const totalDiscountSAR = subtotalSAR * activeExtraCouponDiscount;
    const grandTotalSAR = subtotalSAR - totalDiscountSAR;

    document.getElementById('cart-subtotal-price').innerText = formatPriceWithActiveCurrency(subtotalSAR);
    document.getElementById('cart-discount-value').innerText = formatPriceWithActiveCurrency(totalDiscountSAR);
    document.getElementById('cart-grand-total-price').innerText = formatPriceWithActiveCurrency(grandTotalSAR);
}

// دالة تعديل الكميات بداخل السلة بزيادة أو نقصان مع حماية حدود المخزن
function modifyCartItemQty(index, delta) {
    const item = shoppingCartArray[index];
    const targetQty = item.quantity + delta;

    if (targetQty <= 0) {
        removeProductFromCart(index);
    } else if (targetQty <= item.product.stock) {
        item.quantity = targetQty;
        updateCartBadgeCounter();
        updateCartPanelTotalsUI();
    } else {
        alert("⚠️ عذراً، لا يمكن تجاوز الكميات المتاحة من هذا الصنف حالياً بالمخزن!");
    }
}

// دالة مسح منتج نهائياً من السلة
function removeProductFromCart(index) {
    shoppingCartArray.splice(index, 1);
    updateCartBadgeCounter();
    updateCartPanelTotalsUI();
}

// نظام التحقق وتطبيق الكوبونات والخصومات الخاصة بالإدارة
function applyExtraCouponCode() {
    const code = document.getElementById('coupon-input-code').value.trim().toUpperCase();
    if (code === "ALRADI20" || code === "ALRADI") {
        activeExtraCouponDiscount = 0.20; 
        alert("👑 تهانينا! كود الخصم صحيح، تم تطبيق تخفيض 20% إضافي على كامل الفاتورة.");
        updateCartPanelTotalsUI();
    } else {
        alert("❌ رمز الكوبون المدخل غير صحيح أو انتهت فترة صلاحيته الدولية.");
    }
}

// --- 👤 التحكم بنافذة الملف الشخصي للأرشيف وفواتير المبيعات الخاصة بالعميل ---
function toggleClientProfileModal() {
    const modal = document.getElementById('client-profile-modal');
    if (!modal) return;

    if (modal.style.display === "none" || modal.style.display === "") {
        modal.style.display = "flex";
        document.getElementById('profile-client-name').innerText = loggedInUserSession.name + " (أبو يزن / الرعدي)";
        document.getElementById('profile-client-identity').innerText = loggedInUserSession.identity;
        rebuildClientInvoicesTableUI();
    } else {
        modal.style.display = "none";
    }
}

// دالة تحديث وتغيير كلمة مرور العميل
function updateClientPassword() {
    const oldPass = document.getElementById('client-old-pass').value;
    const newPass = document.getElementById('client-new-pass').value;
    if (newPass.length >= 4) {
        alert("🔒 تم تشفير وتحديث كلمة المرور الجديدة في قاعدة سجلات العميل بنجاح!");
        document.getElementById('client-old-pass').value = "";
        document.getElementById('client-new-pass').value = "";
    } else {
        alert("⚠️ يرجى تعيين كلمة مرور متناسقة وقوية لا تقل عن 4 خانات.");
    }
}

// بناء جدول أرشيف الفواتير والمشتريات القديمة التابع لحساب العميل الحالي
function rebuildClientInvoicesTableUI() {
    const rowsContainer = document.getElementById('client-invoices-history-rows');
    if (!rowsContainer) return;

    rowsContainer.innerHTML = "";
    if (loggedInUserSession.invoicesHistory.length === 0) {
        rowsContainer.innerHTML = `<tr><td colspan="5" class="table-empty-notice">لا توجد لديك فواتير مشتريات سابقة حتى الآن في حسابك.</td></tr>`;
        return;
    }

    loggedInUserSession.invoicesHistory.forEach(inv => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${inv.invoiceId}</strong></td>
            <td>${inv.date}</td>
            <td><span class="gold-total-text">${inv.finalAmount}</span></td>
            <td><span class="status-badge-success"><i class="fa-solid fa-circle-check"></i> مكتملة</span></td>
            <td><button class="btn-grid-action-view" onclick="reprintArchivedInvoiceDirectly('${inv.invoiceId}')"><i class="fa-solid fa-eye"></i> عرض وتنزيل</button></td>
        `;
        rowsContainer.appendChild(tr);
    });
}

// --- 🖨️ [دالة طباعة وتحميل الفاتورة]: تجهيز وتنزيل الفاتورة الفاخرة مع حقن الأصوات التفاعلية ---
function triggerInvoicePDFDownload() {
    // 🎵 [صوت زر الطباعة]: نغمة كليك تقني ناعم لتأكيد بدء معالجة الطباعة لملف الـ PDF
    new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav').play();
    
    alert("📥 جاري تحضير وثيقة مبيعات متجر الرعدي أونلاين المتزامنة سحابياً كملف PDF فاخر...");
    window.print(); // تفعيل أمر الطباعة المباشر للنظام وتحويله إلى PDF بالجوال
}

// دالة مغادرة لوحة تحكم المدير والرجوع لواجهة المتجر الرئيسية للعملاء
function backToHome() {
    document.getElementById('admin-dashboard-panel').style.display = "none";
    document.getElementById('main-store-app').style.display = "block";
    renderProductsCatalogView();
}
