import type {PrismaClient} from '@prisma/client';

/** Public leaderboard values are virtual euro-cents, never real money. */
export type LeaderboardCategory='balance'|'inventory'|'openings';
export type LeaderboardEntry={
 rank:number;
 username:string;
 balanceCents:number;
 inventoryCents:number;
 inventoryItems:number;
 totalOpenings:number;
 paidOpenings:number;
 freeOpenings:number;
};
export type LeaderboardResult={
 updatedAt:string;
 rankings:Record<LeaderboardCategory,LeaderboardEntry[]>;
};
type RawRank={
 username:string;
 balanceCents:bigint;
 inventoryCents:bigint;
 inventoryItems:bigint;
 totalOpenings:bigint;
 paidOpenings:bigint;
 freeOpenings:bigint;
 balanceRank:number;
 inventoryRank:number;
 openingsRank:number;
};

/** Aggregate inventory and opening history separately to avoid multiplying totals.
 * Demo/free-case items have no sellable inventory value. Every opening counts.
 */
export async function loadLeaderboard(db:PrismaClient,limit=20):Promise<LeaderboardResult>{
 const cap=Math.max(1,Math.min(50,Math.trunc(limit)));
 const rows=await db.$queryRaw<RawRank[]>`
 WITH inventory_totals AS (
  SELECT i."ownerId" AS "userId",
         COALESCE(SUM(COALESCE(i."valueAtDrop",item.value)::bigint),0::bigint) AS "inventoryCents",
         COUNT(*)::bigint AS "inventoryItems"
  FROM "InventoryItem" i
  JOIN "Item" item ON item.id=i."itemId"
  WHERE i."soldAt" IS NULL AND i."isDemo"=false
  GROUP BY i."ownerId"
 ),
 opening_totals AS (
  SELECT o."userId",
         COUNT(*)::bigint AS "totalOpenings",
         COUNT(*) FILTER (WHERE c.price>0)::bigint AS "paidOpenings",
         COUNT(*) FILTER (WHERE c.price=0)::bigint AS "freeOpenings"
  FROM "Opening" o
  JOIN "Case" c ON c.id=o."caseId"
  GROUP BY o."userId"
 ),
 player_stats AS (
  SELECT u.username,u.coins::bigint AS "balanceCents",
         COALESCE(i."inventoryCents",0::bigint) AS "inventoryCents",
         COALESCE(i."inventoryItems",0::bigint) AS "inventoryItems",
         COALESCE(o."totalOpenings",0::bigint) AS "totalOpenings",
         COALESCE(o."paidOpenings",0::bigint) AS "paidOpenings",
         COALESCE(o."freeOpenings",0::bigint) AS "freeOpenings"
  FROM "User" u
  LEFT JOIN inventory_totals i ON i."userId"=u.id
  LEFT JOIN opening_totals o ON o."userId"=u.id
 ),
 ranked AS (
  SELECT p.*,
         ROW_NUMBER() OVER (
          ORDER BY p."balanceCents" DESC,p."inventoryCents" DESC,
                   p."totalOpenings" DESC,p.username ASC
         )::int AS "balanceRank",
         ROW_NUMBER() OVER (
          ORDER BY p."inventoryCents" DESC,p."balanceCents" DESC,
                   p."totalOpenings" DESC,p.username ASC
         )::int AS "inventoryRank",
         ROW_NUMBER() OVER (
          ORDER BY p."totalOpenings" DESC,p."paidOpenings" DESC,
                   p."inventoryCents" DESC,p.username ASC
         )::int AS "openingsRank"
  FROM player_stats p
 )
 SELECT * FROM ranked
 WHERE "balanceRank"<=${cap} OR "inventoryRank"<=${cap} OR "openingsRank"<=${cap}
 `;
 const toEntry=(row:RawRank,rank:number):LeaderboardEntry=>({
  rank,username:row.username,balanceCents:Number(row.balanceCents),
  inventoryCents:Number(row.inventoryCents),
  inventoryItems:Number(row.inventoryItems),
  totalOpenings:Number(row.totalOpenings),
  paidOpenings:Number(row.paidOpenings),
  freeOpenings:Number(row.freeOpenings)
 });
 return {
  updatedAt:new Date().toISOString(),
  rankings:{
   balance:rows.filter(r=>r.balanceRank<=cap)
    .sort((a,b)=>a.balanceRank-b.balanceRank).map(r=>toEntry(r,r.balanceRank)),
   inventory:rows.filter(r=>r.inventoryRank<=cap)
    .sort((a,b)=>a.inventoryRank-b.inventoryRank).map(r=>toEntry(r,r.inventoryRank)),
   openings:rows.filter(r=>r.openingsRank<=cap)
    .sort((a,b)=>a.openingsRank-b.openingsRank).map(r=>toEntry(r,r.openingsRank))
  }
 };
}
