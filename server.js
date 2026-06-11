// ==============================================
// الرعدي أونلاين - السيرفر الرئيسي
// جميع الحقوق محفوظة © 2024
// ==============================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');

// ============ تكوينات أساسية ============
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ============ قواعد البيانات ============
let db, orders, products, users, coupons, settings, auditLogs, cartHolds;

async function connectDB() {
  try {
    // محاولة الاتصال بـ MongoDB
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ MongoDB متصل');
      db = mongoose.connection;
      
      // تعريف المخططات
      const userSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
      const productSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
      const orderSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
      const couponSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
      const settingsSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
      const auditLogSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
      const cartHoldSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
      
      users = mongoose.model('User', userSchema);
      products = mongoose.model('Product', productSchema);
      orders = mongoose.model('Order', orderSchema);
      coupons = mongoose.model('Coupon', couponSchema);
      settings = mongoose.model('Setting', settingsSchema);
      auditLogs = mongoose.model('AuditLog', auditLogSchema);
      cartHolds = mongoose.model('CartHold', cartHoldSchema);
    } else {
      // استخدام قاعدة بيانات محلية (JSON)
      console.log('⚠️ استخدام قاعدة بيانات محلية');
      const Database = require('./localDB');
      db = new Database();
      users = db.collection('users');
      products = db.collection('products');
      orders = db.collection('orders');
      coupons = db.collection('coupons');
      settings = db.collection('settings');
      auditLogs = db.collection('auditLogs');
      cartHolds = db.collection('cartHolds');
    }
  } catch (error) {
    console.error('❌ فشل الاتصال بقاعدة البيانات:', error.message);
    // استخدام قاعدة بيانات محلية كبديل
    const Database = require('./localDB');
    db = new Database();
  }
}

// ============ Middleware ============
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100,
  message: { error: 'طلبات كثيرة جداً، يرجى المحاولة لاحقاً' }
});
app.use('/api/', limiter);

// مجلد الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============ مسارات API ============

// --- المصادقة والتسجيل ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;
    
    // التحقق من البيانات
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }
    
    // التحقق من وجود المستخدم
    const existingUser = await users.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ error: 'البريد الإلكتروني أو رقم الهاتف مسجل مسبقاً' });
    }
    
    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // إنشاء المستخدم
    const user = await users.insertOne({
      fullName,
      email,
      phone,
      password: hashedPassword,
      role: 'customer',
      addresses: [],
      preferences: {
        locale: 'ar',
        currency: 'SAR',
        theme: 'dark-gold',
        welcomeSound: null,
        notifications: { email: true, push: true, whatsapp: true }
      },
      loyaltyPoints: 0,
      loyaltyTier: 'bronze',
      twoFactorEnabled: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // إنشاء توكن
    const token = jwt.sign(
      { id: user._id || user.id, role: 'customer' },
      process.env.JWT_SECRET || 'ra3di-secret-key-2024',
      { expiresIn: '30d' }
    );
    
    // تسجيل النشاط
    await auditLogs.insertOne({
      userId: user._id || user.id,
      action: 'REGISTER',
      details: 'تسجيل حساب جديد',
      ipAddress: req.ip,
      createdAt: new Date()
    });
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id || user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
        loyaltyTier: user.loyaltyTier,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('خطأ في التسجيل:', error);
    res.status(500).json({ error: 'فشل في إنشاء الحساب' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    
    // البحث عن المستخدم
    const query = email ? { email } : { phone };
    const user = await users.findOne(query);
    
    if (!user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }
    
    // التحقق من كلمة المرور
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }
    
    // إنشاء توكن
    const token = jwt.sign(
      { id: user._id || user.id, role: user.role },
      process.env.JWT_SECRET || 'ra3di-secret-key-2024',
      { expiresIn: '30d' }
    );
    
    // تحديث آخر دخول
    await users.updateOne(
      { _id: user._id || user.id },
      { $set: { lastLogin: new Date() } }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id || user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
        loyaltyTier: user.loyaltyTier,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error);
    res.status(500).json({ error: 'فشل في تسجيل الدخول' });
  }
});

