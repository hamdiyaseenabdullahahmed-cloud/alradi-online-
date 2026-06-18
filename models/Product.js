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
        minlength: [3, 'الوصف يجب أن يكون 3 أحرف على الأقل'],
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
        default: 1
    },
    sku: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },
    isUnlimited: {
        type: Boolean,
        default: false
    },
    lowStockThreshold: {
        type: Number,
        default: 5
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
    stockStatus: {
        type: String,
        enum: ['in_stock', 'low_stock', 'out_of_stock', 'pre_order'],
        default: 'in_stock'
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
    
    // ========== SEO ==========
    slug: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },
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
    
    // ========== خيارات إضافية ==========
    options: [{
        name: String,
        values: [{
            value: String,
            additionalPrice: Number,
            stock: Number
        }]
    }],
    
    specifications: [{
        name: String,
        value: String
    }]
    
}, { 
    timestamps: true 
});

// =============================================
// INDEXES
// =============================================

productSchema.index({ name: 'text', nameEn: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ slug: 1 });

// =============================================
// MIDDLEWARE - تحديث الحالة قبل الحفظ
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
    
    // توليد slug
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
    
    // تحديث حالة التخفيض
    if (this.discount && this.discount.isActive && this.discount.value > 0) {
        this.isOnSale = true;
    } else {
        this.isOnSale = false;
    }
    
    // إزالة SKU الفارغ
    if (this.sku === '' || this.sku === null || this.sku === undefined) {
        this.sku = undefined;
    }
    
    next();
});

// =============================================
// METHODS
// =============================================

productSchema.methods.getFinalPrice = function() {
    if (this.discount && this.discount.isActive) {
        if (this.discount.type === 'percentage') {
            return this.price - (this.price * this.discount.value / 100);
        } else if (this.discount.type === 'fixed') {
            return Math.max(0, this.price - this.discount.value);
        }
    }
    return this.price;
};

productSchema.methods.isAvailable = function(quantity = 1) {
    if (!this.isActive || this.isHidden) return false;
    if (this.isUnlimited) return true;
    if (this.stockStatus === 'out_of_stock') return false;
    return this.stock >= quantity;
};

productSchema.methods.reduceStock = async function(quantity) {
    if (this.isUnlimited) return true;
    if (this.stock < quantity) throw new Error('المخزون غير كافٍ');
    this.stock -= quantity;
    this.sales += quantity;
    this.revenue += this.getFinalPrice() * quantity;
    await this.save();
    return true;
};

productSchema.methods.getMainImage = function() {
    const mainImage = this.images.find(img => img.isMain);
    if (mainImage) return mainImage.url;
    if (this.images.length > 0) return this.images[0].url;
    return null;
};

productSchema.methods.addToCart = async function() {
    this.cartAddCount += 1;
    return this.save();
};

productSchema.methods.getPublicData = function() {
    return {
        id: this._id,
        name: this.name,
        nameEn: this.nameEn,
        description: this.description,
        category: this.category,
        brand: this.brand,
        price: this.price,
        comparePrice: this.comparePrice,
        finalPrice: this.getFinalPrice(),
        stock: this.stock,
        stockStatus: this.stockStatus,
        mainImage: this.getMainImage(),
        images: this.images,
        rating: this.rating,
        isOnSale: this.isOnSale,
        isFeatured: this.isFeatured,
        isNewArrival: this.isNewArrival,
        slug: this.slug,
        sales: this.sales
    };
};

// =============================================
// STATICS
// =============================================

productSchema.statics.search = async function(query, options = {}) {
    const {
        category,
        minPrice,
        maxPrice,
        onSale,
        featured,
        sort,
        page = 1,
        limit = 12
    } = options;
    
    const filter = { isActive: true };
    
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
        if (minPrice) filter.price.$gte = parseFloat(minPrice);
        if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    if (onSale) filter.isOnSale = true;
    if (featured) filter.isFeatured = true;
    
    let sortOption = { createdAt: -1 };
    if (sort === 'price-asc') sortOption = { price: 1 };
    if (sort === 'price-desc') sortOption = { price: -1 };
    if (sort === 'rating') sortOption = { 'rating.average': -1 };
    if (sort === 'sales') sortOption = { sales: -1 };
    if (sort === 'newest') sortOption = { createdAt: -1 };
    
    const skip = (page - 1) * limit;
    
    const [products, total] = await Promise.all([
        this.find(filter).sort(sortOption).skip(skip).limit(limit),
        this.countDocuments(filter)
    ]);
    
    return { products, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

module.exports = mongoose.model('Product', productSchema);
