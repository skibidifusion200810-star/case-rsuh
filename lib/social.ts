import {NextRequest} from 'next/server';
import {createHash} from 'node:crypto';
import type {PrismaClient} from '@prisma/client';
export const GIFT_COOLDOWN_MS=24*60*60*1000;
export const MAX_GIFT_CENTS=200000; // €2000 virtual currency, never real money.
export const CHAT_COOLDOWN_MS=3000;
export const RARE_MIN_CENTS=100000; // €1000+ only
export function qualifiesForGlobalDrop(item:{rarity:string;value:number;name:string}){
 return item.value>=RARE_MIN_CENTS&&(
  item.rarity==='KNIFE' || item.rarity==='LEGENDARY' || item.name.includes('Dragon Lore'));
}
export async function socialViewer(req:NextRequest,db:PrismaClient){
 const token=req.cookies.get('cr_session')?.value;
 if(!token)return null;
 const tokenHash=createHash('sha256').update(token).digest('hex');
 const session=await db.session.findUnique({where:{tokenHash},include:{user:true}});
 return session&&session.expiresAt>new Date()&&!(session.user.isBanned&&(!session.user.bannedUntil||session.user.bannedUntil>new Date()))?session.user:null;
}
export function nextGiftAt(last:Date|null|undefined){
 return last?new Date(last.getTime()+GIFT_COOLDOWN_MS):null;
}
export function validateGiftCents(value:unknown):value is number{
 return typeof value==='number'&&Number.isSafeInteger(value)&&value>=1&&value<=MAX_GIFT_CENTS;
}
