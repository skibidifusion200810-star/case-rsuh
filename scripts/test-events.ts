import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {NextRequest} from 'next/server';
import {PrismaClient} from '@prisma/client';
import {GET as adminGET,POST as adminPOST} from '../app/api/admin/route';
import {GET as gameGET,POST as gamePOST} from '../app/api/game/route';
import {GET as battleGET,POST as battlePOST} from '../app/api/battles/route';
import {POST as duoPOST} from '../app/api/duo-battles/route';
import {getLiveEvent,eventPrice,eventWeight} from '../lib/events';
const db=new PrismaClient();
const root='http://localhost:3000';
async function post(fn:(r:NextRequest)=>Promise<Response>,path:string,b:Record<string,unknown>,token?:string){
 const response=await fn(new NextRequest(root+path,{method:'POST',headers:{
  'content-type':'application/json',origin:root,host:'localhost:3000',
  ...(token?{cookie:'cr_session='+token}:{})
 },body:JSON.stringify(b)}));
 return {status:response.status,json:await response.json(),
  cookie:response.headers.get('set-cookie')?.match(/cr_session=([^;]+)/)?.[1]};
}
async function get(fn:(r:NextRequest)=>Promise<Response>,path:string,token?:string){
 const response=await fn(new NextRequest(root+path,{headers:token?{cookie:'cr_session='+token}:{}}));
 return {status:response.status,json:await response.json()};
}
async function register(){
 const username='event_test_'+randomBytes(5).toString('hex');
 const r=await post(gamePOST,'/api/game',{action:'register',
  username,password:'Secure_Test_Password_9819'});
 assert.equal(r.status,200);
 assert.ok(r.cookie);
 return {id:r.json.user.id as string,cookie:r.cookie!};
}
async function main(){
 const initialAdmin=process.env.ADMIN_USER_ID;
 const owner=await register();
 const player=await register();
 try{
  const initial=await db.gameEvent.findUnique({where:{id:'GLOBAL'}});
  if(initial&&initial.endsAt>new Date())throw Error('Test requires no live event');
  await db.gameEvent.deleteMany({where:{id:'GLOBAL'}});
  const c=await db.case.findUniqueOrThrow({where:{slug:'neon-circuit'},include:{items:true}});
  const ordinary=c.items.find(x=>x.weight>0&&x.rarity==='UNCOMMON')!;
  const rare=c.items.find(x=>x.weight>0&&x.rarity==='EPIC')!;
  assert.ok(ordinary&&rare);
  assert.equal(eventPrice(7500,null),7500);
  assert.equal(eventWeight(rare,c.price,null),rare.weight);
  process.env.ADMIN_USER_ID=owner.id;
  const denied=await post(adminPOST,'/api/admin',{
   action:'startEvent',discountPercent:50,luckMultiplier:200,durationMinutes:10
  },player.cookie);
  assert.equal(denied.status,403,'Non-admin cannot start events');
  const invalid=await post(adminPOST,'/api/admin',{
   action:'startEvent',discountPercent:99,luckMultiplier:900,durationMinutes:10
  },owner.cookie);
  assert.equal(invalid.status,400,'Invalid discount and luck rejected');
  const noEffect=await post(adminPOST,'/api/admin',{
   action:'startEvent',discountPercent:0,luckMultiplier:100,durationMinutes:10
  },owner.cookie);
  assert.equal(noEffect.status,400,'Empty event rejected');
  const start=await post(adminPOST,'/api/admin',{
   action:'startEvent',discountPercent:50,luckMultiplier:200,durationMinutes:10
  },owner.cookie);
  assert.equal(start.status,200,'Admin can start custom discount and luck event');
  assert.equal(start.json.event.discountPercent,50);
  assert.equal(start.json.event.luckMultiplier,200);
  const expiry=new Date(start.json.event.endsAt).getTime()-new Date(start.json.event.startsAt).getTime();
  assert.equal(expiry,600000,'Server expiry is exactly ten minutes');
  const second=await post(adminPOST,'/api/admin',{
   action:'startEvent',discountPercent:70,luckMultiplier:300,durationMinutes:60
  },owner.cookie);
  assert.equal(second.status,400,'Cannot accidentally overlap two events');
  const live=await getLiveEvent(db);
  assert.ok(live);
  assert.equal(eventPrice(7500,live),3750,'€75 case becomes €37.50');
  assert.equal(eventPrice(100,live),50);
  assert.equal(eventPrice(0,live),0,'Free remains free');
  assert.equal(eventWeight(ordinary,c.price,live),ordinary.weight,'Common low-value odds unchanged');
  assert.ok(eventWeight(rare,c.price,live)>rare.weight,'Rare weight boosted');
  const publicEvent=await get(gameGET,'/api/game?action=event');
  assert.equal(publicEvent.status,200);
  assert.equal(publicEvent.json.event.discountPercent,50);
  const catalog=await get(gameGET,'/api/game?action=cases');
  assert.equal(catalog.status,200);
  const discounted=catalog.json.cases.find((x:{slug:string})=>x.slug===c.slug);
  assert.equal(discounted.originalPrice,c.price);
  assert.equal(discounted.price,Math.ceil(c.price/2));
  const boosted=discounted.items.find((x:{id:string})=>x.id===rare.id);
  assert.equal(boosted.weight,eventWeight(rare,c.price,live));
  const before=(await db.user.findUniqueOrThrow({where:{id:player.id}})).coins;
  const opened=await post(gamePOST,'/api/game',{action:'open',caseId:c.id,count:1},player.cookie);
  assert.equal(opened.status,200,'Discounted paid opening succeeds');
  const after=(await db.user.findUniqueOrThrow({where:{id:player.id}})).coins;
  assert.equal(before-after,eventPrice(c.price,live),'Client cannot override the server-side paid price');
  const bot=await post(battlePOST,'/api/battles',{
   action:'create',caseIds:[c.id],againstBot:true
  },player.cookie);
  assert.equal(bot.status,200,'Bot battle uses active event');
  assert.equal(bot.json.battle.totalCost,eventPrice(c.price,live));
  assert.equal(bot.json.battle.rounds[0].casePrice,eventPrice(c.price,live));
  const duo=await post(duoPOST,'/api/duo-battles',{
   action:'create',caseIds:[c.id]
  },player.cookie);
  assert.equal(duo.status,200,'Duo battle uses active event');
  assert.equal(duo.json.battle.totalCost,eventPrice(c.price,live));
  const stop=await post(adminPOST,'/api/admin',{action:'stopEvent'},owner.cookie);
  assert.equal(stop.status,200);
  assert.equal(await getLiveEvent(db),null);
  assert.equal((await get(gameGET,'/api/game?action=event')).json.event,null);
  const afterStop=await get(gameGET,'/api/game?action=cases');
  assert.equal(afterStop.json.cases.find((x:{slug:string})=>x.slug===c.slug).price,c.price);
  assert.equal(afterStop.json.cases.find((x:{slug:string})=>x.slug===c.slug).items.find((x:{id:string})=>x.id===rare.id).weight,rare.weight);
  const stopAgain=await post(adminPOST,'/api/admin',{action:'stopEvent'},owner.cookie);
  assert.equal(stopAgain.status,400);
  // Simulated ten minute expiry (no timers or app process required).
  const next=await post(adminPOST,'/api/admin',{
   action:'startEvent',discountPercent:25,luckMultiplier:150,durationMinutes:1
  },owner.cookie);
  assert.equal(next.status,200);
  await db.gameEvent.update({where:{id:'GLOBAL'},data:{endsAt:new Date(Date.now()-1000)}});
  assert.equal(await getLiveEvent(db),null,'Expired event is automatically inactive');
  assert.equal((await get(gameGET,'/api/game?action=event')).json.event,null);
  const events=await get(adminGET,'/api/admin?view=events',owner.cookie);
  assert.equal(events.status,200);
  assert.ok(events.json.recent.some((a:{action:string})=>a.action==='START_EVENT'));
  assert.ok(events.json.recent.some((a:{action:string})=>a.action==='STOP_EVENT'));
  console.log('PASS protected timed events, 50% discounted opening/battles, 2x rare luck, expiry and audit');
 }finally{
  await db.gameEvent.deleteMany({where:{id:'GLOBAL'}});
  await db.adminAuditLog.deleteMany({where:{actorId:owner.id}});
  await db.session.deleteMany({where:{userId:{in:[owner.id,player.id]}}});
  // Keep test-created openings/inventory unrelated to later test data out of the DB.
  const battles=await db.battle.findMany({where:{creatorId:player.id},select:{id:true}});
  const battleIds=battles.map(b=>b.id);
  await db.rareDropEvent.deleteMany({where:{username:{startsWith:'event_test_'}}});
  await db.inventoryItem.deleteMany({where:{ownerId:player.id}});
  await db.opening.deleteMany({where:{userId:player.id}});
  await db.battle.deleteMany({where:{id:{in:battleIds}}});
  await db.user.deleteMany({where:{id:{in:[owner.id,player.id]}}});
  if(initialAdmin===undefined)delete process.env.ADMIN_USER_ID;else process.env.ADMIN_USER_ID=initialAdmin;
  await db.$disconnect();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
