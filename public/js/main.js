// =============================================
// متجر الرعدي أون لاين - alradi-online
// الملف الرئيسي للتفاعلات
// =============================================

// ================ المتغيرات العامة ================
let cart = [];
let cartCount = 0;
let currentLanguage = 'ar';
let isDarkMode = false;
let currentGridView = 3;
let currentSort = 'newest';
let wishlistItems = [];

// ================ عند تحميل الصفحة ================
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
    
    const sounds = {
        'addToCart': storeSettings.voiceAddToCartFile || '/audio/add-to-cart.mp3',
        'save': storeSettings.voiceSaveFile || '/audio/save.mp3',
        'print': storeSettings.voicePrintFile || '/audio/print.mp3',
        'sort': storeSettings.voiceSortFile || '/audio/sort.mp3',
        'notification': storeSettings.voiceNotificationFile || '/audio/notification.mp3',
        'success': storeSettings.voiceSuccessFile || '/audio/success.mp3',
        'error': storeSettings.voiceErrorFile || '/audio/error.mp3',
        'welcome': storeSettings.voiceGreetingFile || '/audio/welcome.mp3'
    };
    
    const audioFile = sounds[soundType];
    if (audioFile) {
        try {
            const audio = new Audio(audioFile);
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch (e) {}
    }
}

function initVoiceGreeting() {
    const greetingPlayed = sessionStorage.getItem('voiceGreetingPlayed');
    if (!greetingPlayed && storeSettings && storeSettings.voiceGreetingEnabled) {
        setTimeout(() => {
            playSound('welcome');
            sessionStorage.setItem('voiceGreetingPlayed', 'true');
        }, 1500);
    }
}

// =============================================
// السلة
// =============================================

async function addToCart(productId, quantity = 1, options = {}) {
    try {
        const response = await fetch('/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, quantity, options })
        });
        
        const data = await response.json();
        
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
    } catch (error) {
        console.error('خطأ في إضافة المنتج للسلة:', error);
        showToast('حدث خطأ في إضافة المنتج', 'error');
    }
}

async function updateCartItem(productId, quantity, optionsKey = '{}') {
    try {
        const response = await fetch('/cart/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, quantity, optionsKey })
        });
        
        const data = await response.json();
        
        if (data.success) {
            cart = data.cart;
            cartCount = data.cartCount;
            updateCartUI();
            updateCartTotals(data.subtotal, data.shippingCost, data.total);
        }
        
        return data;
    } catch (error) {
        console.error('خطأ في تحديث السلة:', error);
    }
}

async function removeFromCart(productId, optionsKey = '{}') {
    try {
        const response = await fetch('/cart/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, optionsKey })
        });
        
        const data = await response.json();
        
        if (data.success) {
            cart = data.cart;
            cartCount = data.cartCount;
            updateCartUI();
            updateCartTotals(data.subtotal, data.shippingCost, data.total);
            showToast('تم إزالة المنتج من السلة', 'success');
        }
        
        return data;
    } catch (error) {
        console.error('خطأ في إزالة المنتج:', error);
    }
}

async function clearCart() {
    try {
        const response = await fetch('/cart/clear', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            cart = [];
            cartCount = 0;
            updateCartUI();
            updateCartTotals(0, 0, 0);
            showToast('تم تفريغ السلة', 'success');
        }
    } catch (error) {
        console.error('خطأ في تفريغ السلة:', error);
    }
}

function updateCartUI() {
    const cartCountElements = document.querySelectorAll('.cart-count-badge, .badge-count');
    cartCountElements.forEach(el => {
        el.textContent = cartCount;
        el.style.display = cartCount > 0 ? 'flex' : 'none';
    });
}

function updateCartTotals(subtotal, shippingCost, total) {
    const subtotalEl = document.getElementById('cart-subtotal');
    const shippingEl = document.getElementById('cart-shipping');
    const totalEl = document.getElementById('cart-total');
    
    if (subtotalEl) subtotalEl.textContent = subtotal + ' ر.س';
    if (shippingEl) shippingEl.textContent = shippingCost + ' ر.س';
    if (totalEl) totalEl.textContent = total + ' ر.س';
}

function loadCart() {
    fetch('/cart/api/cart-data')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                cart = data.cart || [];
                cartCount = data.cartCount || 0;
                updateCartUI();
            }
        })
        .catch(() => {});
}

// =============================================
// المفضلة
// =============================================

