import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {NextRequest} from 'next/server';
import {PrismaClient} from '@prisma/client';
import {POST as game} from '../app/api/game/route';
import {POST as battleAction,GET as battleList} from '../app/api/battles/route';

const db=new PrismaClient();
const base='http://localhost:3000';
async function request(action:(req:NextRequest)=>Promise<Response>,path:string,body:Record<string,unknown>,cookie?:string){
 const req=new NextRequest(base+path,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie:'cr_session='+cookie}:{})},
  body:JSON.stringify(body)});
 const res=await action(req);
 return {status:res.status,json:await res.json(),cookie:res.headers.get('set-cookie')?.match(/cr_session=([^;]+)/)?.[1]};
}
async function register(label:string){
 const username='bt_'+label+'_'+randomBytes(5).toString('hex');
 const r=await request(game,'/api/game',{action:'register',username,password:'StrongPassword_987654321'});
 assert.equal(r.status,200);
 assert.ok(r.cookie);
 await db.user.update({where:{username},data:{coins:1000000}});
 return {username,id:r.json.user.id,cookie:r.cookie!};
}
async function main(){
 const [owner,guest,third]=await Promise.all([register('owner'),register('guest'),register('third')]);
 const c=await db.case.findUniqueOrThrow({where:{slug:'urban-supply'}});
 const balance=1000000;
 const bot=await request(battleAction,'/api/battles',{action:'create',caseId:c.id,againstBot:true},owner.cookie);
 assert.equal(bot.status,200,'Bot battle must start');
 assert.equal(bot.json.battle.status,'FINISHED');
 assert.equal(bot.json.battle.againstBot,true);
 assert.ok(bot.json.battle.winner==='creator'||bot.json.battle.winner==='guest');
 assert.ok(bot.json.battle.creatorDrop);
 assert.ok(bot.json.battle.guestDrop);
 const ownerAfterBot=await db.user.findUniqueOrThrow({where:{id:owner.id}});
 assert.equal(ownerAfterBot.coins,balance-c.price,'Bot battle charges one case fee');
 const itemCount=await db.inventoryItem.count({where:{ownerId:owner.id}});
 assert.equal(itemCount,bot.json.battle.winner==='creator'?2:0,'Bot battle awards both drops only on human win');
 const botOpenings=await db.opening.count({where:{userId:owner.id}});
 assert.equal(botOpenings,1,'Bot opening counted only for human participant');

 const pending=await request(battleAction,'/api/battles',{action:'create',caseId:c.id,againstBot:false},owner.cookie);
 assert.equal(pending.status,200);
 assert.equal(pending.json.battle.status,'WAITING');
 const lobbyId=pending.json.battle.id as string;
 const joined=await request(battleAction,'/api/battles',{action:'join',battleId:lobbyId},guest.cookie);
 assert.equal(joined.status,200,'Second player joins');
 assert.equal(joined.json.battle.status,'FINISHED');
 assert.ok(joined.json.battle.winner==='creator'||joined.json.battle.winner==='guest');
 const duplicate=await request(battleAction,'/api/battles',{action:'join',battleId:lobbyId},third.cookie);
 assert.equal(duplicate.status,400,'Finished battle cannot be joined');
 const guestAfter=await db.user.findUniqueOrThrow({where:{id:guest.id}});
 assert.equal(guestAfter.coins,balance-c.price,'Guest charged exactly once');
 const wonId=joined.json.battle.winner==='creator'?owner.id:guest.id;
 assert.equal(joined.json.battle.awardedItemCount,2,'Response confirms two awarded items');
 assert.equal(await db.inventoryItem.count({where:{ownerId:wonId,battleId:lobbyId}}),2,'Winner receives exactly two linked inventory items');
 assert.equal(await db.inventoryItem.count({where:{ownerId:wonId}}),wonId===owner.id?itemCount+2:2,'Winner collects both cards');
 assert.equal(await db.opening.count({where:{userId:guest.id}}),1,'Guest opening counted');
 assert.equal(await db.opening.count({where:{userId:owner.id}}),2,'Creator opening counted');

 const canceled=await request(battleAction,'/api/battles',{action:'create',caseId:c.id,againstBot:false},third.cookie);
 assert.equal(canceled.status,200);
 const unauthCancel=await request(battleAction,'/api/battles',{action:'cancel',battleId:canceled.json.battle.id},guest.cookie);
 assert.equal(unauthCancel.status,400,'Non-creator cannot cancel');
 const cancel=await request(battleAction,'/api/battles',{action:'cancel',battleId:canceled.json.battle.id},third.cookie);
 assert.equal(cancel.status,200);
 assert.equal(cancel.json.battle.status,'CANCELED');
 assert.equal((await db.user.findUniqueOrThrow({where:{id:third.id}})).coins,balance,'Cancellation refunds entry');

 const upgrade=await request(game,'/api/game',{action:'upgrade',tier:2},owner.cookie);
 assert.equal(upgrade.status,200,'2x upgrade purchase');
 assert.equal(upgrade.json.user.openSlots,2);
 assert.equal(upgrade.json.user.coins,balance-2*c.price-10000);
 const upgradeDuplicate=await request(game,'/api/game',{action:'upgrade',tier:2},owner.cookie);
 assert.equal(upgradeDuplicate.status,400,'No second debit for already bought tier');
 const two=await request(game,'/api/game',{action:'open',caseId:c.id,count:2},owner.cookie);
 assert.equal(two.status,200,'2x opening must work with upgrade');
 assert.equal(two.json.results.length,2);
 const bulkSold=await request(game,'/api/game',
  {action:'sellBatch',inventoryIds:two.json.results.map((x:{inventoryId:string})=>x.inventoryId)},owner.cookie);
 assert.equal(bulkSold.status,200,'Atomic sell-all succeeds');
 assert.equal(bulkSold.json.count,2);
 const again=await request(game,'/api/game',
  {action:'sellBatch',inventoryIds:two.json.results.map((x:{inventoryId:string})=>x.inventoryId)},owner.cookie);
 assert.equal(again.status,400,'Bulk sell cannot double-credit items');
 assert.equal((await db.user.findUniqueOrThrow({where:{id:owner.id}})).coins,balance-4*c.price-10000+bulkSold.json.value);
 const unowned=await request(game,'/api/game',{action:'open',caseId:c.id,count:4},owner.cookie);
 assert.equal(unowned.status,400,'Count exceeding owned slots rejected');
 const finalTier=await request(game,'/api/game',{action:'upgrade',tier:10},owner.cookie);
 assert.equal(finalTier.status,200,'10x upgrade available directly');
 assert.equal(finalTier.json.user.openSlots,10);
 // Mixed-price case battle: creator and guest must each receive the configured
 // rounds, while only the winner receives both sides' rewards in inventory.
 const expensive=await db.case.findUniqueOrThrow({where:{slug:'karambit-eclipse'}});
 const mixed=await request(battleAction,'/api/battles',
  {action:'create',caseIds:[c.id,expensive.id],againstBot:false},third.cookie);
 assert.equal(mixed.status,200,'Mixed 1€+2000€ battle created');
 assert.equal(mixed.json.battle.totalCost,c.price+expensive.price,'Entry cost is the sum');
 assert.equal(mixed.json.battle.rounds.length,2,'Two distinct rounds persisted');
 assert.deepEqual(mixed.json.battle.rounds.map((r:{caseId:string})=>r.caseId),
  [c.id,expensive.id],'Mixed case order retained');
 const mixedJoined=await request(battleAction,'/api/battles',
  {action:'join',battleId:mixed.json.battle.id},guest.cookie);
 assert.equal(mixedJoined.status,200,'Guest joins mixed battle');
 assert.equal(mixedJoined.json.battle.status,'FINISHED');
 assert.equal(mixedJoined.json.battle.rounds.length,2);
 const mixedWinner=mixedJoined.json.battle.winner==='creator'?third.id:guest.id;
 assert.equal(mixedJoined.json.battle.awardedItemCount,4,'Four item awards confirmed');
 assert.equal(await db.inventoryItem.count({where:{
   ownerId:mixedWinner,battleId:mixed.json.battle.id
 }}),4,'Winner owns exactly four items linked to mixed battle');
 assert.equal(mixedJoined.json.battle.creatorTotal,
  mixedJoined.json.battle.rounds.reduce((a:number,r:{creatorDrop:{value:number}})=>a+r.creatorDrop.value,0));
 assert.equal(mixedJoined.json.battle.guestTotal,
  mixedJoined.json.battle.rounds.reduce((a:number,r:{guestDrop:{value:number}})=>a+r.guestDrop.value,0));

 const free=await db.case.findUniqueOrThrow({where:{slug:'first-drop'}});
 const freeBatch=await request(game,'/api/game',{action:'open',caseId:free.id,count:2},owner.cookie);
 assert.equal(freeBatch.status,400,'Free case cannot be opened in a batch');
 console.log('PASS real and bot battles, escrow, cancel, payouts, upgrades and multi-open');
 const sample=await battleList(new NextRequest(base+'/api/battles'));
 assert.equal(sample.status,200,'Public battle listing works');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
