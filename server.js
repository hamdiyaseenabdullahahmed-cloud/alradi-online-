// =================================================================
// ⚡ الرعدي أونلاين - AlRadi Online v4.0 Final
// السيرفر الأسطوري الكامل – جميع نقاط API – جاهز لـ Render
// =================================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const { Server } = require('socket.io');
const http = require('http');
const archiver = require('archiver');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ============ Middleware ============
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','PATCH'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 15*60*1000, max: 500, message: { error: 'طلبات كثيرة' } }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============ رفع الملفات ============
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, 'uploads', req.body?.type || 'general');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${uuidv4().slice(0,8)}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 50*1024*1024 }
});

// ============ قاعدة بيانات محلية ============
class LocalDB {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
  }
  _read(coll) {
    const f = path.join(this.dataDir, `${coll}.json`);
    if (!fs.existsSync(f)) return [];
    try { return JSON.parse(fs.readFileSync(f, 'utf-8')); } catch { return []; }
  }
  _write(coll, data) { fs.writeFileSync(path.join(this.dataDir, `${coll}.json`), JSON.stringify(data, null, 2)); }
  collection(name) {
    const self = this;
    return {
      find: (q = {}) => {
        let d = self._read(name);
        if (q._id) d = d.filter(i => i._id === q._id);
        if (q.email) d = d.filter(i => i.email === q.email);
        if (q.phone) d = d.filter(i => i.phone === q.phone);
        if (q.role) d = d.filter(i => i.role === q.role);
        if (q.code) d = d.filter(i => i.code === q.code);
        if (q.status && q.status !== 'all') d = d.filter(i => i.status === q.status);
        if (q.category) d = d.filter(i => i.category === q.category);
        if (q.isActive !== undefined) d = d.filter(i => i.isActive === q.isActive);
        if (q.type) d = d.filter(i => i.type === q.type);
        if (q.$or) d = d.filter(i => q.$or.some(c => {
          if (c.name?.$regex) return new RegExp(c.name.$regex, c.name.$options || 'i').test(i.name || '');
          if (c.description?.$regex) return new RegExp(c.description.$regex, c.description.$options || 'i').test(i.description || '');
          return false;
        }));
        return {
          sort: (s) => { const k = Object.keys(s)[0]; d.sort((a,b) => s[k]===-1 ? (b[k]||0)-(a[k]||0) : (a[k]||0)-(b[k]||0)); return { toArray: async () => d, limit: (n) => d.slice(0,n) }; },
          toArray: async () => d, limit: (n) => d.slice(0,n), skip: (n) => d.slice(n)
        };
      },
      findOne: async (q) => (await this.collection(name).find(q)).toArray().then(r => r[0] || null),
      insertOne: async (doc) => {
        const d = self._read(name);
        const nd = { _id: uuidv4(), ...doc, createdAt: doc.createdAt || new Date(), updatedAt: new Date() };
        d.push(nd); self._write(name, d); return nd;
      },
      updateOne: async (q, up) => {
        const d = self._read(name);
        const idx = d.findIndex(i => (q._id && i._id === q._id) || (q.code && i.code === q.code) || (q.type && i.type === q.type));
        if (idx > -1) {
          if (up.$set) Object.assign(d[idx], up.$set, { updatedAt: new Date() });
          if (up.$inc) { Object.keys(up.$inc).forEach(k => d[idx][k] = (d[idx][k]||0) + up.$inc[k]); d[idx].updatedAt = new Date(); }
          self._write(name, d); return { modifiedCount: 1 };
        }
        return { modifiedCount: 0 };
      },
      deleteOne: async (q) => {
        let d = self._read(name);
        const idx = d.findIndex(i => i._id === q._id || i.code === q.code);
        if (idx > -1) { d.splice(idx, 1); self._write(name, d); return { deletedCount: 1 }; }
        return { deletedCount: 0 };
      },
      countDocuments: async (q = {}) => (await this.collection(name).find(q)).toArray().then(r => r.length),
      aggregate: async (pipeline) => {
        let data = self._read(name);
        for (const stage of pipeline) {
          if (stage.$match) {
            data = data.filter(i => {
              if (stage.$match.status?.$ne) return i.status !== stage.$match.status.$ne;
              if (stage.$match.createdAt?.$gte) return new Date(i.createdAt) >= new Date(stage.$match.createdAt.$gte);
              return true;
            });
          }
          if (stage.$group) {
            const g = {};
            data.forEach(i => {
              const d = new Date(i.createdAt).toISOString().split('T')[0];
              if (!g[d]) g[d] = { _id: d, orders: 0, revenue: 0 };
              g[d].orders++;
              g[d].revenue += i.pricing?.total || 0;
              g[d].averageOrder = g[d].revenue / g[d].orders;
            });
            data = Object.values(g);
          }
          if (stage.$sort) data.sort((a,b) => a._id.localeCompare(b._id));
        }
        return { toArray: async () => data };
      }
    };
  }
}
const DB = new LocalDB();

