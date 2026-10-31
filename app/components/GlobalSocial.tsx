'use client';

import {useEffect,useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';

type RareDrop={id:string;username:string;itemName:string;rarity:string;value:number;imageUrl?:string|null;createdAt:string;source:string};
type ChatRow={id:string;username:string;body:string;createdAt:string};
type GiftLog={id:string;recipient:string;amount:number;createdAt:string};
type Wallet={username:string;balance:number;nextAt:string|null;transfers:GiftLog[]};
const euro=(cents:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(cents/100);
function parseEuroAmount(text:string):number|null{
 const match=text.trim().match(/^(\d{1,5})(?:[.,](\d{1,2}))?$/);
 if(!match)return null;
 const value=Number(match[1])*100+Number((match[2]??'').padEnd(2,'0'));
 return Number.isSafeInteger(value)&&value>=1&&value<=200000?value:null;
}
export default function GlobalSocial(){
 const [drop,setDrop]=useState<RareDrop|null>(null);
 const [open,setOpen]=useState(false);
 const [tab,setTab]=useState<'chat'|'gift'>('chat');
 const [messages,setMessages]=useState<ChatRow[]>([]);
 const [chatText,setChatText]=useState('');
 const [wallet,setWallet]=useState<Wallet|null>(null);
 const [chatError,setChatError]=useState('');
 const [giftError,setGiftError]=useState('');
 const [giftSuccess,setGiftSuccess]=useState('');
 const [receiver,setReceiver]=useState('');
 const [amount,setAmount]=useState('');
 const [chatSending,setChatSending]=useState(false);
 const [giftSending,setGiftSending]=useState(false);
 const [loading,setLoading]=useState(true);
 const latestDropId=useRef<string|null>(null);
 const initialized=useRef(false);
 const alertTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const chatEnd=useRef<HTMLDivElement>(null);
 const refreshDrops=async()=>{
  try{
   const r=await fetch('/api/social?feed=drops',{cache:'no-store'});
   if(!r.ok)return;
   const j=await r.json() as {events:RareDrop[]};
   const recent=j.events?.[0];
   if(!recent)return;
   if(!initialized.current){
    initialized.current=true;
    latestDropId.current=recent.id;
    if(Date.now()-new Date(recent.createdAt).getTime()>120000)return;
   }else if(recent.id===latestDropId.current)return;
   latestDropId.current=recent.id;
   setDrop(recent);
   if(alertTimer.current)clearTimeout(alertTimer.current);
   alertTimer.current=setTimeout(()=>setDrop(null),14000);
  }catch{/* Drop feed should never interrupt the game. */}
 };
 const refreshChat=async()=>{
  try{
   const r=await fetch('/api/social?feed=chat',{cache:'no-store'});
   if(!r.ok)throw Error('Chat ist gerade nicht erreichbar.');
   const j=await r.json() as {messages:ChatRow[]};
   setMessages(j.messages??[]);
   setChatError('');
  }catch(e){setChatError(e instanceof Error?e.message:'Chat-Fehler')}
  finally{setLoading(false)}
 };
 const refreshWallet=async()=>{
  try{
   const r=await fetch('/api/social?feed=wallet',{cache:'no-store'});
   if(r.status===401){setWallet(null);return}
   if(!r.ok)throw Error('Überweisungsdaten momentan nicht verfügbar.');
   const j=await r.json() as Wallet;
   setWallet(j);
   setGiftError('');
  }catch(e){setGiftError(e instanceof Error?e.message:'Verbindungsfehler')}
 };
 useEffect(()=>{
  void refreshDrops();
  const id=setInterval(()=>void refreshDrops(),5000);
  const openChat=()=>{setOpen(true);setTab('chat')};
  const openGift=()=>{setOpen(true);setTab('gift')};
  const openAdmin=(e:KeyboardEvent)=>{
   if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='a'){
    e.preventDefault();window.location.assign('/admin');
   }
  };
  window.addEventListener('keydown',openAdmin);
  window.addEventListener('cr-open-chat',openChat);
  window.addEventListener('cr-open-gift',openGift);
  return()=>{
   clearInterval(id);
   if(alertTimer.current)clearTimeout(alertTimer.current);
   window.removeEventListener('cr-open-chat',openChat);
   window.removeEventListener('cr-open-gift',openGift);
   window.removeEventListener('keydown',openAdmin);
  };
 },[]);
 useEffect(()=>{
  if(!open)return;
  void refreshChat();
  void refreshWallet();
  const id=setInterval(()=>{
   if(tab==='chat')void refreshChat();
   if(tab==='gift')void refreshWallet();
  },tab==='chat'?2500:12000);
  return()=>clearInterval(id);
 },[open,tab]);
 useEffect(()=>{if(open&&tab==='chat')chatEnd.current?.scrollIntoView({block:'end',behavior:'smooth'})},[messages.length,open,tab]);
 async function sendChat(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(chatSending)return;
  const msg=chatText.trim();
  if(!msg)return;
  setChatSending(true);setChatError('');
  try{
   const r=await fetch('/api/social',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'chat',message:msg})});
   const j=await r.json();
   if(!r.ok)throw Error(j.error||'Nachricht fehlgeschlagen');
   setChatText('');
   await refreshChat();
  }catch(e){setChatError(e instanceof Error?e.message:'Nachricht fehlgeschlagen')}
  finally{setChatSending(false)}
 }
 async function sendGift(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(giftSending)return;
  const amountCents=parseEuroAmount(amount);
  if(amountCents===null){setGiftError('Betrag zwischen 0,01 € und 2.000 € angeben.');return}
  if(!window.confirm('Wirklich '+euro(amountCents)+' virtuelles Guthaben an '+receiver+' senden? Nur eine Überweisung alle 24 Stunden.'))return;
  setGiftSending(true);setGiftError('');setGiftSuccess('');
  try{
   const r=await fetch('/api/social',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'gift',recipient:receiver.trim(),amountCents})});
   const j=await r.json();
   if(!r.ok)throw Error(j.error||'Überweisung fehlgeschlagen');
   setGiftSuccess(euro(amountCents)+' an '+j.transfer.recipient+' gesendet.');
   setReceiver('');setAmount('');
   await refreshWallet();
   window.dispatchEvent(new Event('cr-balance-changed'));
  }catch(e){setGiftError(e instanceof Error?e.message:'Überweisung fehlgeschlagen')}
  finally{setGiftSending(false)}
 }
 const nextAt=wallet?.nextAt?new Date(wallet.nextAt):null;
 const waiting=nextAt!==null&&nextAt.getTime()>Date.now();
 return <>
  {drop&&<div className="cr-drop-alert" role="status" aria-live="polite">
   <div className="cr-drop-ping"><span>✦</span> GLOBALER RARE DROP</div>
   {drop.imageUrl&&<img src={drop.imageUrl} alt="" referrerPolicy="no-referrer"/>}
   <div className="cr-drop-message"><strong>{drop.username}</strong> hat <b>{drop.itemName}</b> gezogen!
    <small>{euro(drop.value)} virtuell · {drop.source==='BATTLE'?'Case Battle':'Kistenöffnung'}</small></div>
   <button aria-label="Benachrichtigung schließen" onClick={()=>setDrop(null)}>✕</button>
  </div>}
  <div className="cr-social-triggers">
   <button className="cr-social-launch" onClick={()=>{setOpen(true);setTab('chat')}} aria-label="Live-Chat öffnen">
    <span className="cr-social-active"/> <span>LIVE CHAT</span> <b>↗</b>
   </button>
   <button className="cr-social-gift-launch" onClick={()=>{setOpen(true);setTab('gift')}} aria-label="Virtuelles Geld senden">€ <span>SENDEN</span></button>
  </div>
  {open&&<div className="cr-social-layer" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
   <aside className="cr-social-panel" role="dialog" aria-label="CASE RUSH Community" aria-modal="true">
    <div className="cr-social-header">
     <div><span className="cr-social-overline">CASE RUSH / COMMUNITY</span><h2>COMMUNITY<span>.</span></h2></div>
     <button className="cr-social-close" onClick={()=>setOpen(false)} aria-label="Schließen">✕</button>
    </div>
    <div className="cr-social-tabs" role="tablist">
     <button role="tab" aria-selected={tab==='chat'} className={tab==='chat'?'active':''} onClick={()=>setTab('chat')}>◉ GLOBAL CHAT</button>
     <button role="tab" aria-selected={tab==='gift'} className={tab==='gift'?'active':''} onClick={()=>setTab('gift')}>€ GELD SENDEN</button>
    </div>
    {tab==='chat'?<>
     <div className="cr-chat-info"><span className="cr-social-active"/> CHAT · AKTUALISIERUNG ALLE 2,5 SEKUNDEN <small>Öffentlich</small></div>
     <div className="cr-chat-messages" aria-live="off">
      {loading?<p>Chat wird geladen …</p>:messages.length===0?<p>Noch keine Nachrichten. Sei der Erste!</p>:
       messages.map(m=><div className="cr-chat-line" key={m.id}>
        <div className="cr-chat-avatar" aria-hidden="true">{m.username[0]?.toUpperCase()}</div>
        <div><div className="cr-chat-line-head"><strong>{m.username}</strong><time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</time></div>
         <p>{m.body}</p></div>
       </div>)}
      <div ref={chatEnd}/>
     </div>
     {chatError&&<div className="cr-social-error" role="alert">{chatError}</div>}
     <form className="cr-chat-form" onSubmit={e=>void sendChat(e)}>
      <label htmlFor="cr-chat-input">DEINE NACHRICHT</label>
      <div><input id="cr-chat-input" value={chatText} onChange={e=>setChatText(e.target.value)} maxLength={280}
       placeholder="Nachricht an alle Spieler …" aria-label="Chat-Nachricht"/>
       <button disabled={chatSending||!chatText.trim()} type="submit">{chatSending?'…':'SENDEN ↗'}</button></div>
      <small>Max. 280 Zeichen · 3 Sekunden Pause · Keine privaten Daten posten</small>
     </form>
    </>:<>
     <div className="cr-gift-intro">
      <span className="cr-social-overline">VIRTUELLER TRANSFER</span>
      <h3>GUTHABEN<br/><em>VERSCHENKEN.</em></h3>
      <p>Schicke einem anderen registrierten Spieler virtuelles Guthaben. Ein Transfer alle 24 Stunden, maximal 2.000 € pro Transfer. Kein Echtgeld.</p>
     </div>
     {wallet?<div className="cr-wallet-summary"><span>DEIN GUTHABEN</span><strong>{euro(wallet.balance)}</strong>
      <small>{waiting?'Nächste Überweisung: '+nextAt!.toLocaleString('de-DE'):'Du kannst jetzt Guthaben verschicken.'}</small></div>:
      <div className="cr-social-signin">Melde dich an, um Geld zu versenden. <Link href="/cases?auth=login" onClick={()=>setOpen(false)}>ZUM LOGIN ↗</Link></div>}
     <form className="cr-gift-form" onSubmit={e=>void sendGift(e)}>
      <label htmlFor="cr-gift-to">EMPFÄNGER (BENUTZERNAME)</label>
      <input id="cr-gift-to" value={receiver} onChange={e=>setReceiver(e.target.value)}
       minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" placeholder="Benutzername" required/>
      <label htmlFor="cr-gift-amount">BETRAG IN VIRTUELLEN EURO</label>
      <input id="cr-gift-amount" inputMode="decimal" value={amount}
       onChange={e=>setAmount(e.target.value)} placeholder="z. B. 25,00" required/>
      {giftError&&<div className="cr-social-error" role="alert">{giftError}</div>}
      {giftSuccess&&<div className="cr-social-success" role="status">{giftSuccess}</div>}
      <button className="cr-gift-submit" disabled={!wallet||waiting||giftSending||!receiver.trim()||!amount.trim()}>
       {giftSending?'WIRD GESENDET …':waiting?'24H-SPERRE AKTIV':'GUTHABEN SENDEN ↗'}
      </button>
     </form>
     {wallet&&wallet.transfers.length>0&&<div className="cr-gift-history">
      <h4>LETZTE ÜBERWEISUNGEN</h4>
      {wallet.transfers.map(t=><div key={t.id}><span>{t.recipient}<small>{new Date(t.createdAt).toLocaleString('de-DE')}</small></span><strong>−{euro(t.amount)}</strong></div>)}
     </div>}
    </>}
    <div className="cr-social-footer">CASE RUSH · Nur virtuelle Spielwerte · Keine Auszahlungen</div>
   </aside>
  </div>}
 </>;
}
