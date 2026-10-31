/**
 * CS.MONEY Trade price import via licensed third-party market data.
 * Never scrape cs.money browser pages; this feed requires a server-only API key.
 * USD market listing prices are converted using Frankfurter's published daily USD/EUR rate.
 */
export type CsMoneyQuote = {marketHashName:string;eurCents:number;checkedAt:Date;imageUrl?:string};
type ProviderRow = {market_hash_name?:string;icon_url?:string;prices?:{provider?:string;price?:number;updated_at?:string}[]};
const MAX_AGE = 48 * 60 * 60 * 1000;
export async function loadCsMoneyQuotes():Promise<Map<string,CsMoneyQuote>> {
 const key=process.env.SKINSTRACK_API_KEY;
 if(!key){console.warn('CS.MONEY quote import disabled: SKINSTRACK_API_KEY is not configured');return new Map()}
 const [resp,fxresp]=await Promise.all([
  fetch('https://api.skinstrack.com/v2/paid/items?providers=csmoney_trade',{
   headers:{'X-API-KEY':key},signal:AbortSignal.timeout(60000),cache:'no-store'
  }),
  fetch('https://api.frankfurter.dev/v2/rate/usd/eur',{signal:AbortSignal.timeout(20000),cache:'no-store'})
 ]);
 if(!resp.ok)throw new Error('CS.MONEY price provider failed HTTP '+resp.status+' (check paid API access)');
 if(!fxresp.ok)throw new Error('Currency rate service failed HTTP '+fxresp.status);
 const rateBody=await fxresp.json() as {rate?:number,date?:string};
 const rate=rateBody.rate;
 if(typeof rate!=='number'||!Number.isFinite(rate)||rate<=0)throw new Error('Invalid published EUR conversion rate');
 const items=await resp.json() as unknown;
 if(!Array.isArray(items))throw new Error('Unexpected CS.MONEY price feed response');
 const quotes=new Map<string,CsMoneyQuote>();
 for(const entry of items as ProviderRow[]){
  if(typeof entry.market_hash_name!=='string'||!Array.isArray(entry.prices))continue;
  const matched=entry.prices.filter(p=>p.provider==='csmoney_trade'
   &&typeof p.price==='number'&&Number.isFinite(p.price)&&p.price>0
   &&p.updated_at&&Number.isFinite(Date.parse(p.updated_at))
   &&Date.now()-Date.parse(p.updated_at)>=0
   &&Date.now()-Date.parse(p.updated_at)<MAX_AGE);
  matched.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));
  const offer=matched[0];
  if(!offer||!offer.price||!offer.updated_at)continue;
  const eurCents=Math.round(offer.price*rate*100);
  if(eurCents<=0||eurCents>2_000_000_000)continue;
  let imageUrl: string|undefined;
  if(typeof entry.icon_url==='string'){
   imageUrl=entry.icon_url.startsWith('https://')?entry.icon_url:'https://community.akamai.steamstatic.com/economy/image/'+entry.icon_url;
  }
  quotes.set(entry.market_hash_name,{
   marketHashName:entry.market_hash_name,eurCents,checkedAt:new Date(offer.updated_at),imageUrl
  });
 }
 if(quotes.size===0)throw new Error('No valid CS.MONEY Trade quotes received; refusing to replace saved item values');
 console.log('Imported',quotes.size,'CS.MONEY Trade quotes at published USD/EUR rate',rate,'dated',rateBody.date);
 return quotes;
}