// ============ أدوات ============
const JWT_SECRET = process.env.JWT_SECRET || 'alradi-secret-2024';
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { req.user = null; return next(); }
  try { req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET); next(); } catch { req.user = null; next(); }
}
function adminRequired(req, res, next) {
  if (!req.user || !['admin','superadmin','manager'].includes(req.user.role)) return res.status(403).json({ error: 'صلاحيات المدير مطلوبة' });
  next();
}
app.use(authMiddleware);

// ============ نقاط الولاء ============
const LOYALTY_TIERS = [
  { name: 'برونزي', min: 0, discount: 0 },
  { name: 'فضي', min: 500, discount: 5 },
  { name: 'ذهبي', min: 1000, discount: 10 },
  { name: 'بلاتيني', min: 2000, discount: 15 }
];
function getTier(points) { return LOYALTY_TIERS.reduce((t, c) => points >= c.min ? c : t, LOYALTY_TIERS[0]); }

// ============ API: المصادقة ============
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;
    if (!fullName || !email || !phone || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    const exists = await DB.collection('users').findOne({ email });
    if (exists) return res.status(400).json({ error: 'البريد مسجل مسبقاً' });
    const hash = await bcrypt.hash(password, 10);
    const user = await DB.collection('users').insertOne({ fullName, email, phone, password: hash, role: 'customer', loyaltyPoints: 0, loyaltyTier: 'برونزي', isActive: true, preferences: { locale:'ar', currency:'SAR', theme:'dark' } });
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ success: true, token, user: { id: user._id, fullName, email, phone, loyaltyPoints: 0, loyaltyTier: 'برونزي' } });
  } catch (e) { res.status(500).json({ error: 'فشل التسجيل' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await DB.collection('users').findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'بيانات خاطئة' });
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    await DB.collection('users').updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    res.json({ success: true, token, user: { id: user._id, fullName: user.fullName, email: user.email, phone: user.phone, loyaltyPoints: user.loyaltyPoints, loyaltyTier: getTier(user.loyaltyPoints).name } });
  } catch (e) { res.status(500).json({ error: 'فشل تسجيل الدخول' }); }
});

app.get('/api/user/profile', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'يرجى تسجيل الدخول' });
  const user = await DB.collection('users').findOne({ _id: req.user.id });
  if (!user) return res.status(404).json({ error: 'غير موجود' });
  res.json({ success: true, data: { ...user, loyaltyTier: getTier(user.loyaltyPoints).name, discountPercent: getTier(user.loyaltyPoints).discount } });
});

// ============ API: المنتجات ============
app.get('/api/products', async (req, res) => {
  const { page=1, limit=20, category, search, featured, flashSale } = req.query;
  const q = { isActive: true };
  if (category) q.category = category;
  if (featured) q.isFeatured = true;
  if (flashSale) q['flashSale.isActive'] = true;
  if (search) q.$or = [{ name: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }];
  const items = await DB.collection('products').find(q);
  const all = await items.toArray();
  const total = all.length;
  all.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  const paged = all.slice((page-1)*limit, page*limit);
  res.json({ success: true, data: paged, pagination: { page: +page, limit: +limit, total, pages: Math.ceil(total/limit) } });
});

