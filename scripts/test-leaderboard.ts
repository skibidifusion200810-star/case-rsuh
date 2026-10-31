import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {loadLeaderboard} from '../lib/leaderboard';

const db=new PrismaClient();
async function main(){
 const slug=randomBytes(5).toString('hex');
 const ids:string[]=[];
 try{
  const [freeCase,paidCase]=await Promise.all([
   db.case.findUniqueOrThrow({where:{slug:'first-drop'},include:{items:true}}),
   db.case.findUniqueOrThrow({where:{slug:'urban-supply'},include:{items:true}})
  ]);
  const item=paidCase.items.find(i=>i.weight>0);
  assert.ok(item,'paid case needs an item');
  const a=await db.user.create({data:{username:'lb_a_'+slug,coins:345000,passwordHash:'test-no-login'}});
  const b=await db.user.create({data:{username:'lb_b_'+slug,coins:400,passwordHash:'test-no-login'}});
  const c=await db.user.create({data:{username:'lb_c_'+slug,coins:0,passwordHash:'test-no-login'}});
  ids.push(a.id,b.id,c.id);
  await db.inventoryItem.createMany({data:[
   {ownerId:a.id,itemId:item.id,valueAtDrop:50000,isDemo:false},
   {ownerId:a.id,itemId:item.id,valueAtDrop:999999,isDemo:false,soldAt:new Date()},
   {ownerId:a.id,itemId:item.id,valueAtDrop:1200,isDemo:true},
   {ownerId:b.id,itemId:item.id,valueAtDrop:120000,isDemo:false},
   {ownerId:b.id,itemId:item.id,valueAtDrop:10000,isDemo:false,soldAt:new Date()}
  ]});
  const openingData=[
   ...Array.from({length:2},()=>({userId:a.id,caseId:freeCase.id,itemId:item.id})),
   {userId:a.id,caseId:paidCase.id,itemId:item.id},
   ...Array.from({length:3},()=>({userId:b.id,caseId:paidCase.id,itemId:item.id})),
   {userId:b.id,caseId:freeCase.id,itemId:item.id},
   ...Array.from({length:2},()=>({userId:c.id,caseId:paidCase.id,itemId:item.id}))
  ];
  await db.opening.createMany({data:openingData});
  const result=await loadLeaderboard(db,50);
  const rows=(metric:'balance'|'inventory'|'openings')=>new Map(result.rankings[metric].map(u=>[u.username,u]));
  const balance=rows('balance');
  const inventory=rows('inventory');
  const openings=rows('openings');
  assert.equal(balance.get(a.username)?.balanceCents,345000,'wallet balance must match');
  assert.equal(inventory.get(a.username)?.inventoryCents,51200,'include historical free item and exclude sold');
  assert.equal(inventory.get(a.username)?.inventoryItems,2,'both free and paid unsold items counted');
  assert.equal(inventory.get(b.username)?.inventoryCents,120000,'use value at opening, not today price');
  assert.equal(inventory.get(c.username)?.inventoryCents,0,'zero inventory should be visible');
  assert.equal(openings.get(a.username)?.totalOpenings,3,'all openings counted');
  assert.equal(openings.get(a.username)?.paidOpenings,1,'paid openings counted separately');
  assert.equal(openings.get(a.username)?.freeOpenings,2,'free openings counted separately');
  assert.equal(openings.get(b.username)?.totalOpenings,4,'multiple openings counted');
  assert.ok((balance.get(a.username)?.rank??999)<(balance.get(b.username)?.rank??999),'balance rank descending');
  assert.ok((inventory.get(b.username)?.rank??999)<(inventory.get(a.username)?.rank??999),'inventory rank descending');
  assert.ok((openings.get(b.username)?.rank??999)<(openings.get(a.username)?.rank??999),'opening rank descending');
  for(const key of ['balance','inventory','openings'] as const){
   const list=result.rankings[key];
   assert.ok(list.length>0&&list.length<=50,'bounded leaderboard');
   assert.deepEqual(list.map(x=>x.rank),Array.from({length:list.length},(_,i)=>i+1),'rank is stable');
   assert.ok(list.every(x=>!('passwordHash' in x)&&!('id' in x)),'never expose secrets or IDs');
  }
  console.log('PASS leaderboard balances, free inventory, openings, ranking and privacy');
 }finally{
  if(ids.length){
   await db.opening.deleteMany({where:{userId:{in:ids}}});
   await db.inventoryItem.deleteMany({where:{ownerId:{in:ids}}});
   await db.user.deleteMany({where:{id:{in:ids}}});
  }
  await db.$disconnect();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