// --- المنتجات ---
app.get('/api/products', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      search, 
      minPrice, 
      maxPrice,
      sort = '-createdAt',
      featured,
      flashSale
    } = req.query;
    
    // بناء استعلام البحث
    const query = { isActive: true };
    
    if (category) query.category = category;
    if (featured) query.isFeatured = true;
    if (flashSale) query['flashSale.isActive'] = true;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    
    const total = await products.countDocuments(query);
    const items = await products.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .toArray();
    
    res.json({
      success: true,
      data: items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('خطأ في جلب المنتجات:', error);
    res.status(500).json({ error: 'فشل في جلب المنتجات' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await products.findOne({ _id: req.params.id });
    if (!product) {
      return res.status(404).json({ error: 'المنتج غير موجود' });
    }
    
    // إضافة المنتجات ذات الصلة
    const relatedProducts = await products.find({
      category: product.category,
      _id: { $ne: product._id },
      isActive: true
    }).limit(4).toArray();
    
    res.json({
      success: true,
      data: {
        ...product,
        relatedProducts
      }
    });
  } catch (error) {
    console.error('خطأ في جلب المنتج:', error);
    res.status(500).json({ error: 'فشل في جلب المنتج' });
  }
});

// --- إدارة السلة ---
app.post('/api/cart/add', async (req, res) => {
  try {
    const { productId, quantity = 1, color, size } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'يرجى تسجيل الدخول' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ra3di-secret-key-2024');
    const userId = decoded.id;
    
    // التحقق من المنتج والمخزون
    const product = await products.findOne({ _id: productId });
    if (!product) {
      return res.status(404).json({ error: 'المنتج غير موجود' });
    }
    
    if (product.stock < quantity) {
      return res.status(400).json({ error: 'المخزون غير كافي' });
    }
    
    // إضافة للسلة في Redis أو قاعدة البيانات
    const cartKey = `cart:${userId}`;
    let cart = JSON.parse(await redisGet(cartKey) || '[]');
    
    const existingItem = cart.find(item => 
      item.productId === productId && 
      item.color === color && 
      item.size === size
    );
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.push({
        productId,
        quantity,
        color,
        size,
        name: product.name,
        price: product.currentPrice || product.price,
        image: product.images?.[0]?.url,
        maxQuantity: product.stock
      });
    }
    
    await redisSet(cartKey, JSON.stringify(cart), 3600); // صلاحية ساعة
    
    res.json({
      success: true,
      message: 'تمت الإضافة إلى السلة',
      cartCount: cart.length,
      cart
    });
  } catch (error) {
    console.error('خطأ في إضافة المنتج للسلة:', error);
    res.status(500).json({ error: 'فشل في إضافة المنتج للسلة' });
  }
});

app.get('/api/cart', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'يرجى تسجيل الدخول' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ra3di-secret-key-2024');
    const cartKey = `cart:${decoded.id}`;
    const cart = JSON.parse(await redisGet(cartKey) || '[]');
    
    res.json({ success: true, data: cart });
  } catch (error) {
    console.error('خطأ في جلب السلة:', error);
    res.status(500).json({ error: 'فشل في جلب السلة' });
  }
});

