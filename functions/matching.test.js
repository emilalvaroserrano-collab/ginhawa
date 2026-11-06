'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {distanceKm,rankedCandidates}=require('./matching');
const origin={lat:17.6132,lng:121.7270};
const base={serviceId:'massage',mode:'home',location:origin};
const profiles={a:{verified:true,active:true,serviceIds:{massage:true}},b:{verified:true,active:true,serviceIds:{massage:true}},c:{verified:false,active:true,serviceIds:{massage:true}},d:{verified:true,active:true,serviceIds:{consult:true}}};
const presence={a:{online:true,lat:17.614,lng:121.727,updatedAt:500000},b:{online:true,lat:17.65,lng:121.74,updatedAt:500000},c:{online:true,lat:17.613,lng:121.727,updatedAt:500000},d:{online:true,lat:17.613,lng:121.727,updatedAt:500000}};
test('Haversine distance',()=>{assert.equal(Math.round(distanceKm(origin,origin)),0);assert.ok(distanceKm(origin,{lat:17.7,lng:121.7})>5);});
test('nearest eligible verified and active first',()=>{assert.deepEqual(rankedCandidates({booking:base,profiles,presence,now:500000}).map(x=>x.uid),['a','b']);});
test('skip previously offered and stale presence',()=>{assert.deepEqual(rankedCandidates({booking:base,profiles,presence,alreadyOffered:{a:true},now:500000}).map(x=>x.uid),['b']);assert.deepEqual(rankedCandidates({booking:base,profiles,presence,now:900000}).map(x=>x.uid),[]);});
test('distance radius and direct provider',()=>{assert.deepEqual(rankedCandidates({booking:{...base,requestedTherapistUid:'a'},profiles,presence:{},now:500000}).map(x=>x.uid),['a']);assert.deepEqual(rankedCandidates({booking:base,profiles,presence,now:500000,maxDistanceKm:0.01}).map(x=>x.uid),[]);});

test('auto-onboarded therapists match only their allowed general wellness services',()=>{
 const additional={auto:{verified:false,active:true,onboardingStatus:'auto_approved',serviceIds:{massage:true,wellness:true,home:true}}};
 const pos={auto:{online:true,lat:17.6132,lng:121.727,updatedAt:500000}};
 assert.deepEqual(rankedCandidates({booking:base,profiles:additional,presence:pos,now:500000}).map(x=>x.uid),['auto']);
 assert.deepEqual(rankedCandidates({booking:{...base,serviceId:'rehab'},profiles:additional,presence:pos,now:500000}).map(x=>x.uid),[]);
});
