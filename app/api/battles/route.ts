import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {createHash,randomInt} from 'node:crypto';

export const dynamic='force-dynamic';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const failed=(message:string,status=400)=>NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
type Draw={id:string;value:number;name:string;imageUrl:string|null;rarity:string;weight:number};

async function viewer(req:NextRequest){
 const cookie=req.cookies.get('cr_session')?.value;
 if(!cookie)return null;
 const session=await db.session.findUnique({where:{tokenHash:hash(cookie)},include:{user:true}});
 return session&&session.expiresAt>new Date()?session.user:null;
}
const pick=(items:Draw[])=>{
 const total=items.reduce((n,item)=>n+item.weight,0);
 if(!total)throw new Error('Für diese Kiste gibt es keine Gewinne');
 let roll=randomInt(total);
 for(const item of items){roll-=item.weight;if(roll<0)return item}
 return items[items.length-1];
};
type BattleInfo={
 id:string;caseId:string;creatorId:string;guestId:string|null;againstBot:boolean;
 status:string;winnerId:string|null;creatorItemId:string|null;guestItemId:string|null;
 creatorValue:number|null;guestValue:number|null;createdAt:Date;finishedAt:Date|null;
};
async function present(battles:BattleInfo[],viewerId?:string){
 const users=await db.user.findMany({where:{id:{in:[...new Set(battles.flatMap(b=>[b.creatorId,b.guestId].filter((s):s is string=>!!s)))]}},select:{id:true,username:true}});
 const cases=await db.case.findMany({where:{id:{in:[...new Set(battles.map(b=>b.caseId))]}},select:{id:true,name:true,price:true,imageUrl:true}});
 const itemIds=[...new Set(battles.flatMap(b=>[b.creatorItemId,b.guestItemId].filter((s):s is string=>!!s)))];
 const items=await db.item.findMany({where:{id:{in:itemIds}},select:{id:true,name:true,rarity:true,imageUrl:true,value:true}});
 const username=new Map(users.map(u=>[u.id,u.username]));
 const caseMap=new Map(cases.map(c=>[c.id,c]));
 const itemMap=new Map(items.map(i=>[i.id,i]));
 return battles.map(b=>({
  id:b.id,status:b.status,againstBot:b.againstBot,
  creator:username.get(b.creatorId)??'Gelöschter Spieler',
  guest:b.againstBot?'RUSH BOT':b.guestId?username.get(b.guestId)??'Gast':null,
  viewerRole:viewerId===b.creatorId?'creator':viewerId&&b.guestId===viewerId?'guest':'spectator',
  winner:b.winnerId===b.creatorId?'creator':b.winnerId&&(b.againstBot||b.winnerId===b.guestId)?'guest':null,
  case:caseMap.get(b.caseId)??null,
  creatorDrop:b.creatorItemId?{...itemMap.get(b.creatorItemId),value:b.creatorValue}:null,
  guestDrop:b.guestItemId?{...itemMap.get(b.guestItemId),value:b.guestValue}:null,
  createdAt:b.createdAt.toISOString(),
  finishedAt:b.finishedAt?.toISOString()??null
 }));
}

export async function GET(req:NextRequest){
 try{
  const u=await viewer(req);
  const id=req.nextUrl.searchParams.get('id');
  if(id){
   const b=await db.battle.findUnique({where:{id}});
   return b?NextResponse.json({battle:(await present([b],u?.id))[0]},{headers:{'Cache-Control':'no-store'}}):failed('Battle nicht gefunden',404);
  }
  const battles=await db.battle.findMany({orderBy:{createdAt:'desc'},take:30});
  return NextResponse.json({battles:await present(battles,u?.id)},{headers:{'Cache-Control':'no-store'}});
 }catch(error){console.error('Battle list:',error);return failed('Battles vorübergehend nicht verfügbar',503)}
}