app.get('/api/products/:id', async (req, res) => {
  const p = await DB.collection('products').findOne({ _id: req.params.id });
  if (!p) return res.status(404).json({ error: 'غير موجود' });
  const related = (await DB.collection('products').find({ category: p.category, isActive: true }).toArray()).filter(x => x._id !== p._id).slice(0,4);
  res.json({ success: true, data: { ...p, relatedProducts: related } });
});

app.post('/api/products', adminRequired, async (req, res) => {
  const product = await DB.collection('products').insertOne({ ...req.body, sku: 'SKU-'+uuidv4().slice(0,8), isActive: true, ratings: { average:0, count:0 } });
  res.status(201).json({ success: true, data: product });
});

app.put('/api/products/:id', adminRequired, async (req, res) => {
  await DB.collection('products').updateOne({ _id: req.params.id }, { $set: { ...req.body, updatedAt: new Date() } });
  res.json({ success: true, message: 'تم التحديث' });
});

app.delete('/api/products/:id', adminRequired, async (req, res) => {
  const product = await DB.collection('products').findOne({ _id: req.params.id });
  if (product) {
    await DB.collection('trash').insertOne({ ...product, deletedAt: new Date(), originalCollection: 'products' });
    await DB.collection('products').deleteOne({ _id: req.params.id });
  }
  res.json({ success: true, message: 'نقل إلى سلة المحذوفات' });
});

// ============ API: السلة والفوترة ============
app.post('/api/cart/loyalty-discount', async (req, res) => {
  if (!req.user) return res.json({ success: true, discountPercent: 0 });
  const user = await DB.collection('users').findOne({ _id: req.user.id });
  const tier = getTier(user?.loyaltyPoints || 0);
  res.json({ success: true, discountPercent: tier.discount, tierName: tier.name });
});

app.post('/api/checkout', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'يرجى تسجيل الدخول' });
  const { items, shippingAddress, shippingType='internal', paymentMethod='cod', couponCode, notes } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'السلة فارغة' });
  const user = await DB.collection('users').findOne({ _id: req.user.id });
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  for (const item of items) {
    const prod = await DB.collection('products').findOne({ _id: item.productId });
    if (!prod || prod.stock < item.quantity) return res.status(400).json({ error: `${item.name} غير متوفر` });
  }
  for (const item of items) await DB.collection('products').updateOne({ _id: item.productId }, { $inc: { stock: -item.quantity } });
  const subtotal = items.reduce((s,i) => s + (i.price * i.quantity), 0);
  const tier = getTier(user.loyaltyPoints || 0);
  const loyaltyDiscount = subtotal * (tier.discount / 100);
  const shippingRate = shippingType === 'internal' ? 0.05 : 0.10;
  const shippingCost = subtotal * shippingRate;
  let couponDiscount = 0;
  if (couponCode) {
    const coupon = await DB.collection('coupons').findOne({ code: couponCode, isActive: true });
    if (coupon) {
      couponDiscount = coupon.discountType === 'percentage' ? subtotal * (coupon.discountValue/100) : coupon.discountValue;
      await DB.collection('coupons').updateOne({ code: couponCode }, { $inc: { usedCount: 1 } });
    }
  }
  const totalDiscount = loyaltyDiscount + couponDiscount;
  const taxRate = 15;
  const tax = (subtotal - totalDiscount) * (taxRate/100);
  const total = subtotal - totalDiscount + tax + shippingCost;
  const orderNumber = `R3D-${Date.now().toString(36).toUpperCase()}`;
  const order = await DB.collection('orders').insertOne({
    orderNumber, user: req.user.id, items, shipping: { type: shippingType, address: shippingAddress, cost: shippingCost },
    pricing: { subtotal, shippingCost, discount: totalDiscount, loyaltyDiscount, couponDiscount, tax, taxRate, total },
    payment: { method: paymentMethod, status: paymentMethod==='cod'?'pending':'pending' },
    status: 'pending', statusHistory: [{ status:'pending', note:'تم الإنشاء', updatedAt: new Date() }],
    maintenanceReminders: items.filter(i => i.maintenanceReminder).map(i => ({ productId: i.productId, productName: i.name, intervalDays: i.maintenanceInterval || 90, dueDate: new Date(Date.now() + (i.maintenanceInterval||90)*86400000), notified: false })),
    createdAt: new Date(), updatedAt: new Date()
  });
  const pointsEarned = Math.floor(total / 10);
  await DB.collection('users').updateOne({ _id: req.user.id }, { $inc: { loyaltyPoints: pointsEarned } });
  const newTier = getTier((user.loyaltyPoints||0) + pointsEarned);
  await DB.collection('audit_logs').insertOne({ userId: req.user.id, action: 'CREATE_ORDER', details: `طلب #${orderNumber}`, createdAt: new Date() });
  res.status(201).json({ success: true, message: 'تم الطلب', data: { orderNumber, total, pointsEarned, newTier: newTier.name } });
});