// --- إتمام الطلب والفوترة ---
app.post('/api/checkout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'يرجى تسجيل الدخول' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ra3di-secret-key-2024');
    const userId = decoded.id;
    
    const {
      shippingAddress,
      shippingType = 'internal',
      paymentMethod = 'cod',
      couponCode,
      notes,
      signature
    } = req.body;
    
    // جلب السلة
    const cartKey = `cart:${userId}`;
    const cart = JSON.parse(await redisGet(cartKey) || '[]');
    
    if (cart.length === 0) {
      return res.status(400).json({ error: 'السلة فارغة' });
    }
    
    // جلب بيانات المستخدم
    const user = await users.findOne({ _id: userId });
    
    // التحقق من المخزون وحجزه مؤقتاً
    const items = [];
    for (const cartItem of cart) {
      const product = await products.findOne({ _id: cartItem.productId });
      if (!product || product.stock < cartItem.quantity) {
        return res.status(400).json({ 
          error: `المنتج ${cartItem.name} غير متوفر بالكمية المطلوبة` 
        });
      }
      
      // حجز مؤقت للمخزون
      await products.updateOne(
        { _id: product._id },
        { $inc: { stock: -cartItem.quantity } }
      );
      
      // إضافة للمخزون المحجوز
      await cartHolds.insertOne({
        userId,
        productId: product._id,
        quantity: cartItem.quantity,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 دقيقة
        createdAt: new Date()
      });
      
      items.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        image: product.images?.[0]?.url,
        price: product.currentPrice || product.price,
        quantity: cartItem.quantity,
        discount: 0,
        subtotal: (product.currentPrice || product.price) * cartItem.quantity
      });
    }
    
    // حساب الشحن
    const shippingRates = await settings.findOne({ type: 'shipping_rates' });
    let shippingCost = 0;
    let shippingRatePercentage = 0;
    
    if (shippingType === 'external') {
      const countryRate = shippingRates?.data?.find(r => 
        r.country === shippingAddress.country
      );
      shippingRatePercentage = countryRate?.percent || 10;
      shippingCost = items.reduce((sum, item) => sum + item.subtotal, 0) * (shippingRatePercentage / 100);
    } else if (shippingType === 'internal') {
      shippingRatePercentage = shippingRates?.data?.find(r => r.type === 'internal')?.percent || 5;
      shippingCost = items.reduce((sum, item) => sum + item.subtotal, 0) * (shippingRatePercentage / 100);
    }
    
    // تطبيق الكوبون
    let discountAmount = 0;
    let couponData = null;
    
    if (couponCode) {
      const coupon = await coupons.findOne({ 
        code: couponCode, 
        isActive: true,
        expiryDate: { $gte: new Date() }
      });
      
      if (coupon) {
        couponData = {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue
        };
        
        if (coupon.discountType === 'percentage') {
          discountAmount = items.reduce((sum, item) => sum + item.subtotal, 0) * (coupon.discountValue / 100);
        } else {
          discountAmount = coupon.discountValue;
        }
        
        // زيادة عدد الاستخدامات
        await coupons.updateOne(
          { _id: coupon._id },
          { $inc: { usedCount: 1 } }
        );
      }
    }
    
    // حساب الضريبة
    const taxRate = 15; // 15% VAT
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxableAmount = subtotal - discountAmount;
    const tax = taxableAmount * (taxRate / 100);
    const total = taxableAmount + tax + shippingCost;
    
    // إنشاء الطلب
    const order = await orders.insertOne({
      orderNumber: `R3D-${Date.now().toString(36).toUpperCase()}`,
      user: userId,
      items,
      shipping: {
        type: shippingType,
        address: shippingAddress,
        ratePercentage: shippingRatePercentage,
        cost: shippingCost,
        estimatedDays: shippingType === 'internal' ? 3 : 14
      },
      coupon: couponData ? {
        ...couponData,
        discountAmount
      } : null,
      pricing: {
        subtotal,
        shippingCost,
        discount: discountAmount,
        tax,
        taxRate,
        total,
        currency: 'SAR'
      },
      payment: {
        method: paymentMethod,
        status: paymentMethod === 'cod' ? 'pending' : 'pending'
      },
      status: 'pending',
      returnPolicy: {
        eligible: true,
        returnWindow: 14,
        conditions: 'الاستبدال مسموح خلال 14 يوماً بشرط عدم وجود تلف'
      },
      notes,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // إنشاء الفاتورة PDF
    const invoiceBuffer = await generateInvoicePDF(order, user);
    
    // حفظ الفاتورة
    const invoicePath = `invoices/${order._id}_${order.orderNumber}.pdf`;
    fs.writeFileSync(path.join(__dirname, 'uploads', invoicePath), invoiceBuffer);
    
    // تحديث الطلب برابط الفاتورة
    await orders.updateOne(
      { _id: order._id },
      { 
        $set: { 
          'invoice.pdfUrl': `/uploads/${invoicePath}`,
          'invoice.termsVersion': 'v1.2',
          'invoice.generatedAt': new Date()
        } 
      }
    );
    
    // إضافة التوقيع إذا وجد
    if (signature) {
      const signatureBuffer = Buffer.from(signature.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const signaturePath = `signatures/${order._id}_signature.png`;
      fs.writeFileSync(path.join(__dirname, 'uploads', signaturePath), signatureBuffer);
      
      await orders.updateOne(
        { _id: order._id },
        { 
          $set: { 
            'invoice.signatureImageUrl': `/uploads/${signaturePath}`,
            'invoice.signatureHash': require('crypto').createHash('sha256').update(signatureBuffer).digest('hex')
          } 
        }
      );
    }
    
    // تفريغ السلة
    await redisDel(cartKey);
    
    // إرسال الإشعارات
    if (user.email) {
      await sendEmail(
        user.email,
        `تأكيد الطلب #${order.orderNumber}`,
        `تم استلام طلبك بنجاح. رقم الطلب: ${order.orderNumber}\nالإجمالي: ${total} ريال`
      );
    }
    
    // إرسال إشعار للمدير
    io.emit('newOrder', {
      orderNumber: order.orderNumber,
      total,
      customer: user.fullName,
      createdAt: new Date()
    });
    
    // إضافة نقاط الولاء
    const loyaltyPoints = Math.floor(total / 10);
    await users.updateOne(
      { _id: userId },
      { $inc: { loyaltyPoints } }
    );
    
    // تحديث مستوى الولاء
    const updatedUser = await users.findOne({ _id: userId });
    let newTier = 'bronze';
    if (updatedUser.loyaltyPoints >= 2000) newTier = 'platinum';
    else if (updatedUser.loyaltyPoints >= 1000) newTier = 'gold';
    else if (updatedUser.loyaltyPoints >= 500) newTier = 'silver';
    
    await users.updateOne(
      { _id: userId },
      { $set: { loyaltyTier: newTier } }
    );
    
    // تسجيل النشاط
    await auditLogs.insertOne({
      userId,
      action: 'CREATE_ORDER',
      details: `إنشاء طلب #${order.orderNumber}`,
      targetTable: 'orders',
      targetId: order._id,
      newValue: { total, status: 'pending' },
      ipAddress: req.ip,
      createdAt: new Date()
    });
    
    res.status(201).json({
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      data: {
        orderNumber: order.orderNumber,
        total,
        invoiceUrl: `/uploads/${invoicePath}`,
        estimatedDelivery: new Date(Date.now() + (shippingType === 'internal' ? 3 : 14) * 24 * 60 * 60 * 1000)
      }
    });
  } catch (error) {
    console.error('خطأ في إتمام الطلب:', error);
    res.status(500).json({ error: 'فشل في إتمام الطلب' });
  }
});

