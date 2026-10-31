'use client';
import {useEffect,useState} from 'react';
type Announcement={id:string;message:string;expiresAt:string};
export default function LiveAnnouncements(){
 const [items,setItems]=useState<Announcement[]>([]);
 const [hidden,setHidden]=useState<string[]>([]);
 useEffect(()=>{
  let active=true;
  const sync=async()=>{
   try{
    if(document.visibilityState==='visible'){
     await fetch('/api/presence',{method:'POST',headers:{'content-type':'application/json'},body:'{}',credentials:'same-origin'});
     const r=await fetch('/api/presence',{cache:'no-store'});
     if(r.ok){const j=await r.json();if(active)setItems(j.announcements??[])}
    }
   }catch{/* Connection interruptions are tolerated. */}
  };
  void sync();
  const timer=setInterval(()=>void sync(),10000);
  const onFocus=()=>void sync();
  document.addEventListener('visibilitychange',onFocus);
  window.addEventListener('focus',onFocus);
  return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',onFocus);window.removeEventListener('focus',onFocus)};
 },[]);
 const current=items.find(x=>!hidden.includes(x.id)&&new Date(x.expiresAt).getTime()>Date.now());
 if(!current)return null;
 return <div className="cr-announcement" role="status">
  <span className="cr-announcement-label">✦ ADMIN · LIVE</span>
  <span className="cr-announcement-message">{current.message}</span>
  <button onClick={()=>setHidden(x=>[...x,current.id])} aria-label="Ankündigung schließen">✕</button>
 </div>;
}
