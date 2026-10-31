import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {loadLeaderboard} from '@/lib/leaderboard';

export const dynamic='force-dynamic';

export async function GET(){
 try{
  const leaderboard=await loadLeaderboard(db,20);
  return NextResponse.json(leaderboard,{
   headers:{
    'Cache-Control':'no-store, max-age=0',
    'X-Content-Type-Options':'nosniff'
   }
  });
 }catch(error){
  console.error('Leaderboard API:',error);
  return NextResponse.json({error:'Bestenliste momentan nicht verfügbar'},{
   status:503,
   headers:{'Cache-Control':'no-store'}
  });
 }
}
