import './runtime-config.js';

import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signInWithEmailAndPassword,createUserWithEmailAndPassword,updateProfile,signOut,browserLocalPersistence,setPersistence} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import {getDatabase,ref,get,set,update,onDisconnect,onValue,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-functions.js';
const config=window.GINHAWA_PUBLIC_CONFIG?.firebase;
if(!config?.apiKey||!config?.authDomain||!config?.projectId||!config?.appId)throw new Error('Ginhawa Firebase config missing. Set Vercel build environment variables and redeploy.');
const app=initializeApp(config),auth=getAuth(app),db=getDatabase(app),functions=getFunctions(app,'asia-southeast1');
const notify=msg=>window.GinhawaUI?.toast(msg)||console.log(msg);
const esc=v=>window.GinhawaUI?.escapeHtml(v)||String(v??'');
const authReady=new Promise(resolve=>onAuthStateChanged(auth,user=>{renderUser(user);resolve(user)},e=>{notify(e.message);resolve(null)}));
await setPersistence(auth,browserLocalPersistence).catch(console.warn);
function renderUser(user){
 const target=document.getElementById('user-state');if(target)target.textContent=user?('Signed in: '+(user.displayName||user.email)):'Not signed in';
 const profile=document.getElementById('profile-state');if(profile)profile.textContent=user?('Welcome, '+(user.displayName||user.email)):'Sign in to manage your Ginhawa account.';
 document.querySelectorAll('[data-auth-link]').forEach(a=>{a.href=user?'profile.html':'login.html';const label=a.querySelector('.nav-label');if(label)label.textContent='Account';else a.textContent=user?'Account':'Login'});
 if(user){loadBookings(user);loadOffers(user)}else{const out=document.getElementById('bookings-list');if(out)out.textContent='Sign in to view live bookings.'}
}
async function upsertProfile(user,name='',role='customer'){
 const path=ref(db,'profiles/'+user.uid);
 await runTransaction(path,old=>old===null?{uid:user.uid,displayName:name||user.displayName||user.email?.split('@')[0]||'Ginhawa User',email:user.email||'',requestedRole:role==='therapist'?'therapist':'customer',createdAt:serverTimestamp()}:undefined,{applyLocally:false});
}
async function googleLogin(){const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});const r=await signInWithPopup(auth,provider);await upsertProfile(r.user);return r.user}
async function doLogin(event){event.preventDefault();const form=event.target,button=form.querySelector('button[type=submit]');button.disabled=true;try{await signInWithEmailAndPassword(auth,form.email.value,form.password.value);location.assign(nextUrl())}catch(e){notify(e.message)}finally{button.disabled=false}}
async function doSignup(event){event.preventDefault();const form=event.target,button=form.querySelector('button[type=submit]');button.disabled=true;try{const r=await createUserWithEmailAndPassword(auth,form.email.value,form.password.value);await updateProfile(r.user,{displayName:form.fullName.value.trim()});const role=form.elements.namedItem('role').value;await upsertProfile(r.user,form.fullName.value.trim(),role);if(role==='therapist'){if(!form.elements.namedItem('therapistAgreement').checked)throw new Error('Accept the therapist code of conduct first.');await httpsCallable(functions,'activateTherapist')({acceptCodeOfConduct:true});await r.user.getIdToken(true)}location.assign(role==='therapist'?'therapist-dashboard.html':'profile.html')}catch(e){notify(e.message)}finally{button.disabled=false}}
function nextUrl(){const next=new URLSearchParams(location.search).get('next');return next&&/^[a-z][a-z0-9-]*\.html$/i.test(next)?next:'profile.html'}

document.getElementById('google-signup')?.addEventListener('click',async()=>{
 try{
  const form=document.getElementById('auth-signup');
  const role=form?.elements.namedItem('role').value||'customer';
  if(role==='therapist'&&!form.elements.namedItem('therapistAgreement').checked)throw new Error('Accept the therapist code of conduct before continuing.');
  const user=await googleLogin();
  if(role==='therapist'){await httpsCallable(functions,'activateTherapist')({acceptCodeOfConduct:true});await user.getIdToken(true)}
  location.assign(role==='therapist'?'therapist-dashboard.html':'profile.html');
 }catch(e){notify(e.message)}
});
const signupRole=document.querySelector('#auth-signup [name=role]');
signupRole?.addEventListener('change',()=>{
 const terms=document.getElementById('therapist-agreement');
 terms?.classList.toggle('hide',signupRole.value!=='therapist');
 const box=terms?.querySelector('input');if(box)box.required=signupRole.value==='therapist';
});

