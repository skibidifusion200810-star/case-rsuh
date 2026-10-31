import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {socialViewer} from '@/lib/social';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(){
 const announcements=await db.adminAnnouncement.findMany({where:{expiresAt:{gt:new Date()}},orderBy:{createdAt:'desc'},take:5,select:{id:true,message:true,expiresAt:true,createdAt:true}});
 return NextResponse.json({announcements},{headers});
}
export async function POST(req:NextRequest){
 const origin=req.headers.get('origin');
 const host=req.headers.get('x-forwarded-host')||req.headers.get('host');
 if(!origin||!host){return NextResponse.json({error:'Ungültige Quelle'},{status:403})}
 try{if(new URL(origin).host!==host)return NextResponse.json({error:'Ungültige Quelle'},{status:403})}catch{return NextResponse.json({error:'Ungültige Quelle'},{status:403})}
 const user=await socialViewer(req,db);
 if(!user)return NextResponse.json({ok:false},{status:401,headers});
 await db.user.update({where:{id:user.id},data:{lastSeenAt:new Date()}});
 return NextResponse.json({ok:true},{headers});
}
