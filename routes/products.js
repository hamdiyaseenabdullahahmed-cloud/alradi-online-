// =============================================
// متجر الرعدي أون لاين - alradi-online
// مسارات المنتجات والتصفح
// =============================================

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const StoreSettings = require('../models/StoreSettings');

// =============================================
// صفحة جميع المنتجات
// =============================================

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
            Product.search(search || null, searchOptions),
            Category.getMainCategories(),
            StoreSettings.getSettings()
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
        console.error('خطأ في صفحة المنتجات:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل المنتجات');
        res.redirect('/');
    }
});

// =============================================
// صفحة تفاصيل المنتج
// =============================================

router.get('/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        
        let product = await Product.findOne({ slug })
            .populate('category', 'name nameEn slug');

        if (!product && slug.match(/^[0-9a-fA-F]{24}$/)) {
            product = await Product.findById(slug)
                .populate('category', 'name nameEn slug');
        }

        if (!product || !product.isActive || product.isHidden) {
            return res.status(404).render('404', {
                pageTitle: 'المنتج غير موجود',
                path: req.url
            });
        }

        await Product.findByIdAndUpdate(product._id, { $inc: { views: 1 } });

        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id },
            isActive: true,
            isHidden: false
        })
        .limit(8)
        .select('name nameEn price comparePrice images rating isOnSale stockStatus slug');

        const storeSettings = await StoreSettings.getSettings();

        res.render('products/detail', {
            pageTitle: product.name,
            product: product.getPublicData(),
            productFull: product,
            relatedProducts,
            reviews: product.reviews.filter(r => r.isApproved),
            storeSettings,
            currencySymbol: 'ر.س',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });

    } catch (error) {
        console.error('خطأ في صفحة تفاصيل المنتج:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل المنتج');
        res.redirect('/products');
    }
});

// =============================================
// صفحة الأقسام
// =============================================

router.get('/category/:slug', async (req, res) => {
    try {
        const category = await Category.findBySlug(req.params.slug);
        
        if (!category) {
            req.flash('error_msg', 'القسم غير موجود');
            return res.redirect('/products');
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const result = await category.getProducts({ page, limit });
        const subCategories = await category.getChildren();
        const allCategories = await Category.getMainCategories();

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
        console.error('خطأ في صفحة القسم:', error);
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('/products');
    }
});

// =============================================
// إضافة تقييم
// =============================================

router.post('/:id/review', async (req, res) => {
    try {
        if (!req.session.user) {
            req.flash('error_msg', 'يرجى تسجيل الدخول');
            return res.redirect('/auth/login');
        }

        const { rating, title, comment } = req.body;
        const product = await Product.findById(req.params.id);

        if (!product) {
            req.flash('error_msg', 'المنتج غير موجود');
            return res.redirect('/products');
        }

        product.reviews.push({
            user: req.session.user._id,
            name: req.session.user.name,
            rating: parseInt(rating),
            title: title || '',
            comment: comment || '',
            isApproved: true,
            createdAt: new Date()
        });

        await product.save();
        await product.updateRating();

        req.flash('success_msg', 'تم إضافة تقييمك بنجاح ✅');
        res.redirect('back');

    } catch (error) {
        console.error('خطأ في إضافة التقييم:', error);
        req.flash('error_msg', 'حدث خطأ');
        res.redirect('back');
    }
});

// =============================================
// المفضلة
// =============================================

router.post('/:id/wishlist', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: 'يرجى تسجيل الدخول', requireLogin: true });
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.json({ success: false, message: 'المنتج غير موجود' });
        }

        const User = require('../models/User');
        const user = await User.findById(req.session.user._id);

        const isInWishlist = user.wishlist.includes(product._id);

        if (isInWishlist) {
            user.wishlist.pull(product._id);
            product.wishlistCount = Math.max(0, (product.wishlistCount || 1) - 1);
            await user.save();
            await product.save();
            return res.json({ success: true, inWishlist: false, message: 'تم إزالة المنتج من المفضلة' });
        } else {
            user.wishlist.push(product._id);
            product.wishlistCount = (product.wishlistCount || 0) + 1;
            await user.save();
            await product.save();
            return res.json({ success: true, inWishlist: true, message: 'تمت إضافة المنتج إلى المفضلة ❤️' });
        }

    } catch (error) {
        console.error('خطأ في المفضلة:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

module.exports = router;
