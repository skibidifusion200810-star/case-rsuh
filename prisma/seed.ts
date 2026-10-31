import { PrismaClient } from '@prisma/client';
import {loadCsMoneyQuotes} from '../lib/csmoney-prices';

const db = new PrismaClient();
const BASE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';
const PRICE_URL = 'https://raw.githubusercontent.com/ByMykel/counter-strike-price-tracker/main/static/latest.json';
// Reference rate of Oct 30, 2026: 1 USD ≈ 0.8961 EUR.
// The amount becomes a virtual in-game redemption value, NOT a cash market quote.
const USD_TO_EUR_REFERENCE = 0.8961;
const caseDefs = [
  {slug:'first-drop', name:'First Drop', price:0, image:'Kilowatt Case'},
  {slug:'urban-supply', name:'Urban Supply', price:100, image:'Recoil Case'},
  {slug:'neon-circuit', name:'Neon Circuit', price:250, image:'Revolution Case'},
  {slug:'crimson-strike', name:'Crimson Strike', price:500, image:'Fracture Case'},
  {slug:'arctic-phantom', name:'Arctic Phantom', price:800, image:'Prisma 2 Case'},
  {slug:'royal-arsenal', name:'Royal Arsenal', price:1500, image:'Clutch Case'},
  {slug:'golden-edge', name:'Golden Edge', price:2500, image:'Spectrum 2 Case'},
  {slug:'butterfly-vault', name:'Butterfly Vault', price:5000, image:'Gamma 2 Case'},
  {slug:'karambit-eclipse', name:'Karambit Eclipse', price:7500, image:'Dreams & Nightmares Case'}
] as const;

const itemPool = [
 {name:'Glock-18 | Water Elemental', rarity:'UNCOMMON',base:2800},
 {name:'USP-S | Cortex',rarity:'COMMON',base:4300},
 {name:'AK-47 | Redline',rarity:'UNCOMMON',base:2000},
 {name:'M4A1-S | Printstream',rarity:'LEGENDARY',base:110},
 {name:'AWP | Asiimov',rarity:'EPIC',base:350},
 {name:'Desert Eagle | Blaze',rarity:'LEGENDARY',base:70},
 {name:'AK-47 | Neon Rider',rarity:'RARE',base:1000},
 {name:'M4A1-S | Hyper Beast',rarity:'RARE',base:1000},
 {name:'AK-47 | Vulcan',rarity:'EPIC',base:330},
 {name:'AWP | Containment Breach',rarity:'EPIC',base:310},
 {name:'P90 | Asiimov',rarity:'UNCOMMON',base:1900},
 {name:'MAC-10 | Disco Tech',rarity:'COMMON',base:2900},
 {name:'Five-SeveN | Monkey Business',rarity:'COMMON',base:2400},
 {name:'USP-S | Printstream',rarity:'LEGENDARY',base:120},
 {name:'AWP | Dragon Lore',rarity:'LEGENDARY',base:20},
 {name:'Butterfly Knife | Fade',rarity:'KNIFE',base:8},
 {name:'Karambit | Doppler',rarity:'KNIFE',base:6},
 {name:'Butterfly Knife | Tiger Tooth',rarity:'KNIFE',base:7},
 {name:'Karambit | Fade',rarity:'KNIFE',base:5}
] as const;

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
 const [skins,crates,pricesFeed,csQuotes]=await Promise.all([
  json<FeedSkin[]>(BASE+'/skins.json'),
  json<FeedCrate[]>(BASE+'/crates.json'),
  json<PriceData>(PRICE_URL).catch(error=>{console.warn('No snapshot:',error);return {prices:{}} as PriceData}),
  loadCsMoneyQuotes()
 ]);
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
  const pool=itemPool.filter(i=>
   def.price<5000 ? (i.rarity!=='KNIFE'||def.price>=2500) :
   i.rarity!=='KNIFE'||i.name.startsWith(def.slug==='butterfly-vault'?'Butterfly Knife':'Karambit')
  );
  let imported=0;
  for(const item of pool){
   const skin=skinsByName.get(label(item.name));
   if(!skin){console.warn('No ByMykel item:',item.name);missing++;continue}
   const bestWear=['Factory New','Minimal Wear','Field-Tested','Well-Worn','Battle-Scarred']
     .find(w=>skin.wears?.some(x=>x.name===w))??'Field-Tested';
   const exactHash=skin.name+' ('+bestWear+')';
   const quote=csQuotes.get(exactHash);
   const imageUrl=await validImage(skin.image)?skin.image:
     await validImage(quote?.imageUrl)?quote?.imageUrl:undefined;
   if(!imageUrl){console.warn('[SKIN IMAGE MISSING]',exactHash);missing++;continue}
   const price=matchedPrice(prices,skin.name,skin.wears);
   const fullName=exactHash;
   // Never substitute an arbitrary case-price percentage or one cent for a missing quote.
   const legacyValue=price?.marketHashName===exactHash?price.value:0;
   const value=quote?.eurCents??legacyValue;
   const source=quote?'CSMONEY_TRADE':legacyValue?'BYMYKEL_USD_SNAPSHOT':'UNVERIFIED';
   if(value<=1||(item.name==='AWP | Dragon Lore'&&!quote&&value<100000)){
    console.warn('[PRICE UNVERIFIED] not eligible for drops:',exactHash);
    continue;
   }
   const existing=await db.item.findFirst({where:{caseId:c.id,name:fullName}});
   if(existing){
    // Never rewrite item values held in inventories; purchase/award amounts stay fixed.
    await db.item.update({where:{id:existing.id},data:{
     imageUrl,weight:item.base,value,priceOrigin:source,marketHashName:exactHash,
     priceCheckedAt:quote?.checkedAt??null
    }});
   }else{
    await db.item.create({data:{
     caseId:c.id,name:fullName,rarity:item.rarity,weight:item.base,
     imageUrl,
     value,
     priceOrigin:source,
     marketHashName:exactHash,
     priceCheckedAt:quote?.checkedAt??null
    }});
   }
   imported++;verified++;
   if(quote)csmoney++;else legacy++;
  }
  if(imported===0)console.warn('No verified-price skins for '+def.slug+'; opening disabled until pricing is available');
  console.log('Seeded:',def.name,'with',imported,'image-backed items');
 }
 console.log('CS2 price/image audit:',{verified,missing,csmoney,legacy,byMykelSnapshotAt:pricesFeed.metadata?.updated_at??'unknown'});
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
