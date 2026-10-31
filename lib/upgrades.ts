/** All prices are integer euro cents. Unlocks are permanent. */
export const UPGRADE_TIERS=[
 {slots:2,price:10000,label:'UPGRADE 1'},
 {slots:4,price:50000,label:'UPGRADE 2'},
 {slots:8,price:100000,label:'UPGRADE 3'},
 {slots:10,price:200000,label:'UPGRADE 4'}
] as const;
export const priceForUpgrade=(slots:number):number|undefined=>
 UPGRADE_TIERS.find(t=>t.slots===slots)?.price;
