import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {socialViewer,qualifiesForGlobalDrop} from '@/lib/social';
import {randomInt} from 'node:crypto';
import type {Item,Prisma} from '@prisma/client';

export const dynamic='force-dynamic';
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
type Seat='creatorPartnerId'|'guestId'|'guestPartnerId';
const seats:Seat[]=['creatorPartnerId','guestId','guestPartnerId'];
type Duo=Prisma.BattleGetPayload<{include:{rounds:true}}>;
const occupied=(battle:Duo,seat:Seat)=>!!battle[seat]||battle.duoBotSeats.includes(seat);
const hasAllSeats=(battle:Duo)=>seats.every(seat=>occupied(battle,seat));
function draw(items:Item[]){
 const available=items.filter(item=>item.weight>0&&item.value>=1&&!!item.imageUrl);
 const total=available.reduce((sum,item)=>sum+item.weight,0);
 if(total<=0)throw Error('Kiste ohne verfügbare Items');
 let roll=randomInt(total);
 for(const item of available){roll-=item.weight;if(roll<0)return item}
 return available[available.length-1];
}

/** Every seat gets its own RNG draw. Bots never debit accounts or receive inventory. */
async function settleIfFull(tx:Prisma.TransactionClient,battleId:string){
 const battle=await tx.battle.findUniqueOrThrow({where:{id:battleId},include:{rounds:true}});
 if(battle.status!=='WAITING'||!battle.duo)throw Error('Duo-Battle nicht mehr offen');
 if(!hasAllSeats(battle))return {id:battleId,status:'WAITING',finished:false};
 const members:(string|null)[]=[
  battle.creatorId,battle.creatorPartnerId,battle.guestId,battle.guestPartnerId
 ];
 const humans=members.filter((x):x is string=>!!x);
 if(new Set(humans).size!==humans.length)throw Error('Doppelte Teilnehmer');
 if(battle.duoBotSeats.length>2)throw Error('Höchstens zwei Bots pro Battle');
 const rounds=battle.rounds.slice().sort((a,b)=>a.position-b.position);
 const catalog=await tx.case.findMany({
  where:{id:{in:[...new Set(rounds.map(r=>r.caseId))]}},include:{items:true}
 });
 const catalogById=new Map(catalog.map(c=>[c.id,c]));
 const results=rounds.map(round=>{
  const c=catalogById.get(round.caseId);
  if(!c)throw Error('Kiste fehlt');
  return {round,draws:[draw(c.items),draw(c.items),draw(c.items),draw(c.items)]};
 });
 const totalA=results.reduce((sum,r)=>sum+r.draws[0].value+r.draws[1].value,0);
 const totalB=results.reduce((sum,r)=>sum+r.draws[2].value+r.draws[3].value,0);
 const wonA=totalA>totalB||(totalA===totalB&&randomInt(2)===0);
 const winnerId=wonA?battle.creatorId:(battle.guestId??battle.guestPartnerId??'BOT');
 const claimed=await tx.battle.updateMany({
  where:{id:battleId,status:'WAITING',duo:true},
  data:{
   status:'FINISHED',winnerId,
   creatorItemId:results[0].draws[0].id,guestItemId:results[0].draws[2].id,
   creatorValue:results[0].draws[0].value,guestValue:results[0].draws[2].value,
   finishedAt:new Date()
  }
 });
 if(claimed.count!==1)throw Error('Battle wurde bereits beendet');
 for(const r of results){
  const d=r.draws;
  await tx.battleRound.update({where:{id:r.round.id},data:{
   creatorItemId:d[0].id,creatorPartnerItemId:d[1].id,
   guestItemId:d[2].id,guestPartnerItemId:d[3].id,
   creatorValue:d[0].value,creatorPartnerValue:d[1].value,
   guestValue:d[2].value,guestPartnerValue:d[3].value
  }});
 }
 // A bot participates in the reel/score, but it is not a registered user.
 await tx.opening.createMany({data:results.flatMap(r=>
  r.draws.flatMap((item,index)=>{
   const humanId=members[index];
   return humanId?[{userId:humanId,caseId:r.round.caseId,itemId:item.id}]:[];
  })
 )});
 const rewardRows=results.flatMap(r=>{
  const d=r.draws;
  const slots=wonA?[0,1]:[2,3];
  return slots.flatMap(index=>{
   const ownerId=members[index];
   if(!ownerId)return [];
   const opposing=index<2?index+2:index-2;
   return [
    {ownerId,itemId:d[index].id,valueAtDrop:d[index].value,battleId},
    {ownerId,itemId:d[opposing].id,valueAtDrop:d[opposing].value,battleId}
   ];
  });
 });
 if(rewardRows.length)await tx.inventoryItem.createMany({data:rewardRows});
 if(rewardRows.length){
  const awarded=await tx.inventoryItem.findMany({
   where:{battleId},include:{item:true,owner:{select:{username:true}}}
  });
  const rare=awarded.filter(r=>qualifiesForGlobalDrop({...r.item,value:r.valueAtDrop??r.item.value}));
  if(rare.length)await tx.rareDropEvent.createMany({data:rare.map(r=>({
   username:r.owner.username,itemName:r.item.name,rarity:r.item.rarity,
   value:r.valueAtDrop??r.item.value,imageUrl:r.item.imageUrl,
   source:'BATTLE',inventoryItemId:r.id
  }))});
 }
 return {id:battleId,status:'FINISHED',finished:true,
  winnerTeam:wonA?'creator':'guest',totalA,totalB,awardedToHumans:rewardRows.length,
  winningHumanPlayers:(wonA?members.slice(0,2):members.slice(2)).filter(Boolean).length};
}

