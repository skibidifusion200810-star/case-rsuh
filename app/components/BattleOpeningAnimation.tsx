'use client';
import {useRef,useState} from 'react';
import CaseSpinTrack,{type SpinWeapon} from './CaseSpinTrack';
type Weapon=SpinWeapon;
export type BattleRoundVisual={
 case:{id:string;name:string;price:number;imageUrl?:string|null}|null;
 creatorDrop:Weapon|null;guestDrop:Weapon|null;creatorPartnerDrop?:Weapon|null;
 guestPartnerDrop?:Weapon|null;position:number;pool?:Weapon[]
};
function SpinLane({winner,pool,name,onDone}:{
 winner:Weapon;pool:Weapon[];name:string;onDone:()=>void
}){
 return <div className="battle-spin-lane cr2-battle-lane">
  <div className="battle-spin-person">{name}</div>
  <CaseSpinTrack winner={winner} pool={pool} compact duration={5100} onComplete={onDone}/>
 </div>;
}
export default function BattleOpeningAnimation({rounds,participants,onFinish}:{
 rounds:BattleRoundVisual[];
 participants:{creator:string;guest:string;creatorPartner?:string|null;guestPartner?:string|null};
 onFinish:()=>void
}){
 const [index,setIndex]=useState(0);
 const completed=useRef(new Set<string>());
 const latest=useRef(onFinish);
 latest.current=onFinish;
 const current=rounds[index];
 if(!current?.creatorDrop||!current?.guestDrop)return null;
 const duo=!!current.creatorPartnerDrop&&!!current.guestPartnerDrop;
 const expected=duo?['creator','creatorPartner','guest','guestPartner']:['creator','guest'];
 const mark=(role:string)=>{
  const key=index+':'+role;
  if(completed.current.has(key))return;
  completed.current.add(key);
  if(expected.every(seat=>completed.current.has(index+':'+seat))){
   if(index+1<rounds.length)setIndex(i=>i+1);
   else latest.current();
  }
 };
 const pool=current.pool??[];
 return <div className="overlay battle-spin-overlay cr2-reel-overlay">
  <section className="battle-spin-modal cr2-reel-modal" aria-label="Case Battle Rotationsanimation" role="dialog" aria-modal="true">
   <div className="eyebrow">CASE RUSH / BATTLE UNBOXING</div>
   <h2>ROUND <em>{index+1} / {rounds.length}</em></h2>
   <p>{current.case?.name??'CASE RUSH'} · {duo?'2V2 BATTLE':'1V1 BATTLE'}</p>
   <div className="battle-spin-pair">
    <SpinLane key={index+'-creator'} winner={current.creatorDrop} pool={pool} name={participants.creator} onDone={()=>mark('creator')}/>
    {current.creatorPartnerDrop&&<SpinLane key={index+'-creatorPartner'} winner={current.creatorPartnerDrop}
     pool={pool} name={participants.creatorPartner??'TEAM A · 2'} onDone={()=>mark('creatorPartner')}/>}
    <SpinLane key={index+'-guest'} winner={current.guestDrop} pool={pool} name={participants.guest} onDone={()=>mark('guest')}/>
    {current.guestPartnerDrop&&<SpinLane key={index+'-guestPartner'} winner={current.guestPartnerDrop}
     pool={pool} name={participants.guestPartner??'TEAM B · 2'} onDone={()=>mark('guestPartner')}/>}
   </div>
   <div className="battle-spin-foot">
    <span>Alle Waffen wurden vor der Animation gezogen.</span>
    <button className="secondary" type="button" onClick={()=>latest.current()}>ALLE ÜBERSPRINGEN ↗</button>
   </div>
  </section>
 </div>;
}
