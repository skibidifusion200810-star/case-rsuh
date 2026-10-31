import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {NextRequest} from 'next/server';
import {PrismaClient} from '@prisma/client';
import {GET as gameGet,POST as gamePost} from '../app/api/game/route';
import {GET as socialGet,POST as socialPost} from '../app/api/social/route';
import {GET as boardGet} from '../app/api/leaderboard/route';
import {POST as battlePost} from '../app/api/battles/route';
import {POST as duoPost} from '../app/api/duo-battles/route';
import {levelFromXp,levelProgress,xpForOpening,xpForLevel} from '../lib/levels';

const db=new PrismaClient();
const url='http://localhost:3000';
async function post(fn:(r:NextRequest)=>Promise<Response>,path:string,b:Record<string,unknown>,token?:string){
 const r=await fn(new NextRequest(url+path,{method:'POST',headers:{
  'content-type':'application/json',origin:url,host:'localhost:3000',
  ...(token?{cookie:'cr_session='+token}:{})
 },body:JSON.stringify(b)}));
 return {status:r.status,data:await r.json(),
  cookie:r.headers.get('set-cookie')?.match(/cr_session=([^;]+)/)?.[1]};
}
async function get(fn:(r:NextRequest)=>Promise<Response>,path:string,token?:string){
 const r=await fn(new NextRequest(url+path,{headers:token?{cookie:'cr_session='+token}:{}}));
 return {status:r.status,data:await r.json()};
}
async function register(){
 const username='level_'+randomBytes(5).toString('hex');
 const result=await post(gamePost,'/api/game',{action:'register',username,password:'StrongLevelPassword_778899'});
 assert.equal(result.status,200);assert.ok(result.cookie);
 return {id:result.data.user.id as string,username,cookie:result.cookie!};
}
async function main(){
 assert.equal(xpForLevel(1),0);
 assert.equal(xpForLevel(2),80);
 assert.equal(xpForLevel(3),240);
 assert.equal(levelFromXp(0),1);
 assert.equal(levelFromXp(79),1);
 assert.equal(levelFromXp(80),2);
 assert.equal(levelFromXp(239),2);
 assert.equal(levelFromXp(240),3);
 assert.equal(levelProgress(80).percent,0);
 assert.equal(levelProgress(159).xpToNext,81);
 assert.equal(levelFromXp(xpForLevel(100)),100);
 assert.equal(levelProgress(xpForLevel(100)).percent,100);
 assert.equal(xpForOpening(0),5);
 assert.ok(xpForOpening(200000)>xpForOpening(100));
 assert.equal(xpForOpening(200000),1200);

 const originalAdmin=process.env.ADMIN_USER_ID;
 const admin=await register(),other=await register();
 try{
  process.env.ADMIN_USER_ID=admin.id;
  const adminMe=await get(gameGet,'/api/game?action=me',admin.cookie);
  assert.equal(adminMe.status,200);
  assert.equal(adminMe.data.user.isAdmin,true,'Owner sees verified red ADMIN badge flag');
  assert.equal(adminMe.data.user.level,1);
  assert.equal(adminMe.data.user.xp,0);
  assert.equal(adminMe.data.user.percent,0);
  const otherMe=await get(gameGet,'/api/game?action=me',other.cookie);
  assert.equal(otherMe.data.user.isAdmin,false,'Normal users never receive admin badge');
  const free=await db.case.findUniqueOrThrow({where:{slug:'first-drop'}});
  const paid=await db.case.findUniqueOrThrow({where:{slug:'urban-supply'}});
  const openedFree=await post(gamePost,'/api/game',{action:'open',caseId:free.id},admin.cookie);
  assert.equal(openedFree.status,200);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:admin.id}})).xp,5);
  const spam=await post(gamePost,'/api/game',{action:'open',caseId:free.id},admin.cookie);
  assert.equal(spam.status,400);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:admin.id}})).xp,5,'Rejected openings grant no XP');
  const openedPaid=await post(gamePost,'/api/game',{action:'open',caseId:paid.id},admin.cookie);
  assert.equal(openedPaid.status,200);
  let expectedXp=5+xpForOpening(paid.price);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:admin.id}})).xp,expectedXp);
  const bot=await post(battlePost,'/api/battles',{action:'create',caseIds:[paid.id],againstBot:true},admin.cookie);
  assert.equal(bot.status,200);
  expectedXp+=xpForOpening(paid.price);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:admin.id}})).xp,expectedXp,
   'Playing against a bot earns XP whether won or lost');
  const lobby=await post(battlePost,'/api/battles',{action:'create',caseIds:[paid.id],againstBot:false},admin.cookie);
  assert.equal(lobby.status,200);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:admin.id}})).xp,expectedXp,
   'Pending battles have not completed openings');
  const joined=await post(battlePost,'/api/battles',{action:'join',battleId:lobby.data.battle.id},other.cookie);
  assert.equal(joined.status,200);
  expectedXp+=xpForOpening(paid.price);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:admin.id}})).xp,expectedXp);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:other.id}})).xp,xpForOpening(paid.price));

  const duo=await post(duoPost,'/api/duo-battles',{action:'create',caseIds:[paid.id,paid.id]},admin.cookie);
  assert.equal(duo.status,200);
  assert.equal((await post(duoPost,'/api/duo-battles',{
   action:'addBot',battleId:duo.data.battle.id,seat:'guestId'
  },admin.cookie)).status,200);
  assert.equal((await post(duoPost,'/api/duo-battles',{
   action:'addBot',battleId:duo.data.battle.id,seat:'guestPartnerId'
  },admin.cookie)).status,200);
  const full=await post(duoPost,'/api/duo-battles',{
   action:'join',battleId:duo.data.battle.id,seat:'creatorPartnerId'
  },other.cookie);
  assert.equal(full.status,200);
  expectedXp+=xpForOpening(paid.price)*2;
  assert.equal((await db.user.findUniqueOrThrow({where:{id:admin.id}})).xp,expectedXp);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:other.id}})).xp,
   xpForOpening(paid.price)*3,'Second real teammate receives XP and bots do not earn any');
  const refreshed=await get(gameGet,'/api/game?action=me',admin.cookie);
  assert.equal(refreshed.data.user.xp,expectedXp);
  assert.equal(refreshed.data.user.level,levelFromXp(expectedXp));
  assert.equal(refreshed.data.user.percent,levelProgress(expectedXp).percent);

  const chat=await post(socialPost,'/api/social',{action:'chat',message:'Level-Test vom Admin'},admin.cookie);
  assert.equal(chat.status,200);
  const feed=await get(socialGet,'/api/social?feed=chat');
  const row=feed.data.messages.find((m:{id:string})=>m.id===chat.data.message.id);
  assert.equal(row.isAdmin,true);
  assert.equal(row.xp,expectedXp);
  const leaderboard=await get(boardGet,'/api/leaderboard');
  assert.equal(leaderboard.status,200);
  const entry=Object.values(leaderboard.data.rankings)
   .flatMap(x=>x as Array<{username:string;xp:number;isAdmin:boolean}>)
   .find(x=>x.username===admin.username);
  // Large public databases may omit an account from all top-20 categories.
  if(entry){assert.equal(entry.isAdmin,true);assert.equal(entry.xp,expectedXp)}
  console.log('PASS 100 levels, verified ADMIN badge, free/paid XP, 1v1, bot and 2v2 progression, chat identity');
 }finally{
  const users=[admin.id,other.id];
  await db.chatMessage.deleteMany({where:{userId:{in:users}}});
  const battles=await db.battle.findMany({where:{creatorId:admin.id},select:{id:true}});
  const ids=battles.map(x=>x.id);
  await db.inventoryItem.deleteMany({where:{ownerId:{in:users}}});
  await db.opening.deleteMany({where:{userId:{in:users}}});
  await db.battle.deleteMany({where:{id:{in:ids}}});
  await db.session.deleteMany({where:{userId:{in:users}}});
  await db.user.deleteMany({where:{id:{in:users}}});
  if(originalAdmin===undefined)delete process.env.ADMIN_USER_ID;
  else process.env.ADMIN_USER_ID=originalAdmin;
  await db.$disconnect();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
