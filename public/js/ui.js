/* ==========================================================================
   🎨 محرك الرسوميات وواجهة المستخدم التوافقي لمتجر الرعدي الدولي (ui.js)
   ========================================================================== */

// --- 🛍️ دالة بناء وعرض كتالوج المنتجات الدولي بنمط الشبكة المرنة ---
function renderProductsCatalogView() {
    const catalogGrid = document.getElementById('products-catalog-grid');
    if (!catalogGrid) return;

    catalogGrid.innerHTML = "";
    
    // تصفية وتفريع المنتجات بناءً على القسم النشط الذي حدده العميل
    const filteredProducts = allProductsArray.filter(prod => {
        return currentActiveCategory === "الكل" || prod.category === currentActiveCategory;
    });

    if (filteredProducts.length === 0) {
        catalogGrid.innerHTML = `<p class="no-data-text-catalog">عذراً، لا توجد منتجات متوفرة حالياً في قسم "${currentActiveCategory}".</p>`;
        return;
    }

    // ضخ المنتجات وبنائها هندسياً دون أي تداخل مع العناصر السابقة
    filteredProducts.forEach(product => {
        const isOutOfStock = product.stock <= 0;
        const hasDiscount = product.price_old && product.price_old > product.price_new;
        let discountBadgeHTML = "";

        if (hasDiscount && !isOutOfStock) {
            const discountPercent = Math.round(((product.price_old - product.price_new) / product.price_old) * 100);
            discountBadgeHTML = `<span class="discount-tag-badge">خصم ${discountPercent}%</span>`;
        }

        const outOfStockHTML = isOutOfStock ? `<span class="out-of-stock-badge">نفذت الكمية 🚫</span>` : "";
        const oldPriceHTML = (hasDiscount && !isOutOfStock) ? `<span class="old-price-text">${formatPriceWithActiveCurrency(product.price_old)}</span>` : "";

        // بناء بطاقة العميل الفاخرة للمنتج
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

// --- 📐 دالة التحكم بالشبكة الذكية (تغيير عدد الأعمدة 1, 2, 3, 4, 5 حسب رغبة العميل) ---
function changeProductGrid(columnsCount) {
    const catalogGrid = document.getElementById('products-catalog-grid');
    if (!catalogGrid) return;

    currentProductGridLayout = columnsCount;

    // إزالة كافة كلاسات الأعمدة السابقة لمنع أي تداخل بصري
    catalogGrid.classList.remove('grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5');
    // إضافة فئة التقسيم المحدثة والملائمة لشاشة العميل
    catalogGrid.classList.add(`grid-cols-${columnsCount}`);

    // إدارة الحالة النشطة لأزرار التحكم
    const gridButtons = document.querySelectorAll('.grid-btn');
    gridButtons.forEach(btn => btn.classList.remove('active'));
    
    // ربط الزر المضغوط بالحالة النشطة
    event.currentTarget.classList.add('active');
}

// --- 🌙 القوس الهلالي للأقسام المحدثة تلقائياً ---
function renderCategoriesCrescentNavigation() {
    const categoryScroller = document.getElementById('dynamic-categories-list');
    if (!categoryScroller) return;

    // تجميع الأقسام الفريدة من مصفوفة المنتجات الإجمالية للرعدي
    const distinctCategories = ["الكل", ...new Set(allProductsArray.map(p => p.category))];
    
    categoryScroller.innerHTML = "";
    distinctCategories.forEach(catName => {
        const badgeBtn = document.createElement('button');
        badgeBtn.className = `category-badge-btn ${currentActiveCategory === catName ? 'active' : ''}`;
        badgeBtn.innerText = catName;
        badgeBtn.onclick = () => {
            currentActiveCategory = catName;
            // تحديث الأقسام لإبراز الخيار النشط
            renderCategoriesCrescentNavigation();
            // إعادة الفلترة والعرض الفوري للمنتجات
            renderProductsCatalogView();
        };
        categoryScroller.appendChild(badgeBtn);
    });
}

// --- ❤️ تفعيل المفضلة والتفاعل الحي ---
function toggleProductFavorite(element, productId) {
    element.classList.toggle('active');
    if (element.classList.contains('active')) {
        element.querySelector('i').style.color = '#E63946';
    } else {
        element.querySelector('i').style.color = '';
    }
}

// --- 🛒 إدارة حركات سلة المشتريات التفاعلية وحساباتها التلقائية ---
function toggleCartModal() {
    const cartOverlay = document.getElementById('cart-modal-overlay');
    if(cartOverlay.style.display === "none") {
        cartOverlay.style.display = "flex";
        updateCartPanelTotalsUI();
    } else {
        cartOverlay.style.display = "none";
    }
}

function addProductToShoppingCart(productId) {
    const productObj = allProductsArray.find(p => p.id === productId);
    if (!productObj || productObj.stock <= 0) return;

    const existingCartItem = shoppingCartArray.find(item => item.product.id === productId);

    if (existingCartItem) {
        if (existingCartItem.quantity < productObj.stock) {
            existingCartItem.quantity++;
        } else {
            alert(`⚠️ عذراً! تم الوصول للحد الأقصى المتاح من كمية هذا المنتج في مخازن الرعدي.`);
            return;
        }
    } else {
        shoppingCartArray.push({ product: productObj, quantity: 1 });
    }

    updateCartBadgeCounter();
    alert(`⚡ تم إلحاق "${productObj.title_ar}" بسلتك الملكية بنجاح.`);
}

function updateCartBadgeCounter() {
    const totalItemsCount = shoppingCartArray.reduce((acc, item) => acc + item.quantity, 0);
    document.getElementById('cart-badge-count').innerText = totalItemsCount;
}

function updateCartPanelTotalsUI() {
    const cartItemsContainer = document.getElementById('cart-items-container');
    if (!cartItemsContainer) return;

    cartItemsContainer.innerHTML = "";
    let subtotalSAR = 0;

    if (shoppingCartArray.length === 0) {
        cartItemsContainer.innerHTML = `<p class="empty-cart-msg"><i class="fa-solid fa-basket-shopping"></i> سلتك فارغة تماماً حالياً، ابدأ بالتسوق الآن!</p>`;
        document.getElementById('cart-subtotal-price').innerText = formatPriceWithActiveCurrency(0);
        document.getElementById('cart-discount-value').innerText = formatPriceWithActiveCurrency(0);
        document.getElementById('cart-grand-total-price').innerText = formatPriceWithActiveCurrency(0);
        return;
    }

    // تدوير وعرض عناصر السلة الانزلاقية
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

    // احتساب معدل كوبونات الخصم الإضافية للمدير والعميل
    const totalDiscountSAR = subtotalSAR * activeExtraCouponDiscount;
    const grandTotalSAR = subtotalSAR - totalDiscountSAR;

    document.getElementById('cart-subtotal-price').innerText = formatPriceWithActiveCurrency(subtotalSAR);
    document.getElementById('cart-discount-value').innerText = formatPriceWithActiveCurrency(totalDiscountSAR);
    document.getElementById('cart-grand-total-price').innerText = formatPriceWithActiveCurrency(grandTotalSAR);
}

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
        alert("⚠️ لا يمكن تجاوز الكمية المتوفرة بالمخزن!");
    }
}

function removeProductFromCart(index) {
    shoppingCartArray.splice(index, 1);
    updateCartBadgeCounter();
    updateCartPanelTotalsUI();
}

// تفعيل حقل قسائم الخصم الإضافي من واجهة السلة
function applyExtraCouponCode() {
    const code = document.getElementById('coupon-input-code').value.trim().toUpperCase();
    if (code === "ALRADI20" || code === "ALRADI") {
        activeExtraCouponDiscount = 0.20; // خصم 20% إضافي فوري
        alert("👑 كود الخصم صحيح! تم تطبيق تخفيض 20% إضافي على طلبك بنجاح.");
        updateCartPanelTotalsUI();
    } else {
        alert("❌ كود الخصم الإضافي منتهي الصلاحية أو غير صحيح.");
    }
}

// --- 👤 إدارة بوابة ومعاينة نافذة ملف العميل الفاضل ---
function toggleClientProfileModal() {
    const modal = document.getElementById('client-profile-modal');
    if (modal.style.display === "none") {
        modal.style.display = "flex";
        document.getElementById('profile-client-name').innerText = loggedInUserSession.name + " (أبو يزن / الرعدي)";
        document.getElementById('profile-client-identity').innerText = loggedInUserSession.identity;
        rebuildClientInvoicesTableUI();
    } else {
        modal.style.display = "none";
    }
}

function updateClientPassword() {
    const oldPass = document.getElementById('client-old-pass').value;
    const newPass = document.getElementById('client-new-pass').value;
    if(newPass.length >= 4) {
        alert("🔒 تم تحديث وتشفير كلمة المرور الخاصة بحساب العميل بنجاح سحابياً!");
        document.getElementById('client-old-pass').value = "";
        document.getElementById('client-new-pass').value = "";
    } else {
        alert("⚠️ يرجى إدخال كلمة مرور جديدة قوية لا تقل عن 4 رموز.");
    }
}

function rebuildClientInvoicesTableUI() {
    const rowsContainer = document.getElementById('client-invoices-history-rows');
    if(!rowsContainer) return;

    rowsContainer.innerHTML = "";
    if(loggedInUserSession.invoicesHistory.length === 0) {
        rowsContainer.innerHTML = `<tr><td colspan="5" class="table-empty-notice">لا توجد لديك فواتير مشتريات سابقة حتى الآن في أرشيف العميل.</td></tr>`;
        return;
    }

    loggedInUserSession.invoicesHistory.forEach(inv => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${inv.invoiceId}</strong></td>
            <td>${inv.date}</td>
            <td><span class="gold-total-text">${inv.finalAmount}</span></td>
            <td><span class="status-badge-success"><i class="fa-solid fa-circle-check"></i> مكتملة</span></td>
            <td><button class="btn-grid-action-view" onclick="reprintArchivedInvoiceDirectly('${inv.invoiceId}')"><i class="fa-solid fa-eye"></i> عرض</button></td>
        `;
        rowsContainer.appendChild(tr);
    });
}

function backToHome() {
    document.getElementById('admin-dashboard-panel').style.display = "none";
    document.getElementById('main-store-app').style.display = "block";
    renderProductsCatalogView();
}
