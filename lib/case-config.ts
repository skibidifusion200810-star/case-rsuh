/**
 * CASE RUSH virtual case economy.
 * All prices are integer euro-cents; each case has a distinct drop table.
 * Weights are server-authoritative; animation slot counts never affect probabilities.
 * Item values come from separately verified catalog data, NOT from these weights.
 */
export type PoolEntry={name:string;rarity:'COMMON'|'UNCOMMON'|'RARE'|'EPIC'|'LEGENDARY'|'KNIFE';weight:number};
export type CaseDefinition={slug:string;name:string;price:number;image:string;items:readonly PoolEntry[]};
const COMMON='COMMON',BLUE='UNCOMMON',RARE='RARE',EPIC='EPIC',RED='LEGENDARY',KNIFE='KNIFE' as const;
const pool=(items:Array<[string,PoolEntry['rarity'],number]>):PoolEntry[]=>
  items.map(([name,rarity,weight])=>({name,rarity,weight}));
export const caseDefs:readonly CaseDefinition[]=[
 {slug:'first-drop',name:'First Drop',price:0,image:'Kilowatt Case',items:pool([
  ['USP-S | Cortex',COMMON,479999],
  ['MAC-10 | Disco Tech',COMMON,340000],
  ['Five-SeveN | Monkey Business',COMMON,130000],
  ['Glock-18 | Water Elemental',BLUE,30000],
  ['P90 | Asiimov',BLUE,19500],
  ['AK-47 | Neon Rider',RARE,400],
  ['AWP | Asiimov',EPIC,100],
  ['Karambit | Doppler',KNIFE,1]
 ])},
 {slug:'urban-supply',name:'Urban Supply',price:100,image:'Recoil Case',items:pool([
  ['USP-S | Cortex',COMMON,3900],
  ['MAC-10 | Disco Tech',COMMON,3500],
  ['Five-SeveN | Monkey Business',COMMON,1500],
  ['Glock-18 | Water Elemental',BLUE,750],
  ['AK-47 | Redline',BLUE,300],
  ['AK-47 | Neon Rider',RARE,45],
  ['AWP | Asiimov',EPIC,5]
 ])},
 {slug:'neon-circuit',name:'Neon Circuit',price:500,image:'Revolution Case',items:pool([
  ['MAC-10 | Disco Tech',COMMON,2700],
  ['Glock-18 | Water Elemental',BLUE,3100],
  ['P90 | Asiimov',BLUE,2200],
  ['AK-47 | Neon Rider',RARE,1400],
  ['M4A1-S | Hyper Beast',RARE,480],
  ['USP-S | Printstream',RED,100],
  ['AWP | Containment Breach',EPIC,20]
 ])},
 {slug:'crimson-strike',name:'Crimson Strike',price:2000,image:'Fracture Case',items:pool([
  ['AK-47 | Redline',BLUE,3500],
  ['USP-S | Cortex',COMMON,1500],
  ['AK-47 | Neon Rider',RARE,2800],
  ['AWP | Asiimov',EPIC,1100],
  ['M4A1-S | Printstream',RED,600],
  ['Desert Eagle | Blaze',RED,350],
  ['AK-47 | Vulcan',EPIC,150]
 ])},
 {slug:'arctic-phantom',name:'Arctic Phantom',price:7500,image:'Prisma 2 Case',items:pool([
  ['Glock-18 | Water Elemental',BLUE,2500],
  ['M4A1-S | Hyper Beast',RARE,3000],
  ['AWP | Asiimov',EPIC,2100],
  ['USP-S | Printstream',RED,1300],
  ['M4A1-S | Printstream',RED,700],
  ['AWP | Containment Breach',EPIC,350],
  ['AWP | Dragon Lore',RED,50]
 ])},
 {slug:'royal-arsenal',name:'Royal Arsenal',price:25000,image:'Clutch Case',items:pool([
  ['AK-47 | Neon Rider',RARE,2600],
  ['M4A1-S | Hyper Beast',RARE,2000],
  ['AWP | Asiimov',EPIC,2400],
  ['M4A1-S | Printstream',RED,1500],
  ['AK-47 | Vulcan',EPIC,900],
  ['Desert Eagle | Blaze',RED,530],
  ['AWP | Dragon Lore',RED,70]
 ])},
 {slug:'golden-edge',name:'Golden Edge',price:50000,image:'Spectrum 2 Case',items:pool([
  ['M4A1-S | Hyper Beast',RARE,2300],
  ['AWP | Asiimov',EPIC,1700],
  ['AK-47 | Vulcan',EPIC,2250],
  ['AWP | Containment Breach',EPIC,1800],
  ['Desert Eagle | Blaze',RED,1000],
  ['M4A1-S | Printstream',RED,800],
  ['Karambit | Doppler',KNIFE,80],
  ['Butterfly Knife | Tiger Tooth',KNIFE,55],
  ['AWP | Dragon Lore',RED,15]
 ])},
 {slug:'butterfly-vault',name:'Butterfly Vault',price:100000,image:'Gamma 2 Case',items:pool([
  ['AK-47 | Neon Rider',RARE,1400],
  ['AWP | Asiimov',EPIC,2700],
  ['AK-47 | Vulcan',EPIC,2400],
  ['AWP | Containment Breach',EPIC,1400],
  ['Desert Eagle | Blaze',RED,1550],
  ['M4A1-S | Printstream',RED,250],
  ['Butterfly Knife | Tiger Tooth',KNIFE,180],
  ['Butterfly Knife | Fade',KNIFE,115],
  ['AWP | Dragon Lore',RED,5]
 ])},
 {slug:'karambit-eclipse',name:'Karambit Eclipse',price:200000,image:'Dreams & Nightmares Case',items:pool([
  ['M4A1-S | Hyper Beast',RARE,600],
  ['AK-47 | Neon Rider',RARE,500],
  ['AK-47 | Vulcan',EPIC,3000],
  ['AWP | Containment Breach',EPIC,2500],
  ['Desert Eagle | Blaze',RED,1500],
  ['M4A1-S | Printstream',RED,900],
  ['Karambit | Doppler',KNIFE,750],
  ['Karambit | Fade',KNIFE,220],
  ['AWP | Dragon Lore',RED,30]
 ])}
] as const;
export const caseBySlug = new Map(caseDefs.map(c=>[c.slug,c]));
export function dropChances(items:readonly {weight:number}[]){
 const total=items.reduce((sum,item)=>sum+item.weight,0);
 if(total<=0)return [];
 return items.map(item=>item.weight/total);
}