document.getElementById('auth-login')?.addEventListener('submit',doLogin);
document.getElementById('auth-signup')?.addEventListener('submit',doSignup);
document.getElementById('google-login')?.addEventListener('click',async()=>{try{await googleLogin();location.assign(nextUrl())}catch(e){notify(e.message)}});
document.getElementById('logout')?.addEventListener('click',async()=>{await signOut(auth);location.assign('index.html')});
function loadBookings(user){const target=document.getElementById('bookings-list');if(!target)return;
 onValue(ref(db,'customerBookings/'+user.uid),snap=>{const bookings=Object.entries(snap.val()||{}).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0));target.innerHTML=bookings.length?bookings.map(([id,b])=>'<article class="status"><b>'+esc(b.serviceId||'Service')+'</b> · '+esc(b.date)+' · '+esc(b.time)+'<br><span class="muted">'+esc(b.city)+' · '+esc(b.status||'searching')+'</span><br><small>'+esc(id)+'</small></article>').join(''):'No requests yet. Book a service to start.'},e=>target.textContent=e.message);
}
function loadOffers(user){const target=document.getElementById('offers-list');if(!target)return;
 onValue(ref(db,'providerInbox/'+user.uid),snap=>{const entries=Object.entries(snap.val()||{});target.replaceChildren();if(!entries.length){target.textContent='No nearby offers. Active therapists are notified when an eligible general-wellness booking is nearby.';return}
 for(const [id,b] of entries){const row=document.createElement('article');row.className='status';const label=document.createElement('div');label.textContent=(b.serviceName||b.serviceId||'Service')+' · '+(b.city||'')+' · '+(b.status||'offered');row.appendChild(label);if(b.status==='offered'){for(const decision of ['accept','decline']){const button=document.createElement('button');button.className='btn '+(decision==='decline'?'light':'');button.style.marginRight='8px';button.style.marginTop='10px';button.textContent=decision==='accept'?'Accept':'Decline';button.onclick=async()=>{button.disabled=true;try{await httpsCallable(functions,'respondToOffer')({bookingId:b.bookingId||id,decision});notify('Response recorded')}catch(e){notify(e.message)}finally{button.disabled=false}};row.appendChild(button)}}target.appendChild(row)}} ,e=>target.textContent=e.message)
}
document.getElementById('booking-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.target,button=f.querySelector('[type=submit]');if(!auth.currentUser){sessionStorage.setItem('ginhawa-booking',JSON.stringify(Object.fromEntries(new FormData(f))));location.assign('login.html?next=booking.html');return}
 const mode=f.mode.value,lat=f.querySelector('#book-lat')?.value,lng=f.querySelector('#book-lng')?.value;
 if(mode!=='online'&&(!lat||!lng)){notify('Set your service location pin first.');return}
 const selection={serviceId:f.serviceId.value,therapistId:null,mode,date:f.date.value,time:f.time.value,city:f.city.value,address:f.address.value,location:mode==='online'?null:{lat:Number(lat),lng:Number(lng)}};
 button.disabled=true;try{const res=await httpsCallable(functions,'submitBooking')(selection);const id=res.data?.bookingId;document.getElementById('booking-feedback').textContent='Booking request sent ('+id+'). We are finding an eligible therapist. Follow status in My Bookings.';notify('Request submitted');f.reset();window.GinhawaLocation?.reset()}catch(err){notify(err.message)}finally{button.disabled=false}
});
const booking=document.getElementById('booking-form');if(booking){
 const params=new URLSearchParams(location.search), service=params.get('service');
 if(service&&Array.from(booking.elements.serviceId.options).some(o=>o.value===service))booking.elements.serviceId.value=service;
 const mode=booking.elements.mode, address=booking.elements.address, box=document.getElementById('location-picker-card');
 const updateMode=()=>{const online=mode.value==='online';address.required=!online;box?.classList.toggle('hide',online);if(online)address.value=''};
 mode.addEventListener('change',updateMode);updateMode();
 try{const saved=JSON.parse(sessionStorage.getItem('ginhawa-booking')||'null');if(saved){for(const [key,value] of Object.entries(saved))if(booking.elements[key])booking.elements[key].value=value;sessionStorage.removeItem('ginhawa-booking');updateMode()}}catch{}
}
let providerTimer=null,providerDisconnect=null;
async function geoPoint(){return await new Promise((resolve,reject)=>{if(!navigator.geolocation){reject(new Error('GPS is unavailable'));return}navigator.geolocation.getCurrentPosition(pos=>resolve({lat:pos.coords.latitude,lng:pos.coords.longitude}),reject,{enableHighAccuracy:true,timeout:15000,maximumAge:30000})})}
async function verifyProvider(){
 await authReady;const user=auth.currentUser;if(!user)throw new Error('Sign in with a therapist account first');
 const [token,profile]=await Promise.all([user.getIdTokenResult(true),get(ref(db,'providerProfiles/'+user.uid))]);
 if(token.claims.therapist!==true||profile.val()?.active!==true||!(profile.val()?.verified===true||profile.val()?.onboardingStatus==='auto_approved'))throw new Error('Complete therapist signup to activate your account');
 return user;
}
async function goOnline(){
 const user=await verifyProvider();const point=await geoPoint();
 if(point.lat<4||point.lat>22||point.lng<116||point.lng>128)throw new Error('GPS must be within the Philippines');
 const status=document.getElementById('provider-location-status'),refPresence=ref(db,'providerPresence/'+user.uid);
 await onDisconnect(refPresence).update({online:false,updatedAt:serverTimestamp()});
 const updatePoint=async p=>{if(auth.currentUser?.uid!==user.uid)return;await update(refPresence,{online:true,lat:p.lat,lng:p.lng,updatedAt:serverTimestamp()});if(status)status.textContent='Online for nearby booking requests · GPS '+p.lat.toFixed(4)+', '+p.lng.toFixed(4)};
 await updatePoint(point);clearInterval(providerTimer);
 providerTimer=setInterval(async()=>{try{await updatePoint(await geoPoint())}catch(e){console.warn('Therapist GPS heartbeat:',e.message)}},60000);
}
async function goOffline(){
 clearInterval(providerTimer);providerTimer=null;
 if(!auth.currentUser)return;
 const refPresence=ref(db,'providerPresence/'+auth.currentUser.uid);
 await update(refPresence,{online:false,updatedAt:serverTimestamp()});
 await onDisconnect(refPresence).cancel();
 const status=document.getElementById('provider-location-status');if(status)status.textContent='Offline · not accepting new requests';
}
for(const [id,handler] of [['provider-online',goOnline],['provider-offline',goOffline]]){
 document.getElementById(id)?.addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;try{await handler();notify(id==='provider-online'?'You are available for nearby requests':'You are offline')}catch(err){notify(err.message)}finally{button.disabled=false}});
}
window.GinhawaFirebase={app,auth,db,functions,authReady,googleLogin,goOnline,goOffline};
