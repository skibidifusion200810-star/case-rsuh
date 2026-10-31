import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {socialViewer} from '@/lib/social';

export const dynamic='force-dynamic';
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
function validIds(input:unknown,max=5):input is string[]{
 return Array.isArray(input)&&input.length<=max&&input.every(x=>typeof x==='string'&&/^[a-f0-9-]{16,64}$/i.test(x))&&new Set(input).size===input.length;
}
async function presentOffers(userId:string){
 const offers=await db.tradeOffer.findMany({where:{OR:[{senderId:userId},{recipientId:userId}]},
  orderBy:{createdAt:'desc'},take:35,include:{
   sender:{select:{username:true}},recipient:{select:{username:true}}
  }});
 const ids=[...new Set(offers.flatMap(x=>[...x.offeredIds,...x.requestedIds]))];
 const items=await db.inventoryItem.findMany({where:{id:{in:ids}},include:{item:true}});
 const map=new Map(items.map(x=>[x.id,x]));
 const toView=(id:string)=>{const entry=map.get(id);return entry?{
  id,name:entry.item.name,rarity:entry.item.rarity,imageUrl:entry.item.imageUrl,
  value:entry.valueAtDrop??entry.item.value,mergedCount:entry.mergedCount
 }:null};
 return offers.map(offer=>({
  id:offer.id,sender:offer.sender.username,recipient:offer.recipient.username,
  direction:offer.senderId===userId?'sent':'received',status:offer.status,
  createdAt:offer.createdAt,finishedAt:offer.finishedAt,
  offered:offer.offeredIds.map(toView).filter(x=>x!==null),
  requested:offer.requestedIds.map(toView).filter(x=>x!==null)
 }));
}
export async function GET(req:NextRequest){
 const user=await socialViewer(req,db);
 if(!user)return fail('Bitte anmelden',401);
 try{
  const recipient=req.nextUrl.searchParams.get('recipient')?.trim();
  const own=await db.inventoryItem.findMany({
   where:{ownerId:user.id,soldAt:null,tradeLockId:null},include:{item:true},
   orderBy:{createdAt:'desc'},take:250
  });
  const player=recipient&&/^[A-Za-z0-9_]{3,24}$/.test(recipient)?
   await db.user.findUnique({where:{username:recipient},select:{id:true,username:true}}):null;
  const target=player&&player.id!==user.id?await db.inventoryItem.findMany({
   where:{ownerId:player.id,soldAt:null,tradeLockId:null},include:{item:true},
   orderBy:{createdAt:'desc'},take:250
  }):[];
  const view=(i:typeof own[number])=>({
   id:i.id,name:i.item.name,rarity:i.item.rarity,imageUrl:i.item.imageUrl,
   value:i.valueAtDrop??i.item.value,mergedCount:i.mergedCount
  });
  return NextResponse.json({mine:own.map(view),recipient:player&&player.id!==user.id?player.username:null,
   target:target.map(view),offers:await presentOffers(user.id)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('trade GET:',e);return fail('Handelsbereich momentan nicht verfügbar',503)}
}
export async function POST(req:NextRequest){
 const user=await socialViewer(req,db);
 if(!user)return fail('Bitte anmelden',401);
 const origin=req.headers.get('origin'),host=req.headers.get('x-forwarded-host')??req.headers.get('host');
 if(origin&&host){try{if(new URL(origin).host!==host)return fail('Ungültiger Ursprung',403)}catch{return fail('Ungültiger Ursprung',403)}}
 try{
  const b=await req.json() as Record<string,unknown>;
  if(b.action==='create'){
   const recipient=typeof b.recipient==='string'?b.recipient.trim():'';
   if(!/^[a-zA-Z0-9_]{3,24}$/.test(recipient))return fail('Gültigen Benutzer angeben');
   if(!validIds(b.offered)||!validIds(b.requested)||!(b.offered as string[]).length)return fail('1–5 angebotene und bis zu 5 gewünschte Items wählen');
   const offered=b.offered as string[],requested=b.requested as string[];
   if(offered.some(id=>requested.includes(id)))return fail('Item darf nicht auf beiden Seiten stehen');
   const recipientUser=await db.user.findUnique({where:{username:recipient},select:{id:true}});
   if(!recipientUser)return fail('Empfänger nicht gefunden',404);
   if(recipientUser.id===user.id)return fail('Nicht mit dir selbst handeln');
   const offer=await db.$transaction(async tx=>{
    const count=await tx.tradeOffer.count({where:{senderId:user.id,status:'PENDING'}});
    if(count>=10)throw Error('Höchstens zehn offene Trades erlaubt');
    const theirs=await tx.inventoryItem.count({where:{id:{in:requested},ownerId:recipientUser.id,soldAt:null,tradeLockId:null}});
    if(theirs!==requested.length)throw Error('Gewünschte Items gehören dem Empfänger nicht mehr');
    const created=await tx.tradeOffer.create({data:{
     senderId:user.id,recipientId:recipientUser.id,offeredIds:offered,requestedIds:requested
    }});
    const locked=await tx.inventoryItem.updateMany({
     where:{id:{in:offered},ownerId:user.id,soldAt:null,tradeLockId:null},
     data:{tradeLockId:created.id}
    });
    if(locked.count!==offered.length)throw Error('Eigene Items sind nicht mehr verfügbar');
    return created;
   },{isolationLevel:'Serializable'});
   return NextResponse.json({offerId:offer.id},{headers:{'Cache-Control':'no-store'}});
  }
  if(b.action==='accept'){
   const id=typeof b.offerId==='string'?b.offerId:'';
   const accepted=await db.$transaction(async tx=>{
    const offer=await tx.tradeOffer.findUnique({where:{id}});
    if(!offer||offer.recipientId!==user.id||offer.status!=='PENDING')throw Error('Handelsangebot nicht mehr verfügbar');
    const changed=await tx.tradeOffer.updateMany({where:{id,status:'PENDING',recipientId:user.id},
     data:{status:'ACCEPTED',finishedAt:new Date()}});
    if(changed.count!==1)throw Error('Handelsangebot wurde bereits bearbeitet');
    const take=await tx.inventoryItem.updateMany({where:{id:{in:offer.offeredIds},ownerId:offer.senderId,
     soldAt:null,tradeLockId:id},data:{ownerId:user.id,tradeLockId:null}});
    if(take.count!==offer.offeredIds.length)throw Error('Angebotene Items sind nicht verfügbar');
    if(offer.requestedIds.length){
     const give=await tx.inventoryItem.updateMany({where:{id:{in:offer.requestedIds},ownerId:user.id,
      soldAt:null,tradeLockId:null},data:{ownerId:offer.senderId}});
     if(give.count!==offer.requestedIds.length)throw Error('Angefragte Items sind nicht mehr verfügbar');
    }
    return offer.id;
   },{isolationLevel:'Serializable'});
   return NextResponse.json({accepted,ok:true},{headers:{'Cache-Control':'no-store'}});
  }
  if(b.action==='decline'||b.action==='cancel'){
   const id=typeof b.offerId==='string'?b.offerId:'';
   const closed=await db.$transaction(async tx=>{
    const offer=await tx.tradeOffer.findUnique({where:{id}});
    if(!offer||offer.status!=='PENDING')throw Error('Angebot bereits abgeschlossen');
    if(b.action==='cancel'&&offer.senderId!==user.id)throw Error('Nur Absender können abbrechen');
    if(b.action==='decline'&&offer.recipientId!==user.id)throw Error('Nur Empfänger können ablehnen');
    const changed=await tx.tradeOffer.updateMany({where:{id,status:'PENDING'},
     data:{status:b.action==='cancel'?'CANCELED':'DECLINED',finishedAt:new Date()}});
    if(changed.count!==1)throw Error('Angebot bereits abgeschlossen');
    await tx.inventoryItem.updateMany({where:{tradeLockId:id,ownerId:offer.senderId},
     data:{tradeLockId:null}});
    return offer.id;
   },{isolationLevel:'Serializable'});
   return NextResponse.json({closed,ok:true},{headers:{'Cache-Control':'no-store'}});
  }
  return fail('Unbekannte Handelsaktion',404);
 }catch(e){
  if(typeof e==='object'&&e!==null&&'code' in e&&e.code==='P2034')
   return fail('Gleichzeitige Änderung – bitte erneut versuchen',409);
  const expected=[
   'Höchstens zehn offene Trades erlaubt','Gewünschte Items gehören dem Empfänger nicht mehr',
   'Eigene Items sind nicht mehr verfügbar','Handelsangebot nicht mehr verfügbar',
   'Handelsangebot wurde bereits bearbeitet','Angebotene Items sind nicht verfügbar',
   'Angefragte Items sind nicht mehr verfügbar','Angebot bereits abgeschlossen',
   'Nur Absender können abbrechen','Nur Empfänger können ablehnen'];
  console.error('trade POST:',e);
  return fail(e instanceof Error&&expected.includes(e.message)?e.message:'Handel konnte nicht abgeschlossen werden',400);
 }
}