async function toggleWishlist(productId) {
    try {
        const response = await fetch(`/products/${productId}/wishlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.requireLogin) {
            window.location.href = '/auth/login';
            return;
        }
        
        if (data.success) {
            if (data.inWishlist) {
                if (!wishlistItems.includes(productId)) {
                    wishlistItems.push(productId);
                }
                showToast('تمت إضافة المنتج إلى المفضلة ❤️', 'success');
            } else {
                wishlistItems = wishlistItems.filter(id => id !== productId);
                showToast('تم إزالة المنتج من المفضلة', 'info');
            }
            updateWishlistUI();
            playSound('save');
        }
        
        return data;
    } catch (error) {
        console.error('خطأ في تحديث المفضلة:', error);
    }
}

function updateWishlistUI() {
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
        const productId = btn.dataset.productId;
        if (wishlistItems.includes(productId)) {
            btn.classList.add('in-wishlist');
            btn.innerHTML = '<i class="fas fa-heart"></i>';
        } else {
            btn.classList.remove('in-wishlist');
            btn.innerHTML = '<i class="far fa-heart"></i>';
        }
    });
}

function loadWishlist() {
    const wishlistBtns = document.querySelectorAll('.wishlist-btn.in-wishlist');
    wishlistBtns.forEach(btn => {
        if (btn.dataset.productId) {
            wishlistItems.push(btn.dataset.productId);
        }
    });
}

// =============================================
// اللغة
// =============================================

function initLanguage() {
    const langSwitcher = document.getElementById('language-switcher');
    if (langSwitcher) {
        langSwitcher.addEventListener('click', function(e) {
            e.preventDefault();
            const newLang = currentLanguage === 'ar' ? 'en' : 'ar';
            switchLanguage(newLang);
        });
    }
    
    const htmlLang = document.documentElement.lang || 'ar';
    currentLanguage = htmlLang;
}

function switchLanguage(lang) {
    window.location.href = `/switch-language/${lang}`;
}

// =============================================
// الوضع الليلي
// =============================================

function initDarkMode() {
    const darkModeCookie = getCookie('darkMode');
    if (darkModeCookie === 'true') {
        isDarkMode = true;
        document.body.classList.add('dark-mode');
    }
    
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
}

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.cookie = `darkMode=${isDarkMode}; path=/; max-age=${365 * 24 * 60 * 60}`;
}

// =============================================
// القائمة الجانبية للموبايل
// =============================================

function initMobileMenu() {
    const toggleBtn = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    
    if (toggleBtn && mainNav) {
        toggleBtn.addEventListener('click', function() {
            mainNav.classList.toggle('open');
            const icon = toggleBtn.querySelector('i');
            if (mainNav.classList.contains('open')) {
                icon.className = 'fas fa-times';
            } else {
                icon.className = 'fas fa-bars';
            }
        });
        
        document.addEventListener('click', function(e) {
            if (!mainNav.contains(e.target) && !toggleBtn.contains(e.target)) {
                mainNav.classList.remove('open');
                const icon = toggleBtn.querySelector('i');
                if (icon) icon.className = 'fas fa-bars';
            }
        });
    }
}

// =============================================
// شريط البحث
// =============================================

function initSearchBar() {
    const searchForm = document.querySelector('.search-bar');
    if (searchForm) {
        const searchInput = searchForm.querySelector('input');
        const searchBtn = searchForm.querySelector('button');
        
        searchBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `/search?q=${encodeURIComponent(query)}`;
            }
        });
        
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (query) {
                    window.location.href = `/search?q=${encodeURIComponent(query)}`;
                }
            }
        });
    }
}

// =============================================
// أدوات التحكم بالشبكة
// =============================================

function initGridControls() {
    const gridBtns = document.querySelectorAll('.grid-btn');
    const productsGrid = document.querySelector('.products-grid');
    
    if (gridBtns.length > 0 && productsGrid) {
        gridBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const cols = parseInt(this.dataset.cols);
                if (cols) {
                    setGridView(cols);
                    gridBtns.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                }
            });
        });
    }
}

function setGridView(cols) {
    currentGridView = cols;
    const productsGrid = document.querySelector('.products-grid');
    if (productsGrid) {
        productsGrid.className = productsGrid.className.replace(/cols-\d+/g, '');
        productsGrid.classList.add(`cols-${cols}`);
    }
    localStorage.setItem('gridView', cols);
}

// =============================================
// أدوات الترتيب
// =============================================

function initSortControls() {
    const sortSelect = document.querySelector('.sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            currentSort = this.value;
            playSound('sort');
            const url = new URL(window.location);
            url.searchParams.set('sort', currentSort);
            window.location.href = url.toString();
        });
    }
}

// =============================================
// أزرار الكمية
// =============================================

function initQuantityButtons() {
    document.querySelectorAll('.quantity-selector').forEach(selector => {
        const minusBtn = selector.querySelector('.quantity-btn.minus');
        const plusBtn = selector.querySelector('.quantity-btn.plus');
        const input = selector.querySelector('.quantity-input');
        
        if (minusBtn && plusBtn && input) {
            const min = parseInt(input.min) || 1;
            const max = parseInt(input.max) || 99;
            
            minusBtn.addEventListener('click', function() {
                let value = parseInt(input.value);
                if (value > min) {
                    input.value = value - 1;
                    input.dispatchEvent(new Event('change'));
                }
            });
            
            plusBtn.addEventListener('click', function() {
                let value = parseInt(input.value);
                if (value < max) {
                    input.value = value + 1;
                    input.dispatchEvent(new Event('change'));
                }
            });
            
            input.addEventListener('change', function() {
                let value = parseInt(this.value);
                if (isNaN(value) || value < min) this.value = min;
                if (value > max) this.value = max;
            });
        }
    });
}

// =============================================
// أزرار الإضافة للسلة
// =============================================

function initAddToCartButtons() {
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            
            const productId = this.dataset.productId;
            const quantityInput = document.querySelector(`.quantity-input[data-product-id="${productId}"]`);
            const quantity = quantityInput ? parseInt(quantityInput.value) : 1;
            
            // جمع الخيارات المحددة
            const options = {};
            document.querySelectorAll(`.option-value.selected[data-product-id="${productId}"]`).forEach(opt => {
                const group = opt.dataset.optionGroup;
                const value = opt.dataset.optionValue;
                if (!options[group]) options[group] = [];
                options[group].push(value);
            });
            
            if (!productId) {
                showToast('المنتج غير محدد', 'error');
                return;
            }
            
            // تأثير تحميل على الزر
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإضافة...';
            this.disabled = true;
            
            const result = await addToCart(productId, quantity, options);
            
            // استعادة الزر
            this.innerHTML = originalText;
            this.disabled = false;
            
            if (result && result.success) {
                // تأثير ارتداد للسلة
                const cartIcon = document.querySelector('.header-icon.cart-icon');
                if (cartIcon) {
                    cartIcon.classList.add('animate-pulse');
                    setTimeout(() => cartIcon.classList.remove('animate-pulse'), 1000);
                }
            }
        });
    });
}

// =============================================
// أزرار المفضلة
// =============================================

function initWishlistButtons() {
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            const productId = this.dataset.productId;
            
            if (!productId) return;
            
            const result = await toggleWishlist(productId);
            
            if (result && result.success) {
                this.classList.toggle('in-wishlist', result.inWishlist);
            }
        });
    });
}

// =============================================
// البانر الترويجي
// =============================================

function initPromoBanner() {
    const closeBtn = document.querySelector('.promo-banner .close-banner');
    const banner = document.querySelector('.promo-banner');
    
    if (closeBtn && banner) {
        closeBtn.addEventListener('click', function() {
            banner.style.display = 'none';
            sessionStorage.setItem('promoBannerClosed', 'true');
        });
        
        if (sessionStorage.getItem('promoBannerClosed') === 'true') {
            banner.style.display = 'none';
        }
    }
}

// =============================================
// تحميل الصور الكسول
// =============================================

function initLazyImages() {
    if ('IntersectionObserver' in window) {
        const lazyImages = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        lazyImages.forEach(img => imageObserver.observe(img));
    } else {
        document.querySelectorAll('img[data-src]').forEach(img => {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        });
    }
}

// =============================================
// التمرير السلس
// =============================================

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// =============================================
// زر العودة للأعلى
// =============================================

function initBackToTop() {
    const backToTopBtn = document.createElement('button');
    backToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTopBtn.className = 'back-to-top';
    backToTopBtn.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 30px;
        width: 45px;
        height: 45px;
        border-radius: 50%;
        background: var(--secondary-color);
        color: white;
        border: none;
        cursor: pointer;
        font-size: 18px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        display: none;
        z-index: 999;
        transition: all 0.3s ease;
    `;
    
    document.body.appendChild(backToTopBtn);
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 500) {
            backToTopBtn.style.display = 'block';
            backToTopBtn.style.animation = 'fadeIn 0.3s ease';
        } else {
            backToTopBtn.style.display = 'none';
        }
    });
    
    backToTopBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    backToTopBtn.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-5px)';
    });
    
    backToTopBtn.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
}

