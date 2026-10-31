import assert from 'node:assert/strict';
import {caseDefs} from '../lib/case-config';

assert.equal(caseDefs.length,9,'Exactly nine cases');
assert.equal(caseDefs[0].price,0,'Starter case free');
assert.equal(caseDefs.at(-1)?.price,200000,'Highest case costs 2000 virtual euros');

const signatures=new Set<string>();
let prevPrice=-1;
let prevPremium=-1;
for(const c of caseDefs){
 assert.ok(c.price>prevPrice,'Case prices must increase');
 prevPrice=c.price;
 assert.ok(c.items.length>=5,'Each case needs enough distinct items: '+c.slug);
 const distinct=new Set(c.items.map(i=>i.name));
 assert.equal(distinct.size,c.items.length,'No repeated item: '+c.slug);
 const weights=c.items.map(x=>x.weight);
 assert.ok(weights.every(w=>Number.isInteger(w)&&w>0),'All weights must be positive integers');
 const total=weights.reduce((a,b)=>a+b,0);
 assert.equal(total,c.slug==='first-drop'?1000000:10000,'Exact known weights: '+c.slug);
 const premium=c.items.filter(x=>['EPIC','LEGENDARY','KNIFE'].includes(x.rarity))
  .reduce((a,b)=>a+b.weight,0)/total;
 assert.ok(premium>prevPremium,'More expensive case must improve Epic+ odds: '+c.slug);
 prevPremium=premium;
 const signature=c.items.map(i=>i.name+':'+i.weight).sort().join('|');
 assert.ok(!signatures.has(signature),'Each case drop pool must differ');
 signatures.add(signature);
 if(c.price>=100000)assert.ok(c.items.every(x=>!['COMMON','UNCOMMON'].includes(x.rarity)),
  'No common/uncommon prizes in 1000+ virtual euro cases');
 console.log(c.name, (c.price/100).toFixed(2)+' EUR', c.items.length+' items',
  (premium*100).toFixed(3)+'% Epic+');
}
const free=caseDefs[0];
const freeRare=free.items.filter(x=>['RARE','EPIC','LEGENDARY','KNIFE'].includes(x.rarity))
 .reduce((a,b)=>a+b.weight,0)/1_000_000;
assert.ok(freeRare<=0.001,'Free case must have <=0.1% chance for Rare+');
console.log('PASS: free rare rate', (freeRare*100).toFixed(4)+'%; nine distinct progressively premium pools');
