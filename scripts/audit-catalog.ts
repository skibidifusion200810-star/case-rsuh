import {PrismaClient} from '@prisma/client';
const db=new PrismaClient();
async function main(){
 const cases=await db.case.findMany({include:{items:true},orderBy:{price:'asc'}});
 let total=0; let invalid=0; let csmoney=0; let legacy=0;
 for(const c of cases){
  const active=c.items.filter(x=>x.weight>0);
  console.log('\nCASE',c.name, '| IMAGE',c.imageUrl?'provided':'MISSING', '| ACTIVE',active.length);
  if(!c.imageUrl){invalid++;console.error('Missing case image',c.name)}
  if(!active.length)console.warn('NO ELIGIBLE ITEMS',c.name);
  for(const item of active){
   total++;
   if(item.priceOrigin==='CSMONEY_TRADE')csmoney++;
   else legacy++;
   const ok=!!item.imageUrl&&item.value>1&&!!item.marketHashName;
   if(!ok)invalid++;
   console.log(ok?'PASS':'FAIL',item.marketHashName??item.name,
    (item.value/100).toFixed(2)+' EUR',item.priceOrigin,
    item.imageUrl?'IMAGE':'NO IMAGE');
  }
 }
 console.log('\nAUDIT SUMMARY',JSON.stringify({cases:cases.length,activeItems:total,csMoneyTrade:csmoney,olderSnapshots:legacy,invalid}));
 if(invalid>0||total===0)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
