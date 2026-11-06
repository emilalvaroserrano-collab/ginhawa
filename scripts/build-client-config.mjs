import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
// Only Firebase and Maps PUBLIC browser SDK values are exposed at build time.
// Never include Firebase Admin credentials, payment secrets or service account keys.
const names={
 apiKey:'GINHAWA_FIREBASE_API_KEY',authDomain:'GINHAWA_FIREBASE_AUTH_DOMAIN',
 databaseURL:'GINHAWA_FIREBASE_DATABASE_URL',projectId:'GINHAWA_FIREBASE_PROJECT_ID',
 storageBucket:'GINHAWA_FIREBASE_STORAGE_BUCKET',messagingSenderId:'GINHAWA_FIREBASE_MESSAGING_SENDER_ID',
 appId:'GINHAWA_FIREBASE_APP_ID',measurementId:'GINHAWA_FIREBASE_MEASUREMENT_ID'
};
const required=['apiKey','authDomain','databaseURL','projectId','storageBucket','messagingSenderId','appId'];
const missing=required.filter(k=>!process.env[names[k]]?.trim());
if(!process.env.GINHAWA_GOOGLE_MAPS_API_KEY?.trim())missing.push('GINHAWA_GOOGLE_MAPS_API_KEY');
if(missing.length){console.error('Missing Vercel build variables: '+missing.map(k=>names[k]||k).join(', '));process.exit(1)}
const firebase=Object.fromEntries(Object.entries(names).map(([key,env])=>[key,process.env[env]||'']));
const config={firebase,googleMapsKey:process.env.GINHAWA_GOOGLE_MAPS_API_KEY,vapidKey:process.env.GINHAWA_FCM_VAPID_KEY||''};
writeFileSync(resolve('public/js/runtime-config.js'),'/* Generated public browser SDK configuration */\nwindow.GINHAWA_PUBLIC_CONFIG=Object.freeze('+JSON.stringify(config)+');\n');
console.log('Built Ginhawa public client config for '+firebase.projectId);
