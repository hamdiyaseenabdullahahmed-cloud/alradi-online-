// =============================================
// متجر الرعدي أون لاين - alradi-online
// الملف الرئيسي للتفاعلات
// =============================================

let cart = [];
let cartCount = 0;
let currentLanguage = 'ar';
let isDarkMode = false;
let currentGridView = 3;
let wishlistItems = [];

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    loadCart();
    loadWishlist();
    initLanguage();
    initDarkMode();
    initMobileMenu();
    initSearchBar();
    initGridControls();
    initSortControls();
    initQuantityButtons();
    initAddToCartButtons();
    initWishlistButtons();
    initPromoBanner();
    initLazyImages();
    initSmoothScroll();
    initBackToTop();
    initVoiceGreeting();
    initTooltips();
    initFormValidation();
    initHeaderScroll();
}

// =============================================
// الصوتيات
// =============================================

function playSound(soundType) {
    if (!storeSettings || !storeSettings.voiceInteractionsEnabled) return;
    var sounds = {
        'addToCart': '/audio/add-to-cart.mp3',
        'save': '/audio/save.mp3',
        'print': '/audio/print.mp3',
        'sort': '/audio/sort.mp3',
        'notification': '/audio/notification.mp3',
        'success': '/audio/success.mp3',
        'error': '/audio/error.mp3',
        'welcome': '/audio/welcome.mp3'
    };
    var audioFile = sounds[soundType];
    if (audioFile) {
        try {
            var audio = new Audio(audioFile);
            audio.volume = 0.5;
            audio.play().catch(function() {});
        } catch (e) {}
    }
}

function initVoiceGreeting() {
    var greetingPlayed = sessionStorage.getItem('voiceGreetingPlayed');
    if (!greetingPlayed && storeSettings && storeSettings.voiceGreetingEnabled) {
        setTimeout(function() {
            playSound('welcome');
            sessionStorage.setItem('voiceGreetingPlayed', 'true');
        }, 1500);
    }
}

// =============================================
// السلة
// =============================================

function addToCart(productId, quantity, options) {
    quantity = quantity || 1;
    options = options || {};
    
    return fetch('/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: productId, quantity: quantity, options: options })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            cart = data.cart;
            cartCount = data.cartCount;
            updateCartUI();
            playSound('addToCart');
            showToast('تمت إضافة المنتج إلى السلة', 'success');
        } else {
            showToast(data.message || 'حدث خطأ', 'error');
        }
        return data;
    })
    .catch(function(error) {
        console.error('خطأ:', error);
        showToast('حدث خطأ في إضافة المنتج', 'error');
    });
}

function updateCartItem(productId, quantity, optionsKey) {
    optionsKey = optionsKey || '{}';
    return fetch('/cart/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: productId, quantity: quantity, optionsKey: optionsKey })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            cart = data.cart;
            cartCount = data.cartCount;
            updateCartUI();
            updateCartTotals(data.subtotal, data.shippingCost, data.total);
        }
        return data;
    });
}

function removeFromCart(productId, optionsKey) {
    optionsKey = optionsKey || '{}';
    return fetch('/cart/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: productId, optionsKey: optionsKey })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            cart = data.cart;
            cartCount = data.cartCount;
            updateCartUI();
            updateCartTotals(data.subtotal, data.shippingCost, data.total);
            showToast('تم إزالة المنتج من السلة', 'success');
        }
        return data;
    });
}

function clearCart() {
    return fetch('/cart/clear', { method: 'POST' })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            cart = [];
            cartCount = 0;
            updateCartUI();
            updateCartTotals(0, 0, 0);
            showToast('تم تفريغ السلة', 'success');
        }
    });
}

function updateCartUI() {
    var cartCountElements = document.querySelectorAll('.cart-count-badge, .badge-count');
    cartCountElements.forEach(function(el) {
        el.textContent = cartCount;
        el.style.display = cartCount > 0 ? 'flex' : 'none';
    });
}

function updateCartTotals(subtotal, shippingCost, total) {
    var subtotalEl = document.getElementById('cart-subtotal');
    var shippingEl = document.getElementById('cart-shipping');
    var totalEl = document.getElementById('cart-total');
    if (subtotalEl) subtotalEl.textContent = subtotal + ' ر.س';
    if (shippingEl) shippingEl.textContent = shippingCost + ' ر.س';
    if (totalEl) totalEl.textContent = total + ' ر.س';
}

function loadCart() {
    fetch('/cart/api/cart-data')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                cart = data.cart || [];
                cartCount = data.cartCount || 0;
                updateCartUI();
            }
        })
        .catch(function() {});
}

// =============================================
// المفضلة
// =============================================

function toggleWishlist(productId) {
    return fetch('/products/' + productId + '/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.requireLogin) {
            window.location.href = '/auth/login';
            return;
        }
        if (data.success) {
            if (data.inWishlist) {
                if (wishlistItems.indexOf(productId) === -1) wishlistItems.push(productId);
                showToast('تمت إضافة المنتج إلى المفضلة ❤️', 'success');
            } else {
                wishlistItems = wishlistItems.filter(function(id) { return id !== productId; });
                showToast('تم إزالة المنتج من المفضلة', 'info');
            }
            updateWishlistUI();
            playSound('save');
        }
        return data;
    });
}

