
import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signInWithEmailAndPassword,createUserWithEmailAndPassword,updateProfile,signOut,browserLocalPersistence,setPersistence} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import {getDatabase,ref,onValue,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-functions.js';
const config={apiKey:'AIzaSyAiRsvAnNal-w7wwOj1YqwemLfffMMagjI',authDomain:'ginhawa-app.firebaseapp.com',databaseURL:'https://ginhawa-app-default-rtdb.asia-southeast1.firebasedatabase.app',projectId:'ginhawa-app',storageBucket:'ginhawa-app.firebasestorage.app',messagingSenderId:'341314764610',appId:'1:341314764610:web:d1cdfbb4886dc3dbe552db',measurementId:'G-21040X11RH'};
const app=initializeApp(config),auth=getAuth(app),db=getDatabase(app),functions=getFunctions(app,'asia-southeast1');
const notify=msg=>window.GinhawaUI?.toast(msg)||console.log(msg);
const esc=v=>window.GinhawaUI?.escapeHtml(v)||String(v??'');
const authReady=new Promise(resolve=>onAuthStateChanged(auth,user=>{renderUser(user);resolve(user)},e=>{notify(e.message);resolve(null)}));
await setPersistence(auth,browserLocalPersistence).catch(console.warn);
function renderUser(user){
 const target=document.getElementById('user-state');if(target)target.textContent=user?('Signed in: '+(user.displayName||user.email)):'Not signed in';
 const profile=document.getElementById('profile-state');if(profile)profile.textContent=user?('Welcome, '+(user.displayName||user.email)):'Sign in to manage your Ginhawa account.';
 document.querySelectorAll('[data-auth-link]').forEach(a=>{a.href=user?'profile.html':'login.html';a.textContent=user?'Account':'Login'});
 if(user){loadBookings(user);loadOffers(user)}else{const out=document.getElementById('bookings-list');if(out)out.textContent='Sign in to view live bookings.'}
}
async function upsertProfile(user,name='',role='customer'){
 const path=ref(db,'profiles/'+user.uid);
 await runTransaction(path,old=>old===null?{uid:user.uid,displayName:name||user.displayName||user.email?.split('@')[0]||'Ginhawa User',email:user.email||'',requestedRole:role==='therapist'?'therapist':'customer',createdAt:serverTimestamp()}:undefined,{applyLocally:false});
}
async function googleLogin(){const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});const r=await signInWithPopup(auth,provider);await upsertProfile(r.user);return r.user}
async function doLogin(event){event.preventDefault();const form=event.target,button=form.querySelector('button[type=submit]');button.disabled=true;try{await signInWithEmailAndPassword(auth,form.email.value,form.password.value);location.assign('profile.html')}catch(e){notify(e.message)}finally{button.disabled=false}}
async function doSignup(event){event.preventDefault();const form=event.target,button=form.querySelector('button[type=submit]');button.disabled=true;try{const r=await createUserWithEmailAndPassword(auth,form.email.value,form.password.value);await updateProfile(r.user,{displayName:form.fullName.value.trim()});await upsertProfile(r.user,form.fullName.value.trim(),form.role.value);location.assign('profile.html')}catch(e){notify(e.message)}finally{button.disabled=false}}
document.getElementById('auth-login')?.addEventListener('submit',doLogin);
document.getElementById('auth-signup')?.addEventListener('submit',doSignup);
document.getElementById('google-login')?.addEventListener('click',async()=>{try{await googleLogin();location.assign('profile.html')}catch(e){notify(e.message)}});
document.getElementById('logout')?.addEventListener('click',async()=>{await signOut(auth);location.assign('index.html')});
function loadBookings(user){const target=document.getElementById('bookings-list');if(!target)return;
 onValue(ref(db,'customerBookings/'+user.uid),snap=>{const bookings=Object.entries(snap.val()||{}).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0));target.innerHTML=bookings.length?bookings.map(([id,b])=>'<article class="status"><b>'+esc(b.serviceId||'Service')+'</b> · '+esc(b.date)+' · '+esc(b.time)+'<br><span class="muted">'+esc(b.city)+' · '+esc(b.status||'searching')+'</span><br><small>'+esc(id)+'</small></article>').join(''):'No requests yet. Book a service to start.'},e=>target.textContent=e.message);
}
function loadOffers(user){const target=document.getElementById('offers-list');if(!target)return;
 onValue(ref(db,'providerInbox/'+user.uid),snap=>{const entries=Object.entries(snap.val()||{});target.replaceChildren();if(!entries.length){target.textContent='No nearby offers. Only verified, active therapists receive requests.';return}
 for(const [id,b] of entries){const row=document.createElement('article');row.className='status';const label=document.createElement('div');label.textContent=(b.serviceName||b.serviceId||'Service')+' · '+(b.city||'')+' · '+(b.status||'offered');row.appendChild(label);if(b.status==='offered'){for(const decision of ['accept','decline']){const button=document.createElement('button');button.className='btn '+(decision==='decline'?'light':'');button.style.marginRight='8px';button.style.marginTop='10px';button.textContent=decision==='accept'?'Accept':'Decline';button.onclick=async()=>{button.disabled=true;try{await httpsCallable(functions,'respondToOffer')({bookingId:b.bookingId||id,decision});notify('Response recorded')}catch(e){notify(e.message)}finally{button.disabled=false}};row.appendChild(button)}}target.appendChild(row)}} ,e=>target.textContent=e.message)
}
document.getElementById('booking-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.target,button=f.querySelector('[type=submit]');if(!auth.currentUser){sessionStorage.setItem('ginhawa-booking',JSON.stringify(Object.fromEntries(new FormData(f))));location.assign('login.html?next=booking.html');return}
 const mode=f.mode.value,lat=f.querySelector('#book-lat')?.value,lng=f.querySelector('#book-lng')?.value;
 if(mode!=='online'&&(!lat||!lng)){notify('Set your service location pin first.');return}
 const selection={serviceId:f.serviceId.value,therapistId:null,mode,date:f.date.value,time:f.time.value,city:f.city.value,address:f.address.value,location:mode==='online'?null:{lat:Number(lat),lng:Number(lng)}};
 button.disabled=true;try{const res=await httpsCallable(functions,'submitBooking')(selection);const id=res.data?.bookingId;document.getElementById('booking-feedback').textContent='Booking request sent ('+id+'). We are finding an eligible therapist. Follow status in My Bookings.';notify('Request submitted');f.reset();window.GinhawaLocation?.reset()}catch(err){notify(err.message)}finally{button.disabled=false}
});
const booking=document.getElementById('booking-form');if(booking){try{const saved=JSON.parse(sessionStorage.getItem('ginhawa-booking')||'null');if(saved){for(const [key,value] of Object.entries(saved))if(booking.elements[key])booking.elements[key].value=value;sessionStorage.removeItem('ginhawa-booking')}}catch{}}
window.GinhawaFirebase={app,auth,db,functions,authReady,googleLogin};
