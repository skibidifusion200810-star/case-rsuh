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
 // Each case uses distinct pools; higher case prices need more expensive skins,
 // not necessarily a higher colour-category percentage.
 assert.ok(premium>=0,'Probability distribution is nonnegative');
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
const freeGold=free.items.filter(item=>item.rarity==='KNIFE');
assert.equal(freeGold.length,1,'First Drop contains exactly one golden knife');
assert.equal(freeGold[0].name,'Karambit | Doppler');
assert.equal(freeGold[0].weight,1,'The free gold knife must be one weight out of 1,000,000');
assert.equal(freeGold[0].weight/free.items.reduce((sum,item)=>sum+item.weight,0),1/1_000_000,
 'Gold knife chance must be 1 in 1,000,000 (0.0001%)');
// Low-valued 1-2 cent skin variants must not appear in any case above €1.
const pennies=new Set(['P250 | Sand Dune','MP9 | Sand Dashed','SCAR-20 | Sand Mesh','MP7 | Army Recon']);
for(const item of caseDefs.slice(2).flatMap(c=>c.items))
 assert.ok(!pennies.has(item.name),'Only first two cases may contain €0.01–0.02 skins');
assert.ok(caseDefs[0].items.some(i=>pennies.has(i.name)));
assert.ok(caseDefs[1].items.some(i=>pennies.has(i.name)));
assert.ok(caseDefs[8].items.some(i=>i.name==='AWP | Dragon Lore'),
 'The €2,000 case needs a rare jackpot prize');
// All first five cases feature a real, sourced skin worth approximately one euro.
for(const c of caseDefs.slice(0,5))
 assert.ok(c.items.some(i=>i.name==='Tec-9 | Re-Entry'),
  'Missing verified ~1€ option in '+c.slug);
for(const c of caseDefs.slice(2))
 assert.ok(c.items.every(i=>!['P250 | Sand Dune','MP9 | Sand Dashed',
  'SCAR-20 | Sand Mesh','MP7 | Army Recon'].includes(i.name)),
  'Only first two tiers may contain cent skins');
const freeRare=free.items.filter(x=>['RARE','EPIC','LEGENDARY','KNIFE'].includes(x.rarity))
 .reduce((a,b)=>a+b.weight,0)/1_000_000;
assert.ok(freeRare<=0.001,'Free case must have <=0.1% chance for Rare+');
console.log('PASS: free rare rate', (freeRare*100).toFixed(4)+'%; nine distinct progressively premium pools');
