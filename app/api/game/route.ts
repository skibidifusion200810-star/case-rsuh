import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {randomBytes,createHash,randomInt} from 'node:crypto';
import argon2 from 'argon2';
import {priceForUpgrade} from '@/lib/upgrades';
import {qualifiesForGlobalDrop} from '@/lib/social';
import {levelProgress,xpForOpening} from '@/lib/levels';
import {inspectWatchedUser,recordWatchedActivity} from '@/lib/watchlist';
import {getLiveEvent,eventPrice,eventWeight,eventPublic} from '@/lib/events';
const cookie='cr_session';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
async function user(req:NextRequest){
 const token=req.cookies.get(cookie)?.value;
 if(!token)return null;
 const session=await db.session.findUnique({where:{tokenHash:hash(token)},include:{user:true}});
 if(!session||session.expiresAt<new Date()||session.user.isBanned)return null;
 return session.user;
}
function fail(error:string,status=400){return NextResponse.json({error},{status})}
const safeUser=(u:{id:string,username:string,coins:number,xp:number,openSlots:number,starterClaimed:boolean})=>({
 id:u.id,username:u.username,coins:u.coins,openSlots:u.openSlots,
 starterClaimed:u.starterClaimed,...levelProgress(u.xp),
 isAdmin:process.env.ADMIN_USER_ID===u.id&&/^[a-f0-9-]{36}$/i.test(u.id)
});
export async function GET(req:NextRequest){
 try{
  const cmd=req.nextUrl.searchParams.get('action')||'cases';
  if(cmd==='event')return NextResponse.json({event:eventPublic(await getLiveEvent(db))},
   {headers:{'Cache-Control':'no-store'}});
  if(cmd==='cases'){
   const [cases,event]=await Promise.all([
    db.case.findMany({include:{items:{where:{weight:{gt:0},value:{gte:1},imageUrl:{not:null}}}},orderBy:{price:'asc'}}),
    getLiveEvent(db)
   ]);
   return NextResponse.json({cases:cases.map(c=>({
    ...c,originalPrice:c.price,price:eventPrice(c.price,event),
    items:c.items.map(i=>({...i,weight:eventWeight(i,c.price,event)}))
   })),event:eventPublic(event)},{headers:{'Cache-Control':'no-store'}});
  }
  const u=await user(req);
  if(cmd==='me')return NextResponse.json({user:u?safeUser(u):null});
  if(cmd==='inventory'){
   if(!u)return fail('Anmelden erforderlich',401);
   return NextResponse.json({items:await db.inventoryItem.findMany({where:{ownerId:u.id,soldAt:null},include:{item:true},orderBy:{createdAt:'desc'}})});
  }
  return fail('Unbekannte Anfrage',404);
 }catch(e){console.error(e);return fail('Serverfehler',500)}
}
export async function POST(req:NextRequest){
 try{
  const raw=await req.json();
  if(!raw || typeof raw !== 'object' || Array.isArray(raw))return fail('Ungültige Anfrage');
  const b=raw as Record<string,unknown>;
  const action=typeof b.action==='string'?b.action:'';
  if(!action)return fail('Aktion fehlt');
  if(action==='register'||action==='login'){
   const username=typeof b.username==='string'?b.username:'';
   const password=typeof b.password==='string'?b.password:'';
   if(!/^[a-zA-Z0-9_]{3,24}$/.test(username)||password.length<10||password.length>128)return fail('Benutzername 3–24 Zeichen; Passwort mindestens 10 Zeichen');
   let u;
   if(action==='register'){
    const existing=await db.user.findUnique({where:{username}});if(existing)return fail('Benutzername schon vergeben',409);
    u=await db.user.create({data:{username,passwordHash:await argon2.hash(password),coins:100000,visitCount:1,lastLoginAt:new Date(),lastSeenAt:new Date()}});
   }else{
    const found=await db.user.findUnique({where:{username}});
    if(!found||!(await argon2.verify(found.passwordHash,password)))return fail('Falsche Zugangsdaten',401);
    if(found.isBanned)return fail('Dieses Konto wurde gesperrt',403);
    u=await db.user.update({where:{id:found.id},data:{visitCount:{increment:1},lastLoginAt:new Date(),lastSeenAt:new Date()}});
   }
   const token=randomBytes(32).toString('hex');
   await db.session.create({data:{userId:u.id,tokenHash:hash(token),expiresAt:new Date(Date.now()+7*86400000)}});
   await db.userAccessLog.create({data:{userId:u.id,activity:action==='register'?'REGISTRATION':'LOGIN'}});
   const response=NextResponse.json({user:safeUser(u)});
   response.cookies.set(cookie,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:604800});
   return response;
  }
  if(action==='logout'){
   const token=req.cookies.get(cookie)?.value;
   if(token)await db.session.deleteMany({where:{tokenHash:hash(token)}});
   const res=NextResponse.json({ok:true});res.cookies.delete(cookie);return res;
  }
  const u=await user(req);if(!u)return fail('Bitte anmelden',401);
  if(action==='upgrade'){
   const tier=typeof b.tier==='number'?b.tier:0;
   const cost=priceForUpgrade(tier);
   if(!cost)return fail('Ungültige Upgrade-Stufe');
   const result=await db.user.updateMany({
    where:{id:u.id,openSlots:{lt:tier},coins:{gte:cost}},
    data:{openSlots:tier,coins:{decrement:cost}}
   });
   if(!result.count)return fail('Upgrade bereits vorhanden oder nicht genügend Guthaben');
   return NextResponse.json({user:safeUser(await db.user.findUniqueOrThrow({where:{id:u.id}}))});
  }
  if(action==='open'){
   const caseId=typeof b.caseId==='string'?b.caseId:'';
   if(!caseId)return fail('Ungültige Kiste');
   const count=typeof b.count==='number'?b.count:1;
   if(!Number.isInteger(count)||count<1||count>10||count>u.openSlots)return fail('Dieses Mehrfachöffnungs-Upgrade fehlt');
   const opened=await db.$transaction(async tx=>{
    const c=await tx.case.findUnique({where:{id:caseId},include:{items:true}});
    if(!c||!c.items.length)throw new Error('Kiste nicht gefunden');
    const event=await getLiveEvent(tx);
    const effectivePrice=eventPrice(c.price,event);
    const eligible=c.items.filter(i=>i.weight>0&&i.value>=1&&!!i.imageUrl)
     .map(i=>({...i,weight:eventWeight(i,c.price,event)}));
    if(!eligible.length)throw new Error('Keine überprüften Gewinne verfügbar');
    if(c.price===0){
     if(count>1)throw Error('Gratis-Kisten können nur einzeln geöffnet werden');
     const cutoff=new Date(Date.now()-2500);
     const changed=await tx.user.updateMany({
      where:{id:u.id,OR:[{freeLastOpenedAt:null},{freeLastOpenedAt:{lt:cutoff}}]},
      data:{freeLastOpenedAt:new Date()}
     });
     if(!changed.count)throw Error('Bitte 3 Sekunden bis zur nächsten Gratis-Kiste warten');
    }else{
     const debit=effectivePrice*count;
     const charged=await tx.user.updateMany({
      where:{id:u.id,coins:{gte:debit},openSlots:{gte:count}},
      data:{coins:{decrement:debit}}
     });
     if(!charged.count)throw Error('Nicht genügend Guthaben oder Upgrade fehlt');
    }
    // All XP is awarded atomically with the server-confirmed opening.
    const earnedXp=xpForOpening(c.price)*count;
    await tx.user.update({where:{id:u.id},data:{xp:{increment:earnedXp}}});
    const total=eligible.reduce((sum,item)=>sum+item.weight,0);
    const results=[];
    for(let index=0;index<count;index++){
     let roll=randomInt(total);
     let selected=eligible[eligible.length-1];
     for(const item of eligible){roll-=item.weight;if(roll<0){selected=item;break}}
     const inv=await tx.inventoryItem.create({data:{
      ownerId:u.id,itemId:selected.id,valueAtDrop:selected.value,isDemo:false
     }});
     await tx.opening.create({data:{userId:u.id,caseId:c.id,itemId:selected.id}});
     if(qualifiesForGlobalDrop(selected)){
      await tx.rareDropEvent.create({data:{
       username:u.username,itemName:selected.name,rarity:selected.rarity,
       value:selected.value,imageUrl:selected.imageUrl,source:'CASE',
       inventoryItemId:inv.id
      }});
     }
     results.push({item:selected,inventoryId:inv.id,isDemo:false});
    }
    return results;
   },{isolationLevel:'Serializable'});
   await recordWatchedActivity(u.id,'CASE_OPEN',{caseId,count,items:opened.map(x=>({name:x.item.name,value:x.item.value,rarity:x.item.rarity}))});
   await inspectWatchedUser(u.id);
   const coins=(await db.user.findUniqueOrThrow({where:{id:u.id}})).coins;
   return NextResponse.json(count===1?{...opened[0],coins}:{results:opened,coins});
  }
  if(action==='sellBatch'){
   const ids=b.inventoryIds;
   if(!Array.isArray(ids)||ids.length<1||ids.length>10||
      !ids.every(id=>typeof id==='string'&&id.length>0)||
      new Set(ids).size!==ids.length)return fail('Bitte 1 bis 10 unterschiedliche Items auswählen');
   const inventoryIds=ids as string[];
   const settled=await db.$transaction(async tx=>{
    // Read only the authenticated user's still-unsold items. Use the value at draw.
    const rows=await tx.inventoryItem.findMany({
     where:{id:{in:inventoryIds},ownerId:u.id,soldAt:null,tradeLockId:null},
     select:{id:true,valueAtDrop:true,item:{select:{value:true}}}
    });
    if(rows.length!==inventoryIds.length)throw Error('Mindestens ein Item ist bereits verkauft oder gehört dir nicht');
    const payout=rows.reduce((sum,row)=>sum+(row.valueAtDrop??row.item.value),0);
    if(!Number.isSafeInteger(payout)||payout<0)throw Error('Ungültiger Verkaufswert');
    const marked=await tx.inventoryItem.updateMany({
     where:{id:{in:inventoryIds},ownerId:u.id,soldAt:null},
     data:{soldAt:new Date()}
    });
    if(marked.count!==inventoryIds.length)throw Error('Mindestens ein Item wurde bereits verkauft');
    const player=await tx.user.update({where:{id:u.id},data:{coins:{increment:payout}}});
    return {soldIds:inventoryIds,coins:player.coins,value:payout,count:marked.count};
   },{isolationLevel:'Serializable'});
   await recordWatchedActivity(u.id,'SELL_BATCH',{value: settled.value,count:settled.count});
   await inspectWatchedUser(u.id);
   return NextResponse.json(settled);
  }
  if(action==='sell'){
   const inventoryId=typeof b.inventoryId==='string'?b.inventoryId:'';
   if(!inventoryId)return fail('Ungültiges Inventar-Item');
   const result=await db.$transaction(async tx=>{
    const inv=await tx.inventoryItem.findUnique({where:{id:inventoryId},include:{item:true}});
    if(!inv||inv.ownerId!==u.id||inv.soldAt||inv.tradeLockId)throw new Error('Item nicht verfügbar');
    const claimed=await tx.inventoryItem.updateMany({where:{id:inventoryId,ownerId:u.id,soldAt:null,tradeLockId:null},data:{soldAt:new Date()}});
    if(claimed.count!==1)throw new Error('Bereits verkauft');
    const paidValue=inv.valueAtDrop??inv.item.value;
    const updated=await tx.user.update({where:{id:u.id},data:{coins:{increment:paidValue}}});
    return {coins:updated.coins,value:paidValue};
   },{isolationLevel:'Serializable'});
   await recordWatchedActivity(u.id,'SELL_ITEM',{value:result.value});
   await inspectWatchedUser(u.id);
   return NextResponse.json(result);
  }
  return fail('Unbekannte Aktion',404);
 }catch(e){
  console.error('CASE RUSH API:',e);
  const message=e instanceof Error?e.message:'';
  if(message==='Nicht genügend Coins'||message==='Starterkiste bereits geöffnet'||message==='Kiste nicht gefunden'||message==='Item nicht verfügbar'||message==='Bereits verkauft'||message==='Keine überprüften Gewinne verfügbar'||message==='Bitte 3 Sekunden bis zur nächsten Gratis-Kiste warten'||message==='Gratis-Kisten können nur einzeln geöffnet werden'||message==='Nicht genügend Guthaben oder Upgrade fehlt'||message==='Mindestens ein Item ist bereits verkauft oder gehört dir nicht'||message==='Mindestens ein Item wurde bereits verkauft')return fail(message);
  if(typeof e==='object'&&e!==null&&'code' in e&&e.code==='P2002')return fail('Dieser Benutzername ist bereits vergeben',409);
  if(typeof e==='object'&&e!==null&&'code' in e&&String(e.code).startsWith('P10'))return fail('Datenbank momentan nicht erreichbar. Bitte später erneut versuchen.',503);
  return fail('Aktion fehlgeschlagen. Bitte prüfe die Eingaben und probiere es erneut.',500);
 }
}