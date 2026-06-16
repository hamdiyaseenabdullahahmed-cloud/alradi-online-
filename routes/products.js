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
        const view = req.query.view || 'grid';
        const gridColumns = parseInt(req.query.grid) || 3;
        const showAll = req.query.showAll === 'true';
        
        const category = req.query.category || '';
        const minPrice = parseFloat(req.query.minPrice) || 0;
        const maxPrice = parseFloat(req.query.maxPrice) || 0;
        const inStock = req.query.inStock === 'true';
        const onSale = req.query.onSale === 'true';
        const featured = req.query.featured === 'true';
        const brand = req.query.brand || '';
        const search = req.query.q || '';
        const rating = parseInt(req.query.rating) || 0;
        
        // بناء خيارات البحث
        const searchOptions = {
            page: showAll ? 1 : page,
            limit: showAll ? 1000 : limit,
            sort,
            category,
            minPrice: minPrice || null,
            maxPrice: maxPrice || null,
            inStock,
            onSale,
            featured
        };
        
        // جلب البيانات بالتوازي
        const [
            result,
            categories,
            storeSettings,
            allBrands
        ] = await Promise.all([
            Product.search(search || null, searchOptions),
            Category.getMainCategories(),
            StoreSettings.getSettings(),
            Product.distinct('brand', { isActive: true, brand: { $ne: '' } })
        ]);
        
        // تصفية حسب العلامة التجارية
        let products = result.products;
        if (brand) {
            products = products.filter(p => p.brand === brand);
        }
        
        // تصفية حسب التقييم
        if (rating > 0) {
            products = products.filter(p => p.rating.average >= rating);
        }
        
        // ترتيب إضافي للعميل
        if (sort === 'price-asc') {
            products.sort((a, b) => a.getFinalPrice() - b.getFinalPrice());
        } else if (sort === 'price-desc') {
            products.sort((a, b) => b.getFinalPrice() - a.getFinalPrice());
        } else if (sort === 'rating') {
            products.sort((a, b) => b.rating.average - a.rating.average);
        } else if (sort === 'sales') {
            products.sort((a, b) => b.sales - a.sales);
        }
        
        // تجهيز نطاق الأسعار للفلاتر
        const priceRange = await Product.aggregate([
            { $match: { isActive: true, isHidden: false } },
            {
                $group: {
                    _id: null,
                    minPrice: { $min: '$price' },
                    maxPrice: { $max: '$price' }
                }
            }
        ]);
        
        const priceStats = priceRange.length > 0 ? priceRange[0] : { minPrice: 0, maxPrice: 1000 };
        
        // الحصول على التصنيف الحالي
        let currentCategory = null;
        if (category) {
            currentCategory = await Category.findById(category).select('name nameEn description');
        }
        
        res.render('products/index', {
            pageTitle: currentCategory ? currentCategory.name : 'جميع المنتجات',
            products,
            categories,
            currentCategory,
            brands: allBrands,
            pagination: showAll ? { page: 1, total: products.length, pages: 1 } : result.pagination,
            sort,
            view,
            gridColumns,
            showAll,
            filters: {
                category,
                minPrice,
                maxPrice,
                inStock,
                onSale,
                featured,
                brand,
                search,
                rating
            },
            priceStats,
            storeSettings,
            currency: storeSettings.currency || 'SAR',
            currencySymbol: storeSettings.currencySymbol || 'ر.س',
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
        
        // البحث عن المنتج بالـ slug أو الـ id
        let product = await Product.findOne({ slug })
            .populate('category', 'name nameEn slug')
            .populate('relatedProducts', 'name nameEn price images slug rating');
        
        if (!product) {
            // محاولة البحث بالـ id
            if (slug.match(/^[0-9a-fA-F]{24}$/)) {
                product = await Product.findById(slug)
                    .populate('category', 'name nameEn slug')
                    .populate('relatedProducts', 'name nameEn price images slug rating');
            }
        }
        
        if (!product || !product.isActive || product.isHidden) {
            return res.status(404).render('404', {
                pageTitle: 'المنتج غير موجود',
                path: req.url
            });
        }
        
        // زيادة عدد المشاهدات
        await product.addView();
        
        // جلب المنتجات ذات الصلة
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id },
            isActive: true,
            isHidden: false
        })
        .limit(8)
        .select('name nameEn price comparePrice images rating isOnSale stockStatus slug');
        
        // جلب المراجعات المعتمدة
        const approvedReviews = product.reviews.filter(r => r.isApproved);
        
        // جلب إعدادات المتجر
        const storeSettings = await StoreSettings.getSettings();
        
        // تجهيز بيانات المنتج للعرض
        const productData = product.getPublicData();
        
        res.render('products/detail', {
            pageTitle: product.name,
            product: productData,
            productFull: product,
            relatedProducts,
            reviews: approvedReviews,
            storeSettings,
            currency: storeSettings.currency || 'SAR',
            currencySymbol: storeSettings.currencySymbol || 'ر.س',
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
        const slug = req.params.slug;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const sort = req.query.sort || 'newest';
        
        const category = await Category.findBySlug(slug);
        
        if (!category) {
            req.flash('error_msg', 'القسم غير موجود');
            return res.redirect('/products');
        }
        
        // الحصول على المنتجات في هذا القسم وأقسامه الفرعية
        const result = await category.getProducts({ page, limit, sort });
        
        // الحصول على الأقسام الفرعية
        const subCategories = await category.getChildren();
        
        // الحصول على جميع الأقسام الرئيسية للقائمة الجانبية
        const allCategories = await Category.getMainCategories();
        
        res.render('products/category', {
            pageTitle: category.name,
            category,
            subCategories,
            allCategories,
            products: result.products,
            pagination: result.pagination,
            sort,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
        
    } catch (error) {
        console.error('خطأ في صفحة القسم:', error);
        req.flash('error_msg', 'حدث خطأ في تحميل القسم');
        res.redirect('/products');
    }
});

// =============================================
// إضافة تقييم للمنتج
// =============================================

router.post('/:id/review', async (req, res) => {
    try {
        // التحقق من تسجيل الدخول
        if (!req.session.user) {
            req.flash('error_msg', 'يرجى تسجيل الدخول لإضافة تقييم');
            return res.redirect('/auth/login');
        }
        
        const { rating, title, comment } = req.body;
        const productId = req.params.id;
        
        if (!rating || rating < 1 || rating > 5) {
            req.flash('error_msg', 'يرجى اختيار تقييم من 1 إلى 5');
            return res.redirect('back');
        }
        
        const product = await Product.findById(productId);
        
        if (!product) {
            req.flash('error_msg', 'المنتج غير موجود');
            return res.redirect('/products');
        }
        
        // التحقق من عدم وجود تقييم سابق
        const existingReview = product.reviews.find(
            r => r.user && r.user.toString() === req.session.user._id.toString()
        );
        
        if (existingReview) {
            req.flash('error_msg', 'لقد قمت بتقييم هذا المنتج مسبقاً');
            return res.redirect('back');
        }
        
        // الحصول على إعدادات المتجر للتحقق من الموافقة التلقائية
        const storeSettings = await StoreSettings.getSettings();
        
        // إضافة التقييم
        product.reviews.push({
            user: req.session.user._id,
            name: req.session.user.name,
            rating: parseInt(rating),
            title: title || '',
            comment: comment || '',
            isApproved: storeSettings.reviewsAutoApprove || false,
            isVerifiedPurchase: false, // سيتم تحديثه إذا كان قد اشترى المنتج
            createdAt: new Date()
        });
        
        await product.save();
        await product.updateRating();
        
        req.flash('success_msg', storeSettings.reviewsAutoApprove 
            ? 'تم إضافة تقييمك بنجاح'
            : 'تم استلام تقييمك وسيتم نشره بعد المراجعة');
        
        res.redirect('back');
        
    } catch (error) {
        console.error('خطأ في إضافة التقييم:', error);
        req.flash('error_msg', 'حدث خطأ في إضافة التقييم');
        res.redirect('back');
    }
});

// =============================================
// تقييم مفيد (Helpful)
// =============================================

router.post('/:id/review/:reviewId/helpful', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: 'يرجى تسجيل الدخول' });
        }
        
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.json({ success: false, message: 'المنتج غير موجود' });
        }
        
        const review = product.reviews.id(req.params.reviewId);
        if (!review) {
            return res.json({ success: false, message: 'التقييم غير موجود' });
        }
        
        const userId = req.session.user._id;
        const alreadyHelpful = review.helpful.users.includes(userId);
        
        if (alreadyHelpful) {
            review.helpful.users.pull(userId);
            review.helpful.count--;
        } else {
            review.helpful.users.push(userId);
            review.helpful.count++;
        }
        
        await product.save();
        
        res.json({
            success: true,
            helpful: !alreadyHelpful,
            count: review.helpful.count
        });
        
    } catch (error) {
        console.error('خطأ في تقييم مفيد:', error);
        res.status(500).json({ success: false });
    }
});