// --- لوحة تحكم المدير ---
app.get('/api/admin/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const [
      totalOrders,
      todayOrders,
      totalRevenue,
      todayRevenue,
      totalCustomers,
      totalProducts,
      lowStockProducts,
      recentOrders
    ] = await Promise.all([
      orders.countDocuments(),
      orders.countDocuments({ createdAt: { $gte: today } }),
      orders.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$pricing.total' } } }
      ]).toArray(),
      orders.aggregate([
        { $match: { createdAt: { $gte: today }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$pricing.total' } } }
      ]).toArray(),
      users.countDocuments({ role: 'customer' }),
      products.countDocuments(),
      products.countDocuments({ stock: { $lte: 5 } }),
      orders.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray()
    ]);
    
    res.json({
      success: true,
      data: {
        totalOrders,
        todayOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        todayRevenue: todayRevenue[0]?.total || 0,
        totalCustomers,
        totalProducts,
        lowStockProducts,
        recentOrders
      }
    });
  } catch (error) {
    console.error('خطأ في جلب الإحصائيات:', error);
    res.status(500).json({ error: 'فشل في جلب الإحصائيات' });
  }
});

app.get('/api/admin/reports', async (req, res) => {
  try {
    const { type = 'sales', period = 'daily', startDate, endDate } = req.query;
    
    let report = [];
    
    if (type === 'sales') {
      const match = { status: { $ne: 'cancelled' } };
      if (startDate && endDate) {
        match.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      report = await orders.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: { 
                format: period === 'daily' ? '%Y-%m-%d' : '%Y-%m',
                date: '$createdAt'
              }
            },
            orders: { $sum: 1 },
            revenue: { $sum: '$pricing.total' },
            averageOrder: { $avg: '$pricing.total' }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray();
    } else if (type === 'products') {
      report = await products.aggregate([
        { $match: { isActive: true } },
        {
          $project: {
            name: 1,
            stock: 1,
            price: 1,
            salesCount: 1,
            revenue: { $multiply: ['$price', '$salesCount'] }
          }
        },
        { $sort: { salesCount: -1 } },
        { $limit: 20 }
      ]).toArray();
    } else if (type === 'inventory') {
      report = await products.find({
        isActive: true,
        stock: { $lte: 10 }
      }).toArray();
    }
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('خطأ في إنشاء التقرير:', error);
    res.status(500).json({ error: 'فشل في إنشاء التقرير' });
  }
});

