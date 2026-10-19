import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

const $ = (id) => document.getElementById(id);
let config = { whatsappNumber: "" };
let products = [];

function money(value) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(value || 0));
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function orderUrl(product) {
  if (!config.whatsappNumber) return "";
  const message = `Hello HOUSE OF FAVÉ! ✨\n\nI'd like to order a product from your website.\n\n🛍️ Product: ${product.name}\n💰 Price: ${money(product.price)}\n🔢 Quantity: 1\n\nPlease confirm availability and let me know how I can complete my order.\n\nThank you!`;
  return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
function renderProducts() {
  const query = $("search").value.trim().toLowerCase();
  const category = $("category").value;
  const shown = products.filter(p => p.available && (!category || p.category === category) &&
    `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(query));
  $("empty-state").hidden = shown.length > 0;
  $("product-grid").innerHTML = shown.map(p => {
    const img = p.image_url
      ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><div class="product-placeholder" style="display:none">HF</div>`
      : `<div class="product-placeholder">HF</div>`;
    const url = orderUrl(p);
    return `<article class="product-card"><div class="product-image">${img}${p.available ? "" : '<span class="stock-label">SOLD OUT</span>'}</div><div class="product-info"><span class="product-category">${escapeHtml(p.category)}</span><h3>${escapeHtml(p.name)}</h3><p class="product-description">${escapeHtml(p.description)}</p><div class="product-bottom"><span class="price">${money(p.price)}</span><a class="order-button" ${url ? `href="${url}" target="_blank" rel="noopener noreferrer"` : 'href="#contact"'}>${url ? "Order via WhatsApp ↗" : "Contact to order"}</a></div></div></article>`;
  }).join("");
}
async function boot() {
  $("year").textContent = new Date().getFullYear();
  try {
    const cfgResponse = await fetch("/api/config");
    config = await cfgResponse.json();
    if (config.whatsappNumber) $("contact-whatsapp").href = `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent("Hello HOUSE OF FAVÉ! I'd like to make an enquiry.")}`;
    if (config.firebaseApiKey && config.firebaseAuthDomain && config.firebaseProjectId && config.firebaseAppId) {
      initializeApp({ apiKey: config.firebaseApiKey, authDomain: config.firebaseAuthDomain, projectId: config.firebaseProjectId, appId: config.firebaseAppId });
    }
  } catch (e) { console.warn("Configuration could not be loaded.", e); }
  try {
    const response = await fetch("/api/products");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load products");
    products = data;
    renderProducts();
  } catch (e) {
    $("product-grid").innerHTML = `<div class="loading">The collection will appear here once the store database is connected.</div>`;
  }
  $("search").addEventListener("input", renderProducts);
  $("category").addEventListener("change", renderProducts);
}
boot();