function updateWishlistUI() {
    document.querySelectorAll('.wishlist-btn').forEach(function(btn) {
        var productId = btn.dataset.productId;
        if (wishlistItems.indexOf(productId) !== -1) {
            btn.classList.add('in-wishlist');
            btn.innerHTML = '<i class="fas fa-heart"></i>';
        } else {
            btn.classList.remove('in-wishlist');
            btn.innerHTML = '<i class="far fa-heart"></i>';
        }
    });
}

function loadWishlist() {
    document.querySelectorAll('.wishlist-btn.in-wishlist').forEach(function(btn) {
        if (btn.dataset.productId) wishlistItems.push(btn.dataset.productId);
    });
}

// =============================================
// اللغة
// =============================================

function initLanguage() {
    var langSwitcher = document.getElementById('language-switcher');
    if (langSwitcher) {
        langSwitcher.addEventListener('click', function(e) {
            e.preventDefault();
            var newLang = currentLanguage === 'ar' ? 'en' : 'ar';
            switchLanguage(newLang);
        });
    }
    currentLanguage = document.documentElement.lang || 'ar';
}

function switchLanguage(lang) {
    window.location.href = '/switch-language/' + lang;
}

// =============================================
// الوضع الليلي
// =============================================

function initDarkMode() {
    var darkModeCookie = getCookie('darkMode');
    if (darkModeCookie === 'true') {
        isDarkMode = true;
        document.body.classList.add('dark-mode');
    }
    var darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
}

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.cookie = 'darkMode=' + isDarkMode + '; path=/; max-age=' + (365 * 24 * 60 * 60);
}

// =============================================
// القائمة للموبايل
// =============================================

function initMobileMenu() {
    var toggleBtn = document.querySelector('.mobile-menu-toggle');
    var mainNav = document.querySelector('.main-nav');
    if (toggleBtn && mainNav) {
        toggleBtn.addEventListener('click', function() {
            mainNav.classList.toggle('open');
            var icon = toggleBtn.querySelector('i');
            icon.className = mainNav.classList.contains('open') ? 'fas fa-times' : 'fas fa-bars';
        });
    }
}

// =============================================
// شريط البحث
// =============================================

function initSearchBar() {
    var searchForm = document.querySelector('.search-bar');
    if (searchForm) {
        var searchInput = searchForm.querySelector('input');
        var searchBtn = searchForm.querySelector('button');
        var doSearch = function() {
            var query = searchInput.value.trim();
            if (query) window.location.href = '/search?q=' + encodeURIComponent(query);
        };
        searchBtn.addEventListener('click', function(e) { e.preventDefault(); doSearch(); });
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
        });
    }
}

// =============================================
// أدوات الشبكة والترتيب
// =============================================

function initGridControls() {
    document.querySelectorAll('.grid-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var cols = parseInt(this.dataset.cols);
            if (cols) {
                setGridView(cols);
                document.querySelectorAll('.grid-btn').forEach(function(b) { b.classList.remove('active'); });
                this.classList.add('active');
            }
        });
    });
}

function setGridView(cols) {
    currentGridView = cols;
    var productsGrid = document.querySelector('.products-grid');
    if (productsGrid) {
        productsGrid.className = productsGrid.className.replace(/cols-\d+/g, '');
        productsGrid.classList.add('cols-' + cols);
    }
    localStorage.setItem('gridView', cols);
}

function initSortControls() {
    var sortSelect = document.querySelector('.sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            playSound('sort');
            var url = new URL(window.location);
            url.searchParams.set('sort', this.value);
            window.location.href = url.toString();
        });
    }
}

// =============================================
// أزرار الكمية
// =============================================

function initQuantityButtons() {
    document.querySelectorAll('.quantity-selector').forEach(function(selector) {
        var minusBtn = selector.querySelector('.quantity-btn.minus');
        var plusBtn = selector.querySelector('.quantity-btn.plus');
        var input = selector.querySelector('.quantity-input');
        if (minusBtn && plusBtn && input) {
            var min = parseInt(input.min) || 1;
            var max = parseInt(input.max) || 99;
            minusBtn.addEventListener('click', function() {
                var value = parseInt(input.value);
                if (value > min) { input.value = value - 1; input.dispatchEvent(new Event('change')); }
            });
            plusBtn.addEventListener('click', function() {
                var value = parseInt(input.value);
                if (value < max) { input.value = value + 1; input.dispatchEvent(new Event('change')); }
            });
        }
    });
}

// =============================================
// أزرار الإضافة للسلة
// =============================================

function initAddToCartButtons() {
    document.querySelectorAll('.add-to-cart-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            var productId = this.dataset.productId;
            if (!productId) {
                showToast('المنتج غير محدد', 'error');
                return;
            }
            var originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإضافة...';
            this.disabled = true;
            
            addToCart(productId, 1, {}).then(function(result) {
                btn.innerHTML = originalText;
                btn.disabled = false;
                if (result && result.success) {
                    var cartIcon = document.querySelector('.header-icon.cart-icon');
                    if (cartIcon) {
                        cartIcon.classList.add('animate-pulse');
                        setTimeout(function() { cartIcon.classList.remove('animate-pulse'); }, 1000);
                    }
                }
            });
        });
    });
}