export async function POST(req:NextRequest){
 const user=await socialViewer(req,db);
 if(!user)return fail('Bitte anmelden',401);
 const origin=req.headers.get('origin'),host=req.headers.get('x-forwarded-host')??req.headers.get('host');
 if(origin&&host){
  try{if(new URL(origin).host!==host)return fail('Ungültiger Ursprung',403)}
  catch{return fail('Ungültiger Ursprung',403)}
 }
 try{
  const body=await req.json() as Record<string,unknown>;
  if(body.action==='create'){
   const ids=body.caseIds;
   if(!Array.isArray(ids)||ids.length<1||ids.length>10||
    !ids.every(x=>typeof x==='string'&&x.length>0))return fail('Bitte 1–10 Kisten auswählen');
   const caseIds=ids as string[];
   const result=await db.$transaction(async tx=>{
    const available=await tx.case.findMany({where:{id:{in:caseIds}},include:{items:true}});
    const byId=new Map(available.map(c=>[c.id,c]));
    const ordered=caseIds.map(id=>byId.get(id));
    if(ordered.some(c=>!c||c.price<=0||
     c.items.filter(i=>i.weight>0&&i.imageUrl&&i.value>0).length<2))
     throw Error('Mindestens eine Kiste ist nicht verfügbar');
    const totalCost=ordered.reduce((sum,c)=>sum+c!.price,0);
    if(!Number.isSafeInteger(totalCost)||totalCost<=0)throw Error('Ungültiger Preis');
    if(await tx.battle.count({where:{creatorId:user.id,status:'WAITING'}})>=3)
     throw Error('Du hast bereits drei offene Battles');
    const debit=await tx.user.updateMany({
     where:{id:user.id,coins:{gte:totalCost}},data:{coins:{decrement:totalCost}}
    });
    if(debit.count!==1)throw Error('Nicht genügend Guthaben');
    const battle=await tx.battle.create({data:{
     creatorId:user.id,caseId:ordered[0]!.id,totalCost,duo:true,againstBot:false,
     rounds:{create:ordered.map((c,index)=>({position:index,caseId:c!.id,casePrice:c!.price}))}
    }});
    return {id:battle.id,status:'WAITING',finished:false,totalCost};
   },{isolationLevel:'Serializable'});
   return NextResponse.json({battle:result});
  }
  if(body.action==='join'){
   const battleId=typeof body.battleId==='string'?body.battleId:'';
   const seat=body.seat;
   if(!seats.includes(seat as Seat))return fail('Teamplatz auswählen');
   const selectedSeat=seat as Seat;
   const joined=await db.$transaction(async tx=>{
    const b=await tx.battle.findUnique({where:{id:battleId},include:{rounds:true}});
    if(!b||!b.duo||b.status!=='WAITING')throw Error('Duo-Battle nicht mehr offen');
    if([b.creatorId,b.creatorPartnerId,b.guestId,b.guestPartnerId].includes(user.id))
     throw Error('Du bist bereits in diesem Battle');
    if(occupied(b,selectedSeat))throw Error('Dieser Teamplatz ist besetzt');
    if(b.totalCost<=0)throw Error('Ungültiger Battle-Preis');
    const paid=await tx.user.updateMany({
     where:{id:user.id,coins:{gte:b.totalCost}},
     data:{coins:{decrement:b.totalCost}}
    });
    if(paid.count!==1)throw Error('Nicht genügend Guthaben');
    const assigned=await tx.battle.updateMany({
     where:{id:battleId,status:'WAITING',duo:true,[selectedSeat]:null,
      NOT:{duoBotSeats:{has:selectedSeat}}},
     data:{[selectedSeat]:user.id}
    });
    if(assigned.count!==1)throw Error('Teamplatz wurde bereits besetzt');
    return settleIfFull(tx,battleId);
   },{isolationLevel:'Serializable'});
   return NextResponse.json({battle:joined});
  }
  if(body.action==='addBot'){
   const battleId=typeof body.battleId==='string'?body.battleId:'';
   const seat=body.seat;
   if(!seats.includes(seat as Seat))return fail('Teamplatz auswählen');
   const selectedSeat=seat as Seat;
   const added=await db.$transaction(async tx=>{
    const b=await tx.battle.findUnique({where:{id:battleId},include:{rounds:true}});
    if(!b||!b.duo||b.status!=='WAITING')throw Error('Duo-Battle nicht mehr offen');
    if(b.creatorId!==user.id)throw Error('Nur der Ersteller kann Bots hinzufügen');
    if(occupied(b,selectedSeat))throw Error('Dieser Teamplatz ist besetzt');
    if(b.duoBotSeats.length>=2)throw Error('Maximal zwei Bots pro Duo-Battle');
    const reserved=await tx.battle.updateMany({
     where:{id:battleId,status:'WAITING',duo:true,[selectedSeat]:null,
      NOT:{duoBotSeats:{has:selectedSeat}}},
     data:{duoBotSeats:{push:selectedSeat}}
    });
    if(reserved.count!==1)throw Error('Teamplatz wurde bereits besetzt');
    // If this completes the lobby, the server rolls all four seats immediately.
    // Bots are not users and are not charged the case fee.
    return settleIfFull(tx,battleId);
   },{isolationLevel:'Serializable'});
   return NextResponse.json({battle:added});
  }
  if(body.action==='removeBot'){
   const battleId=typeof body.battleId==='string'?body.battleId:'';
   const seat=body.seat;
   if(!seats.includes(seat as Seat))return fail('Teamplatz auswählen');
   const selectedSeat=seat as Seat;
   const removed=await db.$transaction(async tx=>{
    const b=await tx.battle.findUnique({where:{id:battleId}});
    if(!b||!b.duo||b.status!=='WAITING')throw Error('Duo-Battle nicht mehr offen');
    if(b.creatorId!==user.id)throw Error('Nur der Ersteller kann Bots entfernen');
    if(!b.duoBotSeats.includes(selectedSeat))throw Error('Auf diesem Platz ist kein Bot');
    const saved=await tx.battle.updateMany({
     where:{id:battleId,status:'WAITING',duo:true,duoBotSeats:{has:selectedSeat}},
     data:{duoBotSeats:{set:b.duoBotSeats.filter(s=>s!==selectedSeat)}}
    });
    if(saved.count!==1)throw Error('Duo-Battle wurde gleichzeitig geändert');
    return {id:battleId,status:'WAITING',finished:false};
   },{isolationLevel:'Serializable'});
   return NextResponse.json({battle:removed});
  }
  if(body.action==='cancel'){
   const battleId=typeof body.battleId==='string'?body.battleId:'';
   const canceled=await db.$transaction(async tx=>{
    const b=await tx.battle.findFirst({
     where:{id:battleId,creatorId:user.id,duo:true,status:'WAITING'}
    });
    if(!b)throw Error('Nur der Ersteller kann offene Duos abbrechen');
    const closed=await tx.battle.updateMany({
     where:{id:battleId,creatorId:user.id,status:'WAITING'},
     data:{status:'CANCELED',finishedAt:new Date()}
    });
    if(closed.count!==1)throw Error('Battle wurde bereits gestartet');
    // Refund actual participants, not free virtual bot seats.
    for(const id of [b.creatorId,b.creatorPartnerId,b.guestId,b.guestPartnerId]){
     if(id)await tx.user.update({where:{id},data:{coins:{increment:b.totalCost}}});
    }
    return {id:battleId,status:'CANCELED'};
   },{isolationLevel:'Serializable'});
   return NextResponse.json({battle:canceled});
  }
  return fail('Unbekannte Duo-Aktion',404);
 }catch(error){
  if(typeof error==='object'&&error!==null&&'code' in error&&error.code==='P2034')
   return fail('Gleichzeitige Belegung – bitte erneut versuchen',409);
  const expected=['Mindestens eine Kiste ist nicht verfügbar','Ungültiger Preis',
   'Du hast bereits drei offene Battles','Nicht genügend Guthaben','Duo-Battle nicht mehr offen',
   'Du bist bereits in diesem Battle','Dieser Teamplatz ist besetzt','Ungültiger Battle-Preis',
   'Teamplatz wurde bereits besetzt','Doppelte Teilnehmer','Kiste fehlt',
   'Battle wurde bereits beendet','Nur der Ersteller kann offene Duos abbrechen',
   'Battle wurde bereits gestartet','Nur der Ersteller kann Bots hinzufügen',
   'Nur der Ersteller kann Bots entfernen','Maximal zwei Bots pro Duo-Battle',
   'Auf diesem Platz ist kein Bot','Duo-Battle wurde gleichzeitig geändert'];
  console.error('duo battle action:',error);
  return fail(error instanceof Error&&expected.includes(error.message)?
   error.message:'Duo-Battle konnte nicht abgeschlossen werden');
 }
}
