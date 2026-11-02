'use client';

import {useEffect,useMemo,useRef,useState} from 'react';

/** Presentation only: the winning item comes exclusively from the server. */
export type SpinWeapon={
 id?:string;name?:string;rarity?:string;value:number;weight?:number;imageUrl?:string|null
};
const COLORS:Record<string,string>={
 COMMON:'#b0b5bc',UNCOMMON:'#499eee',RARE:'#9270e5',
 EPIC:'#dc60b5',LEGENDARY:'#de4c4e',KNIFE:'#d7a13e'
};
const TOTAL_SLOTS=59;
const WIN_SLOT=50;
const START_SLOT=2;
const format=(n:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n/100);

export default function CaseSpinTrack({winner,pool,onComplete,duration=6450,reducedMotion=false,compact=false,ariaLabel}:{
 winner:SpinWeapon;pool:SpinWeapon[];onComplete:()=>void;
 duration?:number;reducedMotion?:boolean;compact?:boolean;ariaLabel?:string
}){
 const stage=useRef<HTMLDivElement>(null);
 const track=useRef<HTMLDivElement>(null);
 const callback=useRef(onComplete);
 const done=useRef(false);
 const [landed,setLanded]=useState(false);
 callback.current=onComplete;
 const strip=useMemo(()=>{
  const available=pool.filter(item=>(item.weight??0)>0&&item.value>=1&&!!item.imageUrl);
  const total=available.reduce((sum,item)=>sum+(item.weight??0),0);
  function randomWeapon(){
   if(!total)return winner;
   let r=Math.random()*total;
   for(const item of available){r-=item.weight??0;if(r<0)return item}
   return available[available.length-1];
  }
  return Array.from({length:TOTAL_SLOTS},(_,i)=>i===WIN_SLOT?winner:randomWeapon());
 },[winner,pool]);
 const finish=()=>{
  if(done.current)return;
  done.current=true;
  callback.current();
 };
 useEffect(()=>{
  if(reducedMotion){finish();return}
  const viewport=stage.current,el=track.current;
  if(!viewport||!el)return;
  const tile=el.querySelector<HTMLElement>('.cr-spin-card');
  if(!tile)return;
  const width=tile.offsetWidth||152;
  const gap=parseFloat(window.getComputedStyle(el).columnGap)||12;
  const position=(index:number)=>viewport.clientWidth/2-width/2-index*(width+gap);
  const start=position(START_SLOT);
  // The mark stays inside the winning tile, without always stopping dead-center.
  const stop=position(WIN_SLOT)+(Math.random()-.5)*width*.28;
  const distance=stop-start;
  el.style.transform='translate3d('+start+'px,0,0)';
  let release=0;
  let timeout=0;
  let animation:Animation|null=null;
  let raf=0;
  const begin=()=>{
   animation=el.animate([
    {offset:0,transform:'translate3d('+start+'px,0,0)',easing:'cubic-bezier(.45,0,.75,1)'},
    {offset:.12,transform:'translate3d('+(start+distance*.085)+'px,0,0)',easing:'linear'},
    {offset:.43,transform:'translate3d('+(start+distance*.58)+'px,0,0)',easing:'cubic-bezier(.25,.15,.23,1)'},
    {offset:.74,transform:'translate3d('+(start+distance*.90)+'px,0,0)',easing:'cubic-bezier(.2,.05,.17,1)'},
    {offset:.92,transform:'translate3d('+(start+distance*.986)+'px,0,0)',easing:'ease-out'},
    {offset:1,transform:'translate3d('+stop+'px,0,0)'}
   ],{duration,fill:'forwards'});
   animation.onfinish=()=>{
    setLanded(true);
    release=window.setTimeout(finish,950);
   };
   timeout=window.setTimeout(finish,duration+1600);
  };
  raf=requestAnimationFrame(begin);
  return()=>{
   cancelAnimationFrame(raf);
   if(animation){animation.onfinish=null;animation.cancel()}
   window.clearTimeout(release);
   window.clearTimeout(timeout);
  };
 },[duration,reducedMotion]);
 return <div className={'cr-spin-window'+(compact?' cr-spin-compact':'')+(landed?' cr-spin-landed':'')} ref={stage}
  aria-label={ariaLabel||'Kistenöffnung – Waffen laufen unter der Gewinnmarkierung durch'}>
   <div className="cr-spin-top-label">CASE RUSH / UNBOXING</div>
   <div className="cr-spin-pointer" aria-hidden="true"><span/><span/></div>
   <div className="cr-spin-track" ref={track}>
    {strip.map((item,i)=><div className={'cr-spin-card'+(i===WIN_SLOT?' cr-spin-winning':'')} key={i}
     style={{borderBottomColor:COLORS[item.rarity??'']||COLORS.COMMON}}>
     <div className="cr-spin-item-art">{item.imageUrl?<img src={item.imageUrl} alt="" draggable={false} decoding="async"/>:<span>✦</span>}</div>
     <strong title={item.name||''}>{item.name||'Skin'}</strong>
     <small>{format(item.value)}</small>
    </div>)}
   </div>
   {landed&&<div className="cr-spin-landing-label" aria-live="polite">DROP ERMITTELT</div>}
 </div>;
}