// ============ API: الفاتورة ============
app.get('/api/invoice/:orderNumber', async (req, res) => {
  const order = await DB.collection('orders').findOne({ orderNumber: req.params.orderNumber });
  if (!order) return res.status(404).json({ error: 'غير موجود' });
  const user = await DB.collection('users').findOne({ _id: order.user });
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);
  doc.fontSize(24).fillColor('#C9A84C').text('الرعدي أونلاين', { align: 'right' });
  doc.fontSize(16).fillColor('#333').text('فاتورة شراء', { align: 'left' });
  doc.moveDown();
  doc.fontSize(12).fillColor('#333').text(`رقم الطلب: ${order.orderNumber}`, { align: 'right' });
  doc.text(`التاريخ: ${new Date(order.createdAt).toLocaleDateString('ar-SA')}`, { align: 'right' });
  (order.items||[]).forEach((item, i) => doc.text(`${i+1}. ${item.name} - ${item.quantity} × ${item.price} = ${item.quantity*item.price} ر.س`, { align: 'right' }));
  doc.moveDown();
  doc.fontSize(16).fillColor('#C9A84C').text(`الإجمالي: ${order.pricing.total} ر.س`, { align: 'right' });
  doc.end();
});

// ============ API: الكوبونات ============
app.post('/api/coupons/validate', async (req, res) => {
  const { code, cartTotal } = req.body;
  const coupon = await DB.collection('coupons').findOne({ code, isActive: true });
  if (!coupon) return res.status(400).json({ error: 'الكوبون غير صالح' });
  const discount = coupon.discountType === 'percentage' ? cartTotal * (coupon.discountValue/100) : coupon.discountValue;
  res.json({ success: true, data: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue, discount } });
});
app.get('/api/coupons', adminRequired, async (req, res) => {
  res.json({ success: true, data: await DB.collection('coupons').find().toArray() });
});
app.post('/api/coupons', adminRequired, async (req, res) => {
  const coupon = await DB.collection('coupons').insertOne({ ...req.body, usedCount: 0, isActive: true, createdAt: new Date() });
  res.status(201).json({ success: true, data: coupon });
});
app.delete('/api/coupons/:code', adminRequired, async (req, res) => {
  await DB.collection('coupons').updateOne({ code: req.params.code }, { $set: { isActive: false } });
  res.json({ success: true, message: 'تم التعطيل' });
});

// ============ API: الطلبات ============
app.get('/api/orders', adminRequired, async (req, res) => {
  const { status } = req.query;
  const q = {};
  if (status && status !== 'all') q.status = status;
  const orders = await DB.collection('orders').find(q).toArray();
  orders.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, data: orders });
});
app.put('/api/orders/:id/status', adminRequired, async (req, res) => {
  const { status, note } = req.body;
  const order = await DB.collection('orders').findOne({ _id: req.params.id });
  if (!order) return res.status(404).json({ error: 'غير موجود' });
  const history = order.statusHistory || [];
  history.push({ status, note: note || '', updatedBy: req.user.id, updatedAt: new Date() });
  await DB.collection('orders').updateOne({ _id: req.params.id }, { $set: { status, statusHistory: history, updatedAt: new Date() } });
  res.json({ success: true, message: 'تم تحديث الحالة' });
});
app.get('/api/orders/user/:userId', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'يرجى تسجيل الدخول' });
  const orders = await DB.collection('orders').find({ user: req.params.userId }).toArray();
  orders.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, data: orders });
});

