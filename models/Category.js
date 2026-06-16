// =============================================
// متجر الرعدي أون لاين - alradi-online
// نموذج الأقسام والتصنيفات
// =============================================

const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    
    // ========== البيانات الأساسية ==========
    name: {
        type: String,
        required: [true, 'اسم القسم مطلوب'],
        trim: true,
        unique: true,
        minlength: [2, 'اسم القسم يجب أن يكون حرفين على الأقل'],
        maxlength: [100, 'اسم القسم يجب أن لا يتجاوز 100 حرف']
    },
    nameEn: {
        type: String,
        trim: true,
        default: ''
    },
    description: {
        type: String,
        default: '',
        maxlength: [500, 'الوصف يجب أن لا يتجاوز 500 حرف']
    },
    descriptionEn: {
        type: String,
        default: ''
    },
    
    // ========== الصورة والأيقونة ==========
    image: {
        type: String,
        default: '/images/default-category.png'
    },
    icon: {
        type: String,
        default: 'fa-folder'
    },
    
    // ========== التصنيف الأب ==========
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    ancestors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    
    // ========== الترتيب والعرض ==========
    order: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    showInMenu: {
        type: Boolean,
        default: true
    },
    showInHomePage: {
        type: Boolean,
        default: false
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
    
    // ========== إحصائيات ==========
    productCount: {
        type: Number,
        default: 0
    },
    totalSales: {
        type: Number,
        default: 0
    },
    
    // ========== إعدادات متقدمة ==========
    filters: [{
        name: String,
        type: {
            type: String,
            enum: ['checkbox', 'radio', 'range', 'color', 'size'],
            default: 'checkbox'
        },
        options: [{
            value: String,
            label: String
        }]
    }],
    
    customFields: [{
        name: String,
        label: String,
        type: {
            type: String,
            enum: ['text', 'number', 'select', 'multi-select', 'color', 'date'],
            default: 'text'
        },
        required: {
            type: Boolean,
            default: false
        },
        options: [String]
    }]
    
}, { 
    timestamps: true 
});

// =============================================
// INDEXES
// =============================================

categorySchema.index({ name: 1 });
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ order: 1 });
categorySchema.index({ isActive: 1 });

// =============================================
// MIDDLEWARE - تحديث slug وancestors قبل الحفظ
// =============================================

categorySchema.pre('save', async function(next) {
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
    
    // تحديث ancestors
    if (this.parent) {
        const parentCategory = await this.constructor.findById(this.parent);
        if (parentCategory) {
            this.ancestors = [...parentCategory.ancestors, parentCategory._id];
        }
    } else {
        this.ancestors = [];
    }
    
    next();
});

// =============================================
// MIDDLEWARE - تحديث عدد المنتجات بعد الحذف
// =============================================

categorySchema.post('findOneAndDelete', async function(doc) {
    if (doc) {
        // تحديث المنتجات المرتبطة
        const Product = mongoose.model('Product');
        await Product.updateMany(
            { category: doc._id },
            { category: null }
        );
        
        // تحديث الأقسام الفرعية
        await this.model.updateMany(
            { parent: doc._id },
            { parent: doc.parent }
        );
    }
});

// =============================================
// METHODS - الحصول على الأقسام الفرعية
// =============================================

categorySchema.methods.getChildren = async function() {
    return await this.constructor.find({ parent: this._id, isActive: true }).sort('order');
};

// =============================================
// METHODS - الحصول على جميع الأقسام الفرعية (شجرة)
// =============================================

categorySchema.methods.getAllChildren = async function() {
    const children = await this.constructor.find({ ancestors: this._id, isActive: true });
    return children;
};

// =============================================
// METHODS - الحصول على المنتجات في هذا القسم
// =============================================

categorySchema.methods.getProducts = async function(options = {}) {
    const Product = mongoose.model('Product');
    const { page = 1, limit = 12, sort = '-createdAt' } = options;
    
    // الحصول على جميع الأقسام الفرعية
    const childrenIds = await this.getAllChildren();
    const categoryIds = [this._id, ...childrenIds.map(c => c._id)];
    
    const filter = {
        category: { $in: categoryIds },
        isActive: true,
        isHidden: false
    };
    
    const skip = (page - 1) * limit;
    
    const [products, total] = await Promise.all([
        Product.find(filter).sort(sort).skip(skip).limit(limit),
        Product.countDocuments(filter)
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

// =============================================
// METHODS - تحديث عدد المنتجات
// =============================================

categorySchema.methods.updateProductCount = async function() {
    const Product = mongoose.model('Product');
    const childrenIds = await this.getAllChildren();
    const categoryIds = [this._id, ...childrenIds.map(c => c._id)];
    
    const count = await Product.countDocuments({
        category: { $in: categoryIds },
        isActive: true,
        isHidden: false
    });
    
    this.productCount = count;
    return this.save();
};

// =============================================
// METHODS - الحصول على بيانات القسم للعرض
// =============================================

categorySchema.methods.getPublicData = function() {
    return {
        id: this._id,
        name: this.name,
        nameEn: this.nameEn,
        description: this.description,
        image: this.image,
        icon: this.icon,
        slug: this.slug,
        productCount: this.productCount,
        isFeatured: this.isFeatured,
        parent: this.parent,
        order: this.order
    };
};

// =============================================
// STATICS - الحصول على شجرة الأقسام كاملة
// =============================================

categorySchema.statics.getTree = async function() {
    const categories = await this.find({ isActive: true }).sort('order');
    
    const buildTree = (parentId = null) => {
        return categories
            .filter(cat => {
                if (parentId === null) return !cat.parent;
                return cat.parent && cat.parent.toString() === parentId.toString();
            })
            .map(cat => ({
                ...cat.toObject(),
                children: buildTree(cat._id)
            }));
    };
    
    return buildTree();
};

// =============================================
// STATICS - الحصول على الأقسام الرئيسية فقط
// =============================================

categorySchema.statics.getMainCategories = async function() {
    return await this.find({ parent: null, isActive: true, showInMenu: true })
        .sort('order')
        .select('name nameEn image icon slug productCount');
};

// =============================================
// STATICS - الحصول على الأقسام المميزة للصفحة الرئيسية
// =============================================

categorySchema.statics.getFeaturedCategories = async function() {
    return await this.find({ isActive: true, showInHomePage: true })
        .sort('order')
        .limit(6)
        .select('name nameEn image icon slug productCount');
};

// =============================================
// STATICS - البحث عن قسم
// =============================================

categorySchema.statics.findBySlug = async function(slug) {
    return await this.findOne({ slug, isActive: true });
};

module.exports = mongoose.model('Category', categorySchema);
