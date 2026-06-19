// =======================================================
// متجر الرعدي أون لاين (Al-Radi Online) - مسارات المنتجات المبرمجة
// الهندسة التطويرية الفاخرة والأمان العالي
// =======================================================

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const StoreSettings = require('../models/StoreSettings');

// =======================================================
// صفحة جميع المنتجات (البحث، الفلترة، والترتيب المتقدم)
// =======================================================
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const sort = req.query.sort || 'newest';
        const category = req.query.category || '';
        const minPrice = parseFloat(req.query.minPrice) || 0;
        const maxPrice = parseFloat(req.query.maxPrice) || 0;
        const inStock = req.query.inStock === 'true';
        const onSale = req.query.onSale === 'true';
        const featured = req.query.featured === 'true';
        const search = req.query.q || '';

        const searchOptions = {
            page, limit, sort, category,
            minPrice: minPrice || null,
            maxPrice: maxPrice || null,
            inStock, onSale, featured
        };

        const [result, categories, storeSettings] = await Promise.all([
            Product.search(search || null, searchOptions).catch(() => ({ products: [], pagination: { total: 0, page, pages: 1 } })),
            Category.getMainCategories().catch(() => []),
            StoreSettings.getSettings().catch(() => ({ storeName: 'متجر الرعدي أون لاين' }))
        ]);

        res.render('products/index', {
            pageTitle: 'جميع المنتجات',
            products: result.products,
            categories,
            pagination: result.pagination,
            sort,
            filters: { category, minPrice, maxPrice, inStock, onSale, featured, search },
            storeSettings,
            currencySymbol: 'ر.س',
            totalProducts: result.pagination.total,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });

    } catch (error) {
        console.error('❌ خطأ في صفحة المنتجات:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل المنتجات');
        res.redirect('/');
    }
});

// =======================================================
// صفحة تفاصيل المنتج (مع تأمين كامل ضد StrictPopulateError)
// =======================================================
router.get('/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        let product;

        try {
            product = await Product.findOne({ slug }).populate({ path: 'category', select: 'name nameEn slug', options: { strictPopulate: false } });
            
            if (!product && slug.match(/^[0-9a-fA-F]{24}$/)) {
                product = await Product.findById(slug).populate({ path: 'category', select: 'name nameEn slug', options: { strictPopulate: false } });
            }
        } catch (populateError) {
            console.warn('⚠️ تنبيه: تم تفعيل خطة التراجع لـ populate:', populateError.message);
            product = await Product.findOne({ slug }) || (slug.match(/^[0-9a-fA-F]{24}$/) ? await Product.findById(slug) : null);
        }

        if (!product || !product.isActive || product.isHidden) {
            return res.status(404).render('404', {
                pageTitle: 'المنتج غير موجود',
                path: req.url
            });
        }

        Product.findByIdAndUpdate(product._id, { $inc: { views: 1 } }).catch(err => console.error('خطأ تحديث المشاهدات:', err));

        const categoryId = product.category ? product.category._id : null;
        const relatedProducts = categoryId ? await Product.find({
            category: categoryId,
            _id: { $ne: product._id },
            isActive: true,
            isHidden: false
        })
        .sort({ 'rating.average': -1, createdAt: -1 })
        .limit(8)
        .select('name nameEn price comparePrice images rating isOnSale stockStatus slug')
        .lean() : [];

        const storeSettings = await StoreSettings.getSettings().catch(() => ({}));

        const safeProductData = typeof product.getPublicData === 'function' ? product.getPublicData() : product;

        res.render('products/detail', {
            pageTitle: product.name,
            product: safeProductData,
            productFull: product,
            relatedProducts,
            reviews: product.reviews ? product.reviews.filter(r => r.isApproved) : [],
            storeSettings,
            currencySymbol: 'ر.س',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });

    } catch (error) {
        console.error('❌ خطأ في صفحة تفاصيل المنتج:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل بيانات المنتج');
        res.redirect('/products');
    }
});

// =======================================================
// صفحة الأقسام والتصنيفات
// =======================================================
router.get('/category/:slug', async (req, res) => {
    try {
        const category = await Category.findBySlug(req.params.slug);
        
        if (!category) {
            req.flash('error_msg', 'القسم المطلوب غير متوفر حالياً');
            return res.redirect('/products');
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        
        const [result, subCategories, allCategories] = await Promise.all([
            category.getProducts({ page, limit }).catch(() => ({ products: [], pagination: {} })),
            category.getChildren().catch(() => []),
            Category.getMainCategories().catch(() => [])
        ]);

        res.render('products/category', {
            pageTitle: category.name,
            category,
            subCategories,
            allCategories,
            products: result.products,
            pagination: result.pagination,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });

    } catch (error) {
        console.error('❌ خطأ في صفحة القسم:', error);
        req.flash('error_msg', 'حدث خطأ أثناء معالجة بيانات الأقسام');
        res.redirect('/products');
    }
});

// =======================================================
// نظام إضافة التقييمات الآمن للمنتجات
// =======================================================
router.post('/:id/review', async (req, res) => {
    try {
        if (!req.session.user) {
            req.flash('error_msg', 'يرجى تسجيل الدخول أولاً لإضافة تقييمك');
            return res.redirect('/auth/login');
        }

        const { rating, title, comment } = req.body;
        const product = await Product.findById(req.params.id);

        if (!product) {
            req.flash('error_msg', 'عذراً، هذا المنتج لم يعد متاحاً للتقييم');
            return res.redirect('/products');
        }

        product.reviews.push({
            user: req.session.user._id,
            name: req.session.user.name,
            rating: Math.min(5, Math.max(1, parseInt(rating) || 5)),
            title: title ? title.trim() : '',
            comment: comment ? comment.trim() : '',
            isApproved: true,
            createdAt: new Date()
        });

        await product.save();
        if (typeof product.updateRating === 'function') {
            await product.updateRating();
        }

        req.flash('success_msg', 'تم إضافة تقييمك بنجاح ✅');
        res.redirect('back');

    } catch (error) {
        console.error('❌ خطأ في إضافة التقييم:', error);
        req.flash('error_msg', 'فشل حفظ التقييم، يرجى المحاولة مرة أخرى');
        res.redirect('back');
    }
});

// =======================================================
// محرك المفضلة الذكي والـ AJAX API
// =======================================================
router.post('/:id/wishlist', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول للوصول لقائمة الأمنيات', requireLogin: true });
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'المنتج غير موجود في قاعدة البيانات' });
        }

        const User = require('../models/User');
        const user = await User.findById(req.session.user._id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'حساب المستخدم غير موجود' });
        }

        const isInWishlist = user.wishlist.includes(product._id);

        if (isInWishlist) {
            user.wishlist.pull(product._id);
            product.wishlistCount = Math.max(0, (product.wishlistCount || 1) - 1);
            
            await Promise.all([user.save(), product.save()]);
            return res.json({ success: true, inWishlist: false, message: 'تم إزالة المنتج من المفضلة بنجاح' });
        } else {
            user.wishlist.push(product._id);
            product.wishlistCount = (product.wishlistCount || 0) + 1;
            
            await Promise.all([user.save(), product.save()]);
            return res.json({ success: true, inWishlist: true, message: 'تمت إضافة المنتج إلى قائمة أمنياتك ❤️' });
        }

    } catch (error) {
        console.error('❌ خطأ في محرك المفضلة:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ برمجي داخلي في نظام المفضلة' });
    }
});

module.exports = router;