// ============ API: العملاء ============
app.get('/api/users', adminRequired, async (req, res) => {
  const { role } = req.query;
  const q = {};
  if (role) q.role = role;
  res.json({ success: true, data: await DB.collection('users').find(q).toArray() });
});

// ============ API: لوحة القيادة ============
app.get('/api/admin/stats', adminRequired, async (req, res) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const [orders, products, customers] = await Promise.all([
    DB.collection('orders').find().toArray(),
    DB.collection('products').find().toArray(),
    DB.collection('users').find({ role: 'customer' }).toArray()
  ]);
  const activeOrders = orders.filter(o => o.status !== 'cancelled');
  const todayOrders = orders.filter(o => new Date(o.createdAt) >= today);
  res.json({ success: true, data: {
    totalOrders: orders.length, todayOrders: todayOrders.length,
    totalRevenue: activeOrders.reduce((s,o) => s + (o.pricing?.total||0), 0),
    todayRevenue: todayOrders.filter(o => o.status!=='cancelled').reduce((s,o) => s + (o.pricing?.total||0), 0),
    totalCustomers: customers.length, totalProducts: products.length,
    lowStockProducts: products.filter(p => p.stock <= 5).length,
    recentOrders: orders.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0,10)
  } });
});

app.get('/api/admin/reports', adminRequired, async (req, res) => {
  const { type='sales', period='daily' } = req.query;
  if (type === 'sales') {
    const result = await DB.collection('orders').aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: { $dateToString: { format: period==='daily'?'%Y-%m-%d':'%Y-%m', date: '$createdAt' } }, orders: { $sum: 1 }, revenue: { $sum: '$pricing.total' }, averageOrder: { $avg: '$pricing.total' } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({ success: true, data: await result.toArray() });
  } else {
    res.json({ success: true, data: [] });
  }
});

// ============ API: الإعدادات ============
app.get('/api/admin/settings/:type', adminRequired, async (req, res) => {
  const setting = await DB.collection('settings').findOne({ type: req.params.type });
  res.json({ success: true, data: setting?.data || null });
});
app.put('/api/admin/settings', adminRequired, async (req, res) => {
  const { type, data } = req.body;
  const existing = await DB.collection('settings').findOne({ type });
  if (existing) await DB.collection('settings').updateOne({ type }, { $set: { data, updatedAt: new Date() } });
  else await DB.collection('settings').insertOne({ type, data, createdAt: new Date() });
  res.json({ success: true, message: 'تم الحفظ' });
});

// ============ API: الصيانة التنبؤية ============
app.get('/api/admin/maintenance-alerts', adminRequired, async (req, res) => {
  const orders = await DB.collection('orders').find().toArray();
  const alerts = [];
  orders.forEach(order => {
    if (order.maintenanceReminders) order.maintenanceReminders.forEach(r => {
      if (!r.notified && new Date(r.dueDate) > new Date()) alerts.push({ orderNumber: order.orderNumber, product: r.productName, dueDate: r.dueDate, daysLeft: Math.ceil((new Date(r.dueDate) - new Date())/86400000) });
    });
  });
  alerts.sort((a,b) => a.daysLeft - b.daysLeft);
  res.json({ success: true, data: alerts });
});

// ============ API: البانرات ============
app.get('/api/banners', async (req, res) => {
  res.json({ success: true, data: await DB.collection('banners').find({ isActive: true }).toArray() });
});
app.post('/api/banners', adminRequired, async (req, res) => {
  const banner = await DB.collection('banners').insertOne({ ...req.body, isActive: true, createdAt: new Date() });
  res.status(201).json({ success: true, data: banner });
});
app.delete('/api/banners/:id', adminRequired, async (req, res) => {
  await DB.collection('banners').updateOne({ _id: req.params.id }, { $set: { isActive: false } });
  res.json({ success: true, message: 'تم التعطيل' });
});

