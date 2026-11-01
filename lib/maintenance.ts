import {db} from '@/lib/db';
export async function maintenanceBlocked(userId?:string|null){
 const status=await db.adminMaintenance.findUnique({where:{id:'GLOBAL'}});
 return !!status?.enabled&&userId!==process.env.ADMIN_USER_ID;
}
