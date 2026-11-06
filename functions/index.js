'use strict';
/** Ginhawa secure booking dispatch: never trust client roles, prices, coordinates, or offer acceptance. */
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onValueCreated}=require('firebase-functions/v2/database');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const logger=require('firebase-functions/logger');
const {initializeApp}=require('firebase-admin/app');
const {getDatabase}=require('firebase-admin/database');
const {getAuth}=require('firebase-admin/auth');
const {getMessaging}=require('firebase-admin/messaging');
const {rankedCandidates}=require('./matching');
initializeApp({databaseURL:'https://ginhawa-app-default-rtdb.asia-southeast1.firebasedatabase.app'});
const db=getDatabase();
const REGION='asia-southeast1';
const INSTANCE='ginhawa-app-default-rtdb';
const OFFER_VALID_MS=10*60*1000;
const MATCH_TIMEOUT_MS=20*60*1000;
const MAX_REQUESTS_PER_DAY=12;
function invalid(message){throw new HttpsError('invalid-argument',message);}
function string(v,max=80){return typeof v==='string'?v.trim().slice(0,max):'';}
function truthyObject(v){return v&&typeof v==='object'&&!Array.isArray(v);}
function validateLocation(l){
  if(!truthyObject(l)||typeof l.lat!=='number'||typeof l.lng!=='number'||!Number.isFinite(l.lat)||!Number.isFinite(l.lng)||Math.abs(l.lat)>90||Math.abs(l.lng)>180)invalid('Choose a valid location pin.');
  if(l.lat<4||l.lat>22||l.lng<116||l.lng>128)invalid('Location must be within the service region (Philippines).');
  return {lat:+l.lat.toFixed(6),lng:+l.lng.toFixed(6)};
}
function isTherapistEligible(profile) {
 return profile?.active===true && (profile.verified===true || profile.onboardingStatus==='auto_approved');
}
function requireAuth(req){
  if(!req.auth?.uid)throw new HttpsError('unauthenticated','Sign in to continue.');
  return req.auth.uid;
}
function fmtDay(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function requestPublicStatus(b){
  return {serviceId:b.serviceId,therapistId:b.therapistId||null,mode:b.mode,date:b.date,time:b.time,city:b.city,
    address:b.address||'',location:b.location||null,status:b.status,assignedTherapistUid:b.assignedTherapistUid||null,
    createdAt:b.createdAt,updatedAt:b.updatedAt||b.createdAt};
}

/**
 * Temporary launch policy: automatically enable GENERAL WELLNESS providers.
 * This is NOT credential/license verification. Clinical services must remain gated.
 * Authenticated users explicitly opt into therapist terms before receiving the role.
 */
exports.activateTherapist=onCall({region:REGION,maxInstances:10},async req=>{
 const uid=requireAuth(req);
 if(req.data?.acceptCodeOfConduct!==true)invalid('Accept the therapist terms and code of conduct to activate your profile.');
 const account=await getAuth().getUser(uid);
 if(!account.email || account.disabled)throw new HttpsError('permission-denied','A valid active email account is required.');
 const providerRef=db.ref('providerProfiles/'+uid);
 const now=Date.now();
 const safeName=string(account.displayName,120)||string(account.email.split('@')[0],120)||'Ginhawa Therapist';
 const tx=await providerRef.transaction(current=>current===null?{
   uid,displayName:safeName,active:true,verified:false,autoApproved:true,
   onboardingStatus:'auto_approved',credentialStatus:'not_verified',
   serviceIds:{massage:true,wellness:true,home:true},
   createdAt:now,updatedAt:now
 }:undefined,undefined,false);
 const profile=tx.snapshot.val();
 if(!profile?.active||!isTherapistEligible(profile))throw new HttpsError('permission-denied','This therapist account is restricted.');
 const claims=account.customClaims||{};
 if(claims.therapist!==true)await getAuth().setCustomUserClaims(uid,{...claims,therapist:true});
 await db.ref('profiles/'+uid).update({requestedRole:'therapist',therapistOnboardedAt:now});
 return {status:'active',onboardingStatus:profile.onboardingStatus||'approved',credentialVerified:profile.verified===true,serviceIds:Object.keys(profile.serviceIds||{})};
});

exports.submitBooking=onCall({region:REGION,maxInstances:10},async req=>{
  const uid=requireAuth(req),data=req.data||{};
  const serviceId=string(data.serviceId,64),therapistId=string(data.therapistId,80)||null;
  const mode=string(data.mode,12),date=string(data.date,10),time=string(data.time,20),city=string(data.city,90),address=string(data.address,180);
  if(!/^[a-zA-Z0-9_-]{1,64}$/.test(serviceId)||!['home','venue','online'].includes(mode)||!/^20\d\d-\d\d-\d\d$/.test(date)||!/^\d{1,2}:\d{2} (AM|PM)$/.test(time)||!city)invalid('Complete service, date, time and city.');
  const day=fmtDay(),dayUTC=new Date(day+'T00:00:00Z');
  const at=new Date(date+'T00:00:00Z');
  if(Number.isNaN(at.getTime())||at.toISOString().slice(0,10)!==date||at<dayUTC||at.getTime()>dayUTC.getTime()+90*86400000)invalid('Date must be within the next 90 days.');
  const location=mode==='online'?null:validateLocation(data.location);
  if(mode!=='online'&&address.length<5)invalid('Enter the service address or landmark.');
  const serviceSnap=await db.ref(`catalog/services/${serviceId}`).get();
  if(serviceSnap.val()?.active!==true)throw new HttpsError('failed-precondition','Service is not yet enabled by Ginhawa.');
  let requestedTherapistUid=null;
  if(therapistId){
    const pSnap=await db.ref(`catalog/therapists/${therapistId}`).get();
    const p=pSnap.val();
    if(!(p?.verified||p?.autoApproved)||!p?.published||typeof p.uid!=='string')throw new HttpsError('failed-precondition','Selected therapist is not currently available for direct requests.');
    requestedTherapistUid=p.uid;
    const profile=(await db.ref(`providerProfiles/${requestedTherapistUid}`).get()).val();
    if(!isTherapistEligible(profile)||!(profile.serviceIds?.[serviceId]===true||Array.isArray(profile.serviceIds)&&profile.serviceIds.includes(serviceId)))throw new HttpsError('failed-precondition','Selected therapist cannot provide this service.');
  }
  const rateRef=db.ref(`bookingQuotas/${uid}/${day}`);
  const quota=await rateRef.transaction(v=>(v||0)>=MAX_REQUESTS_PER_DAY?undefined:(v||0)+1,undefined,false);
  if(!quota.committed)throw new HttpsError('resource-exhausted','Daily booking request limit reached.');
  const key=db.ref('bookingRequests').push();
  const now=Date.now();
  const booking={customerUid:uid,serviceId,therapistId,requestedTherapistUid,mode,date,time,city,address,location,
    status:'searching',assignedTherapistUid:null,createdAt:now,updatedAt:now};
  try{
    await db.ref().update({[`bookingRequests/${key.key}`]:booking,[`customerBookings/${uid}/${key.key}`]:requestPublicStatus(booking)});
  }catch(err){await rateRef.transaction(v=>Math.max(0,(v||1)-1),undefined,false).catch(()=>{});throw err;}
  return {bookingId:key.key,status:'searching'};
});
async function sendPush(uid,offer){
  const raw=(await db.ref(`providerPushTokens/${uid}`).get()).val()||{};
  const tokens=Object.values(raw).filter(v=>typeof v==='string'&&v.length>20).slice(0,25);
  if(!tokens.length)return;
  const notification={title:'Ginhawa · New nearby booking',body:`${offer.serviceName} · ${offer.city} · ${offer.date}, ${offer.time}`};
  try{
    const resp=await getMessaging().sendEachForMulticast({tokens,notification,data:{bookingId:offer.bookingId,url:'/therapist-dashboard.html'}});
    if(resp.failureCount)logger.warn('Push delivery failed for some installations',{uid,failed:resp.failureCount});
  }catch(err){logger.warn('Push unavailable',{uid,err:err.message});}
}
async function mirrorCustomer(bookingId,booking){
  await db.ref(`customerBookings/${booking.customerUid}/${bookingId}`).set(requestPublicStatus(booking));
}
async function dispatchOffers(bookingId){
  const b=(await db.ref(`bookingRequests/${bookingId}`).get()).val();
  if(!b||b.status!=='searching')return 0;
  const [profiles,presence,offered,service]=await Promise.all([
    db.ref('providerProfiles').get(),db.ref('providerPresence').get(),db.ref(`offersByBooking/${bookingId}`).get(),db.ref(`catalog/services/${b.serviceId}`).get()
  ]);
  const chosen=rankedCandidates({booking:b,profiles:profiles.val(),presence:presence.val(),alreadyOffered:offered.val()||{},now:Date.now()});
  let count=0;
  for(const candidate of chosen){
    const offerRef=db.ref(`providerInbox/${candidate.uid}/${bookingId}`);
    const offer={bookingId,serviceId:b.serviceId,serviceName:string(service.val()?.name,90)||b.serviceId,
      date:b.date,time:b.time,city:b.city,mode:b.mode,status:'offered',distanceKm:Number.isFinite(candidate.distanceKm)?Math.round(candidate.distanceKm*10)/10:null,
      createdAt:Date.now(),expiresAt:Date.now()+OFFER_VALID_MS};
    const tx=await offerRef.transaction(current=>current===null?offer:undefined,undefined,false);
    if(!tx.committed)continue;
    await db.ref(`offersByBooking/${bookingId}/${candidate.uid}`).set(true);
    count++;
    await sendPush(candidate.uid,offer);
  }
  return count;
}
exports.dispatchNewBooking=onValueCreated({ref:'/bookingRequests/{bookingId}',instance:INSTANCE,region:REGION},async event=>{
  const bookingId=event.params.bookingId;
  try{logger.info('Dispatching booking request',{bookingId});await dispatchOffers(bookingId);}
  catch(err){logger.error('Dispatch failed',{bookingId,error:err.message});throw err;}
});
exports.respondToOffer=onCall({region:REGION,maxInstances:10},async req=>{
  const uid=requireAuth(req),bookingId=string(req.data?.bookingId,128),decision=string(req.data?.decision,12);
  if(!/^[-_a-zA-Z0-9]{5,128}$/.test(bookingId)||!['accept','decline'].includes(decision))invalid('Invalid offer response.');
  const [profileSnap,offerSnap]=await Promise.all([db.ref(`providerProfiles/${uid}`).get(),db.ref(`providerInbox/${uid}/${bookingId}`).get()]);
  if(!isTherapistEligible(profileSnap.val())||req.auth.token.therapist!==true)throw new HttpsError('permission-denied','An active therapist account is required.');
  const offer=offerSnap.val();
  if(!offer||offer.status!=='offered'||offer.expiresAt<Date.now())throw new HttpsError('failed-precondition','Offer is unavailable or expired.');
  if(decision==='decline'){
    await db.ref(`providerInbox/${uid}/${bookingId}/status`).set('declined');
    return {status:'declined'};
  }
  const bookingRef=db.ref(`bookingRequests/${bookingId}`),now=Date.now();
  const result=await bookingRef.transaction(b=>{
    if(!b||b.status!=='searching'||now-b.createdAt>MATCH_TIMEOUT_MS)return undefined;
    return {...b,status:'assigned',assignedTherapistUid:uid,updatedAt:now};
  },undefined,false);
  if(!result.committed)throw new HttpsError('already-exists','Another therapist accepted, or the offer expired.');
  const b=result.snapshot.val();
  await db.ref().update({
    [`customerBookings/${b.customerUid}/${bookingId}`]:requestPublicStatus(b),
    [`providerInbox/${uid}/${bookingId}/status`]:'accepted',
    [`assignedBookings/${uid}/${bookingId}`]:{bookingId,customerUid:b.customerUid,serviceId:b.serviceId,mode:b.mode,date:b.date,time:b.time,city:b.city,address:b.address,location:b.location,status:'assigned',assignedAt:now}
  });
  const offers=(await db.ref(`offersByBooking/${bookingId}`).get()).val()||{};
  await Promise.all(Object.keys(offers).filter(x=>x!==uid).map(x=>db.ref(`providerInbox/${x}/${bookingId}/status`).set('taken').catch(()=>{})));
  return {status:'assigned',bookingId};
});
exports.retryUnassignedBookings=onSchedule({schedule:'every 2 minutes',timeZone:'Asia/Manila',region:REGION,maxInstances:1},async()=>{
  const snap=await db.ref('bookingRequests').orderByChild('status').equalTo('searching').limitToFirst(100).get();
  for(const [id,b] of Object.entries(snap.val()||{})){
    if(Date.now()-b.createdAt>=MATCH_TIMEOUT_MS){
      const r=await db.ref(`bookingRequests/${id}`).transaction(current=>current?.status==='searching'?{...current,status:'no_provider',updatedAt:Date.now()}:undefined,undefined,false);
      if(r.committed)await mirrorCustomer(id,r.snapshot.val());
      continue;
    }
    await dispatchOffers(id).catch(err=>logger.warn('Retry failed',{id,error:err.message}));
  }
});
