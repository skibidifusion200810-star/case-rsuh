'use client';
import {useEffect,useState} from 'react';

type Card={id:string;itemId:string;name:string;rarity:string;imageUrl:string|null;value:number;mergedCount:number};
type Offer={id:string;sender:string;recipient:string;direction:'sent'|'received';status:string;offered:Card[];requested:Card[];createdAt:string};
type Data={mine:Card[];recipient:string|null;target:Card[];offers:Offer[]};
const eur=(v:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(v/100);
export default function TradingHub(){
 const [data,setData]=useState<Data|null>(null);
 const [name,setName]=useState('');
 const [searched,setSearched]=useState('');
 const [offered,setOffered]=useState<string[]>([]);
 const [requested,setRequested]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [refreshTick,setRefreshTick]=useState(0);
 const refresh=async(target=searched)=>{
 try{
 const response=await fetch('/api/trades'+(target?'?recipient='+encodeURIComponent(target):''),{cache:'no-store'});
 const json=await response.json();
 if(!response.ok)throw Error(json.error||'Handel momentan nicht erreichbar');
 setData(json);
 setError('');
 }catch(e){setError(e instanceof Error?e.message:'Verbindungsfehler')}
 };
 useEffect(()=>{void refresh()},[refreshTick]);
 useEffect(()=>{
 const timer=window.setInterval(()=>{void refresh()},12000);
 return()=>window.clearInterval(timer);
 },[searched]);
 function toggle(ids:string[],setter:(v:string[])=>void,id:string,max=5){
 if(ids.includes(id))setter(ids.filter(s=>s!==id));
 else if(ids.length<max)setter([...ids,id]);
 }
 async function submit(path:string,payload:Record<string,unknown>,success:string){
 setBusy(true);setError('');setNotice('');
 try{
 const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'Aktion fehlgeschlagen');
 setNotice(success);
 setOffered([]);setRequested([]);
 setRefreshTick(x=>x+1);
 window.dispatchEvent(new Event('cr-balance-changed'));
 }catch(e){setError(e instanceof Error?e.message:'Fehler')}
 finally{setBusy(false)}
 }
 const pick=(card:Card,ids:string[],setter:(v:string[])=>void,max=5)=>(
 <button type="button" key={card.id} className={'trade-item '+(ids.includes(card.id)?'picked':'')}
 onClick={()=>toggle(ids,setter,card.id,max)}>
 {card.imageUrl?<img src={card.imageUrl} alt="" loading="lazy"/>:<span className="trade-art-empty">✦</span>}
 <strong>{card.name}</strong>
 <span>{eur(card.value)}{card.mergedCount>1?' · MERGE ×'+card.mergedCount:''}</span>
 <small>{ids.includes(card.id)?'✓ AUSGEWÄHLT':'AUSWÄHLEN'}</small>
 </button>);
 return <section className="trading-hub">
 <div className="eyebrow">PLAYER ECONOMY / TRADING</div>
 <h2>SKIN <em>TRADING.</em></h2>
 <p className="trading-lead">Tausche Skins sicher mit anderen Spielern. Duplikate kannst du direkt im Inventar mergen. Alle Werte sind Spielwerte.</p>
 {error&&<p className="trading-error" role="alert">{error}</p>}
 {notice&&<p className="trading-notice" role="status">{notice}</p>}
 {!data?<div className="trading-empty">Bitte anmelden, um Skins zu tauschen und zu mergen.</div>:
 <>
 <div className="trading-recipient">
 <div><label htmlFor="trade-person">MIT WEM WILLST DU TRADEN?</label><p>Gib den exakten Nutzernamen ein, um dessen handelbare Skins zu sehen.</p></div>
 <form onSubmit={e=>{e.preventDefault();setSearched(name.trim());setOffered([]);setRequested([]);setRefreshTick(n=>n+1)}}>
 <input id="trade-person" value={name} placeholder="Benutzername" onChange={e=>setName(e.target.value)}
 minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required/>
 <button className="primary">SPIELER SUCHEN ↗</button>
 </form>
 </div>
 <div className="trading-compare">
 <div className="trading-column"><div className="trading-section-title"><h3>DEIN ANGEBOT</h3><span>{offered.length}/5 ITEMS</span></div>
 <p>Aus deinem Inventar. Beim Erstellen gesperrt, bis der Trade abgeschlossen oder abgebrochen wird.</p>
 <div className="trading-item-grid">{(data.mine??[]).map(c=>pick(c,offered,setOffered))}</div>
 </div>
 <div className="trading-column"><div className="trading-section-title"><h3>{data.recipient??'GEGENSPIELER'}</h3><span>{requested.length}/5 ITEMS</span></div>
 <p>Wähle die Items, die du im Gegenzug erhalten möchtest.</p>
 <div className="trading-item-grid">{(data.target??[]).map(c=>pick(c,requested,setRequested))}</div>
 </div>
 </div>
 <div className="trading-actions">
 <div><span>DEIN ANGEBOT</span><strong>{eur(offered.reduce((sum,id)=>sum+(data.mine.find(i=>i.id===id)?.value??0),0))}</strong>
 <span>GEWÜNSCHT</span><strong>{eur(requested.reduce((sum,id)=>sum+(data.target.find(i=>i.id===id)?.value??0),0))}</strong></div>
 <button className="primary" disabled={busy||!data.recipient||!offered.length} onClick={()=>void submit('/api/trades',{
 action:'create',recipient:data.recipient,offered,requested
 },'Trade-Angebot gesendet. Die angebotenen Items sind reserviert.')}>TRADE ANGEBOT SENDEN ↗</button>
 </div>
 <div className="trading-section-title"><h3>DEINE HANDELSANGEBOTE</h3><span>{data.offers.length} LETZTE</span></div>
 <div className="trading-offers">
 {data.offers.length===0?<div className="trading-empty">Du hast noch keine Trade-Angebote.</div>:
 data.offers.map(offer=><article className="trading-offer" key={offer.id}>
 <div className="trading-offer-head">
 <div><strong>{offer.direction==='received'?'ANGEBOT VON '+offer.sender:'AN '+offer.recipient}</strong><small>{new Date(offer.createdAt).toLocaleString('de-DE')}</small></div>
 <span className={'trade-state '+offer.status.toLowerCase()}>{offer.status==='PENDING'?'OFFEN':offer.status==='ACCEPTED'?'ABGESCHLOSSEN':offer.status==='DECLINED'?'ABGELEHNT':'ABGEBROCHEN'}</span>
 </div>
 <div className="trading-offer-items">
 <span>{offer.sender}: {offer.offered.map(i=>i.name).join(' + ')||'—'}</span>
 <span>↔</span>
 <span>{offer.recipient}: {offer.requested.map(i=>i.name).join(' + ')||'Keine Gegenleistung'}</span>
 </div>
 {offer.status==='PENDING'&&<div className="trading-offer-buttons">
 {offer.direction==='received'?<>
 <button className="primary" disabled={busy} onClick={()=>void submit('/api/trades',{action:'accept',offerId:offer.id},'Trade angenommen! Deine Items wurden ausgetauscht.')}>ANNEHMEN</button>
 <button className="secondary" disabled={busy} onClick={()=>void submit('/api/trades',{action:'decline',offerId:offer.id},'Trade abgelehnt.')}>ABLEHNEN</button>
 </>:<button className="secondary" disabled={busy} onClick={()=>void submit('/api/trades',{action:'cancel',offerId:offer.id},'Trade abgebrochen. Deine Items sind wieder frei.')}>ZURÜCKZIEHEN</button>}
 </div>}
 </article>)}
 </div>
 </>}

 </section>;
}
