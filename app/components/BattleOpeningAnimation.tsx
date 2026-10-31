'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
type Weapon={id?:string;name?:string;rarity?:string;value:number;weight?:number;imageUrl?:string|null};
export type BattleRoundVisual={
 case:{id:string;name:string;price:number;imageUrl?:string|null}|null;
 creatorDrop:Weapon|null;guestDrop:Weapon|null;creatorPartnerDrop?:Weapon|null;guestPartnerDrop?:Weapon|null;position:number;pool?:Weapon[]
};
const euro=(n:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n/100);
const colors:Record<string,string>={COMMON:'#a4acb8',UNCOMMON:'#4aa8fc',RARE:'#a879ff',EPIC:'#ee6dd9',LEGENDARY:'#ff5c68',KNIFE:'#ffc253'};
const STEP=152, GAP=10, END=5, START=33, DURATION=3800;
/** Cosmetic animation only. Never re-rolls or edits server-side outcomes. */
function SpinLane({winner,pool,name,onDone}:{
 winner:Weapon;pool:Weapon[];name:string;onDone:()=>void
}){
 const track=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null);
 const done=useRef(false),doneCallback=useRef(onDone);
 doneCallback.current=onDone;
 const cards=useMemo(()=>{
  const available=pool.filter(p=>(p.weight??0)>0);
  const total=available.reduce((s,x)=>s+(x.weight??0),0);
  const pick=()=>{
   if(!total)return winner;
   let n=Math.random()*total;
   for(const item of available){n-=item.weight??0;if(n<0)return item}
   return available[available.length-1];
  };
  return Array.from({length:40},(_,i)=>i===END?winner:pick());
 },[winner,pool]);
 const finish=()=>{if(!done.current){done.current=true;doneCallback.current()}};
 useEffect(()=>{
  const el=track.current,stage=viewport.current;
  if(!el||!stage)return;
  const position=(index:number)=>stage.clientWidth/2-STEP/2-index*(STEP+GAP);
  el.style.transition='none';
  el.style.transform='translate3d('+position(START)+'px,0,0)';
  let raf2=0;
  const raf1=requestAnimationFrame(()=>{
   raf2=requestAnimationFrame(()=>{
    el.style.transition='transform '+DURATION+'ms cubic-bezier(.10,.68,.16,1)';
    el.style.transform='translate3d('+position(END)+'px,0,0)';
   });
  });
  const timeout=setTimeout(finish,DURATION+240);
  return()=>{cancelAnimationFrame(raf1);cancelAnimationFrame(raf2);clearTimeout(timeout)};
 },[]);
 return <div className="battle-spin-lane">
  <div className="battle-spin-person">{name}</div>
  <div className="battle-spin-window" ref={viewport}>
   <div className="battle-spin-line" aria-hidden="true"/>
   <div className="battle-spin-track" ref={track} onTransitionEnd={e=>{
    if(e.target===track.current&&e.propertyName==='transform')finish();
   }}>
    {cards.map((weapon,i)=><div className="battle-spin-card" key={i} style={{
     borderBottomColor:colors[weapon.rarity??'']??'#a4acb8'
    }}>
     {weapon.imageUrl?<img src={weapon.imageUrl} alt="" draggable={false}/>:<span>✦</span>}
     <strong>{weapon.name}</strong>
     <small>{euro(weapon.value)} virtuell</small>
    </div>)}
   </div>
  </div>
 </div>;
}
export default function BattleOpeningAnimation({rounds,participants,onFinish}:{
 rounds:BattleRoundVisual[];
 participants:{creator:string;guest:string;creatorPartner?:string|null;guestPartner?:string|null};
 onFinish:()=>void
}){
 const [index,setIndex]=useState(0);
 const completed=useRef(new Set<string>());
 const current=rounds[index];
 const end=useRef(onFinish);
 end.current=onFinish;
 const mark=(role:string)=>{
  const key=index+':'+role;
  if(completed.current.has(key))return;
  completed.current.add(key);
  const expected=current.creatorPartnerDrop&&current.guestPartnerDrop?
   ['creator','creatorPartner','guest','guestPartner']:['creator','guest'];
  if(expected.every(seat=>completed.current.has(index+':'+seat))){
   if(index+1<rounds.length)setIndex(i=>i+1);
   else end.current();
  }
 };
 if(!current?.creatorDrop||!current?.guestDrop)return null;
 // Each source case has a distinct pool, passed from the game catalog where possible.
 const pool=current.pool??[];
 return <div className="overlay battle-spin-overlay">
  <section className="battle-spin-modal" aria-label="Case Battle Rotationsanimation" role="dialog" aria-modal="true">
   <div className="eyebrow">CASE RUSH · BATTLE OPENING</div>
   <h2>RUNDE {index+1} <em>/ {rounds.length}</em></h2>
   <p>{current.case?.name??'Kiste'} · {current.creatorPartnerDrop?'Team A gegen Team B – vier Spieler öffnen':'beide Spieler öffnen'} dieselbe Kiste</p>
   <div className="battle-spin-pair">
    <SpinLane key={index+'-creator'} winner={current.creatorDrop} pool={pool} name={participants.creator}
     onDone={()=>mark('creator')}/>
    {current.creatorPartnerDrop&&<SpinLane key={index+'-creatorPartner'} winner={current.creatorPartnerDrop} pool={pool}
     name={participants.creatorPartner??'Team A · 2'} onDone={()=>mark('creatorPartner')}/>}
    <SpinLane key={index+'-guest'} winner={current.guestDrop} pool={pool} name={participants.guest}
     onDone={()=>mark('guest')}/>
    {current.guestPartnerDrop&&<SpinLane key={index+'-guestPartner'} winner={current.guestPartnerDrop} pool={pool}
     name={participants.guestPartner??'Team B · 2'} onDone={()=>mark('guestPartner')}/>}
   </div>
   <div className="battle-spin-foot">
    <span>Gewinne wurden bereits serverseitig gezogen. Animation verändert keine Chancen.</span>
    <button className="secondary" onClick={()=>end.current()}>ALLE ANIMATIONEN ÜBERSPRINGEN</button>
   </div>
  </section>
 </div>;
}
