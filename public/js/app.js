
(()=>{'use strict';
const $=s=>document.querySelector(s);
const page=location.pathname.split('/').pop()||'index.html';
document.querySelectorAll('a[href]').forEach(a=>{if(a.getAttribute('href')===page)a.classList.add('active')});
const toast=msg=>{let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.hidden=false;clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.hidden=true,4500)};
window.GinhawaUI={toast,escapeHtml:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
const menu=$('#menu-toggle'),links=$('#mobile-menu');
menu?.addEventListener('click',()=>{const open=links?.classList.toggle('hide');menu.setAttribute('aria-expanded',String(!open))});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(e=>console.warn('PWA:',e)));
const date=$('#book-date');if(date)date.min=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
})();
