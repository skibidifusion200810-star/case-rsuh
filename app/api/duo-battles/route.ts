import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {socialViewer,qualifiesForGlobalDrop} from '@/lib/social';
import {randomInt} from 'node:crypto';
import type {Item} from '@prisma/client';

export const dynamic='force-dynamic';
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
type Seat='creatorPartnerId'|'guestId'|'guestPartnerId';
const seats:Seat[]=['creatorPartnerId','guestId','guestPartnerId'];
function draw(items:Item[]){
 const available=items.filter(i=>i.weight>0&&i.value>=1&&!!i.imageUrl);
 const total=available.reduce((sum,i)=>sum+i.weight,0);
 if(!total)throw Error('Kiste ohne verfügbare Items');
 let n=randomInt(total);
 for(const item of available){n-=item.weight;if(n<0)return item}
 return available[available.length-1];
}
export async function POST(req:NextRequest){
 const user=await socialViewer(req,db);
 if(!user)return fail('Bitte anmelden',401);
 const origin=req.headers.get('origin'),host=req.headers.get('x-forwarded-host')??req.headers.get('host');
 if(origin&&host){try{if(new URL(origin).host!==host)return fail('Ungültiger Ursprung',403)}catch{return fail('Ungültiger Ursprung',403)}}
 try{
  const body=await req.json() as Record<string,unknown>;
  if(body.action==='create'){
   const caseIds=body.caseIds;
   if(!Array.isArray(caseIds)||caseIds.length<1||caseIds.length>10||
    !caseIds.every(x=>typeof x==='string'&&x.length>0))return fail('Bitte 1–10 Kisten auswählen');
   const result=await db.$transaction(async tx=>{
    const available=await tx.case.findMany({where:{id:{in:caseIds as string[]}},include:{items:true}});
    const byId=new Map(available.map(c=>[c.id,c]));
    const ordered=(caseIds as string[]).map(id=>byId.get(id));
    if(ordered.some(c=>!c||c.price<=0||c.items.filter(i=>i.weight>0&&i.imageUrl&&i.value>0).length<2))
     throw Error('Mindestens eine Kiste ist nicht verfügbar');
    const cost=ordered.reduce((sum,c)=>sum+c!.price,0);
    if(!Number.isSafeInteger(cost)||cost<=0)throw Error('Ungültiger Preis');
    if(await tx.battle.count({where:{creatorId:user.id,status:'WAITING'}})>=3)
     throw Error('Du hast bereits drei offene Battles');
    const debited=await tx.user.updateMany({where:{id:user.id,coins:{gte:cost}},
     data:{coins:{decrement:cost}}});
    if(debited.count!==1)throw Error('Nicht genügend Guthaben');
    const battle=await tx.battle.create({data:{
     creatorId:user.id,caseId:ordered[0]!.id,totalCost:cost,duo:true,againstBot:false,
     rounds:{create:ordered.map((c,index)=>({position:index,caseId:c!.id,casePrice:c!.price}))}
    }});
    return {id:battle.id,totalCost:cost};
   },{isolationLevel:'Serializable'});
   return NextResponse.json({battle:result});
  }
  if(body.action==='join'){
   const battleId=typeof body.battleId==='string'?body.battleId:'';
   const seat=body.seat;
   if(!seats.includes(seat as Seat))return fail('Teamplatz auswählen');
   const assignedSeat=seat as Seat;
   const joined=await db.$transaction(async tx=>{
    const battle=await tx.battle.findUnique({where:{id:battleId},include:{rounds:true}});
    if(!battle||!battle.duo||battle.status!=='WAITING')throw Error('Duo-Battle nicht mehr offen');
    if([battle.creatorId,battle.creatorPartnerId,battle.guestId,battle.guestPartnerId].includes(user.id))
     throw Error('Du bist bereits in diesem Battle');
    if(battle[assignedSeat]!==null)throw Error('Dieser Teamplatz ist besetzt');
    const cost=battle.totalCost;
    if(cost<=0)throw Error('Ungültiger Battle-Preis');
    const paid=await tx.user.updateMany({where:{id:user.id,coins:{gte:cost}},
     data:{coins:{decrement:cost}}});
    if(paid.count!==1)throw Error('Nicht genügend Guthaben');
    const occupied=await tx.battle.updateMany({where:{id:battleId,status:'WAITING',duo:true,
     [assignedSeat]:null},data:{[assignedSeat]:user.id}});
    if(occupied.count!==1)throw Error('Teamplatz wurde bereits besetzt');
    const updated=await tx.battle.findUniqueOrThrow({where:{id:battleId},include:{rounds:true}});
    if(!updated.creatorPartnerId||!updated.guestId||!updated.guestPartnerId)
     return {id:battleId,status:'WAITING',finished:false};
    // Fourth player commits the full 2v2 result once, in this transaction.
    const roster=[updated.creatorId,updated.creatorPartnerId,updated.guestId,updated.guestPartnerId];
    if(new Set(roster).size!==4)throw Error('Doppelte Teilnehmer');
    const ordered=updated.rounds.slice().sort((a,b)=>a.position-b.position);
    const catalog=await tx.case.findMany({where:{id:{in:ordered.map(r=>r.caseId)}},include:{items:true}});
    const byId=new Map(catalog.map(c=>[c.id,c]));
    const results=ordered.map(round=>{
     const c=byId.get(round.caseId);
     if(!c)throw Error('Kiste fehlt');
     return {round,draws:[draw(c.items),draw(c.items),draw(c.items),draw(c.items)]};
    });
    const first=results.reduce((sum,r)=>sum+r.draws[0].value+r.draws[1].value,0);
    const second=results.reduce((sum,r)=>sum+r.draws[2].value+r.draws[3].value,0);
    const teamA=first>second||(first===second&&randomInt(2)===0);
    const winnerTeam=teamA?roster.slice(0,2):roster.slice(2,4);
    const winners=new Map([[winnerTeam[0],0],[winnerTeam[1],1]]);
    const settled=await tx.battle.updateMany({where:{id:battleId,status:'WAITING',duo:true,
     creatorPartnerId:updated.creatorPartnerId,guestId:updated.guestId,guestPartnerId:updated.guestPartnerId},
     data:{status:'FINISHED',winnerId:teamA?updated.creatorId:updated.guestId,
      creatorItemId:results[0].draws[0].id,guestItemId:results[0].draws[2].id,
      creatorValue:results[0].draws[0].value,guestValue:results[0].draws[2].value,
      finishedAt:new Date()}});
    if(settled.count!==1)throw Error('Battle wurde bereits beendet');
    for(const result of results){
     const d=result.draws;
     await tx.battleRound.update({where:{id:result.round.id},data:{
      creatorItemId:d[0].id,creatorPartnerItemId:d[1].id,
      guestItemId:d[2].id,guestPartnerItemId:d[3].id,
      creatorValue:d[0].value,creatorPartnerValue:d[1].value,
      guestValue:d[2].value,guestPartnerValue:d[3].value
     }});
    }
    await tx.opening.createMany({data:results.flatMap(r=>r.draws.map((d,i)=>({
     userId:roster[i],caseId:r.round.caseId,itemId:d.id
    })))});
    // Each winning teammate gets their own slot's drop AND a mirrored opponent drop.
    // Each receives two prizes per round; no duplicate inventory records.
    await tx.inventoryItem.createMany({data:results.flatMap(r=>{
     const d=r.draws;
     return teamA?[
      {ownerId:roster[0],itemId:d[0].id,valueAtDrop:d[0].value,battleId},
      {ownerId:roster[0],itemId:d[2].id,valueAtDrop:d[2].value,battleId},
      {ownerId:roster[1],itemId:d[1].id,valueAtDrop:d[1].value,battleId},
      {ownerId:roster[1],itemId:d[3].id,valueAtDrop:d[3].value,battleId}
     ]:[
      {ownerId:roster[2],itemId:d[2].id,valueAtDrop:d[2].value,battleId},
      {ownerId:roster[2],itemId:d[0].id,valueAtDrop:d[0].value,battleId},
      {ownerId:roster[3],itemId:d[3].id,valueAtDrop:d[3].value,battleId},
      {ownerId:roster[3],itemId:d[1].id,valueAtDrop:d[1].value,battleId}
     ];
    })});
    const rare=await tx.inventoryItem.findMany({where:{battleId},include:{item:true,owner:{select:{username:true}}}});
    const highlights=rare.filter(r=>qualifiesForGlobalDrop({...r.item,value:r.valueAtDrop??r.item.value}));
    if(highlights.length)await tx.rareDropEvent.createMany({data:highlights.map(r=>({
     username:r.owner.username,itemName:r.item.name,rarity:r.item.rarity,
     value:r.valueAtDrop??r.item.value,imageUrl:r.item.imageUrl,
     source:'BATTLE',inventoryItemId:r.id
    }))});
    return {id:battleId,status:'FINISHED',finished:true,
     winnerTeam:teamA?'creator':'guest',totalA:first,totalB:second,
     awardedPerWinner:results.length*2};
   },{isolationLevel:'Serializable'});
   return NextResponse.json({battle:joined});
  }
  if(body.action==='cancel'){
   const battleId=typeof body.battleId==='string'?body.battleId:'';
   const canceled=await db.$transaction(async tx=>{
    const battle=await tx.battle.findFirst({where:{id:battleId,creatorId:user.id,
     duo:true,status:'WAITING'}});
    if(!battle)throw Error('Nur der Ersteller kann offene Duos abbrechen');
    const stopped=await tx.battle.updateMany({where:{id:battleId,creatorId:user.id,status:'WAITING'},
     data:{status:'CANCELED',finishedAt:new Date()}});
    if(stopped.count!==1)throw Error('Battle wurde bereits gestartet');
    for(const id of [battle.creatorId,battle.creatorPartnerId,battle.guestId,battle.guestPartnerId]){
     if(id)await tx.user.update({where:{id},data:{coins:{increment:battle.totalCost}}});
    }
    return {id:battleId,status:'CANCELED'};
   },{isolationLevel:'Serializable'});
   return NextResponse.json({battle:canceled});
  }
  return fail('Unbekannte Duo-Aktion',404);
 }catch(e){
  if(typeof e==='object'&&e!==null&&'code' in e&&e.code==='P2034')return fail('Gleichzeitige Belegung, bitte erneut versuchen',409);
  const expected=['Mindestens eine Kiste ist nicht verfügbar','Ungültiger Preis',
   'Du hast bereits drei offene Battles','Nicht genügend Guthaben','Duo-Battle nicht mehr offen',
   'Du bist bereits in diesem Battle','Dieser Teamplatz ist besetzt','Ungültiger Battle-Preis',
   'Teamplatz wurde bereits besetzt','Doppelte Teilnehmer','Kiste fehlt','Battle wurde bereits beendet',
   'Nur der Ersteller kann offene Duos abbrechen','Battle wurde bereits gestartet'];
  console.error('duo POST:',e);
  return fail(e instanceof Error&&expected.includes(e.message)?e.message:'Duo-Battle konnte nicht abgeschlossen werden');
 }
}
