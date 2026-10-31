import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {NextRequest} from 'next/server';
import {PrismaClient} from '@prisma/client';
import {POST} from '../app/api/game/route';

const db=new PrismaClient();
const url='http://localhost:3000/api/game';
async function post(action:string,body:Record<string,unknown>,cookie?:string){
 const req=new NextRequest(url,{method:'POST',headers:{
  'content-type':'application/json',
  ...(cookie?{'cookie':'cr_session='+cookie}:{})
 },body:JSON.stringify({action,...body})});
 const res=await POST(req);
 const json=await res.json();
 return {status:res.status,json,cookie:res.cookies.get('cr_session')?.value};
}
async function main(){
 const username='test_'+randomBytes(7).toString('hex');
 const registered=await post('register',{username,password:'A_VeryStrongTestPassword_38485'});
 assert.equal(registered.status,200,'Registration must work');
 assert.ok(registered.cookie,'Session cookie must exist');
 const cookie=registered.cookie!;
 const free=await db.case.findUniqueOrThrow({where:{slug:'first-drop'}});
 const paid=await db.case.findUniqueOrThrow({where:{slug:'urban-supply'}});
 const first=await post('open',{caseId:free.id},cookie);
 assert.equal(first.status,200,'First free roll should work');
 assert.equal(first.json.isDemo,true,'Free reward must be clearly marked demo');
 const immediate=await post('open',{caseId:free.id},cookie);
 assert.equal(immediate.status,400,'Anti-spam throttle must reject rapid repeat');
 await db.user.update({where:{username},data:{freeLastOpenedAt:new Date(Date.now()-12000)}});
 const second=await post('open',{caseId:free.id},cookie);
 assert.equal(second.status,200,'Free case must be usable again indefinitely');
 const player=await db.user.findUniqueOrThrow({where:{username}});
 assert.equal(player.coins,500,'No coins charged for free openings');
 const cannotSell=await post('sell',{inventoryId:first.json.inventoryId},cookie);
 assert.equal(cannotSell.status,400,'Free practice reward must not mint coins by sale');
 const paidOpening=await post('open',{caseId:paid.id},cookie);
 assert.equal(paidOpening.status,200,'Paid case opening should work');
 const playerAfter=await db.user.findUniqueOrThrow({where:{username}});
 assert.equal(playerAfter.coins,500-paid.price,'Paid opening debits the correct amount');
 const inv=await db.inventoryItem.findUniqueOrThrow({where:{id:paidOpening.json.inventoryId}});
 assert.equal(inv.isDemo,false,'Paid reward is sellable');
 const sold=await post('sell',{inventoryId:inv.id},cookie);
 assert.equal(sold.status,200,'First paid item sell succeeds');
 const soldTwice=await post('sell',{inventoryId:inv.id},cookie);
 assert.equal(soldTwice.status,400,'Double-selling is rejected');
 console.log('PASS free unlimited test, cooldown, no minting, paid billing, single sale');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
