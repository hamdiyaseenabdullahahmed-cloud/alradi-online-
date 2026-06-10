const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg"); // مكتبة PostgreSQL

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public")); // يخدم ملفات index.html و admin.html

// إعداد الاتصال بقاعدة البيانات
const pool = new Pool({
  user: "postgres",       // ضع اسم المستخدم لقاعدة البيانات
  host: "localhost",      // أو عنوان السيرفر إذا كان خارجي
  database: "alraadi_db", // اسم قاعدة البيانات
  password: "password",   // كلمة مرور قاعدة البيانات
  port: 5432              // المنفذ الافتراضي لـ PostgreSQL
});

// ✅ إنشاء الجداول إذا لم تكن موجودة
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100),
      email VARCHAR(100) UNIQUE,
      password VARCHAR(200),
      phone VARCHAR(20),
      address TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100),
      price NUMERIC,
      stock INT,
      category VARCHAR(50),
      image TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id),
      product_id INT REFERENCES products(id),
      quantity INT,
      status VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
initDB();

// ✅ تسجيل مستخدم جديد
app.post("/register", async (req, res) => {
  const { name, email, password, phone, address } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    await pool.query(
      "INSERT INTO users (name, email, password, phone, address) VALUES ($1,$2,$3,$4,$5)",
      [name, email, hashedPassword, phone, address]
    );
    res.json({ success: true, message: "تم إنشاء الحساب بنجاح" });
  } catch (err) {
    res.json({ success: false, message: "خطأ: البريد الإلكتروني مستخدم بالفعل" });
  }
});

// ✅ تسجيل الدخول
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  if (result.rows.length > 0) {
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      const token = jwt.sign({ id: user.id, email: user.email }, "secretKey", { expiresIn: "1h" });
      res.json({ success: true, token });
    } else {
      res.json({ success: false, message: "كلمة المرور غير صحيحة" });
    }
  } else {
    res.json({ success: false, message: "المستخدم غير موجود" });
  }
});

// ✅ جلب المنتجات
app.get("/products", async (req, res) => {
  const result = await pool.query("SELECT * FROM products");
  res.json(result.rows);
});

// ✅ إضافة منتج جديد
app.post("/products", async (req, res) => {
  const { name, price, stock, category, image } = req.body;
  await pool.query(
    "INSERT INTO products (name, price, stock, category, image) VALUES ($1,$2,$3,$4,$5)",
    [name, price, stock, category, image]
  );
  res.json({ success: true, message: "تم إضافة المنتج بنجاح" });
});

// ✅ إنشاء طلب جديد
app.post("/orders", async (req, res) => {
  const { user_id, product_id, quantity } = req.body;
  await pool.query(
    "INSERT INTO orders (user_id, product_id, quantity, status) VALUES ($1,$2,$3,$4)",
    [user_id, product_id, quantity, "قيد المعالجة"]
  );
  res.json({ success: true, message: "تم إنشاء الطلب بنجاح" });
});

// ✅ جلب الطلبات
app.get("/orders", async (req, res) => {
  const result = await pool.query(`
    SELECT orders.id, users.name AS customer, products.name AS product, orders.quantity, orders.status, orders.created_at
    FROM orders
    JOIN users ON orders.user_id = users.id
    JOIN products ON orders.product_id = products.id
  `);
  res.json(result.rows);
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 الرعدي أونلاين يعمل على المنفذ ${PORT}`);
});
