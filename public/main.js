// main.js — واجهة أمامية شاملة

// ---------------------- صوت الترحيب ----------------------
const audio = document.getElementById('welcomeAudio');
const playBtn = document.getElementById('playWelcome');
if(playBtn){
  playBtn.addEventListener('click', () => {
    audio.play().catch(()=>alert('يرجى السماح بتشغيل الصوت من المتصفح'));
  });
}
// محاولة تشغيل تلقائي عند التحميل
window.addEventListener('load', () => {
  audio.play().catch(()=>{ /* بعض المتصفحات تمنع التشغيل */ });
});

// ---------------------- المنتجات ----------------------
async function fetchProducts(){
  try{
    const res = await fetch('/api/products');
    const data = await res.json();
    renderProducts(data);
    renderAdminProducts(data);
  }catch(e){
    console.error('فشل جلب المنتجات', e);
    showToast('خطأ في تحميل المنتجات');
  }
}

function renderProducts(items){
  const grid = document.getElementById('productsGrid');
  if(!grid) return;
  grid.innerHTML = '';
  if(!items.length){
    grid.innerHTML = '<div style="padding:20px;background:#fff;border-radius:10px">لا توجد منتجات الآن</div>';
    return;
  }
  items.forEach(p=>{
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <img src="${p.image || '/assets/product-placeholder.jpg'}" alt="${escapeHtml(p.name)}" />
      <h4>${escapeHtml(p.name)}</h4>
      <p>${escapeHtml(p.description || '')}</p>
      <div class="price">${Number(p.price).toFixed(2)} ر.س</div>
      <button class="btn primary" onclick="addToCart(${p.id})">أضف للسلة</button>
      <button class="btn secondary" onclick="viewProduct(${p.id})">عرض</button>
    `;
    grid.appendChild(el);
  });
}

// ---------------------- السلة ----------------------
let cart = JSON.parse(localStorage.getItem('cart_v1') || '[]');

function addToCart(id){
  const found = cart.find(i=>i.id===id);
  if(found) found.qty++;
  else cart.push({id, qty:1});
  saveCart();
  renderCart();
  showToast('تمت الإضافة إلى السلة');
}

function saveCart(){
  localStorage.setItem('cart_v1', JSON.stringify(cart));
}

function renderCart(){
  const div = document.getElementById('cartItems');
  if(!div) return;
  div.innerHTML = '';
  if(!cart.length){
    div.innerHTML = '<p>السلة فارغة</p>';
    return;
  }
  cart.forEach(c=>{
    const el = document.createElement('div');
    el.textContent = `منتج رقم ${c.id} × ${c.qty}`;
    div.appendChild(el);
  });
}

function checkout(){
  if(!cart.length){ showToast('السلة فارغة'); return; }
  alert('إتمام الطلب (تجريبي)');
  // هنا يمكن استدعاء /api/orders مع بيانات العميل
}

// ---------------------- لوحة المدير ----------------------
function renderAdminProducts(items){
  const div = document.getElementById('adminProducts');
  if(!div) return;
  div.innerHTML = '';
  items.forEach(p=>{
    const el = document.createElement('div');
    el.textContent = `${p.name} — ${p.price} ر.س`;
    div.appendChild(el);
  });
}

const addForm = document.getElementById('addProductForm');
if(addForm){
  addForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const formData = new FormData(addForm);
    // تجريبي: فقط عرض القيم
    const name = formData.get('name');
    const price = formData.get('price');
    showToast(`إضافة منتج: ${name} بسعر ${price} ر.س`);
    addForm.reset();
  });
}

// ---------------------- الفاتورة ----------------------
function downloadInvoice(){
  if(!cart.length){ showToast('لا توجد عناصر'); return; }
  alert('تحميل الفاتورة PDF (تجريبي)');
  // يمكن استدعاء /api/invoice/:orderId بعد إنشاء الطلب
}

// ---------------------- أدوات مساعدة ----------------------
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function showToast(text){
  const t = document.createElement('div');
  t.textContent = text;
  Object.assign(t.style,{
    position:'fixed',left:'50%',transform:'translateX(-50%)',
    bottom:'24px',background:'#0b1220',color:'#fff',
    padding:'10px 14px',borderRadius:'8px',zIndex:9999
  });
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2000);
}

// ---------------------- صفحة المنتج ----------------------
function viewProduct(id){
  window.location.href = `/product.html?id=${id}`;
}

// ---------------------- تحميل أولي ----------------------
fetchProducts();
renderCart();
