
(()=>{'use strict';
const $=s=>document.querySelector(s);
const page=location.pathname.split('/').pop()||'index.html';
const icons={"home":"<path d=\"m3 9 9-7 9 7v11a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z\"/>","services":"<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.5\"/>","book":"<rect x=\"3\" y=\"4\" width=\"18\" height=\"17\" rx=\"2\"/><path d=\"M8 2v4M16 2v4M3 10h18M12 14v6M9 17h6\"/>","bookings":"<rect x=\"3\" y=\"4\" width=\"18\" height=\"17\" rx=\"2\"/><path d=\"M8 2v4M16 2v4M3 10h18M8 14h3M8 18h3M15 14h2\"/>","account":"<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"9\" r=\"3\"/><path d=\"M6.5 19a6 6 0 0 1 11 0\"/>"};
const names=['Home','Services','Book','Bookings','Account'];
const order=['home','services','book','bookings','account'];
const nav=$('.mobile-nav');
if(nav){
 const anchors=Array.from(nav.querySelectorAll('a[href]'));
 anchors.forEach((a,i)=>{
  const type=order[i];if(!type)return;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');
  svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');
  svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
  svg.setAttribute('class','nav-svg');svg.setAttribute('aria-hidden','true');
  svg.innerHTML=icons[type];
  const label=document.createElement('span');label.className='nav-label';label.textContent=names[i];
  a.replaceChildren(svg,label);
  a.classList.add('app-tab');if(type==='book')a.classList.add('booking-tab');
 });
}
document.querySelectorAll('a[href]').forEach(a=>{
 if(a.getAttribute('href')===page){
  a.classList.add('active');
  if(a.closest('.mobile-nav'))a.setAttribute('aria-current','page');
 }
});
const toast=msg=>{let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.hidden=false;clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.hidden=true,4500)};
window.GinhawaUI={toast,escapeHtml:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
const menu=$('#menu-toggle'),links=$('#mobile-menu');
menu?.addEventListener('click',()=>{const open=links?.classList.toggle('hide');menu.setAttribute('aria-expanded',String(!open))});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(e=>console.warn('PWA:',e)));
const date=$('#book-date');if(date)date.min=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
})();
