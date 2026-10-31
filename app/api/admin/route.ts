import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {socialViewer} from '@/lib/social';

export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const fail=(error:string,status=400,extra:Record<string,unknown>={})=>
 NextResponse.json({error,...extra},{status,headers:noStore});
const adminId=()=>process.env.ADMIN_USER_ID?.trim()||'';
const adminConfigured=()=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(adminId());
const maxGrant=100000000; // €1,000,000 virtual, integer cents.
const usernameFilter=(q:string)=>({username:{contains:q,mode:'insensitive' as const}});
const ownerId=adminId();

async function access(req:NextRequest){
 const user=await socialViewer(req,db);
 if(!user)return {user:null,allowed:false,configured:adminConfigured()};
 return {user,allowed:adminConfigured()&&user.id===ownerId,configured:adminConfigured()};
}
async function log(tx:Parameters<Parameters<typeof db.$transaction>[0]>[0], actor:{id:string;username:string},
 action:string,targetType:string,targetId:string,details:Record<string,unknown>){
 await tx.adminAuditLog.create({data:{
  actorId:actor.id,actorUsername:actor.username,action,targetType,targetId,details:JSON.stringify(details)
 }});
}
export async function GET(req:NextRequest){
 try{
  const gate=await access(req);
  if(!gate.user)return fail('Bitte zuerst anmelden',401);
  if(!gate.allowed)return fail('Kein Administratorzugriff',403,{
   configured:gate.configured,accountId:gate.user.id
  });
  const view=req.nextUrl.searchParams.get('view')||'overview';
  if(view==='status')return NextResponse.json({admin:true,username:gate.user.username},{headers:noStore});
  if(view==='overview'){
   const [users,cases,openings,battles,chat,totals,lastActions]=await Promise.all([
    db.user.count(),db.case.count(),db.opening.count(),
    db.battle.count(),db.chatMessage.count(),
    db.user.aggregate({_sum:{coins:true}}),
    db.adminAuditLog.findMany({take:8,orderBy:{createdAt:'desc'}})
   ]);
   return NextResponse.json({stats:{
    users,cases,openings,battles,chat,totalCoins:totals._sum.coins||0
   },actions:lastActions},{headers:noStore});
  }
  if(view==='users'){
   const q=(req.nextUrl.searchParams.get('q')||'').trim().slice(0,50);
   const users=await db.user.findMany({
    where:q?usernameFilter(q):{},
    take:40,orderBy:{createdAt:'desc'},
    select:{id:true,username:true,coins:true,isBanned:true,createdAt:true,openSlots:true,
     _count:{select:{inventory:true,openings:true}}}
   });
   return NextResponse.json({users},{headers:noStore});
  }
  if(view==='chat'){
   const messages=await db.chatMessage.findMany({orderBy:{createdAt:'desc'},take:65,
    select:{id:true,body:true,createdAt:true,user:{select:{username:true,id:true}}}});
   return NextResponse.json({messages},{headers:noStore});
  }
  if(view==='cases'){
   const cases=await db.case.findMany({orderBy:{price:'asc'},include:{
    items:{where:{value:{gte:1},imageUrl:{not:null}},orderBy:{value:'asc'},
     select:{id:true,name:true,rarity:true,value:true,weight:true,imageUrl:true,marketHashName:true}}
   }});
   return NextResponse.json({cases},{headers:noStore});
  }
  if(view==='battles'){
   const battles=await db.battle.findMany({orderBy:{createdAt:'desc'},take:45,
    select:{id:true,createdAt:true,status:true,totalCost:true,duo:true,duoBotSeats:true,
     againstBot:true,creatorId:true,guestId:true,winnerId:true,finishedAt:true}});
   const users=await db.user.findMany({where:{id:{in:[...new Set(battles.flatMap(b=>[b.creatorId,b.guestId].filter((x):x is string=>!!x)))]}},
    select:{id:true,username:true}});
   const names=new Map(users.map(x=>[x.id,x.username]));
   return NextResponse.json({battles:battles.map(b=>({
    id:b.id,createdAt:b.createdAt,status:b.status,totalCost:b.totalCost,duo:b.duo,
    againstBot:b.againstBot,bots:b.duoBotSeats.length,
    creator:names.get(b.creatorId)||'Spieler',guest:b.guestId?names.get(b.guestId)||'Spieler':null,
    winner:b.winnerId?names.get(b.winnerId)??(b.winnerId==='BOT'?'BOT':'Team'):null
   }))},{headers:noStore});
  }
  if(view==='audit'){
   const actions=await db.adminAuditLog.findMany({orderBy:{createdAt:'desc'},take:100});
   return NextResponse.json({actions},{headers:noStore});
  }
  return fail('Unbekannte Admin-Ansicht',404);
 }catch(e){console.error('Admin GET:',e);return fail('Admin-Daten momentan nicht verfügbar',503)}
}
export async function POST(req:NextRequest){
 const gate=await access(req);
 if(!gate.user)return fail('Bitte anmelden',401);
 if(!gate.allowed)return fail('Administratorzugriff erforderlich',403);
 const origin=req.headers.get('origin');
 const host=req.headers.get('x-forwarded-host')||req.headers.get('host');
 if(!origin||!host)return fail('Ungültige Anfragequelle',403);
 try{if(new URL(origin).host!==host)return fail('Fremde Anfragequelle',403)}
 catch{return fail('Ungültige Anfragequelle',403)}
 const actor=gate.user;
 try{
  const input=await req.json() as Record<string,unknown>;
  if(!input||Array.isArray(input)||typeof input!=='object')return fail('Ungültige Anfrage');
  const action=typeof input.action==='string'?input.action:'';
  if(action==='grantCoins'){
   const userId=typeof input.userId==='string'?input.userId:'';
   const amount=input.amountCents;
   if(typeof amount!=='number'||!Number.isSafeInteger(amount)||amount<1||amount>maxGrant)
    return fail('Betrag muss zwischen 0,01 € und 1.000.000 € liegen');
   const result=await db.$transaction(async tx=>{
    const recipient=await tx.user.findUnique({where:{id:userId},
     select:{id:true,username:true,coins:true}});
    if(!recipient)throw Error('Spieler nicht gefunden');
    if(recipient.coins>2147483647-amount)throw Error('Guthabenlimit überschritten');
    const updated=await tx.user.update({where:{id:recipient.id},
     data:{coins:{increment:amount}},select:{id:true,username:true,coins:true}});
    await log(tx,actor,'GRANT_COINS','USER',recipient.id,{
     amountCents:amount,beforeCents:recipient.coins,afterCents:updated.coins,
     recipientUsername:recipient.username
    });
    return updated;
   },{isolationLevel:'Serializable'});
   return NextResponse.json({ok:true,user:result},{headers:noStore});
  }
  if(action==='ban'||action==='unban'){
   const userId=typeof input.userId==='string'?input.userId:'';
   if(userId===actor.id)return fail('Du kannst dein eigenes Admin-Konto nicht sperren');
   const isBanned=action==='ban';
   const result=await db.$transaction(async tx=>{
    const target=await tx.user.findUnique({where:{id:userId},
     select:{id:true,username:true,isBanned:true}});
    if(!target)throw Error('Spieler nicht gefunden');
    const updated=await tx.user.update({where:{id:userId},data:{isBanned},
     select:{id:true,username:true,isBanned:true}});
    if(isBanned)await tx.session.deleteMany({where:{userId}});
    await log(tx,actor,isBanned?'BAN_USER':'UNBAN_USER','USER',userId,{
     username:target.username,oldStatus:target.isBanned,newStatus:isBanned
    });
    return updated;
   },{isolationLevel:'Serializable'});
   return NextResponse.json({ok:true,user:result},{headers:noStore});
  }
  if(action==='deleteMessage'){
   const id=typeof input.messageId==='string'?input.messageId:'';
   const result=await db.$transaction(async tx=>{
    const message=await tx.chatMessage.findUnique({where:{id},
     include:{user:{select:{username:true}}}});
    if(!message)throw Error('Nachricht nicht gefunden');
    await tx.chatMessage.delete({where:{id}});
    await log(tx,actor,'DELETE_CHAT','CHAT_MESSAGE',id,{
     author:message.user.username,content:message.body.slice(0,280)
    });
    return {id};
   },{isolationLevel:'Serializable'});
   return NextResponse.json({ok:true,removed:result},{headers:noStore});
  }
  if(action==='setCasePrice'){
   const caseId=typeof input.caseId==='string'?input.caseId:'';
   const price=input.priceCents;
   if(typeof price!=='number'||!Number.isSafeInteger(price)||price<0||price>100000000)
    return fail('Kistenpreis außerhalb des erlaubten Bereichs');
   const result=await db.$transaction(async tx=>{
    const c=await tx.case.findUnique({where:{id:caseId}});
    if(!c)throw Error('Kiste nicht gefunden');
    if((c.slug==='first-drop')!== (price===0))throw Error('Nur die kostenlose Kiste darf gratis sein');
    const changed=await tx.case.update({where:{id:caseId},data:{price},
     select:{id:true,slug:true,name:true,price:true}});
    await tx.adminCaseOverride.upsert({where:{slug:c.slug},create:{slug:c.slug,price},update:{price}});
    await log(tx,actor,'SET_CASE_PRICE','CASE',caseId,{
     name:c.name,oldCents:c.price,newCents:price
    });
    return changed;
   },{isolationLevel:'Serializable'});
   return NextResponse.json({ok:true,case:result},{headers:noStore});
  }
  if(action==='setDropWeight'){
   const itemId=typeof input.itemId==='string'?input.itemId:'';
   const weight=input.weight;
   if(typeof weight!=='number'||!Number.isSafeInteger(weight)||weight<0||weight>100000000)
    return fail('Ungültiges Drop-Gewicht');
   const result=await db.$transaction(async tx=>{
    const item=await tx.item.findUnique({where:{id:itemId}});
    if(!item)throw Error('Item nicht gefunden');
    if(weight>0&&(!item.imageUrl||item.value<1))throw Error('Dieser Skin besitzt keine überprüften Bild- und Wertdaten');
    if(weight===0&&item.weight>0){
     const other=await tx.item.count({where:{caseId:item.caseId,id:{not:item.id},weight:{gt:0},value:{gte:1},imageUrl:{not:null}}});
     if(!other)throw Error('Die Kiste muss mindestens einen aktiven Gewinn behalten');
    }
    const changed=await tx.item.update({where:{id:itemId},data:{weight},
     select:{id:true,name:true,weight:true}});
    await tx.adminItemOverride.upsert({where:{itemId},create:{itemId,weight},update:{weight}});
    await log(tx,actor,'SET_DROP_WEIGHT','ITEM',itemId,{
     name:item.name,oldWeight:item.weight,newWeight:weight
    });
    return changed;
   },{isolationLevel:'Serializable'});
   return NextResponse.json({ok:true,item:result},{headers:noStore});
  }
  return fail('Unbekannte Aktion',404);
 }catch(e){
  if(typeof e==='object'&&e!==null&&'code' in e&&e.code==='P2034')
   return fail('Gleichzeitige Änderung – bitte erneut versuchen',409);
  const message=e instanceof Error?e.message:'';
  const expected=['Spieler nicht gefunden','Guthabenlimit überschritten','Nachricht nicht gefunden',
   'Kiste nicht gefunden','Item nicht gefunden','Dieser Skin besitzt keine überprüften Bild- und Wertdaten',
   'Die Kiste muss mindestens einen aktiven Gewinn behalten','Nur die kostenlose Kiste darf gratis sein'];
  console.error('Admin mutation:',e);
  return fail(expected.includes(message)?message:'Admin-Aktion fehlgeschlagen',400);
 }
}
