'use client';
import {useEffect,useRef,useState} from 'react';

type EventInfo={id:string;discountPercent:number;luckMultiplier:number;startsAt:string;endsAt:string};
const countdown=(ms:number)=>{
 const n=Math.max(0,Math.ceil(ms/1000));
 const hours=Math.floor(n/3600),minutes=Math.floor(n%3600/60),seconds=n%60;
 return (hours?hours+':':'')+String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0');
};
export default function EventBanner(){
 const [event,setEvent]=useState<EventInfo|null>(null);
 const [now,setNow]=useState(Date.now());
 const previous=useRef<string|null>(null);
 useEffect(()=>{
  let mounted=true;
  const update=async()=>{
   try{
    const res=await fetch('/api/game?action=event',{cache:'no-store'});
    if(!res.ok)return;
    const json=await res.json() as {event:EventInfo|null};
    if(!mounted)return;
    const next=json.event;
    const identity=next?next.endsAt+':'+next.discountPercent+':'+next.luckMultiplier:null;
    if(previous.current!==identity){
     previous.current=identity;
     setEvent(next);
     window.dispatchEvent(new Event('cr-event-updated'));
    }
   }catch{/* leave last fetched event; local countdown still expires */}
  };
  void update();
  const poll=window.setInterval(()=>void update(),5000);
  const tick=window.setInterval(()=>setNow(Date.now()),1000);
  return()=>{mounted=false;clearInterval(poll);clearInterval(tick)};
 },[]);
 if(!event||new Date(event.endsAt).getTime()<=now)return null;
 const discount=event.discountPercent>0;
 const boosted=event.luckMultiplier>100;
 return <div className="cr-event-banner" role="status" aria-live="off">
  <span className="cr-event-live"><span className="cr-event-dot"/> LIVE EVENT</span>
  <span className="cr-event-title">
   {discount&&<b>−{event.discountPercent}% KISTEN-RABATT</b>}
   {discount&&boosted&&<span className="cr-event-plus">+</span>}
   {boosted&&<b>{(event.luckMultiplier/100).toLocaleString('de-DE')}× LUCK</b>}
  </span>
  <span className="cr-event-end">ENDET IN <strong>{countdown(new Date(event.endsAt).getTime()-now)}</strong></span>
 </div>;
}
