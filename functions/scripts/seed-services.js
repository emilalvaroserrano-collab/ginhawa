'use strict';
/** Admin-only one-time seed. Does not override existing configured services. */
const fs=require('fs');const path=require('path');
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getDatabase}=require('firebase-admin/database');
initializeApp({credential:applicationDefault(),projectId:'ginhawa-app',databaseURL:'https://ginhawa-app-default-rtdb.asia-southeast1.firebasedatabase.app'});
const input=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../seed-services.json'),'utf8'));
(async()=>{
 const pathRef=getDatabase().ref('catalog/services');
 const tx=await pathRef.transaction(old=>old===null?input:undefined,undefined,false);
 if(!tx.committed)console.log('Service catalog exists; not overwritten.');
 else console.log('Service catalog seeded.');
})().catch(e=>{console.error(e);process.exitCode=1;});
