/**
 * Keeps case expected payouts below their configured price without replacing
 * observed market valuations or hand-picking the server's winning item.
 * Inputs/outputs are integer weights. FREE cases are excluded by the caller.
 */
export type BalancedItem={id:string;weight:number;value:number;rarity:string};
export function balanceCaseWeights<T extends BalancedItem>(
 items:readonly T[],priceCents:number,targetRtp=0.88
):{entries:Array<{item:T;weight:number}>;expectedCents:number;rtp:number;profitChance:number}{
 if(!Number.isInteger(priceCents)||priceCents<=0)throw Error('Paid case price required');
 if(!items.length||items.some(x=>x.weight<=0||x.value<=0))throw Error('Invalid catalog for case balance');
 const totalWeight=1_000_000;
 const distribution=(lambda:number)=>{
  // Rare knives remain rare even in premium cases. An item is not
  // weighted up merely because its observed market price increased.
  const scores=items.map(x=>{
   const rare=x.rarity==='KNIFE'?0.05:1;
   const over=Math.max(0,x.value/priceCents-1);
   return x.weight*rare*Math.exp(-lambda*over);
  });
  const sum=scores.reduce((a,b)=>a+b,0);
  return scores.map(x=>x/sum);
 };
 const mean=(shares:number[])=>shares.reduce((sum,p,i)=>sum+p*items[i].value,0);
 let shares=distribution(0);
 const maxEv=priceCents*targetRtp;
 if(mean(shares)>maxEv){
  let low=0,high=128;
  for(let i=0;i<55;i++){
   const mid=(low+high)/2;
   if(mean(distribution(mid))>maxEv)low=mid;else high=mid;
  }
  shares=distribution(high);
 }
 const counts=shares.map(p=>Math.max(1,Math.round(p*totalWeight)));
 const expectedCents=counts.reduce((sum,w,i)=>sum+w*items[i].value,0)/
  counts.reduce((sum,w)=>sum+w,0);
 const profitChance=counts.reduce((sum,w,i)=>sum+(items[i].value>priceCents?w:0),0)/
  counts.reduce((sum,w)=>sum+w,0);
 return {entries:items.map((item,i)=>({item,weight:counts[i]})),
  expectedCents,rtp:expectedCents/priceCents,profitChance};
}
