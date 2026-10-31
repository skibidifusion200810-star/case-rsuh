/**
 * Historical, verifiable EUR listing prices for exact non-Souvenir CS2 variants.
 * Collected 2026-10-29 from Veriloot's per-marketplace tables for CS.MONEY.
 * These are snapshots, NOT guaranteed current prices and NOT payouts in real money.
 * Do not extrapolate to Factory New or any other wear; there is no fake fallback.
 */
export type ReferenceQuote={wear:'Field-Tested';eurCents:number;observedAt:string;provider:string;sourceUrl:string};
export const verifiedReferenceQuotes:Record<string,ReferenceQuote>={
 'P250 | Sand Dune':{
  wear:'Field-Tested',eurCents:2,observedAt:'2026-10-29T07:30:00+01:00',
  provider:'CS.MONEY listing via Veriloot',
  sourceUrl:'https://veriloot.gg/en/skins/p250/sand-dune/field-tested'
 },
 'MP9 | Sand Dashed':{
  wear:'Field-Tested',eurCents:1,observedAt:'2026-10-29T07:20:00+01:00',
  provider:'CS.MONEY listing via Veriloot',
  sourceUrl:'https://veriloot.gg/en/skins/mp9/sand-dashed'
 },
 'SCAR-20 | Sand Mesh':{
  wear:'Field-Tested',eurCents:1,observedAt:'2026-10-29T07:30:00+01:00',
  provider:'CS.MONEY listing via Veriloot',
  sourceUrl:'https://veriloot.gg/en/skins/scar-20/sand-mesh/field-tested'
 },
 'MP7 | Army Recon':{
  wear:'Field-Tested',eurCents:2,observedAt:'2026-10-29T14:55:00+01:00',
  provider:'CS.MONEY listing via Veriloot',
  sourceUrl:'https://veriloot.gg/en/skins/mp7/army-recon/field-tested'
 }
};
export function referenceQuoteFor(name:string):ReferenceQuote|undefined{
 return Object.hasOwn(verifiedReferenceQuotes,name)?verifiedReferenceQuotes[name]:undefined;
}
