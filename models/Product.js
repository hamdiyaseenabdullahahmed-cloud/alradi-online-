// =============================================
// متجر الرعدي أون لاين - alradi-online
// نموذج المنتجات
// =============================================

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    
    // ========== البيانات الأساسية ==========
    name: {
        type: String,
        required: [true, 'اسم المنتج مطلوب'],
        trim: true,
        minlength: [2, 'اسم المنتج يجب أن يكون حرفين على الأقل'],
        maxlength: [200, 'اسم المنتج يجب أن لا يتجاوز 200 حرف']
    },
    nameEn: {
        type: String,
        trim: true,
        default: ''
    },
    description: {
        type: String,
        required: [true, 'وصف المنتج مطلوب'],
        minlength: [10, 'الوصف يجب أن يكون 10 أحرف على الأقل'],
        maxlength: [5000, 'الوصف يجب أن لا يتجاوز 5000 حرف']
    },
    descriptionEn: {
        type: String,
        default: ''
    },
    
    // ========== التصنيف ==========
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'القسم مطلوب']
    },
    subCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubCategory',
        default: null
    },
    brand: {
        type: String,
        default: ''
    },
    tags: [{
        type: String,
        trim: true
    }],
    
    // ========== التسعير ==========
    price: {
        type: Number,
        required: [true, 'السعر مطلوب'],
        min: [0, 'السعر يجب أن يكون أكبر من أو يساوي 0']
    },
    comparePrice: {
        type: Number,
        default: null
    },
    cost: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'SAR'
    },
    
    // ========== الخصم ==========
    discount: {
        type: {
            type: String,
            enum: ['percentage', 'fixed', 'none'],
            default: 'none'
        },
        value: {
            type: Number,
            default: 0
        },
        startDate: {
            type: Date,
            default: null
        },
        endDate: {
            type: Date,
            default: null
        },
        isActive: {
            type: Boolean,
            default: false
        }
    },
    
    // ========== المخزون ==========
    stock: {
        type: Number,
        required: [true, 'الكمية مطلوبة'],
        min: [0, 'الكمية يجب أن تكون أكبر من أو يساوي 0'],
        default: 0
    },
    sku: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        default: ''
    },
    barcode: {
        type: String,
        default: ''
    },
    lowStockThreshold: {
        type: Number,
        default: 5
    },
    isUnlimited: {
        type: Boolean,
        default: false
    },
    
    // ========== الصور ==========
    images: [{
        url: {
            type: String,
            required: true
        },
        alt: {
            type: String,
            default: ''
        },
        isMain: {
            type: Boolean,
            default: false
        },
        order: {
            type: Number,
            default: 0
        }
    }],
    
    // ========== الفيديو ==========
    videoUrl: {
        type: String,
        default: ''
    },
    
    // ========== الخيارات (ألوان، مقاسات، إلخ) ==========
    options: [{
        name: {
            type: String,
            required: true
        },
        nameEn: {
            type: String,
            default: ''
        },
        type: {
            type: String,
            enum: ['color', 'size', 'material', 'style', 'custom'],
            default: 'custom'
        },
        values: [{
            value: {
                type: String,
                required: true
            },
            valueEn: {
                type: String,
                default: ''
            },
            additionalPrice: {
                type: Number,
                default: 0
            },
            stock: {
                type: Number,
                default: 0
            },
            sku: {
                type: String,
                default: ''
            },
            colorCode: {
                type: String,
                default: ''
            },
            image: {
                type: String,
                default: ''
            }
        }]
    }],
    
    // ========== التقييمات ==========
    rating: {
        average: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        count: {
            type: Number,
            default: 0
        },
        distribution: {
            1: { type: Number, default: 0 },
            2: { type: Number, default: 0 },
            3: { type: Number, default: 0 },
            4: { type: Number, default: 0 },
            5: { type: Number, default: 0 }
        }
    },
    reviews: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        name: String,
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        title: String,
        comment: String,
        isApproved: {
            type: Boolean,
            default: false
        },
        isVerifiedPurchase: {
            type: Boolean,
            default: false
        },
        helpful: {
            count: { type: Number, default: 0 },
            users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
        },
        images: [String],
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // ========== حالة المنتج ==========
    isActive: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    isNewArrival: {
        type: Boolean,
        default: false
    },
    isBestSeller: {
        type: Boolean,
        default: false
    },
    isOnSale: {
        type: Boolean,
        default: false
    },
    isHidden: {
        type: Boolean,
        default: false
    },
    
    // ========== حالة المخزون الظاهرة ==========
    stockStatus: {
        type: String,
        enum: ['in_stock', 'low_stock', 'out_of_stock', 'pre_order'],
        default: 'in_stock'
    },
    
    // ========== الشحن ==========
    weight: {
        type: Number,
        default: 0
    },
    dimensions: {
        length: { type: Number, default: 0 },
        width: { type: Number, default: 0 },
        height: { type: Number, default: 0 }
    },
    shippingClass: {
        type: String,
        default: 'standard'
    },
    freeShipping: {
        type: Boolean,
        default: false
    },
    
    // ========== SEO ==========
    metaTitle: {
        type: String,
        default: ''
    },
    metaDescription: {
        type: String,
        default: ''
    },
    metaKeywords: {
        type: String,
        default: ''
    },
    slug: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },
    
    // ========== إحصائيات ==========
    views: {
        type: Number,
        default: 0
    },
    sales: {
        type: Number,
        default: 0
    },
    revenue: {
        type: Number,
        default: 0
    },
    wishlistCount: {
        type: Number,
        default: 0
    },
    cartAddCount: {
        type: Number,
        default: 0
    },
    
    // ========== بيانات إضافية ==========
    specifications: [{
        name: String,
        value: String
    }],
    features: [{
        title: String,
        description: String,
        icon: String
    }],
    faq: [{
        question: String,
        answer: String
    }],
    relatedProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    
    // ========== إعدادات متقدمة ==========
    minOrderQuantity: {
        type: Number,
        default: 1
    },
    maxOrderQuantity: {
        type: Number,
        default: 10
    },
    enableBackorder: {
        type: Boolean,
        default: false
    },
    backorderNote: {
        type: String,
        default: ''
    },
    customFields: [{
        name: String,
        value: mongoose.Schema.Types.Mixed
    }]
    
}, { 
    timestamps: true 
});

