/** Permanent, virtual CASE RUSH player progression.
 * Levels are derived from saved XP rather than mutable client state.
 */
export const MAX_LEVEL=100;
export const xpForLevel=(level:number):number=>{
 const n=Math.max(1,Math.min(MAX_LEVEL,Math.trunc(level)));
 return 80*(n-1)*n/2;
};
export function levelFromXp(xp:number){
 const total=Math.max(0,Math.floor(Number.isFinite(xp)?xp:0));
 let level=1;
 while(level<MAX_LEVEL&&total>=xpForLevel(level+1))level++;
 return level;
}
export function levelProgress(xp:number){
 const total=Math.max(0,Math.floor(Number.isFinite(xp)?xp:0));
 const level=levelFromXp(total);
 const floor=xpForLevel(level);
 const next=level<MAX_LEVEL?xpForLevel(level+1):floor;
 const span=next-floor;
 return {level,xp:total,currentXp:level===MAX_LEVEL?0:total-floor,
  requiredXp:span,percent:level===MAX_LEVEL?100:Math.min(100,Math.floor(100*(total-floor)/span)),
  xpToNext:level===MAX_LEVEL?0:next-total};
}
/** Each completed roll, including a lost PvP battle, grants XP.
 * Free rolls grant 5XP; paying more earns XP faster, with a per-roll cap.
 * Never use client-supplied values when awarding XP.
 */
export function xpForOpening(basePriceCents:number){
 if(!Number.isSafeInteger(basePriceCents)||basePriceCents<=0)return 5;
 return Math.min(1200,25+Math.floor(basePriceCents/20));
}
