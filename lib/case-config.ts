/**
 * CASE RUSH virtual case economy. Case prices are in integer euro cents.
 * Drop weights are server authoritative; valuations require an exact-wear price source.
 */
export type Rarity='COMMON'|'UNCOMMON'|'RARE'|'EPIC'|'LEGENDARY'|'KNIFE';
export type PoolEntry={name:string;rarity:Rarity;weight:number};
export type CaseDefinition={slug:string;name:string;price:number;image:string;items:readonly PoolEntry[]};
const COMMON='COMMON',BLUE='UNCOMMON',RARE='RARE',EPIC='EPIC',RED='LEGENDARY',KNIFE='KNIFE' as const;
const pool=(entries:Array<[string,Rarity,number]>):PoolEntry[]=>
 entries.map(([name,rarity,weight])=>({name,rarity,weight}));
export const caseDefs:readonly CaseDefinition[]=[
 {slug:'first-drop',name:'First Drop',price:0,image:'Kilowatt Case',items:pool([
  ['P250 | Sand Dune',COMMON,478999],
  ['MP9 | Sand Dashed',COMMON,340000],
  ['SCAR-20 | Sand Mesh',COMMON,160000],
  ['MP7 | Army Recon',COMMON,19500],
  ['Tec-9 | Re-Entry',BLUE,1000],
  ['AK-47 | Neon Rider',RARE,400],
  ['AWP | Asiimov',EPIC,100],
  ['Karambit | Doppler',KNIFE,1]
 ])},
 {slug:'urban-supply',name:'Urban Supply',price:100,image:'Recoil Case',items:pool([
  ['P250 | Sand Dune',COMMON,2300],
  ['MP9 | Sand Dashed',COMMON,3200],
  ['SCAR-20 | Sand Mesh',COMMON,2700],
  ['MP7 | Army Recon',COMMON,250],
  ['Tec-9 | Re-Entry',BLUE,1500],
  ['Glock-18 | Water Elemental',RARE,45],
  ['AWP | Asiimov',EPIC,5]
 ])},
 {slug:'neon-circuit',name:'Neon Circuit',price:500,image:'Revolution Case',items:pool([
  ['Tec-9 | Re-Entry',BLUE,7000],
  ['P250 | Franklin',EPIC,1200],
  ['USP-S | Cortex',RARE,1000],
  ['Glock-18 | Water Elemental',RARE,400],
  ['AK-47 | Redline',RARE,200],
  ['AWP | Asiimov',EPIC,180],
  ['M4A1-S | Printstream',RED,20]
 ])},
 {slug:'crimson-strike',name:'Crimson Strike',price:2000,image:'Fracture Case',items:pool([
  ['Tec-9 | Re-Entry',BLUE,7200],
  ['Galil AR | Black Sand',BLUE,1000],
  ['USP-S | Cortex',RARE,800],
  ['AK-47 | Redline',RARE,500],
  ['M4A1-S | Hyper Beast',RARE,300],
  ['AWP | Asiimov',EPIC,150],
  ['M4A1-S | Printstream',RED,40],
  ['Desert Eagle | Blaze',RED,10]
 ])},
 {slug:'arctic-phantom',name:'Arctic Phantom',price:7500,image:'Prisma 2 Case',items:pool([
  ['Tec-9 | Re-Entry',BLUE,6500],
  ['P250 | Franklin',EPIC,700],
  ['USP-S | Cortex',RARE,1300],
  ['AK-47 | Redline',RARE,600],
  ['AWP | Asiimov',EPIC,500],
  ['M4A1-S | Printstream',RED,270],
  ['AWP | Containment Breach',EPIC,100],
  ['Desert Eagle | Blaze',RED,30]
 ])},
 {slug:'royal-arsenal',name:'Royal Arsenal',price:25000,image:'Clutch Case',items:pool([
  ['USP-S | Cortex',RARE,1500],
  ['Glock-18 | Water Elemental',RARE,1600],
  ['AK-47 | Redline',RARE,1400],
  ['AWP | Asiimov',EPIC,2000],
  ['M4A1-S | Printstream',RED,1700],
  ['AK-47 | Vulcan',EPIC,1000],
  ['Desert Eagle | Blaze',RED,700],
  ['AWP | Containment Breach',EPIC,100]
 ])},
 {slug:'golden-edge',name:'Golden Edge',price:50000,image:'Spectrum 2 Case',items:pool([
  ['Glock-18 | Water Elemental',RARE,1100],
  ['AK-47 | Redline',RARE,800],
  ['AWP | Asiimov',EPIC,2100],
  ['M4A1-S | Printstream',RED,2000],
  ['AWP | Containment Breach',EPIC,1300],
  ['AK-47 | Vulcan',EPIC,1450],
  ['Desert Eagle | Blaze',RED,1000],
  ['Karambit | Doppler',KNIFE,150],
  ['Butterfly Knife | Tiger Tooth',KNIFE,100]
 ])},
 {slug:'butterfly-vault',name:'Butterfly Vault',price:100000,image:'Gamma 2 Case',items:pool([
  ['AK-47 | Redline',RARE,1000],
  ['M4A1-S | Hyper Beast',RARE,800],
  ['AWP | Asiimov',EPIC,2100],
  ['AK-47 | Vulcan',EPIC,2000],
  ['AWP | Containment Breach',EPIC,1400],
  ['Desert Eagle | Blaze',RED,1400],
  ['M4A1-S | Printstream',RED,700],
  ['Butterfly Knife | Tiger Tooth',KNIFE,450],
  ['Butterfly Knife | Fade',KNIFE,150]
 ])},
 {slug:'karambit-eclipse',name:'Karambit Eclipse',price:200000,image:'Dreams & Nightmares Case',items:pool([
  ['M4A1-S | Hyper Beast',RARE,350],
  ['AK-47 | Neon Rider',RARE,250],
  ['AK-47 | Vulcan',EPIC,3300],
  ['AWP | Containment Breach',EPIC,2200],
  ['Desert Eagle | Blaze',RED,1800],
  ['M4A1-S | Printstream',RED,800],
  ['Karambit | Doppler',KNIFE,1000],
  ['Karambit | Fade',KNIFE,250],
  ['AWP | Dragon Lore',RED,50]
 ])}
] as const;
export const caseBySlug=new Map(caseDefs.map(c=>[c.slug,c]));
export function dropChances(items:readonly {weight:number}[]){
 const total=items.reduce((sum,item)=>sum+item.weight,0);
 return total<=0?[]:items.map(item=>item.weight/total);
}