// ============ API: الصوتيات ============
app.get('/api/sounds', adminRequired, async (req, res) => {
  res.json({ success: true, data: await DB.collection('sounds').find().toArray() });
});
app.post('/api/sounds', adminRequired, upload.single('file'), async (req, res) => {
  const sound = await DB.collection('sounds').insertOne({ name: req.body.name, url: `/uploads/sounds/${req.file.filename}`, createdAt: new Date() });
  res.status(201).json({ success: true, data: sound });
});

// ============ API: سلة المحذوفات ============
app.get('/api/trash', adminRequired, async (req, res) => {
  res.json({ success: true, data: await DB.collection('trash').find().toArray() });
});
app.post('/api/trash/restore/:id', adminRequired, async (req, res) => {
  const item = await DB.collection('trash').findOne({ _id: req.params.id });
  if (!item) return res.status(404).json({ error: 'غير موجود' });
  await DB.collection(item.originalCollection).insertOne({ ...item });
  await DB.collection('trash').deleteOne({ _id: req.params.id });
  res.json({ success: true, message: 'تمت الاستعادة' });
});

// ============ API: سجل النشاطات ============
app.get('/api/audit-logs', adminRequired, async (req, res) => {
  const logs = await DB.collection('audit_logs').find().toArray();
  logs.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, data: logs });
});

// ============ API: النسخ الاحتياطي ============
app.post('/api/backup', adminRequired, async (req, res) => {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const dir = path.join(__dirname, 'backups', timestamp);
  fs.mkdirSync(dir, { recursive: true });
  const output = fs.createWriteStream(path.join(dir, 'backup.zip'));
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(output);
  archive.directory(path.join(__dirname, 'data'), 'data');
  archive.directory(path.join(__dirname, 'uploads'), 'uploads');
  await archive.finalize();
  res.json({ success: true, path: `/backups/${timestamp}/backup.zip` });
});

// ============ رفع الملفات ============
app.post('/api/upload', upload.array('files', 20), async (req, res) => {
  const files = (req.files || []).map(f => ({ url: `/uploads/${req.body?.type || 'general'}/${f.filename}`, originalName: f.originalname, size: f.size, type: f.mimetype }));
  res.json({ success: true, data: files });
});

// ============ WebSocket ============
io.on('connection', (socket) => {
  socket.on('join', (room) => socket.join(room));
  socket.on('chat message', (msg) => io.emit('chat message', msg));
});

// ============ الصيانة التنبؤية اليومية ============
cron.schedule('0 8 * * *', async () => {
  const orders = await DB.collection('orders').find().toArray();
  for (const order of orders) {
    if (!order.maintenanceReminders) continue;
    for (const rem of order.maintenanceReminders) {
      if (!rem.notified && new Date(rem.dueDate) <= new Date()) {
        rem.notified = true;
        await DB.collection('orders').updateOne({ _id: order._id }, { $set: { maintenanceReminders: order.maintenanceReminders } });
      }
    }
  }
});

