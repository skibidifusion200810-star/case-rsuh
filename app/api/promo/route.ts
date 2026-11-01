import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {maintenanceBlocked} from '@/lib/maintenance';
import {socialViewer} from '@/lib/social';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 const user=await socialViewer(req,db);if(!user)return NextResponse.json({error:'Bitte anmelden'},{status:401});
 if(await maintenanceBlocked(user.id))return NextResponse.json({error:'Wartungsmodus aktiv'},{status:503});
 const origin=req.headers.get('origin'),host=req.headers.get('x-forwarded-host')||req.headers.get('host');
 if(!origin||!host)return NextResponse.json({error:'Ungültige Anfragequelle'},{status:403});
 try{if(new URL(origin).host!==host)return NextResponse.json({error:'Ungültige Anfragequelle'},{status:403})}catch{return NextResponse.json({error:'Ungültige Anfragequelle'},{status:403})}
 try{
  const body=await req.json() as {code?:string};
  const code=String(body.code||'').trim().toUpperCase();
  if(!/^[A-Z0-9_-]{4,32}$/.test(code))return NextResponse.json({error:'Ungültiger Code'},{status:400});
  const reward=await db.$transaction(async tx=>{
   const promo=await tx.adminPromo.findUnique({where:{code}});
   if(!promo||promo.uses>=promo.maxUses||(promo.expiresAt&&promo.expiresAt<=new Date()))throw Error('Code nicht verfügbar');
   if(await tx.adminPromoRedemption.findFirst({where:{userId:user.id,promoId:promo.id}}))throw Error('Bereits eingelöst');
   const claimed=await tx.adminPromo.updateMany({where:{id:promo.id,uses:{lt:promo.maxUses}},data:{uses:{increment:1}}});
   if(claimed.count!==1)throw Error('Code aufgebraucht');
   await tx.adminPromoRedemption.create({data:{promoId:promo.id,userId:user.id}});
   if(promo.coinAmount){
    const wallet=await tx.user.findUniqueOrThrow({where:{id:user.id},select:{coins:true}});
    if(wallet.coins>2147483647-promo.coinAmount)throw Error('Guthabenlimit erreicht');
    await tx.user.update({where:{id:user.id},data:{coins:{increment:promo.coinAmount}}});
   }
   if(promo.itemId){
    const item=await tx.item.findUnique({where:{id:promo.itemId},select:{id:true,value:true}});
    if(!item)throw Error('Prämie nicht verfügbar');
    await tx.inventoryItem.create({data:{ownerId:user.id,itemId:item.id,valueAtDrop:item.value}});
   }
   return {coins:promo.coinAmount,item:!!promo.itemId};
  },{isolationLevel:'Serializable'});
  return NextResponse.json({ok:true,reward});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Code fehlgeschlagen'},{status:400})}
}
