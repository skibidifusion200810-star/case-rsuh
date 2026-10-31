'use client';
import {useEffect,useMemo,useRef} from 'react';

type ReelItem={id:string;name:string;rarity:string;imageUrl?:string|null};
type Props={winner:ReelItem;pool:ReelItem[];reducedMotion:boolean;onFinish:()=>void};
const rarity:Record<string,string>={COMMON:'#9ca3af',UNCOMMON:'#44a1ff',RARE:'#9b71ff',EPIC:'#f36ad4',LEGENDARY:'#fa5260',KNIFE:'#e9b147'};
const WIN_INDEX=4;
const START_INDEX=40;
const WIDTH=152;
const GAP=12;
const DURATION=6200;

/** Visual reel only: the server has already committed the real winning item. */
export default function OpeningReel({winner,pool,reducedMotion,onFinish}:Props){
 const viewport=useRef<HTMLDivElement>(null);
 const track=useRef<HTMLDivElement>(null);
 const finished=useRef(false);
 const finishHandler=useRef(onFinish);
 finishHandler.current=onFinish;
 const slots=useMemo(()=>{
  const choices=pool.length?pool:[winner];
  return Array.from({length:46},(_,i)=>i===WIN_INDEX?winner:
   choices[(i*17+Math.floor(Math.random()*choices.length))%choices.length]);
 },[winner,pool]);
 const finish=()=>{
  if(finished.current)return;
  finished.current=true;
  finishHandler.current();
 };
 useEffect(()=>{
  if(reducedMotion){finish();return}
  const el=track.current,stage=viewport.current;
  if(!el||!stage)return;
  const align=(index:number)=>stage.getBoundingClientRect().width/2-WIDTH/2-index*(WIDTH+GAP);
  el.style.transition='none';
  el.style.transform='translate3d('+align(START_INDEX)+'px,0,0)';
  let secondFrame=0;
  const firstFrame=requestAnimationFrame(()=>{
   secondFrame=requestAnimationFrame(()=>{
    el.style.transition='transform '+DURATION+'ms cubic-bezier(0.08,0.70,0.15,1)';
    el.style.transform='translate3d('+align(WIN_INDEX)+'px,0,0)';
   });
  });
  const timeout=window.setTimeout(finish,DURATION+120);
  return()=>{cancelAnimationFrame(firstFrame);cancelAnimationFrame(secondFrame);clearTimeout(timeout)};
 },[reducedMotion]);
 return <div className="overlay reel-overlay">
  <section className="reel-modal" role="dialog" aria-label="Kistenöffnung läuft" aria-modal="true">
   <div className="eyebrow">CASE RUSH / OPENING</div>
   <h2>KISTE WIRD <em>GEÖFFNET</em></h2>
   <p>Die Waffen bewegen sich nach rechts. Der Gewinn wurde bereits vor Beginn vom Server bestimmt.</p>
   <div className="reel-viewport" ref={viewport}>
    <div className="reel-pointer" aria-hidden="true"><span>▼</span><span>▲</span></div>
    <div className="reel-track" ref={track} onTransitionEnd={finish}>
     {slots.map((item,i)=><div className="reel-tile" key={i} style={{borderBottomColor:rarity[item.rarity]??'#a0a0a0'}}>
      {item.imageUrl?<img src={item.imageUrl} alt="" draggable={false}/>:<span className="reel-no-image">✦</span>}
      <strong>{item.name}</strong>
      <small>{item.rarity}</small>
     </div>)}
    </div>
   </div>
   <div className="reel-actions">
    <span>Nur Animation · kein Einfluss auf die Gewinnchance</span>
    <button type="button" className="secondary" onClick={finish}>ANIMATION ÜBERSPRINGEN</button>
   </div>
  </section>
 </div>
}