import { PrismaClient } from '@prisma/client';
import {loadCsMoneyQuotes} from '../lib/csmoney-prices';
import {caseDefs} from '../lib/case-config';
import {referenceQuoteFor} from '../lib/market-reference';

const db = new PrismaClient();
const BASE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';
const PRICE_URL = 'https://raw.githubusercontent.com/ByMykel/counter-strike-price-tracker/main/static/latest.json';
// Reference rate of Oct 30, 2026: 1 USD ≈ 0.8961 EUR.
// The amount becomes a virtual in-game redemption value, NOT a cash market quote.
const USD_TO_EUR_REFERENCE = 0.8961;
type FeedSkin = {name:string; image?:string; wears?:{name:string}[]};
type FeedCrate = {name:string; image?:string};
type PriceData = {metadata?:{updated_at?:string;currency?:string};prices?:Record<string,number>};
async function json<T>(url:string):Promise<T>{
 const res=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{'user-agent':'CASE-RUSH-BYMYKEL-IMPORT'}});
 if(!res.ok) throw new Error('External item feed '+res.status+': '+url);
 return await res.json() as T;
}
const label=(n:string)=>n.replace(/^★\s*/, '').trim();
function matchedPrice(prices:Record<string,number>,name:string,wears?:{name:string}[]){
 const preferred=['Factory New','Minimal Wear','Field-Tested','Well-Worn','Battle-Scarred'];
 const available=new Set((wears??[]).map(w=>w.name));
 for(const wear of preferred){
  if(available.size && !available.has(wear))continue;
  const variants=[name+' ('+wear+')','★ '+label(name)+' ('+wear+')',label(name)+' ('+wear+')'];
  for(const key of variants){
   const value=prices[key];
   if(Number.isFinite(value)&&value>0)return {marketHashName:key,value:Math.round(value*USD_TO_EUR_REFERENCE)};
  }
 }
 return null;
}
async function main(){
 const strict=process.env.REQUIRE_CSMONEY_QUOTES==='true';
 const [skins,crates,pricesFeed,csQuotes]=await Promise.all([
  json<FeedSkin[]>(BASE+'/skins.json'),
  json<FeedCrate[]>(BASE+'/crates.json'),
  json<PriceData>(PRICE_URL).catch(error=>{console.warn('No snapshot:',error);return {prices:{}} as PriceData}),
  loadCsMoneyQuotes()
 ]);
 // Retroactively allow selling previous free-case rewards; keep their stored values.
 await db.inventoryItem.updateMany({where:{isDemo:true},data:{isDemo:false}});
 const skinsByName=new Map(skins.map(x=>[label(x.name),x]));
 const cratesByName=new Map(crates.map(x=>[x.name,x]));
 const prices=pricesFeed.prices??{};
 if(!skins.length||!crates.length)throw new Error('CS2 data empty');
 await db.$executeRawUnsafe('UPDATE "InventoryItem" AS inv SET "valueAtDrop"=item.value FROM "Item" AS item WHERE inv."itemId"=item.id AND inv."valueAtDrop" IS NULL');
 const checked=new Map<string,Promise<boolean>>();
 async function validImage(url?:string):Promise<boolean>{
  if(!url||!/^https:\/\/(raw\.githubusercontent\.com|community\.akamai\.steamstatic\.com)\//.test(url))return false;
  if(!checked.has(url))checked.set(url,(async()=>{
   try{const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(12000)});
    return r.ok&&!!r.headers.get('content-type')?.startsWith('image/');
   }catch{return false}
  })());
  return checked.get(url)!;
 }
 let verified=0,missing=0,csmoney=0,legacy=0;
 for(const def of caseDefs){
  const ref=cratesByName.get(def.image);
  const caseImg=await validImage(ref?.image)?ref?.image:null;
  if(!caseImg)console.warn('[CASE IMAGE MISSING]',def.name);
  const c=await db.case.upsert({
   where:{slug:def.slug},
   update:{name:def.name,price:def.price,imageUrl:caseImg},
   create:{slug:def.slug,name:def.name,price:def.price,imageUrl:caseImg}
  });
  // Retain historic drops' values, but stop including placeholder item entries in new draws.
  await db.item.updateMany({where:{caseId:c.id},data:{weight:0}});
  const pool=def.items;
  let imported=0;
  for(const item of pool){
   const skin=skinsByName.get(label(item.name));
   if(!skin){console.warn('No ByMykel item:',item.name);missing++;continue}
   const reference=referenceQuoteFor(item.name);
   const bestWear=reference?.wear??(['Factory New','Minimal Wear','Field-Tested','Well-Worn','Battle-Scarred']
     .find(w=>skin.wears?.some(x=>x.name===w))??'Field-Tested');
   const exactHash=skin.name+' ('+bestWear+')';
   const quote=csQuotes.get(exactHash);
   const imageUrl=await validImage(skin.image)?skin.image:
     await validImage(quote?.imageUrl)?quote?.imageUrl:undefined;
   if(!imageUrl){console.warn('[SKIN IMAGE MISSING]',exactHash);missing++;continue}
   const price=matchedPrice(prices,skin.name,skin.wears);
   const fullName=exactHash;
   // Never substitute an arbitrary case-price percentage or one cent for a missing quote.
   const legacyValue=!strict&&price?.marketHashName===exactHash?price.value:0;
   const value=quote?.eurCents??reference?.eurCents??legacyValue;
   const source=quote?'CSMONEY_TRADE':reference?'CSMONEY_MARKET_REFERENCE':
     legacyValue?'BYMYKEL_USD_SNAPSHOT':'UNVERIFIED';
   if(value<1||(strict&&!quote)||(def.price>100&&value<=2)||(item.name==='AWP | Dragon Lore'&&value<200000)){
    console.warn('[PRICE UNVERIFIED] not eligible for drops:',exactHash);
    continue;
   }
   // Restore image previews on legacy inventory entries without rewriting their saved values.
   await db.item.updateMany({
    where:{caseId:c.id,weight:0,
      OR:[{name:label(item.name)+' (CR Edition)'},{name:label(item.name)+' (Virtual)'}]},
    data:{imageUrl}
   });
   const existing=await db.item.findFirst({where:{caseId:c.id,name:fullName}});
   if(existing){
    // Never rewrite item values held in inventories; purchase/award amounts stay fixed.
    await db.item.update({where:{id:existing.id},data:{
     imageUrl,weight:item.weight,rarity:item.rarity,value,priceOrigin:source,marketHashName:exactHash,
     priceCheckedAt:quote?.checkedAt??(reference?new Date(reference.observedAt):pricesFeed.metadata?.updated_at?new Date(pricesFeed.metadata.updated_at):null)
    }});
   }else{
    await db.item.create({data:{
     caseId:c.id,name:fullName,rarity:item.rarity,weight:item.weight,
     imageUrl,
     value,
     priceOrigin:source,
     marketHashName:exactHash,
     priceCheckedAt:quote?.checkedAt??(reference?new Date(reference.observedAt):pricesFeed.metadata?.updated_at?new Date(pricesFeed.metadata.updated_at):null)
    }});
   }
   imported++;verified++;
   if(quote||reference)csmoney++;else legacy++;
  }
  if(imported===0)console.warn('No verified-price skins for '+def.slug+'; opening disabled until pricing is available');
  if(imported<pool.length)console.warn('[CASE INVENTORY]',def.name,'configured',pool.length,'available',imported);
  console.log('Seeded:',def.name,'with',imported,'image-backed items');
 }
 console.log('CS2 price/image audit:',{verified,missing,csmoney,legacy,strict,byMykelSnapshotAt:pricesFeed.metadata?.updated_at??'unknown'});
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
