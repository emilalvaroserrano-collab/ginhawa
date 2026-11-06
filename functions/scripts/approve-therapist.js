'use strict';
/** Admin-only CLI: run AFTER externally verifying the therapist's credentials.
 * Requires Google ADC (gcloud auth application-default login) or a secure service account.
 * Example: node functions/scripts/approve-therapist.js FIREBASE_UID massage,joint "Therapist Full Name" Tuguegarao
 */
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getDatabase}=require('firebase-admin/database');
const uid=process.argv[2],serviceList=process.argv[3],name=process.argv[4],location=process.argv[5];
if(!uid||!/^[A-Za-z0-9_-]{6,128}$/.test(uid)||!serviceList||!name||!location){
 console.error('Usage: node functions/scripts/approve-therapist.js UID service1,service2 "Verified Name" "Service Area"');process.exit(1);
}
const ids=serviceList.split(',').map(s=>s.trim()).filter(Boolean);
if(ids.some(s=>!/^[a-zA-Z0-9_-]{1,64}$/.test(s)))throw new Error('Invalid service ID.');
initializeApp({credential:applicationDefault(),projectId:'ginhawa-app',databaseURL:'https://ginhawa-app-default-rtdb.asia-southeast1.firebasedatabase.app'});
(async()=>{
 const db=getDatabase();
 const user=await getAuth().getUser(uid);
 const services=(await db.ref('catalog/services').get()).val()||{};
 if(!ids.length||ids.some(s=>services[s]?.active!==true))throw new Error('Seed and activate these services before approving a provider.');
 const existing=(await getAuth().getUser(uid)).customClaims||{};
 await getAuth().setCustomUserClaims(uid,{...existing,therapist:true});
 const serviceIds=Object.fromEntries(ids.map(s=>[s,true]));
 await db.ref().update({
   [`providerProfiles/${uid}`]:{verified:true,active:true,serviceIds,displayName:name},
   [`catalog/therapists/${uid}`]:{uid,name,verified:true,published:true,active:true,service:services[ids[0]].name,
    specialty:services[ids[0]].name,serviceIds,location,description:'Verified Ginhawa wellness practitioner',price:services[ids[0]].price||0}
 });
 console.log(`Approved therapist UID ${uid}; provider must sign out and back in to refresh their claims.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
