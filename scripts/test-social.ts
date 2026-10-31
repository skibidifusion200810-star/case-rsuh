import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {NextRequest} from 'next/server';
import {PrismaClient} from '@prisma/client';
import {POST as game} from '../app/api/game/route';
import {GET as socialGet,POST as socialPost} from '../app/api/social/route';
import {qualifiesForGlobalDrop,GIFT_COOLDOWN_MS} from '../lib/social';

const db=new PrismaClient();
const url='http://localhost:3000';
async function post(handler:(req:NextRequest)=>Promise<Response>,path:string,body:Record<string,unknown>,cookie?:string){
 const r=await handler(new NextRequest(url+path,{method:'POST',headers:{
  'content-type':'application/json',...(cookie?{cookie:'cr_session='+cookie}:{})
 },body:JSON.stringify(body)}));
 return {status:r.status,json:await r.json(),cookie:r.headers.get('set-cookie')?.match(/cr_session=([^;]+)/)?.[1]};
}
async function get(feed:string,cookie?:string){
 const r=await socialGet(new NextRequest(url+'/api/social?feed='+feed,{
  headers:cookie?{cookie:'cr_session='+cookie}:{}
 }));
 return {status:r.status,json:await r.json()};
}
async function register(){
 const username='social_'+randomBytes(7).toString('hex');
 const r=await post(game,'/api/game',{action:'register',username,password:'StrongPassword_123456789'});
 assert.equal(r.status,200);
 assert.ok(r.cookie);
 return {username,id:r.json.user.id as string,cookie:r.cookie!};
}
async function main(){
 const a=await register(),b=await register();
 const transferIds:string[]=[];
 try{
  await db.user.update({where:{id:a.id},data:{coins:500000}});
  const noLogin=await post(socialPost,'/api/social',{action:'chat',message:'Hello'});
  assert.equal(noLogin.status,401,'Chat post must require login');
  const tooLong=await post(socialPost,'/api/social',{action:'chat',message:'a'.repeat(281)},a.cookie);
  assert.equal(tooLong.status,400);
  const invalidGift=await post(socialPost,'/api/social',{action:'gift',recipient:b.username,amountCents:200001},a.cookie);
  assert.equal(invalidGift.status,400,'Cannot exceed daily max');
  const self=await post(socialPost,'/api/social',{action:'gift',recipient:a.username,amountCents:100},a.cookie);
  assert.equal(self.status,400,'Cannot gift yourself');
  const missing=await post(socialPost,'/api/social',{action:'gift',recipient:'no_such_player',amountCents:100},a.cookie);
  assert.equal(missing.status,404);
  const chat=await post(socialPost,'/api/social',{action:'chat',message:'Hi von CASE RUSH!'},a.cookie);
  assert.equal(chat.status,200,'Authenticated chat works');
  const spam=await post(socialPost,'/api/social',{action:'chat',message:'Hi nochmal'},a.cookie);
  assert.equal(spam.status,429,'Chat throttling');
  const live=await get('chat');
  assert.equal(live.status,200);
  assert.ok(live.json.messages.some((m:{id:string})=>m.id===chat.json.message.id),'New chat message appears to all');
  assert.ok(live.json.messages.every((m:Record<string,unknown>)=>!('passwordHash' in m)&&!('userId' in m)));
  await db.user.update({where:{id:a.id},data:{chatLastSentAt:new Date(Date.now()-7000)}});
  const nextChat=await post(socialPost,'/api/social',{action:'chat',message:'Wieder online'},a.cookie);
  assert.equal(nextChat.status,200,'Cooldown can expire');

  const first=await post(socialPost,'/api/social',{action:'gift',recipient:b.username,amountCents:25000},a.cookie);
  assert.equal(first.status,200,'Gift €250 succeeds');
  transferIds.push(first.json.transfer.id);
  assert.equal(first.json.transfer.balance,475000,'Gift deducts from sender');
  assert.equal((await db.user.findUniqueOrThrow({where:{id:b.id}})).coins,25500,'Gift credits recipient');
  const second=await post(socialPost,'/api/social',{action:'gift',recipient:b.username,amountCents:100},a.cookie);
  assert.equal(second.status,429,'Only once per 24 hours');
  const wallet=await get('wallet',a.cookie);
  assert.equal(wallet.status,200);
  assert.equal(wallet.json.balance,475000);
  assert.ok(wallet.json.nextAt);
  assert.equal(wallet.json.transfers[0].recipient,b.username);

  // Concurrent attempts after clearing the cooldown: only one transfer may commit.
  await db.user.update({where:{id:a.id},data:{giftLastSentAt:new Date(Date.now()-GIFT_COOLDOWN_MS-5000)}});
  const [p,q]=await Promise.all([
   post(socialPost,'/api/social',{action:'gift',recipient:b.username,amountCents:1000},a.cookie),
   post(socialPost,'/api/social',{action:'gift',recipient:b.username,amountCents:1000},a.cookie)
  ]);
  assert.equal([p.status,q.status].filter(s=>s===200).length,1,'Concurrent attempts must not both succeed');
  if(p.status===200)transferIds.push(p.json.transfer.id);
  if(q.status===200)transferIds.push(q.json.transfer.id);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:a.id}})).coins,474000,'Exactly one debit');
  assert.equal((await db.user.findUniqueOrThrow({where:{id:b.id}})).coins,26500,'Exactly one credit');

  assert.equal(qualifiesForGlobalDrop({name:'AWP | Dragon Lore',rarity:'LEGENDARY',value:1100000}),true);
  assert.equal(qualifiesForGlobalDrop({name:'P250 | Sand Dune',rarity:'COMMON',value:1}),false);
  assert.equal(qualifiesForGlobalDrop({name:'AWP | Asiimov',rarity:'EPIC',value:40000}),false);
  const rare=await db.rareDropEvent.create({data:{
   username:a.username,itemName:'AWP | Dragon Lore',rarity:'LEGENDARY',value:1100000,
   source:'CASE',inventoryItemId:'test_'+randomBytes(12).toString('hex')
  }});
  try{
   const feed=await get('drops');
   assert.equal(feed.status,200);
   assert.ok(feed.json.events.some((event:{id:string})=>event.id===rare.id),'Public rare drop feed updated');
   assert.ok(feed.json.events.every((e:Record<string,unknown>)=>!('userId' in e)));
  }finally{await db.rareDropEvent.delete({where:{id:rare.id}})}
  console.log('PASS live chat, 3-second spam guard, rare-drop filtering, wallet gifts, 24h cooldown and concurrent debit security');
 }finally{
  await db.chatMessage.deleteMany({where:{userId:{in:[a.id,b.id]}}});
  await db.giftTransfer.deleteMany({where:{id:{in:transferIds}}});
  await db.user.deleteMany({where:{id:{in:[a.id,b.id]}}});
  await db.$disconnect();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
