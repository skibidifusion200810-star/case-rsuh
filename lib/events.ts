import type {GameEvent,Item,Prisma,PrismaClient} from '@prisma/client';
/** Event values are server-controlled. 100 = 1x, 200 = 2x, etc. */
export const EVENT_ID='GLOBAL';
export const EVENT_DURATIONS=[1,5,10,15,30,60] as const;
export const EVENT_LUCK=[100,125,150,200,250,300,400,500] as const;
export const EVENT_DISCOUNTS=[0,10,20,25,30,40,50,60,70,75,80,90] as const;

export type LiveEvent=Pick<GameEvent,'id'|'discountPercent'|'luckMultiplier'|'startsAt'|'endsAt'>;
export async function getLiveEvent(
 db:Prisma.TransactionClient|PrismaClient,now=new Date()
):Promise<LiveEvent|null>{
 const event=await db.gameEvent.findUnique({where:{id:EVENT_ID}});
 return event&&event.startsAt<=now&&event.endsAt>now?event:null;
}
/** Always preserve free cases and charge at least one cent for paid ones. */
export function eventPrice(cents:number,event:LiveEvent|null){
 if(!event||cents===0)return cents;
 return Math.max(1,Math.ceil(cents*(100-event.discountPercent)/100));
}
export function isLuckTarget(item:Pick<Item,'rarity'|'value'>,baseCost:number){
 return ['RARE','EPIC','LEGENDARY','KNIFE'].includes(item.rarity)||
  (baseCost>0&&item.value>baseCost);
}
export function eventWeight(item:Pick<Item,'rarity'|'value'|'weight'>,baseCost:number,event:LiveEvent|null){
 if(item.weight<=0)return 0;
 if(!event||event.luckMultiplier===100||!isLuckTarget(item,baseCost))return item.weight;
 return Math.max(1,Math.round(item.weight*event.luckMultiplier/100));
}
export function eventPublic(event:LiveEvent|null){
 if(!event)return null;
 return {id:event.id,discountPercent:event.discountPercent,luckMultiplier:event.luckMultiplier,
  startsAt:event.startsAt.toISOString(),endsAt:event.endsAt.toISOString()};
}
