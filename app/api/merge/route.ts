import {NextRequest,NextResponse} from 'next/server';
import {randomInt} from 'node:crypto';
import {db} from '@/lib/db';
import {socialViewer} from '@/lib/social';
import {getLiveEvent} from '@/lib/events';
import {recordWatchedActivity,inspectWatchedUser} from '@/lib/watchlist';

export const dynamic='force-dynamic';
const tiers=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'] as const;
const bad=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});

export async function POST(req:NextRequest){
 const user=await socialViewer(req,db);
 if(!user)return bad('Bitte anmelden',401);
 const origin=req.headers.get('origin'),host=req.headers.get('x-forwarded-host')??req.headers.get('host');
 if(origin&&host){
  try{if(new URL(origin).host!==host)return bad('Ungültiger Ursprung',403)}
  catch{return bad('Ungültiger Ursprung',403)}
 }
 try{
  const body=await req.json() as Record<string,unknown>;
  if(body.action!=='mergeAll')return bad('Verwende Alle Duplikate mergen im Inventar',400);
  const merged=await db.$transaction(async tx=>{
   const all=await tx.inventoryItem.findMany({
    where:{ownerId:user.id,soldAt:null,tradeLockId:null,isDemo:false},
    include:{item:true},orderBy:[{itemId:'asc'},{createdAt:'asc'},{id:'asc'}]
   });
   const groups=new Map<string,typeof all>();
   for(const row of all){
    const list=groups.get(row.itemId)||[];
    list.push(row);
    groups.set(row.itemId,list);
   }
   const duplicates=[...groups.values()].filter(rows=>rows.length>=2);
   if(!duplicates.length)throw Error('Keine Duplikate zum Mergen vorhanden');
   const event=await getLiveEvent(tx);
   // 10% baseline, boosted by server-side global Luck (up to 50%).
   const boost=event?event.luckMultiplier/100:1;
   const chancePercent=Math.min(50,10*boost);
   const results=[];
   for(const rows of duplicates){
    const keeper=rows[0];
    const consumed=rows.slice(1);
    const value=rows.reduce((n,r)=>n+(r.valueAtDrop??r.item.value),0);
    const count=rows.reduce((n,r)=>n+r.mergedCount,0);
    if(!Number.isSafeInteger(value)||value<0||value>2147483647||count>2147483647)
     throw Error('Merge-Limit überschritten');
    // Preserve the best existing upgrade and never turn ordinary skins into knives.
    const index=Math.max(...rows.map(r=>tiers.indexOf((r.mergedRarity??r.item.rarity) as typeof tiers[number])));
    const upgraded=index>=0&&index<tiers.length-1&&randomInt(10000)<Math.round(chancePercent*100);
    const rarity=index>=0?tiers[Math.min(tiers.length-1,index+(upgraded?1:0))]:keeper.item.rarity;
    const claimed=await tx.inventoryItem.updateMany({
     where:{id:{in:rows.map(r=>r.id)},ownerId:user.id,soldAt:null,tradeLockId:null},
     data:{tradeLockId:'BULK-MERGE-'+keeper.id}
    });
    if(claimed.count!==rows.length)throw Error('Inventar wurde gleichzeitig verändert');
    await tx.inventoryItem.update({
     where:{id:keeper.id},
     data:{valueAtDrop:value,mergedCount:count,mergedRarity:rarity,tradeLockId:null}
    });
    await tx.inventoryItem.updateMany({
     where:{id:{in:consumed.map(r=>r.id)},ownerId:user.id,tradeLockId:'BULK-MERGE-'+keeper.id},
     data:{soldAt:new Date(),tradeLockId:null}
    });
    results.push({inventoryId:keeper.id,name:keeper.item.name,consumed:consumed.length,mergedCount:count,rarity,upgraded,chancePercent,value});
   }
   return results;
  },{isolationLevel:'Serializable',timeout:20000});
  await recordWatchedActivity(user.id,'MERGE_ALL',{groups:merged.length,consumed:merged.reduce((n,x)=>n+x.consumed,0),upgrades:merged.filter(x=>x.upgraded).length});
  await inspectWatchedUser(user.id);
  return NextResponse.json({ok:true,results:merged},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  if(typeof e==='object'&&e!==null&&'code' in e&&e.code==='P2034')return bad('Inventar hat sich geändert. Bitte erneut versuchen',409);
  const message=e instanceof Error?e.message:'';
  return bad(['Keine Duplikate zum Mergen vorhanden','Merge-Limit überschritten','Inventar wurde gleichzeitig verändert'].includes(message)?message:'Mergen fehlgeschlagen');
 }
}
