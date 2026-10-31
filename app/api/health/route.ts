import {db} from '@/lib/db';
export async function GET(){try{await db.$queryRaw`SELECT 1`;return Response.json({status:'ok',database:'online'})}catch{return Response.json({status:'error',database:'offline'},{status:503})}}
