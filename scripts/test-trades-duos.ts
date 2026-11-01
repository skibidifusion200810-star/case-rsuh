import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {NextRequest} from 'next/server';
import {PrismaClient} from '@prisma/client';
import {POST as game} from '../app/api/game/route';
import {POST as merge} from '../app/api/merge/route';
import {POST as trades,GET as tradeList} from '../app/api/trades/route';
import {POST as duo} from '../app/api/duo-battles/route';
import {GET as battles} from '../app/api/battles/route';
const db=new PrismaClient();
const host='http://localhost:3000';
async function call(fn:(req:NextRequest)=>Promise<Response>,path:string,body:Record<string,unknown>,cookie?:string){
 const response=await fn(new NextRequest(host+path,{
  method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie:'cr_session='+cookie}:{})},
  body:JSON.stringify(body)
 }));
 return {status:response.status,data:await response.json(),
  cookie:response.headers.get('set-cookie')?.match(/cr_session=([^;]+)/)?.[1]};
}
async function get(fn:(req:NextRequest)=>Promise<Response>,path:string,cookie?:string){
 const response=await fn(new NextRequest(host+path,{headers:cookie?{'cookie':'cr_session='+cookie}:{}}));
 return {status:response.status,data:await response.json()};
}
async function register(){
 const username='economy_'+randomBytes(5).toString('hex');
 const account=await call(game,'/api/game',{action:'register',username,password:'VeryLong-TestPassword-883388'});
 assert.equal(account.status,200);
 assert.ok(account.cookie);
 await db.user.update({where:{username},data:{coins:1000000}});
 return {id:account.data.user.id as string,username,cookie:account.cookie!};
}
async function main(){
 const [a,b,c,d]=await Promise.all([register(),register(),register(),register()]);
 const testCase=await db.case.findUniqueOrThrow({where:{slug:'urban-supply'}});
 const first=await db.item.findFirstOrThrow({where:{caseId:testCase.id,weight:{gt:0}}});
 const second=await db.item.findFirstOrThrow({where:{caseId:testCase.id,id:{not:first.id}}});
 const create=(ownerId:string,itemId:string,value:number)=>
  db.inventoryItem.create({data:{ownerId,itemId,valueAtDrop:value}});
 const copies=await Promise.all([create(a.id,first.id,11),create(a.id,first.id,13)]);
 const stacked=await call(merge,'/api/merge',{action:'mergeAll'},a.cookie);
 assert.equal(stacked.status,200,'Two duplicate copies merge');
 assert.equal(stacked.data.results[0].value,24);
 assert.equal(stacked.data.results[0].mergedCount,2);
 const keeper=await db.inventoryItem.findUniqueOrThrow({where:{id:copies[0].id}});
 assert.equal(keeper.valueAtDrop,24);
 assert.equal(keeper.mergedCount,2);
 assert.ok((await db.inventoryItem.findUniqueOrThrow({where:{id:copies[1].id}})).soldAt);
 const mergeAgain=await call(merge,'/api/merge',{action:'mergeAll'},a.cookie);
 assert.equal(mergeAgain.status,400,'Consumed copies may not be merged again');
 const extra=await create(a.id,second.id,225);
 const desired=await create(b.id,first.id,300);
 const offer=await call(trades,'/api/trades',{
  action:'create',recipient:b.username,offered:[extra.id],requested:[desired.id]
 },a.cookie);
 assert.equal(offer.status,200,'Offer can be created');
 const locked=await db.inventoryItem.findUniqueOrThrow({where:{id:extra.id}});
 assert.equal(locked.tradeLockId,offer.data.offerId,'Offered inventory is locked');
 const forbiddenSale=await call(game,'/api/game',{action:'sell',inventoryId:extra.id},a.cookie);
 assert.equal(forbiddenSale.status,400,'Locked inventory cannot be sold');
 const accepted=await call(trades,'/api/trades',{action:'accept',offerId:offer.data.offerId},b.cookie);
 assert.equal(accepted.status,200,'Recipient can accept offer');
 assert.equal((await db.inventoryItem.findUniqueOrThrow({where:{id:extra.id}})).ownerId,b.id);
 assert.equal((await db.inventoryItem.findUniqueOrThrow({where:{id:desired.id}})).ownerId,a.id);
 assert.equal((await db.inventoryItem.findUniqueOrThrow({where:{id:extra.id}})).tradeLockId,null);
 const replay=await call(trades,'/api/trades',{action:'accept',offerId:offer.data.offerId},b.cookie);
 assert.equal(replay.status,400,'Offer cannot be accepted twice');
 const toCancel=await create(a.id,second.id,50);
 const cancelOffer=await call(trades,'/api/trades',{
  action:'create',recipient:b.username,offered:[toCancel.id],requested:[]
 },a.cookie);
 assert.equal(cancelOffer.status,200);
 const cancel=await call(trades,'/api/trades',{action:'cancel',offerId:cancelOffer.data.offerId},a.cookie);
 assert.equal(cancel.status,200);
 assert.equal((await db.inventoryItem.findUniqueOrThrow({where:{id:toCancel.id}})).tradeLockId,null,
  'Cancel releases the offered item');
 const list=await get(tradeList,'/api/trades?recipient='+b.username,a.cookie);
 assert.equal(list.status,200);
 assert.ok(list.data.offers.some((o:{id:string})=>o.id===offer.data.offerId));
 const illegalMerge=await call(merge,'/api/merge',{inventoryIds:[copies[0].id,toCancel.id]},a.cookie);
 assert.equal(illegalMerge.status,400,'Different item variants are not mergeable');

 const opening=await call(duo,'/api/duo-battles',{action:'create',caseIds:[testCase.id,testCase.id]},a.cookie);
 assert.equal(opening.status,200,'2v2 creator can reserve entry');
 const battleId=opening.data.battle.id as string;
 assert.equal(opening.data.battle.totalCost,testCase.price*2);
 const duplicateSeat=await call(duo,'/api/duo-battles',{
  action:'join',battleId,seat:'guestId'
 },a.cookie);
 assert.equal(duplicateSeat.status,400,'Creator cannot fill another team seat');
 const partner=await call(duo,'/api/duo-battles',{
  action:'join',battleId,seat:'creatorPartnerId'
 },b.cookie);
 assert.equal(partner.status,200);
 assert.equal(partner.data.battle.finished,false);
 const guest=await call(duo,'/api/duo-battles',{action:'join',battleId,seat:'guestId'},c.cookie);
 assert.equal(guest.status,200);
 const finished=await call(duo,'/api/duo-battles',{action:'join',battleId,seat:'guestPartnerId'},d.cookie);
 assert.equal(finished.status,200,'Fourth player triggers 2v2 resolution');
 assert.equal(finished.data.battle.finished,true);
 const state=await get(battles,'/api/battles?id='+battleId,a.cookie);
 assert.equal(state.status,200);
 assert.equal(state.data.battle.duo,true);
 assert.equal(state.data.battle.rounds.length,2);
 assert.equal(state.data.battle.awardedItemCount,8,'Both winners share eight items');
 const teamWon=state.data.battle.winner as string;
 const winners=teamWon==='creator'?[a.id,b.id]:[c.id,d.id];
 const losers=teamWon==='creator'?[c.id,d.id]:[a.id,b.id];
 for(const id of winners)assert.equal(await db.inventoryItem.count({where:{battleId,ownerId:id}}),4,'Each winner gets 2 items per round');
 for(const id of losers)assert.equal(await db.inventoryItem.count({where:{battleId,ownerId:id}}),0);
 const all=state.data.battle.rounds;
 assert.equal(all.reduce((n:number,r:{creatorDrop:{value:number},creatorPartnerDrop:{value:number}})=>
  n+r.creatorDrop.value+r.creatorPartnerDrop.value,0),state.data.battle.creatorTotal);
 assert.equal(all.reduce((n:number,r:{guestDrop:{value:number},guestPartnerDrop:{value:number}})=>
  n+r.guestDrop.value+r.guestPartnerDrop.value,0),state.data.battle.guestTotal);
 const replaySeat=await call(duo,'/api/duo-battles',{action:'join',battleId,seat:'guestPartnerId'},d.cookie);
 assert.equal(replaySeat.status,400,'Settled 2v2 battle cannot be joined again');
 const waiting=await call(duo,'/api/duo-battles',{action:'create',caseIds:[testCase.id]},a.cookie);
 assert.equal(waiting.status,200);
 const leave=await call(duo,'/api/duo-battles',{action:'join',
  battleId:waiting.data.battle.id,seat:'guestId'},b.cookie);
 assert.equal(leave.status,200);
 const beforeA=(await db.user.findUniqueOrThrow({where:{id:a.id}})).coins;
 const beforeB=(await db.user.findUniqueOrThrow({where:{id:b.id}})).coins;
 const withdrawn=await call(duo,'/api/duo-battles',{action:'cancel',battleId:waiting.data.battle.id},a.cookie);
 assert.equal(withdrawn.status,200,'Creator can cancel');
 assert.equal((await db.user.findUniqueOrThrow({where:{id:a.id}})).coins,beforeA+testCase.price);
 assert.equal((await db.user.findUniqueOrThrow({where:{id:b.id}})).coins,beforeB+testCase.price);

 // A real two-person team against two virtual bots: bots occupy seats, do not
 // create accounts, and can never withdraw virtual money or receive inventory.
 const balanceA=(await db.user.findUniqueOrThrow({where:{id:a.id}})).coins;
 const balanceB=(await db.user.findUniqueOrThrow({where:{id:b.id}})).coins;
 const duoWithBots=await call(duo,'/api/duo-battles',
  {action:'create',caseIds:[testCase.id,testCase.id]},a.cookie);
 assert.equal(duoWithBots.status,200,'Creator can create 2v2 lobby for bots');
 const botBattleId=duoWithBots.data.battle.id as string;
 const unauthorized=await call(duo,'/api/duo-battles',
  {action:'addBot',battleId:botBattleId,seat:'guestId'},c.cookie);
 assert.equal(unauthorized.status,400,'Only the lobby owner can add bots');
 const firstBot=await call(duo,'/api/duo-battles',
  {action:'addBot',battleId:botBattleId,seat:'guestId'},a.cookie);
 assert.equal(firstBot.status,200);
 assert.equal(firstBot.data.battle.finished,false);
 const taken=await call(duo,'/api/duo-battles',
  {action:'join',battleId:botBattleId,seat:'guestId'},c.cookie);
 assert.equal(taken.status,400,'A real player cannot steal the reserved bot seat');
 const botTwo=await call(duo,'/api/duo-battles',
  {action:'addBot',battleId:botBattleId,seat:'guestPartnerId'},a.cookie);
 assert.equal(botTwo.status,200,'Second bot fills the other opposing seat');
 assert.equal(botTwo.data.battle.finished,false,'Still waiting for the second real teammate');
 const removed=await call(duo,'/api/duo-battles',
  {action:'removeBot',battleId:botBattleId,seat:'guestPartnerId'},a.cookie);
 assert.equal(removed.status,200,'Owner can remove a bot before the battle starts');
 const putBack=await call(duo,'/api/duo-battles',
  {action:'addBot',battleId:botBattleId,seat:'guestPartnerId'},a.cookie);
 assert.equal(putBack.status,200,'Owner can refill a removed bot slot');
 assert.equal(putBack.data.battle.finished,false);
 const realTeammate=await call(duo,'/api/duo-battles',
  {action:'join',battleId:botBattleId,seat:'creatorPartnerId'},b.cookie);
 assert.equal(realTeammate.status,200,'Second real player starts 2v2 vs two bots');
 assert.equal(realTeammate.data.battle.finished,true);
 const botState=await get(battles,'/api/battles?id='+botBattleId,a.cookie);
 assert.equal(botState.status,200);
 assert.deepEqual(botState.data.battle.duoBotSeats,['guestId','guestPartnerId']);
 assert.equal(botState.data.battle.creatorPartner,b.username);
 assert.equal(botState.data.battle.guest,'RUSH BOT');
 assert.equal(botState.data.battle.guestPartner,'RUSH BOT');
 assert.equal(botState.data.battle.rounds.length,2);
 assert.ok(botState.data.battle.rounds.every((r:{
  creatorDrop:unknown,creatorPartnerDrop:unknown,guestDrop:unknown,guestPartnerDrop:unknown
 })=>r.creatorDrop&&r.creatorPartnerDrop&&r.guestDrop&&r.guestPartnerDrop),'All four reels have server drops');
 const humansWon=botState.data.battle.winner==='creator';
 assert.equal(await db.inventoryItem.count({where:{battleId:botBattleId}}),
  humansWon?8:0,'Bot team wins do not mint human inventory items');
 assert.equal(botState.data.battle.awardedItemCount,humansWon?8:0);
 for(const userId of [a.id,b.id])assert.equal(await db.inventoryItem.count({
  where:{ownerId:userId,battleId:botBattleId}
 }),humansWon?4:0,'Each human on winning team receives two items per case');
 assert.equal((await db.user.findUniqueOrThrow({where:{id:a.id}})).coins,
  balanceA-testCase.price*2,'Only human creator paid for the battle');
 assert.equal((await db.user.findUniqueOrThrow({where:{id:b.id}})).coins,
  balanceB-testCase.price*2,'Human teammate paid the same entry cost');
 // A single real creator can now complete a duo match with three bots.
 const triple=await call(duo,'/api/duo-battles',{action:'create',caseIds:[testCase.id]},a.cookie);
 assert.equal(triple.status,200);
 const tripleId=triple.data.battle.id as string;
 for(const seat of ['guestId','guestPartnerId']){
  const add=await call(duo,'/api/duo-battles',{action:'addBot',battleId:tripleId,seat},a.cookie);
  assert.equal(add.status,200);
  assert.equal(add.data.battle.finished,false);
 }
 const finalBot=await call(duo,'/api/duo-battles',{action:'addBot',battleId:tripleId,seat:'creatorPartnerId'},a.cookie);
 assert.equal(finalBot.status,200,'Third bot is allowed and finishes the duo');
 assert.equal(finalBot.data.battle.finished,true);
 const replayBots=await call(duo,'/api/duo-battles',
  {action:'addBot',battleId:botBattleId,seat:'creatorPartnerId'},a.cookie);
 assert.equal(replayBots.status,400,'Finished bot battle cannot be modified');

 // Refund only paying humans, not fake bot accounts.
 const refundable=await call(duo,'/api/duo-battles',
  {action:'create',caseIds:[testCase.id]},a.cookie);
 assert.equal(refundable.status,200);
 assert.equal((await call(duo,'/api/duo-battles',
  {action:'addBot',battleId:refundable.data.battle.id,seat:'guestId'},a.cookie)).status,200);
 assert.equal((await call(duo,'/api/duo-battles',
  {action:'cancel',battleId:refundable.data.battle.id},a.cookie)).status,200);
 assert.equal((await db.user.findUniqueOrThrow({where:{id:a.id}})).coins,
  balanceA-testCase.price*2,'Cancel refunded only the actual payer');

 console.log('PASS atomic trades, value-neutral merge, real 2v2 and 2 humans vs 2 bots, restricted bot seats and refunds');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
