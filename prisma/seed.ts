import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const cases = [
['first-drop','First Drop',0],['urban-supply','Urban Supply',100],['neon-circuit','Neon Circuit',250],
['crimson-strike','Crimson Strike',500],['arctic-phantom','Arctic Phantom',800],
['royal-arsenal','Royal Arsenal',1500],['golden-edge','Golden Edge',2500],
['butterfly-vault','Butterfly Vault',5000],['karambit-eclipse','Karambit Eclipse',7500]
] as const;
const names=['Glock-18 | Water Elemental','USP-S | Cortex','AK-47 | Redline','M4A1-S | Printstream','AWP | Asiimov','Desert Eagle | Blaze','Butterfly Knife | Fade'];
const rarities=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY','LEGENDARY','KNIFE'];
const weights=[4600,3000,1700,500,150,45,5];
async function main(){
 for (const [slug,name,price] of cases) {
  const c=await db.case.upsert({where:{slug},update:{name,price},create:{slug,name,price}});
  for(let i=0;i<names.length;i++){
   const n=names[i];const exists=await db.item.findFirst({where:{caseId:c.id,name:n}});
   if(!exists)await db.item.create({data:{caseId:c.id,name:n,rarity:rarities[i],weight:weights[i],value:Math.round(Math.max(20,price*([.2,.45,.8,1.5,3,5,20][i])))}});
  }
 }
}
main().finally(()=>db.$disconnect());