// ============ بذرة البيانات ============
async function seed() {
  const count = await DB.collection('products').countDocuments();
  if (count > 0) return;
  const products = [
    { name: '📱 ساعة ذكية فاخرة Pro Max', description: 'ساعة ذكية بمميزات متطورة', price: 599, comparePrice: 899, stock: 50, category: 'إلكترونيات', images: [{ url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', type: 'main' }], ratings: { average: 4.5, count: 120 }, flashSale: { isActive: true, discountPercentage: 30, startDate: new Date(), endDate: new Date(Date.now()+86400000) }, isFeatured: true },
    { name: '🎧 سماعات لاسلكية بريميوم', description: 'سماعات بجودة صوت Hi-Res', price: 349, stock: 100, category: 'إلكترونيات', images: [{ url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', type: 'main' }], ratings: { average: 4.2, count: 85 }, isFeatured: true },
    { name: '🧴 عطر شرقي فاخر 100ml', description: 'تركيبة شرقية أصيلة', price: 450, comparePrice: 600, stock: 30, category: 'عطور', images: [{ url: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400', type: 'main' }], ratings: { average: 4.8, count: 200 } },
    { name: '👜 حقيبة يد جلد طبيعي', description: 'جلد طبيعي 100%', price: 799, stock: 15, category: 'أزياء', images: [{ url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400', type: 'main' }], ratings: { average: 4.0, count: 45 } },
    { name: '🏠 سجاد يدوي تقليدي', description: 'صوف طبيعي منسوج يدوياً', price: 1200, stock: 8, category: 'منزل', images: [{ url: 'https://images.unsplash.com/photo-1600166898405-da9535204843?w=400', type: 'main' }], ratings: { average: 4.6, count: 30 } },
    { name: '☕ جهاز قهوة احترافي', description: 'ضغط 15 بار، طاحونة مدمجة', price: 899, stock: 20, category: 'منزل', images: [{ url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400', type: 'main' }], ratings: { average: 4.3, count: 67 } },
    { name: '🕶️ نظارة شمسية فاخرة', description: 'إطار ذهبي، عدسات بولارايد', price: 650, stock: 40, category: 'أزياء', images: [{ url: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400', type: 'main' }], ratings: { average: 4.1, count: 55 } },
    { name: '📱 هاتف ذكي Ultra', description: 'شاشة 6.8\"، كاميرا 200MP', price: 2999, comparePrice: 3499, stock: 12, category: 'إلكترونيات', images: [{ url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400', type: 'main' }], ratings: { average: 4.7, count: 310 }, flashSale: { isActive: true, discountPercentage: 15, endDate: new Date(Date.now()+86400000) }, isFeatured: true }
  ];
  for (const p of products) await DB.collection('products').insertOne({ ...p, sku: 'SKU-'+uuidv4().slice(0,8), isActive: true, reviews: [], tags: [p.category], createdAt: new Date(), updatedAt: new Date() });
  await DB.collection('coupons').insertOne({ code: 'WELCOME10', discountType: 'percentage', discountValue: 10, minOrderAmount: 100, maxUses: 1000, usedCount: 0, isActive: true, description: 'خصم 10%', expiryDate: new Date(Date.now()+365*86400000), createdAt: new Date() });
  await DB.collection('coupons').insertOne({ code: 'FLASH50', discountType: 'fixed', discountValue: 50, minOrderAmount: 500, maxUses: 500, usedCount: 0, isActive: true, description: 'خصم 50 ريال', expiryDate: new Date(Date.now()+30*86400000), createdAt: new Date() });
  const hash = await bcrypt.hash('admin123', 10);
  await DB.collection('users').insertOne({ fullName: 'مدير النظام', email: 'admin@alradi.com', phone: '+966500000000', password: hash, role: 'admin', loyaltyPoints: 9999, loyaltyTier: 'بلاتيني', isActive: true, preferences: { locale:'ar', currency:'SAR', theme:'dark-gold' }, createdAt: new Date() });
  await DB.collection('settings').insertOne({ type: 'store', data: { storeName: 'الرعدي أونلاين', primaryColor: '#C9A84C', secondaryColor: '#1A1A2E' }, createdAt: new Date() });
  await DB.collection('settings').insertOne({ type: 'shipping', data: { internalRate: 5, externalRate: 10 }, createdAt: new Date() });
  await DB.collection('settings').insertOne({ type: 'return_policy', data: { text: 'الاستبدال مسموح خلال 14 يوماً', window: 14 }, createdAt: new Date() });
  console.log('✅ تم إضافة البيانات التجريبية');
  console.log('👑 المدير: admin@alradi.com / admin123');
}

// ============ الصفحات ============
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => { if (!req.path.startsWith('/api/')) res.sendFile(path.join(__dirname, 'public', 'index.html')); else res.status(404).json({ error: 'المسار غير موجود' }); });

// ============ بدء التشغيل ============
const PORT = process.env.PORT || 3000;
(async () => {
  ['public', 'uploads', 'uploads/products', 'uploads/sounds', 'uploads/general', 'data', 'backups'].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
  await seed();
  server.listen(PORT, () => {
    console.log(`⚡ الرعدي أونلاين يعمل على المنفذ ${PORT}`);
    console.log(`🌐 المتجر: http://localhost:${PORT}`);
    console.log(`👑 لوحة التحكم: http://localhost:${PORT}/admin`);
  });
})();