// --- تحديث إعدادات المتجر ---
app.put('/api/admin/settings', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    const existing = await settings.findOne({ type });
    
    if (existing) {
      await settings.updateOne(
        { type },
        { $set: { data, updatedAt: new Date() } }
      );
    } else {
      await settings.insertOne({
        type,
        data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // إرسال التحديثات عبر WebSocket
    io.emit('settingsUpdated', { type, data });
    
    // تسجيل النشاط
    await auditLogs.insertOne({
      userId: req.user?.id,
      action: 'UPDATE_SETTINGS',
      details: `تحديث إعدادات ${type}`,
      targetTable: 'settings',
      newValue: data,
      ipAddress: req.ip,
      createdAt: new Date()
    });
    
    res.json({
      success: true,
      message: 'تم تحديث الإعدادات بنجاح'
    });
  } catch (error) {
    console.error('خطأ في تحديث الإعدادات:', error);
    res.status(500).json({ error: 'فشل في تحديث الإعدادات' });
  }
});

app.get('/api/admin/settings/:type', async (req, res) => {
  try {
    const setting = await settings.findOne({ type: req.params.type });
    res.json({
      success: true,
      data: setting?.data || null
    });
  } catch (error) {
    console.error('خطأ في جلب الإعدادات:', error);
    res.status(500).json({ error: 'فشل في جلب الإعدادات' });
  }
});

// --- نظام الكوبونات ---
app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, cartTotal } = req.body;
    
    const coupon = await coupons.findOne({
      code,
      isActive: true,
      expiryDate: { $gte: new Date() },
      $expr: { $lt: ['$usedCount', '$maxUses'] }
    });
    
    if (!coupon) {
      return res.status(400).json({ error: 'الكوبون غير صالح أو منتهي الصلاحية' });
    }
    
    if (cartTotal < coupon.minOrderAmount) {
      return res.status(400).json({ 
        error: `الحد الأدنى للطلب ${coupon.minOrderAmount} ريال` 
      });
    }
    
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = cartTotal * (coupon.discountValue / 100);
    } else {
      discount = coupon.discountValue;
    }
    
    res.json({
      success: true,
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discount,
        description: coupon.description
      }
    });
  } catch (error) {
    console.error('خطأ في التحقق من الكوبون:', error);
    res.status(500).json({ error: 'فشل في التحقق من الكوبون' });
  }
});

// --- تحميل الملفات ---
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, 'uploads', req.body.type || 'general');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 ميجابايت
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mp3|wav|ogg|pdf|glb|gltf|usdz/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم'));
    }
  }
});

app.post('/api/upload', upload.array('files', 20), async (req, res) => {
  try {
    const files = req.files.map(file => ({
      url: `/uploads/${req.body.type || 'general'}/${file.filename}`,
      originalName: file.originalname,
      size: file.size,
      type: file.mimetype
    }));
    
    // معالجة الصور تلقائياً
    const processedFiles = await Promise.all(files.map(async (file) => {
      if (file.type.startsWith('image/')) {
        const inputPath = path.join(__dirname, file.url);
        const webpPath = inputPath.replace(/\.[^.]+$/, '.webp');
        
        await sharp(inputPath)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(webpPath);
        
        file.webpUrl = file.url.replace(/\.[^.]+$/, '.webp');
        file.thumbnailUrl = file.url.replace(/\.[^.]+$/, '_thumb.webp');
        
        // إنشاء صورة مصغرة
        await sharp(inputPath)
          .resize(300, 300, { fit: 'cover' })
          .webp({ quality: 60 })
          .toFile(inputPath.replace(/\.[^.]+$/, '_thumb.webp'));
      }
      return file;
    }));
    
    res.json({
      success: true,
      data: processedFiles
    });
  } catch (error) {
    console.error('خطأ في رفع الملفات:', error);
    res.status(500).json({ error: 'فشل في رفع الملفات' });
  }
});

