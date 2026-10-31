import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {randomBytes,createHash,randomInt} from 'node:crypto';
import argon2 from 'argon2';
import {z} from 'zod';
const cookie='cr_session';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
async function user(req:NextRequest){
 const token=req.cookies.get(cookie)?.value;
 if(!token)return null;
 const session=await db.session.findUnique({where:{tokenHash:hash(token)},include:{user:true}});
 if(!session||session.expiresAt<new Date())return null;
 return session.user;
}
function fail(error:string,status=400){return NextResponse.json({error},{status})}
const safeUser=(u:{id:string,username:string,coins:number,starterClaimed:boolean})=>({id:u.id,username:u.username,coins:u.coins,starterClaimed:u.starterClaimed});
export async function GET(req:NextRequest){
 try{
  const cmd=req.nextUrl.searchParams.get('action')||'cases';
  if(cmd==='cases')return NextResponse.json({cases:await db.case.findMany({include:{items:true},orderBy:{price:'asc'}})});
  const u=await user(req);
  if(cmd==='me')return NextResponse.json({user:u?safeUser(u):null});
  if(cmd==='inventory'){
   if(!u)return fail('Anmelden erforderlich',401);
   return NextResponse.json({items:await db.inventoryItem.findMany({where:{ownerId:u.id,soldAt:null},include:{item:true},orderBy:{createdAt:'desc'}})});
  }
  return fail('Unbekannte Anfrage',404);
 }catch(e){console.error(e);return fail('Serverfehler',500)}
}
export async function POST(req:NextRequest){
 try{
  const b=await req.json();
  const action=z.string().parse(b.action);
  if(action==='register'||action==='login'){
   const input=z.object({username:z.string().regex(/^[a-zA-Z0-9_]{3,24}$/),password:z.string().min(10).max(128)}).safeParse(b);
   if(!input.success)return fail('Benutzername 3–24 Zeichen; Passwort mindestens 10 Zeichen');
   const {username,password}=input.data;
   let u;
   if(action==='register'){
    const existing=await db.user.findUnique({where:{username}});if(existing)return fail('Benutzername schon vergeben',409);
    u=await db.user.create({data:{username,passwordHash:await argon2.hash(password)}});
   }else{
    const found=await db.user.findUnique({where:{username}});
    if(!found||!(await argon2.verify(found.passwordHash,password)))return fail('Falsche Zugangsdaten',401);
    u=found;
   }
   const token=randomBytes(32).toString('hex');
   await db.session.create({data:{userId:u.id,tokenHash:hash(token),expiresAt:new Date(Date.now()+7*86400000)}});
   const response=NextResponse.json({user:safeUser(u)});
   response.cookies.set(cookie,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:604800});
   return response;
  }
  if(action==='logout'){
   const token=req.cookies.get(cookie)?.value;
   if(token)await db.session.deleteMany({where:{tokenHash:hash(token)}});
   const res=NextResponse.json({ok:true});res.cookies.delete(cookie);return res;
  }
  const u=await user(req);if(!u)return fail('Bitte anmelden',401);
  if(action==='open'){
   const caseId=z.string().parse(b.caseId);
   const opened=await db.$transaction(async tx=>{
    const c=await tx.case.findUnique({where:{id:caseId},include:{items:true}});
    if(!c||!c.items.length)throw new Error('Kiste nicht gefunden');
    if(c.price===0){
     const changed=await tx.user.updateMany({where:{id:u.id,starterClaimed:false},data:{starterClaimed:true}});
     if(changed.count!==1)throw new Error('Starterkiste bereits geöffnet');
    }else{
     const charged=await tx.user.updateMany({where:{id:u.id,coins:{gte:c.price}},data:{coins:{decrement:c.price}}});
     if(charged.count!==1)throw new Error('Nicht genügend Coins');
    }
    const weight=c.items.reduce((s,i)=>s+i.weight,0);
    let roll=randomInt(weight);
    let selected=c.items[c.items.length-1];
    for(const item of c.items){roll-=item.weight;if(roll<0){selected=item;break}}
    const inv=await tx.inventoryItem.create({data:{ownerId:u.id,itemId:selected.id}});
    await tx.opening.create({data:{userId:u.id,caseId:c.id,itemId:selected.id}});
    return {item:selected,inventoryId:inv.id};
   },{isolationLevel:'Serializable'});
   return NextResponse.json({...opened,coins:(await db.user.findUniqueOrThrow({where:{id:u.id}})).coins});
  }
  if(action==='sell'){
   const inventoryId=z.string().parse(b.inventoryId);
   const result=await db.$transaction(async tx=>{
    const inv=await tx.inventoryItem.findUnique({where:{id:inventoryId},include:{item:true}});
    if(!inv||inv.ownerId!==u.id||inv.soldAt)throw new Error('Item nicht verfügbar');
    const claimed=await tx.inventoryItem.updateMany({where:{id:inventoryId,ownerId:u.id,soldAt:null},data:{soldAt:new Date()}});
    if(claimed.count!==1)throw new Error('Bereits verkauft');
    const updated=await tx.user.update({where:{id:u.id},data:{coins:{increment:inv.item.value}}});
    return {coins:updated.coins,value:inv.item.value};
   },{isolationLevel:'Serializable'});
   return NextResponse.json(result);
  }
  return fail('Unbekannte Aktion',404);
 }catch(e){console.error('CASE RUSH API:',e);return fail(e instanceof Error?e.message:'Serverfehler',400)}
}