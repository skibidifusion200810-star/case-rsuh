import { PrismaClient } from '@prisma/client';

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
 const preferred=['Field-Tested','Factory New','Minimal Wear','Well-Worn','Battle-Scarred'];
 const available=new Set((wears??[]).map(w=>w.name));
 for(const wear of preferred){
  if(available.size && !available.has(wear))continue;
  const variants=[name+' ('+wear+')','★ '+label(name)+' ('+wear+')',label(name)+' ('+wear+')'];
  for(const key of variants){
   const value=prices[key];
   if(Number.isFinite(value)&&value>0)return {marketHashName:key,value:Math.max(1,Math.round(value*USD_TO_EUR_REFERENCE))};
  }
 }
 return null;
}
async function main(){
 const [skins,crates,pricesFeed]=await Promise.all([
  json<FeedSkin[]>(BASE+'/skins.json'),
  json<FeedCrate[]>(BASE+'/crates.json'),
  json<PriceData>(PRICE_URL).catch(error=>{console.warn('No fresh price snapshot; keeping existing valuations:',error);return {prices:{}} as PriceData})
 ]);
 const skinsByName=new Map(skins.map(x=>[label(x.name),x]));
 const cratesByName=new Map(crates.map(x=>[x.name,x]));
 const prices=pricesFeed.prices??{};
 if(!skins.length||!crates.length)throw new Error('CS2 data empty');
 for(const def of caseDefs){
  const ref=cratesByName.get(def.image);
  const c=await db.case.upsert({
   where:{slug:def.slug},
   update:{name:def.name,price:def.price,imageUrl:ref?.image??undefined},
   create:{slug:def.slug,name:def.name,price:def.price,imageUrl:ref?.image??null}
  });
  // Retain historic drops' values, but stop including placeholder item entries in new draws.
  await db.item.updateMany({where:{caseId:c.id,priceOrigin:'GAME'},data:{weight:0}});
  const pool=itemPool.filter(i=>
   def.price<5000 ? (i.rarity!=='KNIFE'||def.price>=2500) :
   i.rarity!=='KNIFE'||i.name.startsWith(def.slug==='butterfly-vault'?'Butterfly Knife':'Karambit')
  );
  let imported=0;
  for(const item of pool){
   const skin=skinsByName.get(label(item.name));
   if(!skin?.image){console.warn('No ByMykel image:',item.name);continue}
   const price=matchedPrice(prices,skin.name,skin.wears);
   const fullName=price?.marketHashName??(label(item.name)+' (Virtual)');
   const existing=await db.item.findFirst({where:{caseId:c.id,name:fullName}});
   if(existing){
    // Never rewrite item values held in inventories; purchase/award amounts stay fixed.
    await db.item.update({where:{id:existing.id},data:{imageUrl:skin.image,weight:item.base}});
   }else{
    await db.item.create({data:{
     caseId:c.id,name:fullName,rarity:item.rarity,weight:item.base,
     imageUrl:skin.image,
     value:price?.value??Math.max(1,Math.round(def.price*0.15)),
     priceOrigin:price?'MARKET_SNAPSHOT':'GAME',
     marketHashName:price?.marketHashName??null
    }});
   }
   imported++;
  }
  if(imported===0)throw new Error('No image-backed skins for '+def.slug);
  console.log('Seeded:',def.name,'with',imported,'image-backed items');
 }
 console.log('CS2 source ByMykel/CSGO-API, USD snapshot updated:',pricesFeed.metadata?.updated_at??'unavailable');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