// ============ دوال مساعدة ============

// إنشاء PDF الفاتورة
async function generateInvoicePDF(order, user) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `فاتورة - ${order.orderNumber}`,
          Author: 'الرعدي أونلاين'
        }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      
      // رأس الفاتورة
      doc.fontSize(24)
         .fillColor('#C9A84C')
         .text('الرعدي أونلاين', { align: 'right' });
      
      doc.fontSize(16)
         .fillColor('#1A1A2E')
         .text('فاتورة شراء', { align: 'left' });
      
      doc.moveTo(50, 100)
         .lineTo(545, 100)
         .strokeColor('#C9A84C')
         .lineWidth(2)
         .stroke();
      
      doc.moveDown(2);
      
      // بيانات العميل
      doc.fontSize(12)
         .fillColor('#1A1A2E')
         .text('بيانات العميل', { align: 'right' });
      
      doc.fontSize(10)
         .text(user.fullName, { align: 'right' })
         .text(user.email, { align: 'right' })
         .text(user.phone, { align: 'right' });
      
      doc.moveDown();
      
      // تفاصيل الطلب
      doc.fontSize(12)
         .text('تفاصيل الطلب');
      
      doc.fontSize(10)
         .text(`رقم الطلب: ${order.orderNumber}`)
         .text(`التاريخ: ${new Date(order.createdAt).toLocaleDateString('ar-SA')}`)
         .text(`طريقة الدفع: ${order.payment.method === 'cod' ? 'الدفع عند الاستلام' : 'بطاقة ائتمان'}`);
      
      doc.moveDown();
      
      // جدول المنتجات
      doc.fontSize(12)
         .fillColor('#C9A84C')
         .text('المنتجات');
      
      doc.moveDown(0.5);
      
      // رأس الجدول
      doc.fontSize(10)
         .fillColor('#1A1A2E');
      
      order.items.forEach((item, index) => {
        const y = doc.y;
        doc.text(`${index + 1}. ${item.name}`)
           .text(`${item.quantity} × ${item.price} ر.س`, { align: 'right' })
           .text(`${item.subtotal} ر.س`, { align: 'right' });
      });
      
      doc.moveDown();
      
      // المجاميع
      doc.moveTo(300, doc.y)
         .lineTo(545, doc.y)
         .strokeColor('#C9A84C')
         .stroke();
      
      doc.moveDown(0.5);
      
      doc.fontSize(10)
         .text(`المجموع الفرعي: ${order.pricing.subtotal} ر.س`, { align: 'right' })
         .text(`الشحن: ${order.pricing.shippingCost} ر.س`, { align: 'right' })
         .text(`الخصم: ${order.pricing.discount} ر.س`, { align: 'right' })
         .text(`الضريبة (${order.pricing.taxRate}%): ${order.pricing.tax} ر.س`, { align: 'right' });
      
      doc.fontSize(14)
         .fillColor('#C9A84C')
         .text(`الإجمالي: ${order.pricing.total} ر.س`, { align: 'right' });
      
      doc.moveDown(2);
      
      // شروط الاسترجاع
      doc.fontSize(10)
         .fillColor('#666666')
         .text('شروط الاسترجاع:', { align: 'right' })
         .fontSize(9)
         .text(order.returnPolicy.conditions || 'الاستبدال مسموح خلال 14 يوماً بشرط عدم وجود تلف', { align: 'right' });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// إرسال بريد إلكتروني
