import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {socialViewer} from '@/lib/social';
import {randomInt} from 'node:crypto';
export const dynamic='force-dynamic';
const answer=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const fail=(error:string,status=400)=>answer({error},status);
async function authorize(req:NextRequest){
 const u=await socialViewer(req,db);
 return u&&process.env.ADMIN_USER_ID===u.id?u:null;
}
const int=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
export async function GET(req:NextRequest){
 const actor=await authorize(req);if(!actor)return fail('Adminzugriff erforderlich',403);
 const view=req.nextUrl.searchParams.get('view')||'summary';
 try{
  if(view==='catalog')return answer({items:await db.item.findMany({where:{imageUrl:{not:null}},select:{id:true,name:true,rarity:true,value:true,imageUrl:true,caseId:true},take:1000})});
  if(view==='players'){
   const id=req.nextUrl.searchParams.get('userId')||'';
   if(!id)return fail('Spieler fehlt');
   const [player,inventory,warnings,openings,battles]=await Promise.all([
    db.user.findUnique({where:{id},select:{id:true,username:true,coins:true,xp:true,isBanned:true,bannedUntil:true}}),
    db.inventoryItem.findMany({where:{ownerId:id,soldAt:null},include:{item:{select:{name:true,rarity:true,value:true,imageUrl:true}}},take:300}),
    db.playerWarning.findMany({where:{userId:id},orderBy:{createdAt:'desc'},take:25}),
    db.opening.count({where:{userId:id}}),
    db.battle.findMany({where:{OR:[{creatorId:id},{guestId:id},{creatorPartnerId:id},{guestPartnerId:id}],status:'FINISHED'},select:{id:true,winnerId:true,totalCost:true,duo:true}})
   ]);
   const wins=battles.filter(b=>b.winnerId===id).length;
   const spent=await db.battleRound.aggregate({where:{battleId:{in:battles.map(b=>b.id)}},_sum:{casePrice:true}});
   return answer({player,inventory,warnings,stats:{openings,battles:battles.length,wins,winRate:battles.length?Math.round(wins/battles.length*100):0,paidBattleCaseTotal:spent._sum.casePrice||0}});
  }
  if(view==='summary'){
   const since=new Date(Date.now()-24*60*60*1000);
   const [users,online,signups,openings,battles,coins,items,drops,gifts,tradeFlags,codes,scheduled,settings,maintenance,jackpots]=await Promise.all([
    db.user.count(),db.user.count({where:{lastSeenAt:{gt:new Date(Date.now()-60000)}}}),
    db.user.count({where:{createdAt:{gte:since}}}),
    db.opening.count({where:{boughtAt:{gte:since}}}),
    db.battle.count({where:{createdAt:{gte:since}}}),
    db.user.aggregate({_sum:{coins:true}}),
    db.inventoryItem.findMany({where:{soldAt:null},select:{valueAtDrop:true,item:{select:{value:true}}},take:5000}),
    db.opening.findMany({take:60,orderBy:{boughtAt:'desc'},include:{user:{select:{username:true}},item:{select:{name:true,value:true,rarity:true,imageUrl:true}}}}),
    db.adminGiftBatch.findMany({take:15,orderBy:{createdAt:'desc'}}),
    db.adminTradeFlag.findMany({take:30,orderBy:{createdAt:'desc'}}),
    db.adminPromo.findMany({take:60,orderBy:{createdAt:'desc'}}),
    db.adminScheduledEvent.findMany({take:40,orderBy:{startsAt:'desc'}}),
    db.adminSetting.findMany(),
    db.adminMaintenance.findUnique({where:{id:'GLOBAL'}}),
    db.adminJackpot.findMany()
   ]);
   return answer({stats:{users,online,signups,openings,battles,coins:coins._sum.coins||0,inventoryValue:items.reduce((n,i)=>n+(i.valueAtDrop??i.item.value),0),inventoryRowsSampled:items.length},drops:drops.map(d=>({id:d.id,username:d.user.username,itemName:d.item.name,value:d.item.value,rarity:d.item.rarity,imageUrl:d.item.imageUrl,createdAt:d.boughtAt})),gifts,tradeFlags,codes,scheduled,settings,maintenance,jackpots});
  }
  if(view==='trades'){
   const offers=await db.tradeOffer.findMany({orderBy:{createdAt:'desc'},take:80,include:{sender:{select:{username:true}},recipient:{select:{username:true}}}});
   return answer({offers});
  }
  if(view==='cases'){
   return answer({cases:await db.case.findMany({orderBy:{name:'asc'},include:{items:{select:{id:true,name:true,weight:true,rarity:true,imageUrl:true}}}})});
  }
  return fail('Unbekannte Ansicht',404);
 }catch(e){console.error('advanced admin get',e);return fail('Serverfehler',503)}
}
export async function POST(req:NextRequest){
 const actor=await authorize(req);if(!actor)return fail('Adminzugriff erforderlich',403);
 const origin=req.headers.get('origin'),host=req.headers.get('x-forwarded-host')||req.headers.get('host');
 if(!origin||!host)return fail('Ungültige Anfragequelle',403);
 try{if(new URL(origin).host!==host)return fail('Ungültige Anfragequelle',403)}catch{return fail('Ungültige Anfragequelle',403)}
 try{
  const data=await req.json() as Record<string,unknown>;
  const action=String(data.action||'');
  const target=typeof data.userId==='string'?data.userId:'';
  const note=typeof data.reason==='string'?data.reason.trim().slice(0,500):'';
  const log=async(type:string,id:string,details:unknown={})=>db.adminAuditLog.create({data:{actorId:actor.id,actorUsername:actor.username,action:type,targetType:'ADVANCED',targetId:id,details:JSON.stringify(details)}});
  if(['setCoins','setXp','warn','temporaryBan','removeInventory'].includes(action)){
   const user=await db.user.findUnique({where:{id:target}});
   if(!user)return fail('Spieler nicht gefunden',404);
   if(action==='setCoins'){
    if(!int(data.amount,0,2000000000))return fail('Ungültiger Betrag');
    await db.user.update({where:{id:target},data:{coins:data.amount as number}});
   }
   if(action==='setXp'){
    if(!int(data.amount,0,2000000000))return fail('Ungültiger XP-Wert');
    await db.user.update({where:{id:target},data:{xp:data.amount as number}});
   }
   if(action==='warn'){
    if(!note)return fail('Grund erforderlich');
    await db.playerWarning.create({data:{userId:target,reason:note,createdBy:actor.id}});
   }
   if(action==='temporaryBan'){
    if(target===actor.id)return fail('Eigenes Admin-Konto nicht sperrbar');
    if(![1,24,168].includes(Number(data.hours)))return fail('Nur 1, 24 oder 168 Stunden');
    await db.user.update({where:{id:target},data:{isBanned:true,bannedUntil:new Date(Date.now()+Number(data.hours)*3600000)}});
    await db.session.deleteMany({where:{userId:target}});
   }
   if(action==='removeInventory'){
    const inventoryId=String(data.inventoryId||'');
    const row=await db.inventoryItem.findFirst({where:{id:inventoryId,ownerId:target,soldAt:null,tradeLockId:null}});
    if(!row)return fail('Item fehlt oder ist im Trade reserviert');
    await db.inventoryItem.update({where:{id:inventoryId},data:{soldAt:new Date()}});
   }
   await log(action,target,{amount:data.amount,hours:data.hours,reason:note,inventoryId:data.inventoryId});
   return answer({ok:true});
  }
  if(action==='grantSkin'){
   const id=String(data.itemId||'');
   const item=await db.item.findUnique({where:{id},select:{id:true,value:true}});
   const recipient=await db.user.findUnique({where:{id:target},select:{id:true}});
   if(!item||!recipient)return fail('Spieler oder Skin nicht gefunden',404);
   const amount=int(data.count,1,10)?data.count as number:1;
   await db.$transaction(async tx=>{
    await tx.inventoryItem.createMany({data:Array.from({length:amount},()=>({ownerId:target,itemId:item.id,valueAtDrop:item.value}))});
    await tx.adminAuditLog.create({data:{actorId:actor.id,actorUsername:actor.username,action:'GRANT_SKIN',targetType:'USER',targetId:target,details:JSON.stringify({itemId:id,count:amount})}});
   });
   return answer({ok:true});
  }
  if(action==='globalGiveaway'){
   if(!int(data.amount,1,1000000))return fail('1 bis 1000000 Cent');
   const players=await db.user.findMany({where:{isBanned:false,lastSeenAt:{gte:new Date(Date.now()-30*60000)}},select:{id:true,coins:true}});
   if(!players.length)return fail('Keine aktiven Spieler');
   await db.$transaction(async tx=>{
    const batch=await tx.adminGiftBatch.create({data:{creatorId:actor.id,amount:data.amount as number,recipientCount:players.length}});
    for(const p of players){
     if(p.coins>2147483647-(data.amount as number))continue;
     await tx.user.update({where:{id:p.id},data:{coins:{increment:data.amount as number}}});
    }
    await tx.adminAuditLog.create({data:{actorId:actor.id,actorUsername:actor.username,action:'GLOBAL_GIVEAWAY',targetType:'BATCH',targetId:batch.id,details:JSON.stringify({amount:data.amount,players:players.length})}});
   },{timeout:60000});
   return answer({ok:true,count:players.length});
  }
  if(action==='mysteryDrop'){
   const catalog=await db.item.findMany({where:{imageUrl:{not:null},value:{gt:0}},select:{id:true,value:true}});
   const players=await db.user.findMany({where:{isBanned:false,lastSeenAt:{gte:new Date(Date.now()-30*60000)}},select:{id:true}});
   if(!catalog.length||!players.length)return fail('Keine aktiven Spieler oder Skins');
   const player=players[randomInt(players.length)],item=catalog[randomInt(catalog.length)];
   await db.inventoryItem.create({data:{ownerId:player.id,itemId:item.id,valueAtDrop:item.value}});
   await log(action,player.id,{itemId:item.id});
   return answer({ok:true,userId:player.id,itemId:item.id});
  }
  if(action==='createPromo'){
   const code=String(data.code||'').trim().toUpperCase();
   if(!/^[A-Z0-9_-]{4,32}$/.test(code)||!int(data.amount,0,100000000)||!int(data.maxUses,1,100000))return fail('Code, Betrag oder Nutzungsgrenze ungültig');
   if(!(data.amount as number)&&!data.itemId)return fail('Coins oder Item auswählen');
   if(data.itemId&&!(await db.item.findUnique({where:{id:String(data.itemId)}})))return fail('Item fehlt');
   const promo=await db.adminPromo.create({data:{code,coinAmount:data.amount as number,itemId:data.itemId?String(data.itemId):null,maxUses:data.maxUses as number}});
   await log(action,promo.id,{code,maxUses:data.maxUses});return answer({ok:true});
  }
  if(action==='scheduleEvent'){
   if(!int(data.discount,0,90)||!int(data.luck,100,500))return fail('Ungültiges Event');
   const start=new Date(String(data.start||'')),end=new Date(String(data.end||''));
   if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||start.getTime()<Date.now()-60000||end.getTime()-start.getTime()>86400000)return fail('Ungültiger Zeitraum (max. 24 Stunden)');
   const created=await db.adminScheduledEvent.create({data:{title:String(data.title||'Happy Hour').slice(0,100),startsAt:start,endsAt:end,discountPercent:data.discount as number,luckMultiplier:data.luck as number,createdBy:actor.id}});
   await log(action,created.id);return answer({ok:true});
  }
  if(action==='setJackpot'){
   const id=String(data.caseId||'');
   if(!(await db.case.findUnique({where:{id}})))return fail('Kiste fehlt');
   if(!int(data.multiplier,100,500))return fail('100 bis 500');
   await db.adminJackpot.upsert({where:{id},create:{id,caseId:id,bonusMultiplier:data.multiplier as number,endsAt:new Date(Date.now()+3600000)},update:{bonusMultiplier:data.multiplier as number,endsAt:new Date(Date.now()+3600000)}});
   await log(action,id,{multiplier:data.multiplier});return answer({ok:true});
  }
  if(action==='maintenance'){
   if(typeof data.enabled!=='boolean')return fail('Ungültiger Status');
   await db.adminMaintenance.upsert({where:{id:'GLOBAL'},create:{id:'GLOBAL',enabled:data.enabled,message:'Wartungsarbeiten'},update:{enabled:data.enabled}});
   await log(action,'GLOBAL',{enabled:data.enabled});return answer({ok:true});
  }
  if(action==='setting'){
   const key=String(data.key||'');
   if(!['START_COINS','CHAT_COOLDOWN_MS','GIFT_COOLDOWN_MS','MAX_OPENINGS'].includes(key)||!int(data.amount,0,100000000))return fail('Ungültige Einstellung');
   await db.adminSetting.upsert({where:{key},create:{key,value:String(data.amount)},update:{value:String(data.amount)}});
   await log(action,key,{value:data.amount});return answer({ok:true});
  }
  if(action==='createCase'){
   const name=String(data.name||'').trim().slice(0,80),slug=String(data.slug||'').trim().toLowerCase();
   if(!name||!/^[a-z0-9-]{3,60}$/.test(slug)||!int(data.price,1,100000000))return fail('Kistenangaben ungültig');
   const itemIds=Array.isArray(data.itemIds)?data.itemIds.filter((x):x is string=>typeof x==='string').slice(0,100):[];
   if(itemIds.length<2)return fail('Mindestens zwei Waffen auswählen');
   const source=await db.item.findMany({where:{id:{in:itemIds}}});
   if(source.length<2)return fail('Waffen nicht gefunden');
   const created=await db.case.create({data:{name,slug,price:data.price as number,imageUrl:String(data.imageUrl||'').slice(0,500)||null,items:{create:source.map(x=>({name:x.name,rarity:x.rarity,value:x.value,weight:x.weight,imageUrl:x.imageUrl,priceOrigin:x.priceOrigin,marketHashName:x.marketHashName,priceCheckedAt:x.priceCheckedAt,priceSourceUrl:x.priceSourceUrl}))}}});
   await log(action,created.id,{name,slug});return answer({ok:true});
  }
  if(action==='cancelBattle'){
   const id=String(data.battleId||'');
   const result=await db.$transaction(async tx=>{
    const battle=await tx.battle.findUnique({where:{id},include:{rounds:true}});
    if(!battle||battle.status!=='WAITING')throw Error('Nur offene Battles dürfen erstattet werden');
    const changed=await tx.battle.updateMany({where:{id,status:'WAITING'},data:{status:'CANCELED',finishedAt:new Date()}});
    if(changed.count!==1)throw Error('Battle bereits bearbeitet');
    const members=[battle.creatorId,battle.creatorPartnerId,battle.guestId,battle.guestPartnerId].filter((x):x is string=>!!x);
    const refund=battle.totalCost||battle.rounds.reduce((n,x)=>n+x.casePrice,0);
    for(const userId of members){
     const wallet=await tx.user.findUniqueOrThrow({where:{id:userId},select:{coins:true}});
     if(wallet.coins>2147483647-refund)throw Error('Guthabenlimit verhindert Erstattung');
     await tx.user.update({where:{id:userId},data:{coins:{increment:refund}}});
    }
    await tx.adminAuditLog.create({data:{actorId:actor.id,actorUsername:actor.username,action:'ADMIN_CANCEL_BATTLE',targetType:'BATTLE',targetId:id,details:JSON.stringify({members,refund})}});
    return {refunded:members.length,refund};
   },{isolationLevel:'Serializable'});
   return answer({ok:true,...result});
  }
  if(action==='flagTrade'){
   const id=String(data.offerId||'');
   if(!(await db.tradeOffer.findUnique({where:{id}})))return fail('Trade fehlt');
   await db.adminTradeFlag.create({data:{offerId:id,reason:note||'Manuelle Überprüfung'}});
   await log(action,id,{reason:note});return answer({ok:true});
  }
  return fail('Aktion unbekannt',404);
 }catch(e){console.error('advanced admin',e);return fail('Aktion fehlgeschlagen; bitte Eingaben prüfen',400)}
}
