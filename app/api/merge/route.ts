import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {db} from '@/lib/db';
import {socialViewer} from '@/lib/social';

export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 const user=await socialViewer(req,db);
 if(!user)return NextResponse.json({error:'Bitte anmelden'},{status:401});
 const origin=req.headers.get('origin'),host=req.headers.get('x-forwarded-host')??req.headers.get('host');
 if(origin&&host){try{if(new URL(origin).host!==host)return NextResponse.json({error:'Ungültige Quelle'},{status:403})}catch{return NextResponse.json({error:'Ungültige Quelle'},{status:403})}}
 try{
  const b=await req.json() as Record<string,unknown>;
  const ids=b.inventoryIds;
  if(!Array.isArray(ids)||ids.length<2||ids.length>10||
   !ids.every(x=>typeof x==='string'&&/^[a-f0-9-]{16,64}$/i.test(x))||
   new Set(ids).size!==ids.length)return NextResponse.json({error:'Bitte 2–10 gleiche, ungesperrte Waffen wählen'},{status:400});
  const inventoryIds=ids as string[];
  const result=await db.$transaction(async tx=>{
   const items=await tx.inventoryItem.findMany({
    where:{id:{in:inventoryIds},ownerId:user.id,soldAt:null,tradeLockId:null},include:{item:true}
   });
   if(items.length!==inventoryIds.length)throw Error('Items nicht mehr verfügbar');
   const same=items[0].itemId;
   const variant=items[0].item.marketHashName??items[0].item.name;
   if(items.some(i=>i.itemId!==same||((i.item.marketHashName??i.item.name)!==variant)))
    throw Error('Nur exakt identische Waffen und Zustände lassen sich mergen');
   const total=items.reduce((sum,x)=>sum+(x.valueAtDrop??x.item.value),0);
   const mergedCount=items.reduce((sum,x)=>sum+x.mergedCount,0);
   if(!Number.isSafeInteger(total)||total<1||mergedCount>100000)throw Error('Ungültiger Merge-Wert');
   const claimId='MERGE-'+randomUUID();
   const claimed=await tx.inventoryItem.updateMany({
    where:{id:{in:inventoryIds},ownerId:user.id,soldAt:null,tradeLockId:null},
    data:{tradeLockId:claimId}
   });
   if(claimed.count!==inventoryIds.length)throw Error('Items wurden bereits benutzt');
   const keeper=items.find(x=>x.id===inventoryIds[0])!;
   const consumed=inventoryIds.slice(1);
   await tx.inventoryItem.update({where:{id:keeper.id},
    data:{valueAtDrop:total,mergedCount,tradeLockId:null}});
   await tx.inventoryItem.updateMany({where:{id:{in:consumed},ownerId:user.id,tradeLockId:claimId},
    data:{soldAt:new Date(),tradeLockId:null}});
   return {inventoryId:keeper.id,name:keeper.item.name,mergedCount,value:total,consumed:consumed.length};
  },{isolationLevel:'Serializable'});
  return NextResponse.json({merged:result});
 }catch(e){
  if(typeof e==='object'&&e!==null&&'code' in e&&e.code==='P2034')
   return NextResponse.json({error:'Gleichzeitige Änderung, bitte erneut versuchen'},{status:409});
  const acceptable=['Items nicht mehr verfügbar','Nur exakt identische Waffen und Zustände lassen sich mergen','Ungültiger Merge-Wert','Items wurden bereits benutzt'];
  return NextResponse.json({error:e instanceof Error&&acceptable.includes(e.message)?e.message:'Merge fehlgeschlagen'},{status:400});
 }
}