// =============================================
// INDEXES - الفهارس
// =============================================

productSchema.index({ name: 'text', nameEn: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ 'rating.average': -1 });
productSchema.index({ sales: -1 });
productSchema.index({ isActive: 1, isHidden: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ slug: 1 });

// =============================================
// MIDDLEWARE - تحديث حالة المخزون قبل الحفظ
// =============================================

productSchema.pre('save', function(next) {
    // تحديث حالة المخزون
    if (this.isUnlimited) {
        this.stockStatus = 'in_stock';
    } else if (this.stock <= 0) {
        this.stockStatus = 'out_of_stock';
    } else if (this.stock <= this.lowStockThreshold) {
        this.stockStatus = 'low_stock';
    } else {
        this.stockStatus = 'in_stock';
    }
    
    // تحديث حالة التخفيض
    if (this.discount && this.discount.isActive && this.discount.value > 0) {
        this.isOnSale = true;
        if (this.discount.type === 'percentage') {
            this.comparePrice = this.price;
        }
    } else {
        this.isOnSale = false;
    }
    
    // توليد slug إذا لم يكن موجوداً
    if (!this.slug && this.name) {
        this.slug = this.name
            .toString()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\u0621-\u064A0-9a-z\-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }
    
    next();
});

// =============================================
// MIDDLEWARE - تحديث التقييمات
// =============================================

productSchema.methods.updateRating = async function() {
    const reviews = this.reviews.filter(r => r.isApproved);
    
    if (reviews.length === 0) {
        this.rating.average = 0;
        this.rating.count = 0;
        this.rating.distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        return this.save();
    }
    
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    reviews.forEach(review => {
        distribution[review.rating]++;
    });
    
    this.rating.average = Math.round((totalRating / reviews.length) * 10) / 10;
    this.rating.count = reviews.length;
    this.rating.distribution = distribution;
    
    return this.save();
};

// =============================================
// METHODS - الحصول على السعر النهائي
// =============================================

productSchema.methods.getFinalPrice = function() {
    if (this.discount && this.discount.isActive) {
        const now = new Date();
        const startDate = this.discount.startDate ? new Date(this.discount.startDate) : null;
        const endDate = this.discount.endDate ? new Date(this.discount.endDate) : null;
        
        if ((!startDate || now >= startDate) && (!endDate || now <= endDate)) {
            if (this.discount.type === 'percentage') {
                return this.price - (this.price * this.discount.value / 100);
            } else if (this.discount.type === 'fixed') {
                return Math.max(0, this.price - this.discount.value);
            }
        }
    }
    return this.price;
};

// =============================================
// METHODS - التحقق من توفر المنتج
// =============================================

productSchema.methods.isAvailable = function(quantity = 1) {
    if (!this.isActive || this.isHidden) return false;
    if (this.isUnlimited) return true;
    if (this.stockStatus === 'out_of_stock') return false;
    return this.stock >= quantity;
};

// =============================================
// METHODS - تقليل المخزون بعد الشراء
// =============================================

