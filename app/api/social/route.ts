import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {maintenanceBlocked} from '@/lib/maintenance';
import {
 CHAT_COOLDOWN_MS,GIFT_COOLDOWN_MS,MAX_GIFT_CENTS,
 nextGiftAt,socialViewer,validateGiftCents
} from '@/lib/social';

export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const fail=(error:string,status=400,nextAt?:string)=>NextResponse.json(
 {error,...(nextAt?{nextAt}:{})},{status,headers:noStore}
);

export async function GET(req:NextRequest){
 try{
  const feed=req.nextUrl.searchParams.get('feed')||'drops';
  if(feed==='drops'){
   const events=await db.rareDropEvent.findMany({orderBy:{createdAt:'desc'},take:12,
    select:{id:true,username:true,itemName:true,rarity:true,value:true,imageUrl:true,source:true,createdAt:true}});
   return NextResponse.json({events},{headers:noStore});
  }
  if(feed==='chat'){
   const latest=await db.chatMessage.findMany({
    orderBy:[{createdAt:'desc'},{id:'desc'}],take:50,
    select:{id:true,body:true,createdAt:true,user:{select:{id:true,username:true,xp:true}}}
   });
   return NextResponse.json({messages:latest.reverse().map(m=>({
    id:m.id,username:m.user.username,xp:m.user.xp,
    isAdmin:process.env.ADMIN_USER_ID===m.user.id,body:m.body,createdAt:m.createdAt
   }))},{headers:noStore});
  }
  if(feed==='wallet'){
   const user=await socialViewer(req,db);
   if(!user)return fail('Zum Senden anmelden',401);
   const transfers=await db.giftTransfer.findMany({where:{senderId:user.id},
    include:{recipient:{select:{username:true}}},orderBy:{createdAt:'desc'},take:5});
   const nextAt=nextGiftAt(user.giftLastSentAt);
   return NextResponse.json({
    username:user.username,balance:user.coins,
    nextAt:nextAt?.toISOString()??null,
    transfers:transfers.map(x=>({id:x.id,recipient:x.recipient.username,amount:x.amount,createdAt:x.createdAt}))
   },{headers:noStore});
  }
  return fail('Unbekannter Bereich',404);
 }catch(e){console.error('social GET:',e);return fail('Community momentan nicht erreichbar',503)}
}

export async function POST(req:NextRequest){
 const origin=req.headers.get('origin');
 const host=req.headers.get('x-forwarded-host')??req.headers.get('host');
 if(origin&&host){
  try{if(new URL(origin).host!==host)return fail('Ungültige Anfragequelle',403)}
  catch{return fail('Ungültige Anfragequelle',403)}
 }
 const user=await socialViewer(req,db);
 if(!user)return fail('Bitte anmelden',401);
 if(await maintenanceBlocked(user.id))return fail('Wartungsmodus aktiv',503);
 try{
  const b=await req.json() as Record<string,unknown>;
  if(!b||Array.isArray(b)||typeof b!=='object')return fail('Ungültige Anfrage');
  if(b.action==='chat'){
   const body=typeof b.message==='string'?b.message.trim().replace(/[\x00-\x1f\x7f]/g,' '):'';
   if(!body||body.length>280)return fail('Bitte eine Nachricht mit 1–280 Zeichen eingeben');
   const message=await db.$transaction(async tx=>{
    const cutoff=new Date(Date.now()-CHAT_COOLDOWN_MS);
    const updated=await tx.user.updateMany({
     where:{id:user.id,OR:[{chatLastSentAt:null},{chatLastSentAt:{lt:cutoff}}]},
     data:{chatLastSentAt:new Date()}
    });
    if(!updated.count)throw Error('CHAT_COOLDOWN');
    return tx.chatMessage.create({data:{userId:user.id,body},
     select:{id:true,body:true,createdAt:true}});
   },{isolationLevel:'Serializable'});
   return NextResponse.json({message:{...message,username:user.username}},{headers:noStore});
  }
  if(b.action==='gift'){
   const recipient=typeof b.recipient==='string'?b.recipient.trim():'';
   const amount=b.amountCents;
   if(!/^[a-zA-Z0-9_]{3,24}$/.test(recipient))return fail('Gültigen Benutzernamen eingeben');
   if(!validateGiftCents(amount))return fail('Betrag muss zwischen 0,01 € und 2.000 € liegen');
   if(recipient.toLowerCase()===user.username.toLowerCase())return fail('Du kannst nicht an dich selbst senden');
   const receiver=await db.user.findUnique({where:{username:recipient},select:{id:true,username:true}});
   if(!receiver)return fail('Empfänger nicht gefunden',404);
   const cooldown=nextGiftAt(user.giftLastSentAt);
   if(cooldown&&cooldown.getTime()>Date.now())
    return fail('Du kannst nur einmal alle 24 Stunden Geld senden',429,cooldown.toISOString());

   // Atomic sender debit + cooldown claim + recipient credit + audited transfer.
   // Serializable makes concurrent requests retry or fail rather than minting virtual funds.
   const transfer=await db.$transaction(async tx=>{
    const eligible=await tx.user.updateMany({
     where:{id:user.id,coins:{gte:amount as number},
      OR:[{giftLastSentAt:null},{giftLastSentAt:{lte:new Date(Date.now()-GIFT_COOLDOWN_MS)}}]},
     data:{coins:{decrement:amount as number},giftLastSentAt:new Date()}
    });
    if(eligible.count!==1)throw Error('GIFT_UNAVAILABLE');
    await tx.user.update({where:{id:receiver.id},data:{coins:{increment:amount as number}}});
    const row=await tx.giftTransfer.create({
     data:{senderId:user.id,recipientId:receiver.id,amount:amount as number}
    });
    const sender=await tx.user.findUniqueOrThrow({where:{id:user.id}});
    return {id:row.id,recipient:receiver.username,amount:row.amount,
     balance:sender.coins,nextAt:nextGiftAt(sender.giftLastSentAt)?.toISOString()};
   },{isolationLevel:'Serializable'});
   return NextResponse.json({transfer},{headers:noStore});
  }
  return fail('Unbekannte Aktion',404);
 }catch(e){
  const code=typeof e==='object'&&e!==null&&'code' in e?String(e.code):'';
  if(code==='P2034')return fail('Gleichzeitige Anfrage – bitte erneut versuchen',409);
  if(e instanceof Error&&e.message==='CHAT_COOLDOWN')return fail('Bitte 3 Sekunden zwischen Nachrichten warten',429);
  if(e instanceof Error&&e.message==='GIFT_UNAVAILABLE'){
   const current=await db.user.findUnique({where:{id:user.id},select:{giftLastSentAt:true,coins:true}});
   const nextAt=nextGiftAt(current?.giftLastSentAt);
   if(nextAt&&nextAt.getTime()>Date.now())return fail('Nächste Überweisung erst nach 24 Stunden',429,nextAt.toISOString());
   return fail('Nicht genügend Guthaben',400);
  }
  console.error('social POST:',e);
  return fail('Aktion konnte nicht abgeschlossen werden',500);
 }
}
