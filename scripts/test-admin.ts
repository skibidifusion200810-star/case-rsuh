import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {NextRequest} from 'next/server';
import {PrismaClient} from '@prisma/client';
import {GET as adminGET,POST as adminPOST} from '../app/api/admin/route';
import {POST as gamePOST} from '../app/api/game/route';
import {GET as socialGET} from '../app/api/social/route';

const db=new PrismaClient();
const root='http://localhost:3000';
async function post(fn:(req:NextRequest)=>Promise<Response>,path:string,
 body:Record<string,unknown>,cookie?:string){
 const response=await fn(new NextRequest(root+path,{
  method:'POST',headers:{'content-type':'application/json',
   origin:root,'host':'localhost:3000',
   ...(cookie?{cookie:'cr_session='+cookie}:{})},
  body:JSON.stringify(body)
 }));
 return {status:response.status,
  json:await response.json(),
  cookie:response.headers.get('set-cookie')?.match(/cr_session=([^;]+)/)?.[1]};
}
async function get(fn:(req:NextRequest)=>Promise<Response>,path:string,cookie?:string){
 const response=await fn(new NextRequest(root+path,{
  headers:cookie?{cookie:'cr_session='+cookie}:{}
 }));
 return {status:response.status,json:await response.json()};
}
async function register(){
 const username='admin_test_'+randomBytes(5).toString('hex');
 const r=await post(gamePOST,'/api/game',{
  action:'register',username,password:'Secure_Test_Password_9819'
 });
 assert.equal(r.status,200);
 assert.ok(r.cookie);
 return {username,id:r.json.user.id as string,cookie:r.cookie!};
}
async function main(){
 const originalAdminId=process.env.ADMIN_USER_ID;
 const admin=await register();
 const player=await register();
 const noAuth=await get(adminGET,'/api/admin?view=users');
 assert.equal(noAuth.status,401,'Admin must require a logged-in account');
 process.env.ADMIN_USER_ID=''; // No secret configured = deny all.
 assert.equal((await get(adminGET,'/api/admin?view=users',admin.cookie)).status,403);
 process.env.ADMIN_USER_ID=admin.id;
 const stranger=await get(adminGET,'/api/admin?view=users',player.cookie);
 assert.equal(stranger.status,403,'Another authenticated player may not access admin resources');
 assert.equal(stranger.json.accountId,player.id,'Unauthorized player can learn only their own ID');
 assert.equal((await post(adminPOST,'/api/admin',{
  action:'grantCoins',userId:admin.id,amountCents:100000
 },player.cookie)).status,403,'Non-admin may not grant coins');
 const users=await get(adminGET,'/api/admin?view=users&q='+player.username,admin.cookie);
 assert.equal(users.status,200);
 assert.ok(users.json.users.some((x:{id:string})=>x.id===player.id));
 const initial=await db.user.findUniqueOrThrow({where:{id:player.id}});
 assert.equal(initial.coins,100000,'New players start with 1000 virtual EUR');
 const wrongAmount=await post(adminPOST,'/api/admin',{
  action:'grantCoins',userId:player.id,amountCents:-500
 },admin.cookie);
 assert.equal(wrongAmount.status,400);
 const first=await post(adminPOST,'/api/admin',{
  action:'grantCoins',userId:player.id,amountCents:2500
 },admin.cookie);
 assert.equal(first.status,200);
 assert.equal(first.json.user.coins,102500,'Admin adds €25 to existing €1000');
 const concurrent=await Promise.all([
  post(adminPOST,'/api/admin',{action:'grantCoins',userId:player.id,amountCents:1200},admin.cookie),
  post(adminPOST,'/api/admin',{action:'grantCoins',userId:player.id,amountCents:1300},admin.cookie)
 ]);
 assert.ok(concurrent.every(x=>x.status===200||x.status===409),
  'Concurrent credit transactions must succeed or request a retry');
 const actualAdded=concurrent.reduce((sum,r)=>sum+(r.status===200?
  r.json.user.coins? r.json.user.coins:0:0),0);
 assert.ok(actualAdded>=0);
 const expectedTotal=102500+concurrent.reduce((sum,r,i)=>sum+(r.status===200?(i===0?1200:1300):0),0);
 assert.equal((await db.user.findUniqueOrThrow({where:{id:player.id}})).coins,
  expectedTotal,'No lost update or money creation');
 const audits=await get(adminGET,'/api/admin?view=audit',admin.cookie);
 assert.equal(audits.status,200);
 assert.ok(audits.json.actions.some((x:{action:string,targetId:string,details:string})=>
  x.action==='GRANT_COINS'&&x.targetId===player.id&&x.details.includes('2500')));
 const ownBan=await post(adminPOST,'/api/admin',{action:'ban',userId:admin.id},admin.cookie);
 assert.equal(ownBan.status,400,'Admin cannot ban own account');
 const banned=await post(adminPOST,'/api/admin',{action:'ban',userId:player.id},admin.cookie);
 assert.equal(banned.status,200);
 assert.equal((await get(adminGET,'/api/admin?view=users',player.cookie)).status,401,
  'A blocked session is unauthenticated, not just unauthorized');
 assert.equal((await get(socialGET,'/api/social?feed=wallet',player.cookie)).status,401,
  'Banned players cannot use their existing sessions');
 assert.equal((await post(gamePOST,'/api/game',{
  action:'login',username:player.username,password:'Secure_Test_Password_9819'
 })).status,403,'Banned users cannot log back in');
 assert.equal((await post(adminPOST,'/api/admin',{action:'unban',userId:player.id},admin.cookie)).status,200);
 const again=await post(gamePOST,'/api/game',{
  action:'login',username:player.username,password:'Secure_Test_Password_9819'
 });
 assert.equal(again.status,200,'Unbanned user may login again');

 const message=await db.chatMessage.create({data:{userId:player.id,body:'A test message to moderate'}});
 assert.equal((await post(adminPOST,'/api/admin',{
  action:'deleteMessage',messageId:message.id
 },player.cookie)).status,403);
 assert.equal((await post(adminPOST,'/api/admin',{
  action:'deleteMessage',messageId:message.id
 },admin.cookie)).status,200);
 assert.equal(await db.chatMessage.count({where:{id:message.id}}),0);

 const c=await db.case.findUniqueOrThrow({where:{slug:'urban-supply'}});
 const price=await post(adminPOST,'/api/admin',{
  action:'setCasePrice',caseId:c.id,priceCents:c.price+100
 },admin.cookie);
 assert.equal(price.status,200);
 assert.equal((await db.case.findUniqueOrThrow({where:{id:c.id}})).price,c.price+100);
 assert.equal((await db.adminCaseOverride.findUniqueOrThrow({where:{slug:c.slug}})).price,c.price+100);
 const item=await db.item.findFirstOrThrow({where:{caseId:c.id,weight:{gt:0}}});
 const weight=await post(adminPOST,'/api/admin',{
  action:'setDropWeight',itemId:item.id,weight:item.weight+7
 },admin.cookie);
 assert.equal(weight.status,200);
 assert.equal((await db.item.findUniqueOrThrow({where:{id:item.id}})).weight,item.weight+7);
 assert.equal((await db.adminItemOverride.findUniqueOrThrow({where:{itemId:item.id}})).weight,item.weight+7);
 const board=await get(adminGET,'/api/admin?view=overview',admin.cookie);
 assert.equal(board.status,200);
 assert.ok(board.json.stats.users>=2);
 assert.equal((await get(adminGET,'/api/admin?view=battles',admin.cookie)).status,200);
 assert.equal((await get(adminGET,'/api/admin?view=cases',admin.cookie)).status,200);
 console.log('PASS owner-only admin, safe grants and audit, bans, chat moderation, durable case settings');
 // Restore seeded case settings so test runner never influences subsequent tests.
 await db.case.update({where:{id:c.id},data:{price:c.price}});
 await db.item.update({where:{id:item.id},data:{weight:item.weight}});
 await db.adminCaseOverride.deleteMany({where:{slug:c.slug}});
 await db.adminItemOverride.deleteMany({where:{itemId:item.id}});
 await db.adminAuditLog.deleteMany({where:{actorId:admin.id}});
 await db.session.deleteMany({where:{userId:{in:[admin.id,player.id]}}});
 await db.user.deleteMany({where:{id:{in:[admin.id,player.id]}}});
 if(originalAdminId===undefined)delete process.env.ADMIN_USER_ID;
 else process.env.ADMIN_USER_ID=originalAdminId;
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