// =============================================
// أزرار المفضلة
// =============================================

function initWishlistButtons() {
    document.querySelectorAll('.wishlist-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            var productId = this.dataset.productId;
            if (!productId) return;
            toggleWishlist(productId).then(function(result) {
                if (result && result.success) {
                    btn.classList.toggle('in-wishlist', result.inWishlist);
                }
            });
        });
    });
}

// =============================================
// البانر الترويجي
// =============================================

function initPromoBanner() {
    var closeBtn = document.querySelector('.promo-banner .close-banner');
    var banner = document.querySelector('.promo-banner');
    if (closeBtn && banner) {
        closeBtn.addEventListener('click', function() {
            banner.style.display = 'none';
            sessionStorage.setItem('promoBannerClosed', 'true');
        });
        if (sessionStorage.getItem('promoBannerClosed') === 'true') banner.style.display = 'none';
    }
}

// =============================================
// تحميل الصور
// =============================================

function initLazyImages() {
    if ('IntersectionObserver' in window) {
        var lazyImages = document.querySelectorAll('img[data-src]');
        var imageObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    var img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });
        lazyImages.forEach(function(img) { imageObserver.observe(img); });
    }
}

// =============================================
// التمرير وزر الأعلى
// =============================================

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            var targetId = this.getAttribute('href');
            if (targetId === '#') return;
            var target = document.querySelector(targetId);
            if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        });
    });
}

function initBackToTop() {
    var btn = document.createElement('button');
    btn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    btn.style.cssText = 'position:fixed;bottom:30px;left:30px;width:45px;height:45px;border-radius:50%;background:var(--secondary-color);color:white;border:none;cursor:pointer;font-size:18px;box-shadow:0 5px 15px rgba(0,0,0,0.3);display:none;z-index:999;';
    document.body.appendChild(btn);
    window.addEventListener('scroll', function() { btn.style.display = window.scrollY > 500 ? 'block' : 'none'; });
    btn.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); });
}

function initHeaderScroll() {
    var header = document.querySelector('.main-header');
    if (header) {
        window.addEventListener('scroll', function() { header.classList.toggle('scrolled', window.scrollY > 100); });
    }
}

// =============================================
// التولتيب
// =============================================

function initTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            var tooltip = document.createElement('div');
            tooltip.textContent = this.dataset.tooltip;
            tooltip.style.cssText = 'position:absolute;background:var(--primary-color);color:white;padding:5px 12px;border-radius:5px;font-size:12px;white-space:nowrap;z-index:1000;';
            document.body.appendChild(tooltip);
            var rect = this.getBoundingClientRect();
            tooltip.style.top = (rect.top - tooltip.offsetHeight - 5) + 'px';
            tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
            this._tooltip = tooltip;
        });
        el.addEventListener('mouseleave', function() {
            if (this._tooltip) { this._tooltip.remove(); this._tooltip = null; }
        });
    });
}

// =============================================
// التحقق من النماذج
// =============================================

function initFormValidation() {
    document.querySelectorAll('form[data-validate]').forEach(function(form) {
        form.addEventListener('submit', function(e) {
            var isValid = true;
            this.querySelectorAll('[required]').forEach(function(input) {
                if (!input.value.trim()) {
                    isValid = false;
                    input.classList.add('error');
                } else {
                    input.classList.remove('error');
                }
            });
            if (!isValid) { e.preventDefault(); showToast('يرجى ملء جميع الحقول المطلوبة', 'error'); }
        });
    });
}

// =============================================
// الإشعارات
// =============================================

function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;
    var toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = 'position:fixed;top:20px;left:20px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;';
        document.body.appendChild(toastContainer);
    }
    var colors = { success: '#28a745', error: '#dc3545', warning: '#ffc107', info: '#17a2b8' };
    var icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    var toast = document.createElement('div');
    toast.innerHTML = '<span style="margin-left:10px;"><i class="fas ' + icons[type] + '"></i></span> ' + message;
    toast.style.cssText = 'display:flex;align-items:center;background:' + colors[type] + ';color:white;padding:12px 20px;border-radius:10px;margin-bottom:10px;box-shadow:0 5px 15px rgba(0,0,0,0.2);font-size:14px;min-width:280px;';
    toastContainer.appendChild(toast);
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, duration);
}

// =============================================
// الكوكيز
// =============================================

function getCookie(name) {
    var value = '; ' + document.cookie;
    var parts = value.split('; ' + name + '=');
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
}

// =============================================
// تصدير الدوال
// =============================================

window.addToCart = addToCart;
window.updateCartItem = updateCartItem;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.toggleWishlist = toggleWishlist;
window.switchLanguage = switchLanguage;
window.toggleDarkMode = toggleDarkMode;
window.setGridView = setGridView;
window.showToast = showToast;
window.playSound = playSound;
