import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

const $ = id => document.getElementById(id);
const ADMIN_EMAILS = new Set(["favouranigbogu44@gmail.com", "whitefrostff@gmail.com"]);
let auth = null, currentUser = null, products = [];
const money = n => new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(Number(n||0));
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function notice(message, error=false){$("admin-notice").textContent=message;$("admin-notice").style.color=error?"#a32236":"#28613b";}
function loginNotice(message){$("login-message").textContent=message;}
async function token(){if(!currentUser)throw new Error("Please sign in first.");return currentUser.getIdToken();}
async function api(url, options={}) {
  const idToken = await token();
  const response = await fetch(url,{...options,headers:{"Content-Type":"application/json","Authorization":`Bearer ${idToken}`,...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||"Request failed.");
  return data;
}
function clearForm(){ $("product-form").reset();$("product-id").value="";$("p-available").checked=true;$("form-title").textContent="Add a product";$("save-product").textContent="Publish product";$("cancel-edit").hidden=true; }
function fillForm(p){$("product-id").value=p.id;$("p-name").value=p.name;$("p-price").value=p.price;$("p-category").value=p.category;$("p-image").value=p.image_url||"";$("p-description").value=p.description||"";$("p-available").checked=Boolean(p.available);$("form-title").textContent="Edit product";$("save-product").textContent="Save changes";$("cancel-edit").hidden=false;window.scrollTo({top:0,behavior:"smooth"});}
function renderProducts(){
  $("admin-products").innerHTML=products.length?products.map(p=>`<article class="admin-product"><div>${p.image_url?`<img src="${esc(p.image_url)}" alt="" onerror="this.style.display='none'">`:'<div class="no-image">HF</div>'}</div><div><h3>${esc(p.name)}</h3><p>${esc(p.category)}</p><div class="product-price">${money(p.price)}</div><span class="status-pill ${p.available?'':'off'}">${p.available?'Published':'Unavailable'}</span></div><div class="product-actions"><button class="quiet-button" data-edit="${esc(p.id)}">Edit</button><button class="quiet-button" data-delete="${esc(p.id)}">Delete</button></div></article>`).join(""):'<p class="muted">No products yet. Add your first product using the form.</p>';
  $("admin-products").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>{const p=products.find(x=>String(x.id)===b.dataset.edit);if(p)fillForm(p);}));
  $("admin-products").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{const p=products.find(x=>String(x.id)===b.dataset.delete);if(!p||!confirm(`Delete "${p.name}"? This cannot be undone.`))return;try{await api(`/api/products/${p.id}`,{method:"DELETE"});notice("Product deleted.");await loadProducts();}catch(e){notice(e.message,true);}}));
}
async function loadProducts(){try{products=await api("/api/products?includeUnavailable=true");renderProducts();}catch(e){notice(e.message,true);}}
async function showDashboard(user){
  currentUser=user;
  $("login-panel").hidden=true;$("dashboard").hidden=false;$("signed-email").textContent=user.email||"";
  await loadProducts();
}
function showLogin(){currentUser=null;$("dashboard").hidden=true;$("login-panel").hidden=false;}
async function start(){
  try{
    const cfg=await (await fetch("/api/config")).json();
    if(!cfg.firebaseApiKey||!cfg.firebaseAuthDomain||!cfg.firebaseProjectId||!cfg.firebaseAppId){loginNotice("Google login isn't configured yet. Add the Firebase web app settings in Render.");$("google-login").disabled=true;return;}
    const app=initializeApp({apiKey:cfg.firebaseApiKey,authDomain:cfg.firebaseAuthDomain,projectId:cfg.firebaseProjectId,appId:cfg.firebaseAppId});
    auth=getAuth(app);
    $("google-login").addEventListener("click",async()=>{try{loginNotice("Opening Google sign-in…");const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});await signInWithPopup(auth,provider);}catch(e){loginNotice(e.message||"Google sign-in failed.");}});
    onAuthStateChanged(auth,async user=>{
      if(!user){showLogin();return;}
      const email=(user.email||"").toLowerCase();
      if(!user.emailVerified||!ADMIN_EMAILS.has(email)){await signOut(auth);showLogin();loginNotice("Access denied. This Google account is not on the admin allowlist.");return;}
      loginNotice("");await showDashboard(user);
    });
    $("logout").addEventListener("click",()=>signOut(auth));
    $("refresh").addEventListener("click",loadProducts);
    $("cancel-edit").addEventListener("click",clearForm);
    $("product-form").addEventListener("submit",async e=>{
      e.preventDefault();
      const id=$("product-id").value;
      const body={name:$("p-name").value.trim(),price:Number($("p-price").value),category:$("p-category").value,image_url:$("p-image").value.trim(),description:$("p-description").value.trim(),available:$("p-available").checked};
      try{await api(id?`/api/products/${id}`:"/api/products",{method:id?"PUT":"POST",body:JSON.stringify(body)});notice(id?"Product updated.":"Product published.");clearForm();await loadProducts();}catch(err){notice(err.message,true);}
    });
  }catch(e){loginNotice("Could not initialize the admin page. Check the Firebase configuration.");}
}
start();
