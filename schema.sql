-- إنشاء جدول المستخدمين (المدير والزبائن)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'customer', -- قيم: admin أو customer
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول المنتجات
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    old_price NUMERIC(10,2),
    category VARCHAR(50),
    image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول الطلبات
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- قيم: pending, paid, shipped
    total NUMERIC(10,2) DEFAULT 0,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول عناصر الطلب
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    quantity INT DEFAULT 1,
    price NUMERIC(10,2) NOT NULL
);

-- إدخال مدير افتراضي
INSERT INTO users (username, password, role, email)
VALUES ('admin', '$2b$10$abcdefghijklmnopqrstuv', 'admin', 'admin@example.com');
-- ملاحظة: كلمة المرور هنا مشفرة بـ bcrypt (غيّرها عندك)

-- إدخال منتجات تجريبية
INSERT INTO products (name, description, price, old_price, category, image)
VALUES 
('عطر فاخر', 'عطر مميز برائحة شرقية', 120.00, 150.00, 'عطور', '/assets/product1.jpg'),
('هاتف ذكي', 'هاتف حديث بشاشة كبيرة', 950.00, 1100.00, 'هواتف', '/assets/product2.jpg'),
('حذاء رياضي', 'حذاء مريح للجري', 300.00, 350.00, 'أزياء', '/assets/product3.jpg');
