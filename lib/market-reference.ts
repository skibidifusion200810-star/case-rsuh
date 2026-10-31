/**
 * Historical, verifiable EUR listing prices for exact non-Souvenir CS2 variants.
 * Collected 2026-10-29 from Veriloot's per-marketplace tables for CS.MONEY.
 * These are snapshots, NOT guaranteed current prices and NOT payouts in real money.
 * Do not extrapolate to Factory New or any other wear; there is no fake fallback.
 */
export type ReferenceQuote={wear:'Field-Tested'|'Factory New';eurCents:number;observedAt:string;provider:string;sourceUrl:string};
export const verifiedReferenceQuotes:Record<string,ReferenceQuote>={
 'USP-S | Cortex':{
  wear:'Field-Tested',eurCents:307,observedAt:'2026-10-29T06:55:00+01:00',
  provider:'CS.MONEY listings compared by Veriloot',
  sourceUrl:'https://veriloot.gg/en/skins/usp-s/cortex/field-tested'
 },
 'M4A1-S | Decimator':{
  wear:'Field-Tested',eurCents:950,observedAt:'2026-10-29T07:55:00+01:00',
  provider:'CS.MONEY listings compared by Veriloot',
  sourceUrl:'https://veriloot.gg/en/skins/m4a1-s/decimator/field-tested'
 },
 'AWP | Corticera':{
  wear:'Field-Tested',eurCents:1635,observedAt:'2026-10-29T06:55:00+01:00',
  provider:'CS.MONEY listings compared by Veriloot',
  sourceUrl:'https://veriloot.gg/en/skins/awp/corticera/field-tested'
 },

 'Tec-9 | Re-Entry':{
  wear:'Field-Tested',eurCents:99,observedAt:'2026-10-29T07:30:00+01:00',
  provider:'CS.MONEY listing via Veriloot',
  sourceUrl:'https://veriloot.gg/en/skins/tec-9/re-entry/field-tested'
 },
 'P250 | Franklin':{
  wear:'Field-Tested',eurCents:105,observedAt:'2026-10-31T14:55:00+01:00',
  provider:'CS.MONEY listing via Veriloot',
  sourceUrl:'https://veriloot.gg/en/top/skins-under-5-euros'
 },
 'Galil AR | Black Sand':{
  wear:'Field-Tested',eurCents:49,observedAt:'2026-10-29T07:30:00+01:00',
  provider:'CS.MONEY listing via Veriloot',
  sourceUrl:'https://veriloot.gg/en/skins/galil-ar/black-sand/field-tested'
 },
 'Butterfly Knife | Fade':{
  wear:'Factory New',eurCents:183541,observedAt:'2026-10-01',
  provider:'SkinScanner-Marktvergleich, Tradeit-Listing (kein CS.MONEY-Preis)',
  sourceUrl:'https://skinscanner.gg/item/butterfly-knife-fade/butterfly-knife-fade-factory-new'
 },
 'AWP | Dragon Lore':{
  wear:'Factory New',eurCents:1150106,observedAt:'2026-11-01T00:00:00+01:00',
  provider:'CS.MONEY listing via FragStash (reference snapshot, not live)',
  sourceUrl:'https://fragstash.com/catalog/awp/dragon-lore/'
 },
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
