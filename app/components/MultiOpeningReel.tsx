'use client';
import {useRef} from 'react';
import CaseSpinTrack,{type SpinWeapon} from './CaseSpinTrack';
type Item=SpinWeapon&{id:string;name:string;rarity:string;weight:number};
export type MultiDrop={item:Item;inventoryId:string};
function Lane({winner,pool,index,reducedMotion,onComplete}:{
 winner:Item;pool:Item[];index:number;reducedMotion:boolean;onComplete:(index:number)=>void
}){
 return <div className="multi-reel-lane cr2-multi-lane">
  <span className="multi-reel-counter">CASE {String(index+1).padStart(2,'0')} <span>◈ SPINNING</span></span>
  <CaseSpinTrack winner={winner} pool={pool} reducedMotion={reducedMotion}
   duration={5900+index*150} compact onComplete={()=>onComplete(index)}/>
 </div>;
}
export default function MultiOpeningReel({drops,pool,reducedMotion,onFinish}:{
 drops:MultiDrop[];pool:Item[];reducedMotion:boolean;onFinish:()=>void
}){
 const completed=useRef(new Set<number>());
 const done=useRef(false);
 const latest=useRef(onFinish);
 latest.current=onFinish;
 const finish=()=>{if(done.current)return;done.current=true;latest.current()};
 const mark=(index:number)=>{
  completed.current.add(index);
  if(completed.current.size===drops.length)finish();
 };
 return <div className="overlay reel-overlay cr2-reel-overlay">
  <section className="multi-reel-modal cr2-reel-modal" role="dialog" aria-modal="true" aria-label="Mehrfach-Kistenöffnung">
   <div className="eyebrow">CASE RUSH / MULTI OPENING</div>
   <h2>{drops.length} CASES. <em>{drops.length} DROPS.</em></h2>
   <p>Jede Kiste bekommt eine eigene, unabhängig abbremsende Waffenrolle.</p>
   <div className="multi-reel-scroller">
    {drops.map((drop,index)=><Lane key={drop.inventoryId}
     winner={drop.item} pool={pool} index={index} reducedMotion={reducedMotion} onComplete={mark}/>)}
   </div>
   <div className="reel-actions"><span>Ergebnisse wurden bereits serverseitig bestimmt.</span>
    <button className="secondary" type="button" onClick={finish}>ALLE ÜBERSPRINGEN ↗</button>
   </div>
  </section>
 </div>;
}