export async function POST(req:NextRequest){
 const u=await viewer(req);
 if(!u)return failed('Bitte anmelden',401);
 try{
  const body=await req.json() as Record<string,unknown>;
  const action=body?.action;
  if(action==='create'){
   const caseId=typeof body.caseId==='string'?body.caseId:'';
   const againstBot=body.againstBot===true;
   if(!caseId)return failed('Kiste auswählen');
   const created=await db.$transaction(async tx=>{
    const c=await tx.case.findUnique({where:{id:caseId},include:{items:true}});
    if(!c||c.price<=0)throw Error('Case Battles brauchen eine kostenpflichtige Kiste');
    const active=c.items.filter(i=>i.weight>0&&i.value>=1&&!!i.imageUrl);
    if(active.length<2)throw Error('Diese Kiste ist derzeit nicht für Battles verfügbar');
    if(await tx.battle.count({where:{creatorId:u.id,status:'WAITING'}})>=3)throw Error('Du hast schon 3 offene Battles');
    const charged=await tx.user.updateMany({where:{id:u.id,coins:{gte:c.price}},data:{coins:{decrement:c.price}}});
    if(!charged.count)throw Error('Nicht genügend Guthaben');
    const battle=await tx.battle.create({data:{creatorId:u.id,caseId,againstBot,status:'WAITING'}});
    if(!againstBot)return battle;
    const a=pick(active),bot=pick(active);
    const creatorWins=a.value>bot.value||(a.value===bot.value&&randomInt(2)===0);
    await tx.opening.create({data:{userId:u.id,caseId,itemId:a.id}});
    if(creatorWins)await tx.inventoryItem.createMany({data:[
     {ownerId:u.id,itemId:a.id,valueAtDrop:a.value},
     {ownerId:u.id,itemId:bot.id,valueAtDrop:bot.value}
    ]});
    return tx.battle.update({where:{id:battle.id},data:{
     status:'FINISHED',winnerId:creatorWins?u.id:'BOT',
     creatorItemId:a.id,guestItemId:bot.id,
     creatorValue:a.value,guestValue:bot.value,finishedAt:new Date()
    }});
   },{isolationLevel:'Serializable'});
   return NextResponse.json({battle:(await present([created],u.id))[0]});
  }
  if(action==='join'){
   const battleId=typeof body.battleId==='string'?body.battleId:'';
   const joined=await db.$transaction(async tx=>{
    const battle=await tx.battle.findUnique({where:{id:battleId}});
    if(!battle||battle.status!=='WAITING'||battle.againstBot||battle.guestId)throw Error('Battle nicht mehr offen');
    if(battle.creatorId===u.id)throw Error('Du kannst nicht gegen dich selbst spielen');
    const c=await tx.case.findUnique({where:{id:battle.caseId},include:{items:true}});
    if(!c||!c.price)throw Error('Kiste nicht verfügbar');
    const active=c.items.filter(i=>i.weight>0&&i.value>=1&&!!i.imageUrl);
    if(active.length<2)throw Error('Nicht genügend Items für diese Kiste');
    const charged=await tx.user.updateMany({where:{id:u.id,coins:{gte:c.price}},data:{coins:{decrement:c.price}}});
    if(!charged.count)throw Error('Nicht genügend Guthaben');
    const a=pick(active),b=pick(active);
    const creatorWins=a.value>b.value||(a.value===b.value&&randomInt(2)===0);
    const winnerId=creatorWins?battle.creatorId:u.id;
    const claimed=await tx.battle.updateMany({where:{id:battle.id,status:'WAITING',guestId:null},data:{
     guestId:u.id,status:'FINISHED',winnerId,
     creatorItemId:a.id,guestItemId:b.id,
     creatorValue:a.value,guestValue:b.value,finishedAt:new Date()
    }});
    if(!claimed.count)throw Error('Battle bereits gestartet');
    await tx.opening.createMany({data:[
     {userId:battle.creatorId,caseId:c.id,itemId:a.id},
     {userId:u.id,caseId:c.id,itemId:b.id}
    ]});
    await tx.inventoryItem.createMany({data:[
     {ownerId:winnerId,itemId:a.id,valueAtDrop:a.value},
     {ownerId:winnerId,itemId:b.id,valueAtDrop:b.value}
    ]});
    return tx.battle.findUniqueOrThrow({where:{id:battle.id}});
   },{isolationLevel:'Serializable'});
   return NextResponse.json({battle:(await present([joined],u.id))[0]});
  }
  if(action==='cancel'){
   const battleId=typeof body.battleId==='string'?body.battleId:'';
   const canceled=await db.$transaction(async tx=>{
    const battle=await tx.battle.findFirst({where:{id:battleId,creatorId:u.id,guestId:null,againstBot:false,status:'WAITING'}});
    if(!battle)throw Error('Nur ein eigenes offenes Battle kann abgebrochen werden');
    const changed=await tx.battle.updateMany({where:{id:battleId,creatorId:u.id,status:'WAITING',guestId:null},data:{status:'CANCELED',finishedAt:new Date()}});
    if(!changed.count)throw Error('Battle wurde bereits gestartet');
    const c=await tx.case.findUniqueOrThrow({where:{id:battle.caseId}});
    await tx.user.update({where:{id:u.id},data:{coins:{increment:c.price}}});
    return tx.battle.findUniqueOrThrow({where:{id:battleId}});
   },{isolationLevel:'Serializable'});
   return NextResponse.json({battle:(await present([canceled],u.id))[0]});
  }
  return failed('Unbekannte Aktion',404);
 }catch(error){
  console.error('Battle action:',error);
  if(typeof error==='object'&&error!==null&&'code' in error&&error.code==='P2034')return failed('Battle wurde gleichzeitig geändert. Bitte erneut versuchen.',409);
  const expected=['Case Battles brauchen eine kostenpflichtige Kiste','Diese Kiste ist derzeit nicht für Battles verfügbar','Du hast schon 3 offene Battles','Nicht genügend Guthaben','Battle nicht mehr offen','Du kannst nicht gegen dich selbst spielen','Kiste nicht verfügbar','Nicht genügend Items für diese Kiste','Battle bereits gestartet','Nur ein eigenes offenes Battle kann abgebrochen werden','Battle wurde bereits gestartet'];
  return failed(error instanceof Error&&expected.includes(error.message)?error.message:'Battle konnte nicht abgeschlossen werden',400);
 }
}