// =============================================
// الهيدر عند التمرير
// =============================================

function initHeaderScroll() {
    const header = document.querySelector('.main-header');
    if (header) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 100) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }
}

// =============================================
// التولتيب
// =============================================

function initTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(el => {
        el.addEventListener('mouseenter', function() {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = this.dataset.tooltip;
            tooltip.style.cssText = `
                position: absolute;
                background: var(--primary-color);
                color: white;
                padding: 5px 12px;
                border-radius: 5px;
                font-size: 12px;
                white-space: nowrap;
                z-index: 1000;
                pointer-events: none;
            `;
            
            document.body.appendChild(tooltip);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.top = (rect.top - tooltip.offsetHeight - 5) + 'px';
            tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
            
            this._tooltip = tooltip;
        });
        
        el.addEventListener('mouseleave', function() {
            if (this._tooltip) {
                this._tooltip.remove();
                this._tooltip = null;
            }
        });
    });
}

// =============================================
// التحقق من النماذج
// =============================================

function initFormValidation() {
    document.querySelectorAll('form[data-validate]').forEach(form => {
        form.addEventListener('submit', function(e) {
            let isValid = true;
            
            this.querySelectorAll('[required]').forEach(input => {
                if (!input.value.trim()) {
                    isValid = false;
                    input.classList.add('error');
                    
                    const errorMsg = document.createElement('span');
                    errorMsg.className = 'field-error';
                    errorMsg.textContent = 'هذا الحقل مطلوب';
                    errorMsg.style.cssText = 'color: var(--danger-color); font-size: 12px; margin-top: 5px; display: block;';
                    
                    if (!input.nextElementSibling || !input.nextElementSibling.classList.contains('field-error')) {
                        input.parentNode.appendChild(errorMsg);
                    }
                } else {
                    input.classList.remove('error');
                    const errorMsg = input.parentNode.querySelector('.field-error');
                    if (errorMsg) errorMsg.remove();
                }
            });
            
            // التحقق من البريد الإلكتروني
            const emailInput = this.querySelector('input[type="email"]');
            if (emailInput && emailInput.value.trim()) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(emailInput.value.trim())) {
                    isValid = false;
                    emailInput.classList.add('error');
                    showToast('يرجى إدخال بريد إلكتروني صحيح', 'error');
                }
            }
            
            if (!isValid) {
                e.preventDefault();
                showToast('يرجى تصحيح الأخطاء في النموذج', 'error');
            }
        });
    });
}

