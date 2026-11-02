'use client';
import {useRef} from 'react';
import CaseSpinTrack,{type SpinWeapon} from './CaseSpinTrack';
type Item=SpinWeapon&{id:string;name:string;rarity:string;weight:number};
export default function OpeningReel({winner,pool,reducedMotion,onFinish}:{
 winner:Item;pool:Item[];reducedMotion:boolean;onFinish:()=>void
}){
 const done=useRef(false);
 const next=useRef(onFinish);
 next.current=onFinish;
 const finish=()=>{if(done.current)return;done.current=true;next.current()};
 return <div className="overlay reel-overlay cr2-reel-overlay">
  <section className="reel-modal cr2-reel-modal" role="dialog" aria-modal="true" aria-label="Kistenöffnung">
   <div className="eyebrow">CASE RUSH / OPENING SEQUENCE</div>
   <h2>CASE <em>OPENING.</em></h2>
   <p>Das Roulette läuft von rechts nach links und stoppt unter der goldenen Markierung.</p>
   <CaseSpinTrack winner={winner} pool={pool} duration={6550} reducedMotion={reducedMotion} onComplete={finish}/>
   <div className="reel-actions">
    <span>Der Gewinn steht vor Beginn der Animation fest.</span>
    <button type="button" className="secondary" onClick={finish}>ANIMATION ÜBERSPRINGEN ↗</button>
   </div>
  </section>
 </div>;
}
