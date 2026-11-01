import {db} from '@/lib/db';

/** Best-effort fraud heuristics; never block legitimate game activity. */
export async function inspectWatchedUser(userId:string){
 try {
  const entry=await db.watchlistEntry.findUnique({where:{userId}});
  if(!entry)return;
  const player=await db.user.findUnique({where:{id:userId},select:{username:true,coins:true}});
  if(!player)return;
  const now=new Date();
  const cutoff=new Date(now.getTime()-5*60_000);
  const [totalOpenings,rapidOpenings,rareDrops]=await Promise.all([
   db.opening.count({where:{userId}}),
   db.opening.count({where:{userId,boughtAt:{gte:cutoff}}}),
   db.inventoryItem.count({where:{ownerId:userId,createdAt:{gte:cutoff},item:{rarity:{in:['LEGENDARY','KNIFE']}}}})
  ]);
  const delta=entry.lastBalance===null?0:player.coins-entry.lastBalance;
  const signals:Array<{category:string;description:string;details:Record<string,number|null>}>=[];
  if(delta>=100_000)signals.push({category:'COIN_SPIKE',description:'Ungewöhnlicher Coin-Zuwachs bei '+player.username,details:{deltaCents:delta,balanceCents:player.coins}});
  if(rapidOpenings>=25&&totalOpenings>(entry.lastOpeningCount??0))signals.push({category:'RAPID_OPENINGS',description:rapidOpenings+' Kistenöffnungen in fünf Minuten bei '+player.username,details:{rapidOpenings}});
  if(rareDrops>=5&&totalOpenings>(entry.lastOpeningCount??0))signals.push({category:'RARE_DROP_CLUSTER',description:rareDrops+' hochwertige Drops in fünf Minuten bei '+player.username,details:{rareDrops}});
  await db.$transaction(async tx=>{
   for(const signal of signals){
    // Avoid repeating the same alert for every successive opening.
    const recent=await tx.watchAlert.findFirst({where:{userId,category:signal.category,createdAt:{gte:cutoff}},select:{id:true}});
    if(recent)continue;
    await tx.watchAlert.create({data:{userId,category:signal.category,description:signal.description,details:JSON.stringify(signal.details)}});
    await tx.adminAuditLog.create({data:{actorId:'SYSTEM',actorUsername:'WATCHDOG',action:'WATCH_ALERT',targetType:'USER',targetId:userId,details:JSON.stringify(signal)}});
   }
   await tx.watchlistEntry.updateMany({where:{userId},data:{lastBalance:player.coins,lastOpeningCount:totalOpenings,lastCheckedAt:now}});
  });
 }catch(error){console.error('Watchlist inspection:',error)}
}