// =============================================
// الإشعارات (Toast)
// =============================================

function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">
            ${type === 'success' ? '<i class="fas fa-check-circle"></i>' : 
              type === 'error' ? '<i class="fas fa-times-circle"></i>' : 
              type === 'warning' ? '<i class="fas fa-exclamation-triangle"></i>' : 
              '<i class="fas fa-info-circle"></i>'}
        </span>
        <span class="toast-message">${message}</span>
        <button class="toast-close">&times;</button>
    `;
    
    toast.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        background: ${type === 'success' ? 'var(--success-color)' : 
                      type === 'error' ? 'var(--danger-color)' : 
                      type === 'warning' ? 'var(--warning-color)' : 'var(--info-color)'};
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        margin-bottom: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        animation: slideInRight 0.3s ease;
        font-size: 14px;
        min-width: 280px;
        max-width: 450px;
    `;
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.style.animation = 'slideInLeft 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    });
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'slideInLeft 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    `;
    document.body.appendChild(container);
    return container;
}

// =============================================
// الكوكيز
// =============================================

function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
}

// =============================================
// المحادثة المباشرة
// =============================================

function initChat(conversationId) {
    const socket = io();
    
    socket.on('connect', () => {
        socket.emit('user-join', {
            userId: currentUserId || 'visitor',
            name: currentUserName || 'زائر',
            role: currentUserRole || 'customer'
        });
    });
    
    socket.on('new-message', (message) => {
        if (message.conversationId === conversationId) {
            appendMessage(message);
        }
        playSound('notification');
    });
    
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    
    if (chatForm && chatInput) {
        chatForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const content = chatInput.value.trim();
            
            if (content) {
                socket.emit('send-message', {
                    content,
                    conversationId,
                    recipientSocketId: null
                });
                chatInput.value = '';
            }
        });
    }
}

function appendMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const isOwn = message.senderId === (currentUserId || 'visitor');
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${isOwn ? 'own-message' : ''}`;
    messageEl.innerHTML = `
        <div class="message-bubble">
            <div class="message-sender">${message.senderName}</div>
            <div class="message-content">${message.content}</div>
            <div class="message-time">${new Date(message.timestamp || Date.now()).toLocaleTimeString('ar-SA')}</div>
        </div>
    `;
    
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// =============================================
// دوال مساعدة
// =============================================

function formatPrice(price, currency = 'ر.س') {
    return price.toFixed(2) + ' ' + currency;
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// =============================================
// تصدير الدوال للاستخدام العام
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
window.formatPrice = formatPrice;