async function sendEmail(to, subject, text) {
  try {
    if (!process.env.SMTP_HOST) return;
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    
    await transporter.sendMail({
      from: `"الرعدي أونلاين" <${process.env.SMTP_FROM}>`,
      to,
      subject,
      text
    });
  } catch (error) {
    console.error('خطأ في إرسال البريد:', error);
  }
}

// دوال Redis مساعدة
async function redisGet(key) {
  try {
    if (process.env.REDIS_URL) {
      const redis = require('redis');
      const client = redis.createClient({ url: process.env.REDIS_URL });
      await client.connect();
      const value = await client.get(key);
      await client.disconnect();
      return value;
    }
    return global.cache?.[key];
  } catch {
    return global.cache?.[key];
  }
}

async function redisSet(key, value, ttl) {
  try {
    if (process.env.REDIS_URL) {
      const redis = require('redis');
      const client = redis.createClient({ url: process.env.REDIS_URL });
      await client.connect();
      await client.setEx(key, ttl, value);
      await client.disconnect();
    } else {
      if (!global.cache) global.cache = {};
      global.cache[key] = value;
      setTimeout(() => delete global.cache[key], ttl * 1000);
    }
  } catch {
    if (!global.cache) global.cache = {};
    global.cache[key] = value;
  }
}

async function redisDel(key) {
  try {
    if (process.env.REDIS_URL) {
      const redis = require('redis');
      const client = redis.createClient({ url: process.env.REDIS_URL });
      await client.connect();
      await client.del(key);
      await client.disconnect();
    } else {
      delete global.cache?.[key];
    }
  } catch {
    delete global.cache?.[key];
  }
}

// ============ WebSocket ============
io.on('connection', (socket) => {
  console.log('🟢 عميل متصل:', socket.id);
  
  socket.on('join', (room) => {
    socket.join(room);
  });
  
  socket.on('adminAction', (data) => {
    // إرسال التحديثات لجميع العملاء
    socket.broadcast.emit('storeUpdate', data);
  });
  
  socket.on('disconnect', () => {
    console.log('🔴 عميل منفصل:', socket.id);
  });
});

// ============ المهام المجدولة ============

// تنظيف حجوزات المخزون المنتهية
cron.schedule('*/5 * * * *', async () => {
  try {
    const expiredHolds = await cartHolds.find({
      expiresAt: { $lte: new Date() }
    }).toArray();
    
    for (const hold of expiredHolds) {
      await products.updateOne(
        { _id: hold.productId },
        { $inc: { stock: hold.quantity } }
      );
      await cartHolds.deleteOne({ _id: hold._id });
    }
    
    if (expiredHolds.length > 0) {
      console.log(`🧹 تم تنظيف ${expiredHolds.length} حجز منتهي`);
    }
  } catch (error) {
    console.error('خطأ في تنظيف الحجوزات:', error);
  }
});

// نسخ احتياطي يومي
cron.schedule('0 2 * * *', async () => {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupDir = path.join(__dirname, 'backups', timestamp);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // نسخ البيانات
    const data = {
      products: await products.find().toArray(),
      orders: await orders.find().toArray(),
      users: await users.find().toArray(),
      coupons: await coupons.find().toArray(),
      settings: await settings.find().toArray()
    };
    
    fs.writeFileSync(
      path.join(backupDir, 'data.json'),
      JSON.stringify(data, null, 2)
    );
    
    console.log(`💾 نسخ احتياطي تم إنشاؤه: ${timestamp}`);
  } catch (error) {
    console.error('خطأ في النسخ الاحتياطي:', error);
  }
});

// ============ تشغيل السيرفر ============
const PORT = process.env.PORT || 3000;

async function startServer() {
  await connectDB();
  
  // إنشاء المجلدات المطلوبة
  const dirs = ['uploads', 'uploads/products', 'uploads/invoices', 'uploads/signatures', 'backups'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  httpServer.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║   ⚡ الرعدي أونلاين - Ra3di Online   ║
║   🚀 السيرفر يعمل على المنفذ: ${PORT}   ║
║   🌐 http://localhost:${PORT}           ║
║   👑 http://localhost:${PORT}/admin    ║
╚════════════════════════════════════════╝
    `);
  });
}

startServer().catch(console.error);

module.exports = app;