// =============================================
// مقارنة المنتجات
// =============================================

router.get('/compare', async (req, res) => {
    try {
        const productIds = req.query.ids ? req.query.ids.split(',') : [];
        
        let products = [];
        if (productIds.length > 0) {
            products = await Product.find({
                _id: { $in: productIds },
                isActive: true
            }).select('name nameEn price comparePrice images rating specifications options');
        }
        
        res.render('products/compare', {
            pageTitle: 'مقارنة المنتجات',
            products,
            maxCompare: 4,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (error) {
        console.error('خطأ في مقارنة المنتجات:', error);
        res.redirect('/products');
    }
});

// =============================================
// إضافة/إزالة من المفضلة
// =============================================

router.post('/:id/wishlist', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ 
                success: false, 
                message: 'يرجى تسجيل الدخول',
                requireLogin: true 
            });
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
            await user.save();
            await product.save();
            product.wishlistCount = Math.max(0, product.wishlistCount - 1);
            await product.save();
            
            return res.json({
                success: true,
                inWishlist: false,
                message: 'تم إزالة المنتج من المفضلة'
            });
        } else {
            user.wishlist.push(product._id);
            await user.save();
            product.wishlistCount += 1;
            await product.save();
            
            return res.json({
                success: true,
                inWishlist: true,
                message: 'تم إضافة المنتج إلى المفضلة'
            });
        }
        
    } catch (error) {
        console.error('خطأ في المفضلة:', error);
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// API: الحصول على منتجات بتنسيق JSON
// =============================================

router.get('/api/list', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const sort = req.query.sort || '-createdAt';
        const category = req.query.category || '';
        
        const filter = { isActive: true, isHidden: false };
        if (category) filter.category = category;
        
        const skip = (page - 1) * limit;
        
        const [products, total] = await Promise.all([
            Product.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .select('name nameEn price comparePrice images rating stockStatus slug sales'),
            Product.countDocuments(filter)
        ]);
        
        res.json({
            success: true,
            products,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

// =============================================
// API: الحصول على منتج واحد
// =============================================

router.get('/api/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('category', 'name nameEn slug');
        
        if (!product || !product.isActive) {
            return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
        }
        
        res.json({
            success: true,
            product: product.getPublicData()
        });
        
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
});

module.exports = router;