productSchema.methods.reduceStock = async function(quantity) {
    if (this.isUnlimited) return true;
    
    if (this.stock < quantity) {
        throw new Error('المخزون غير كافٍ');
    }
    
    this.stock -= quantity;
    this.sales += quantity;
    this.revenue += this.getFinalPrice() * quantity;
    
    await this.save();
    
    // إرسال تنبيه إذا كان المخزون منخفضاً
    if (this.stock <= this.lowStockThreshold && this.stock > 0) {
        // سيتم تفعيل نظام التنبيهات هنا
        console.log(`⚠️ تنبيه: المخزون منخفض للمنتج "${this.name}" - المتبقي: ${this.stock}`);
    }
    
    return true;
};

// =============================================
// METHODS - زيادة المخزون
// =============================================

productSchema.methods.increaseStock = async function(quantity) {
    if (!this.isUnlimited) {
        this.stock += quantity;
        await this.save();
    }
    return true;
};

// =============================================
// METHODS - إضافة مشاهدة
// =============================================

productSchema.methods.addView = async function() {
    this.views += 1;
    return this.save();
};

// =============================================
// METHODS - إضافة للمفضلة
// =============================================

productSchema.methods.addToWishlist = async function() {
    this.wishlistCount += 1;
    return this.save();
};

// =============================================
// METHODS - إضافة للسلة
// =============================================

productSchema.methods.addToCart = async function() {
    this.cartAddCount += 1;
    return this.save();
};

// =============================================
// METHODS - الحصول على الصورة الرئيسية
// =============================================

productSchema.methods.getMainImage = function() {
    const mainImage = this.images.find(img => img.isMain);
    if (mainImage) return mainImage.url;
    if (this.images.length > 0) return this.images[0].url;
    return '/images/default-product.png';
};

// =============================================
// METHODS - الحصول على نسبة الخصم
// =============================================

productSchema.methods.getDiscountPercentage = function() {
    if (this.comparePrice && this.comparePrice > this.price) {
        return Math.round((1 - this.price / this.comparePrice) * 100);
    }
    if (this.discount && this.discount.isActive && this.discount.type === 'percentage') {
        return this.discount.value;
    }
    return 0;
};

// =============================================
// METHODS - الحصول على بيانات المنتج للعرض
// =============================================

productSchema.methods.getPublicData = function() {
    return {
        id: this._id,
        name: this.name,
        nameEn: this.nameEn,
        description: this.description,
        descriptionEn: this.descriptionEn,
        category: this.category,
        brand: this.brand,
        price: this.price,
        comparePrice: this.comparePrice,
        finalPrice: this.getFinalPrice(),
        discountPercentage: this.getDiscountPercentage(),
        stock: this.stock,
        stockStatus: this.stockStatus,
        mainImage: this.getMainImage(),
        images: this.images,
        rating: this.rating,
        isOnSale: this.isOnSale,
        isFeatured: this.isFeatured,
        isNewArrival: this.isNewArrival,
        isBestSeller: this.isBestSeller,
        options: this.options,
        slug: this.slug,
        sales: this.sales
    };
};

// =============================================
// STATICS - البحث عن المنتجات
// =============================================

productSchema.statics.search = async function(query, options = {}) {
    const {
        category,
        minPrice,
        maxPrice,
        inStock,
        onSale,
        featured,
        sort,
        page = 1,
        limit = 12
    } = options;
    
    const filter = { isActive: true, isHidden: false };
    
    if (query) {
        filter.$or = [
            { name: { $regex: query, $options: 'i' } },
            { nameEn: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { tags: { $regex: query, $options: 'i' } },
            { brand: { $regex: query, $options: 'i' } }
        ];
    }
    
    if (category) filter.category = category;
    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = minPrice;
        if (maxPrice) filter.price.$lte = maxPrice;
    }
    if (inStock) filter.stockStatus = { $ne: 'out_of_stock' };
    if (onSale) filter.isOnSale = true;
    if (featured) filter.isFeatured = true;
    
    let sortOption = { createdAt: -1 };
    if (sort === 'price-asc') sortOption = { price: 1 };
    if (sort === 'price-desc') sortOption = { price: -1 };
    if (sort === 'rating') sortOption = { 'rating.average': -1 };
    if (sort === 'sales') sortOption = { sales: -1 };
    if (sort === 'newest') sortOption = { createdAt: -1 };
    if (sort === 'name') sortOption = { name: 1 };
    
    const skip = (page - 1) * limit;
    
    const [products, total] = await Promise.all([
        this.find(filter).sort(sortOption).skip(skip).limit(limit).populate('category'),
        this.countDocuments(filter)
    ]);
    
    return {
        products,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    };
};

module.exports = mongoose.model('Product', productSchema);
