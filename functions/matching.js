'use strict';
const MAX_DISTANCE_KM=30;
function distanceKm(a,b){
  if(!a||!b) return Infinity;
  const {lat:lat1,lng:lon1}=a,{lat:lat2,lng:lon2}=b;
  if([lat1,lon1,lat2,lon2].some(x=>!Number.isFinite(Number(x)))) return Infinity;
  const dLat=(Number(lat2)-Number(lat1))*Math.PI/180;
  const dLon=(Number(lon2)-Number(lon1))*Math.PI/180;
  const r1=Number(lat1)*Math.PI/180,r2=Number(lat2)*Math.PI/180;
  return 6371*2*Math.atan2(Math.sqrt(Math.sin(dLat/2)**2+Math.cos(r1)*Math.cos(r2)*Math.sin(dLon/2)**2),Math.sqrt(1-(Math.sin(dLat/2)**2+Math.cos(r1)*Math.cos(r2)*Math.sin(dLon/2)**2)));
}
function supportsService(profile,serviceId){
  const services=profile?.serviceIds;
  return Array.isArray(services)?services.includes(serviceId):services?.[serviceId]===true;
}
function rankedCandidates({booking,profiles,presence,alreadyOffered={},now=Date.now(),limit=3,maxDistanceKm=MAX_DISTANCE_KM}){
  const results=[];
  for(const [uid,profile] of Object.entries(profiles||{})){
    if(!profile?.verified||profile?.active!==true||!supportsService(profile,booking.serviceId)||alreadyOffered[uid])continue;
    if(booking.requestedTherapistUid&&uid!==booking.requestedTherapistUid)continue;
    const online=presence?.[uid];
    if(booking.requestedTherapistUid){
      results.push({uid,distanceKm:online?distanceKm(booking.location,online):null});continue;
    }
    if(!online?.online||!Number.isFinite(online.updatedAt)||now-online.updatedAt>150000||online.updatedAt>now+30000)continue;
    if(!Number.isFinite(Number(online.lat))||!Number.isFinite(Number(online.lng)))continue;
    const d=booking.mode==='online'?0:distanceKm(booking.location,online);
    if(d<=maxDistanceKm)results.push({uid,distanceKm:d});
  }
  results.sort((a,b)=>(a.distanceKm??0)-(b.distanceKm??0));
  return results.slice(0,limit);
}
module.exports={distanceKm,supportsService,rankedCandidates,MAX_DISTANCE_KM};
