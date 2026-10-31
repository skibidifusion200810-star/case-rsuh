'use client';

import {useEffect,useMemo,useRef} from 'react';

type ReelItem={
 id:string;name:string;rarity:string;value:number;weight:number;imageUrl?:string|null
};
export type MultiDrop={item:ReelItem;inventoryId:string};
type Props={
 drops:MultiDrop[];pool:ReelItem[];reducedMotion:boolean;onFinish:()=>void
};
const TILE=152;
const GAP=12;
const START=40;
const TARGET=5;
const DURATION=5600;
const rarity:Record<string,string>={
 COMMON:'#9ca3af',UNCOMMON:'#44a1ff',RARE:'#9b71ff',
 EPIC:'#f36ad4',LEGENDARY:'#fa5260',KNIFE:'#e9b147'
};
const eur=(value:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value/100);

/** Visual-only row. The winning item is selected and saved by the server beforehand. */
function ReelRow({winner,pool,index,finish,reducedMotion}:{
 winner:ReelItem;pool:ReelItem[];index:number;
 finish:(index:number)=>void;reducedMotion:boolean
}){
 const viewport=useRef<HTMLDivElement>(null);
 const track=useRef<HTMLDivElement>(null);
 const slots=useMemo(()=>{
  const options=pool.filter(x=>x.weight>0);
  const total=options.reduce((sum,x)=>sum+x.weight,0);
  const pick=():ReelItem=>{
   if(!total)return winner;
   let n=Math.random()*total;
   for(const item of options){n-=item.weight;if(n<0)return item}
   return options[options.length-1];
  };
  // Populate BEFORE the animation begins; TARGET always contains the server winner.
  return Array.from({length:46},(_,i)=>i===TARGET?winner:pick());
 },[winner,pool]);
 const onFinish=useRef(finish);
 onFinish.current=finish;
 useEffect(()=>{
  if(reducedMotion){onFinish.current(index);return}
  const stage=viewport.current,el=track.current;
  if(!stage||!el)return;
  const align=(at:number)=>stage.getBoundingClientRect().width/2-TILE/2-at*(TILE+GAP);
  el.style.transition='none';
  el.style.transform='translate3d('+align(START)+'px,0,0)';
  let second=0;
  const first=requestAnimationFrame(()=>{
   second=requestAnimationFrame(()=>{
    el.style.transition='transform '+(DURATION+index*160)+'ms cubic-bezier(0.08,0.70,0.15,1)';
    el.style.transform='translate3d('+align(TARGET)+'px,0,0)';
   });
  });
  const timeout=window.setTimeout(()=>onFinish.current(index),DURATION+index*160+180);
  return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);window.clearTimeout(timeout)};
 },[index,reducedMotion]);
 return <div className="multi-reel-lane">
  <span className="multi-reel-counter">KISTE {String(index+1).padStart(2,'0')}</span>
  <div className="reel-viewport multi-reel-viewport" ref={viewport}>
   <div className="reel-pointer" aria-hidden="true"><span>▼</span><span>▲</span></div>
   <div className="reel-track" ref={track} onTransitionEnd={e=>{
    if(e.target===track.current&&e.propertyName==='transform')onFinish.current(index);
   }}>
    {slots.map((item,i)=><div className="reel-tile" key={i} style={{
     borderBottomColor:rarity[item.rarity]??'#a0a0a0'
    }}>
     {item.imageUrl?<img src={item.imageUrl} alt="" draggable={false}/>:
      <span className="reel-no-image">✦</span>}
     <strong title={item.name}>{item.name}</strong>
     <span className="reel-item-value">{eur(item.value)} <small>virtuell</small></span>
    </div>)}
   </div>
  </div>
 </div>;
}

/** Every opened case has its own independently moving weapon reel. */
export default function MultiOpeningReel({drops,pool,reducedMotion,onFinish}:Props){
 const finished=useRef(new Set<number>());
 const done=useRef(false);
 const finishHandler=useRef(onFinish);
 finishHandler.current=onFinish;
 const finishAll=()=>{
  if(done.current)return;
  done.current=true;
  finishHandler.current();
 };
 const finishLane=(index:number)=>{
  finished.current.add(index);
  if(finished.current.size===drops.length)finishAll();
 };
 return <div className="overlay reel-overlay">
  <section className="multi-reel-modal" role="dialog" aria-modal="true" aria-label="Mehrfachöffnung läuft">
   <div className="eyebrow">CASE RUSH / MULTI OPEN</div>
   <h2>{drops.length} KISTEN <em>ÖFFNEN.</em></h2>
   <p>Jede Kiste rotiert einzeln. Die goldene Linie markiert den Gewinn.</p>
   <div className="multi-reel-scroller">
    {drops.map((drop,index)=><ReelRow
     key={drop.inventoryId} winner={drop.item} pool={pool} index={index}
     reducedMotion={reducedMotion} finish={finishLane}
    />)}
   </div>
   <div className="reel-actions">
    <span>Gewinne bereits serverseitig festgelegt · alle Werte virtuell</span>
    <button className="secondary" type="button" onClick={finishAll}>ALLE ANIMATIONEN ÜBERSPRINGEN</button>
   </div>
  </section>
 </div>;
}
