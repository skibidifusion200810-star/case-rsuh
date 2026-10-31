import {NextRequest,NextResponse} from 'next/server';
import type {Item,Prisma} from '@prisma/client';
import {db} from '@/lib/db';
import {qualifiesForGlobalDrop} from '@/lib/social';
import {getLiveEvent,eventPrice,eventWeight,type LiveEvent} from '@/lib/events';
import {createHash,randomInt} from 'node:crypto';

export const dynamic='force-dynamic';
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const limit=10;
type BattleFull=Prisma.BattleGetPayload<{include:{rounds:true}}>;
async function viewer(req:NextRequest){
 const token=req.cookies.get('cr_session')?.value;
 if(!token)return null;
 const s=await db.session.findUnique({where:{tokenHash:digest(token)},include:{user:true}});
 return s&&s.expiresAt>new Date()&&!s.user.isBanned?s.user:null;
}
function active(items:Item[]){return items.filter(x=>x.weight>0&&x.value>=1&&!!x.imageUrl)}
function draw(items:Item[],basePrice:number,event:LiveEvent|null){
 const weighted=items.map(i=>({...i,weight:eventWeight(i,basePrice,event)}));
 const total=weighted.reduce((a,b)=>a+b.weight,0);
 if(total<=0)throw Error('Kein Item verfügbar');
 let number=randomInt(total);
 for(const item of weighted){number-=item.weight;if(number<0)return item}
 return weighted[weighted.length-1];
}
async function present(battles:BattleFull[],userId?:string){
 const userIds=[...new Set(battles.flatMap(x=>[x.creatorId,x.creatorPartnerId,x.guestId,x.guestPartnerId].filter((s):s is string=>!!s)))];
 const caseIds=[...new Set(battles.flatMap(x=>[x.caseId,...x.rounds.map(r=>r.caseId)]))];
 const itemIds=[...new Set(battles.flatMap(x=>[
  x.creatorItemId,x.guestItemId,...x.rounds.flatMap(r=>[r.creatorItemId,r.creatorPartnerItemId,r.guestItemId,r.guestPartnerItemId])
 ].filter((s):s is string=>!!s)))];
 const [users,cases,items,awardRows]=await Promise.all([
  db.user.findMany({where:{id:{in:userIds}},select:{id:true,username:true}}),
  db.case.findMany({where:{id:{in:caseIds}},select:{id:true,name:true,price:true,imageUrl:true}}),
  db.item.findMany({where:{id:{in:itemIds}},select:{id:true,name:true,rarity:true,value:true,imageUrl:true,weight:true}}),
  db.inventoryItem.groupBy({by:['battleId','ownerId'],where:{battleId:{in:battles.map(b=>b.id)}} ,_count:{_all:true}})
 ]);
 const names=new Map(users.map(x=>[x.id,x.username]));
 const casesById=new Map(cases.map(x=>[x.id,x]));
 const itemsById=new Map(items.map(x=>[x.id,x]));
 const awards=new Map(awardRows.map(row=>[row.battleId+':'+row.ownerId,row._count._all]));
 const drop=(id:string|null,value:number|null)=>id?{...itemsById.get(id),value:value??itemsById.get(id)?.value??0}:null;
 return battles.map(b=>{
  const rounds=b.rounds.length?b.rounds.slice().sort((a,z)=>a.position-z.position).map(r=>({
   position:r.position,caseId:r.caseId,case:casesById.get(r.caseId)??null,
   casePrice:r.casePrice,creatorDrop:drop(r.creatorItemId,r.creatorValue),
   creatorPartnerDrop:drop(r.creatorPartnerItemId,r.creatorPartnerValue),
   guestDrop:drop(r.guestItemId,r.guestValue),guestPartnerDrop:drop(r.guestPartnerItemId,r.guestPartnerValue)
  })):[{
   position:0,caseId:b.caseId,case:casesById.get(b.caseId)??null,
   casePrice:b.totalCost||casesById.get(b.caseId)?.price||0,
   creatorDrop:drop(b.creatorItemId,b.creatorValue),guestDrop:drop(b.guestItemId,b.guestValue),
   creatorPartnerDrop:null,guestPartnerDrop:null
  }];
  const creatorTotal=rounds.reduce((sum,r)=>sum+(r.creatorDrop?.value??0)+(r.creatorPartnerDrop?.value??0),0);
  const guestTotal=rounds.reduce((sum,r)=>sum+(r.guestDrop?.value??0)+(r.guestPartnerDrop?.value??0),0);
  const isBot=(seat:string)=>b.duoBotSeats.includes(seat);
  const participant=(id:string|null,seat:string):string|null=>
   isBot(seat)?'RUSH BOT':id?names.get(id)??'Spieler':null;
  const partnerA=participant(b.creatorPartnerId,'creatorPartnerId');
  const memberB=participant(b.guestId,'guestId');
  const partnerB=participant(b.guestPartnerId,'guestPartnerId');
  const winningTeam=b.winnerId?
   (b.winnerId===b.creatorId||(b.creatorPartnerId!==null&&b.winnerId===b.creatorPartnerId)?
    'creator':'guest'):null;
  const winnerIds=winningTeam==='creator'?[b.creatorId,b.creatorPartnerId]:
   winningTeam==='guest'?[b.guestId,b.guestPartnerId]:[];
  const duoAwards=winnerIds.filter((id):id is string=>!!id)
   .reduce((sum,id)=>sum+(awards.get(b.id+':'+id)??0),0);
  return {
   id:b.id,status:b.status,againstBot:b.againstBot,duo:b.duo,
   duoBotSeats:b.duoBotSeats,
   creatorPartner:partnerA,
   guestPartner:partnerB,
   creatorTeam:[names.get(b.creatorId)??'Spieler',partnerA],
   guestTeam:[memberB,partnerB],
   creator:names.get(b.creatorId)??'Spieler',
   guest:b.againstBot?'RUSH BOT':memberB,
   viewerRole:userId===b.creatorId?'creator':userId===b.creatorPartnerId?'creatorPartner':userId===b.guestId?'guest':userId===b.guestPartnerId?'guestPartner':'spectator',
   winner:b.duo?winningTeam:b.winnerId===b.creatorId?'creator':b.winnerId&&(b.againstBot||b.winnerId===b.guestId)?'guest':null,
   case:casesById.get(b.caseId)??null,
   awardedItemCount:b.duo?duoAwards:b.winnerId&&b.winnerId!=='BOT'?
    awards.get(b.id+':'+b.winnerId)??0:0,
   viewerAwardCount:userId?awards.get(b.id+':'+userId)??0:0,
   totalCost:b.totalCost||rounds.reduce((sum,r)=>sum+r.casePrice,0),
   rounds,creatorTotal,guestTotal,
   creatorDrop:rounds[0].creatorDrop,guestDrop:rounds[0].guestDrop,
   createdAt:b.createdAt.toISOString(),finishedAt:b.finishedAt?.toISOString()??null
  };
 });
}
export async function GET(req:NextRequest){
 try{
  const u=await viewer(req);
  const id=req.nextUrl.searchParams.get('id');
  if(id){
   const battle=await db.battle.findUnique({where:{id},include:{rounds:true}});
   if(!battle)return fail('Battle nicht gefunden',404);
   return NextResponse.json({battle:(await present([battle],u?.id))[0]},{headers:{'Cache-Control':'no-store'}});
  }
  const battles=await db.battle.findMany({orderBy:{createdAt:'desc'},take:30,include:{rounds:true}});
  return NextResponse.json({battles:await present(battles,u?.id)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Battle list:',e);return fail('Battles momentan nicht verfügbar',503)}
}
export async function POST(req:NextRequest){
 const user=await viewer(req);
 if(!user)return fail('Bitte anmelden',401);
 try{
  const body=await req.json() as Record<string,unknown>;
  if(body.action==='create'){
   const ids=Array.isArray(body.caseIds)?body.caseIds:typeof body.caseId==='string'?[body.caseId]:[];
   if(ids.length<1||ids.length>limit||!ids.every(x=>typeof x==='string'&&x.length>0))
    return fail('Bitte 1 bis 10 Kisten auswählen');
   const caseIds=ids as string[];
   const againstBot=body.againstBot===true;
   const created=await db.$transaction(async tx=>{
    const available=await tx.case.findMany({where:{id:{in:caseIds}},include:{items:true}});
    const byId=new Map(available.map(c=>[c.id,c]));
    const selected=caseIds.map(id=>byId.get(id));
    if(selected.some(c=>!c||c.price<=0||active(c.items).length<2))
     throw Error('Mindestens eine ausgewählte Kiste ist nicht verfügbar');
    const event=await getLiveEvent(tx);
    const totalCost=selected.reduce((sum,c)=>sum+eventPrice(c!.price,event),0);
    if(!Number.isSafeInteger(totalCost)||totalCost<=0)throw Error('Ungültiger Gesamtpreis');
    if(await tx.battle.count({where:{creatorId:user.id,status:'WAITING'}})>=3)
     throw Error('Du hast bereits 3 offene Battles');
    const paid=await tx.user.updateMany({where:{id:user.id,coins:{gte:totalCost}},data:{coins:{decrement:totalCost}}});
    if(paid.count!==1)throw Error('Nicht genügend Guthaben');
    const battle=await tx.battle.create({
     data:{
      creatorId:user.id,caseId:selected[0]!.id,totalCost,againstBot,
      rounds:{create:selected.map((c,index)=>({position:index,caseId:c!.id,casePrice:eventPrice(c!.price,event)}))}
     },include:{rounds:true}
    });
    if(!againstBot)return battle;
    const results=selected.map((c,index)=>({
     round:battle.rounds.find(r=>r.position===index)!,caseId:c!.id,
     a:draw(active(c!.items),c!.price,event),b:draw(active(c!.items),c!.price,event)
    }));
    const sumA=results.reduce((sum,r)=>sum+r.a.value,0);
    const sumB=results.reduce((sum,r)=>sum+r.b.value,0);
    const won=sumA>sumB||(sumA===sumB&&randomInt(2)===0);
    for(const r of results)await tx.battleRound.update({where:{id:r.round.id},data:{
     creatorItemId:r.a.id,guestItemId:r.b.id,creatorValue:r.a.value,guestValue:r.b.value
    }});
    await tx.opening.createMany({data:results.map(r=>({userId:user.id,caseId:r.caseId,itemId:r.a.id}))});
    if(won)await tx.inventoryItem.createMany({data:results.flatMap(r=>[
     {ownerId:user.id,itemId:r.a.id,valueAtDrop:r.a.value,battleId:battle.id},
     {ownerId:user.id,itemId:r.b.id,valueAtDrop:r.b.value,battleId:battle.id}
    ])});
    if(won){
     const rewards=await tx.inventoryItem.findMany({
      where:{battleId:battle.id,ownerId:user.id},include:{item:true}
     });
     const rare=rewards.filter(r=>qualifiesForGlobalDrop({...r.item,value:r.valueAtDrop??r.item.value}));
     if(rare.length)await tx.rareDropEvent.createMany({data:rare.map(r=>({
      username:user.username,itemName:r.item.name,rarity:r.item.rarity,
      value:r.valueAtDrop??r.item.value,imageUrl:r.item.imageUrl,
      inventoryItemId:r.id,source:'BATTLE'
     }))});
    }
    return tx.battle.update({where:{id:battle.id},data:{
     status:'FINISHED',winnerId:won?user.id:'BOT',
     creatorItemId:results[0].a.id,guestItemId:results[0].b.id,
     creatorValue:results[0].a.value,guestValue:results[0].b.value,finishedAt:new Date()
    },include:{rounds:true}});
   },{isolationLevel:'Serializable'});
   return NextResponse.json({battle:(await present([created],user.id))[0]});
  }
  if(body.action==='join'){
   const battleId=typeof body.battleId==='string'?body.battleId:'';
   const joined=await db.$transaction(async tx=>{
    const b=await tx.battle.findUnique({where:{id:battleId},include:{rounds:true}});
    if(!b||b.status!=='WAITING'||b.againstBot||b.duo||b.guestId)throw Error('Battle nicht mehr offen');
    if(b.creatorId===user.id)throw Error('Du kannst nicht gegen dich selbst spielen');
    const rounds=b.rounds.length?b.rounds.slice().sort((a,z)=>a.position-z.position):[];
    const ids=rounds.length?rounds.map(r=>r.caseId):[b.caseId];
    const cases=await tx.case.findMany({where:{id:{in:ids}},include:{items:true}});
    const lookup=new Map(cases.map(c=>[c.id,c]));
    if(ids.some(id=>!lookup.has(id)||active(lookup.get(id)!.items).length<2))
     throw Error('Kiste nicht verfügbar');
    const event=await getLiveEvent(tx);
    const totalCost=b.totalCost||ids.reduce((sum,id)=>sum+lookup.get(id)!.price,0);
    const paid=await tx.user.updateMany({where:{id:user.id,coins:{gte:totalCost}},data:{coins:{decrement:totalCost}}});
    if(paid.count!==1)throw Error('Nicht genügend Guthaben');
    const results=ids.map((id,index)=>({
     round:rounds[index],caseId:id,a:draw(active(lookup.get(id)!.items),lookup.get(id)!.price,event),b:draw(active(lookup.get(id)!.items),lookup.get(id)!.price,event)
    }));
    const aTotal=results.reduce((sum,r)=>sum+r.a.value,0);
    const bTotal=results.reduce((sum,r)=>sum+r.b.value,0);
    const winnerId=aTotal>bTotal||(aTotal===bTotal&&randomInt(2)===0)?b.creatorId:user.id;
    const claimed=await tx.battle.updateMany({where:{id:b.id,status:'WAITING',guestId:null},data:{
     guestId:user.id,status:'FINISHED',winnerId,
     creatorItemId:results[0].a.id,guestItemId:results[0].b.id,
     creatorValue:results[0].a.value,guestValue:results[0].b.value,finishedAt:new Date()
    }});
    if(claimed.count!==1)throw Error('Battle bereits gestartet');
    for(const r of results)if(r.round)await tx.battleRound.update({where:{id:r.round.id},data:{
     creatorItemId:r.a.id,guestItemId:r.b.id,creatorValue:r.a.value,guestValue:r.b.value
    }});
    await tx.opening.createMany({data:results.flatMap(r=>[
     {userId:b.creatorId,caseId:r.caseId,itemId:r.a.id},
     {userId:user.id,caseId:r.caseId,itemId:r.b.id}
    ])});
    await tx.inventoryItem.createMany({data:results.flatMap(r=>[
     {ownerId:winnerId,itemId:r.a.id,valueAtDrop:r.a.value,battleId:b.id},
     {ownerId:winnerId,itemId:r.b.id,valueAtDrop:r.b.value,battleId:b.id}
    ])});
    const [awarded,winner]=await Promise.all([
     tx.inventoryItem.findMany({where:{battleId:b.id,ownerId:winnerId},include:{item:true}}),
     tx.user.findUniqueOrThrow({where:{id:winnerId},select:{username:true}})
    ]);
    const rare=awarded.filter(r=>qualifiesForGlobalDrop({...r.item,value:r.valueAtDrop??r.item.value}));
    if(rare.length)await tx.rareDropEvent.createMany({data:rare.map(r=>({
     username:winner.username,itemName:r.item.name,rarity:r.item.rarity,
     value:r.valueAtDrop??r.item.value,imageUrl:r.item.imageUrl,
     inventoryItemId:r.id,source:'BATTLE'
    }))});
    return tx.battle.findUniqueOrThrow({where:{id:b.id},include:{rounds:true}});
   },{isolationLevel:'Serializable'});
   return NextResponse.json({battle:(await present([joined],user.id))[0]});
  }
  if(body.action==='cancel'){
   const battleId=typeof body.battleId==='string'?body.battleId:'';
   const canceled=await db.$transaction(async tx=>{
    const b=await tx.battle.findFirst({where:{id:battleId,creatorId:user.id,status:'WAITING',
     duo:false,againstBot:false,guestId:null},include:{rounds:true}});
    if(!b)throw Error('Nur eigene offene Battles können abgebrochen werden');
    const changed=await tx.battle.updateMany({where:{id:b.id,creatorId:user.id,status:'WAITING',guestId:null},
     data:{status:'CANCELED',finishedAt:new Date()}});
    if(changed.count!==1)throw Error('Battle bereits gestartet');
    const total=b.totalCost||b.rounds.reduce((sum,r)=>sum+r.casePrice,0);
    const fallback=total|| (await tx.case.findUniqueOrThrow({where:{id:b.caseId}})).price;
    await tx.user.update({where:{id:user.id},data:{coins:{increment:fallback}}});
    return tx.battle.findUniqueOrThrow({where:{id:b.id},include:{rounds:true}});
   },{isolationLevel:'Serializable'});
   return NextResponse.json({battle:(await present([canceled],user.id))[0]});
  }
  return fail('Unbekannte Battle-Aktion',404);
 }catch(e){
  console.error('Battle action:',e);
  if(typeof e==='object'&&e!==null&&'code' in e&&e.code==='P2034')
   return fail('Battle wurde gleichzeitig geändert. Bitte erneut versuchen.',409);
  const expected=[
   'Bitte 1 bis 10 Kisten auswählen','Mindestens eine ausgewählte Kiste ist nicht verfügbar',
   'Ungültiger Gesamtpreis','Du hast bereits 3 offene Battles','Nicht genügend Guthaben',
   'Battle nicht mehr offen','Du kannst nicht gegen dich selbst spielen','Kiste nicht verfügbar',
   'Battle bereits gestartet','Nur eigene offene Battles können abgebrochen werden'
  ];
  return fail(e instanceof Error&&expected.includes(e.message)?e.message:'Battle konnte nicht abgeschlossen werden');
 }
}
