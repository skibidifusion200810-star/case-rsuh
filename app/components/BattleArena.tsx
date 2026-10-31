'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import BattleOpeningAnimation, {type BattleRoundVisual} from './BattleOpeningAnimation';

type Weapon={id:string;name:string;rarity:string;value:number;weight:number;imageUrl?:string|null};
type CSCase={id:string;name:string;price:number;imageUrl?:string|null;items:Weapon[]};
type Player={username:string;coins:number};
type Drop={id?:string;name?:string;value:number;weight?:number;imageUrl?:string|null;rarity?:string};
type Round={
 position:number;caseId:string;case:CSCase|null;casePrice:number;
 creatorDrop:Drop|null;guestDrop:Drop|null;creatorPartnerDrop?:Drop|null;guestPartnerDrop?:Drop|null
};
type Battle={
 id:string;status:string;againstBot:boolean;duo:boolean;creator:string;guest:string|null;
 creatorPartner:string|null;guestPartner:string|null;creatorTeam:(string|null)[];guestTeam:(string|null)[];
 viewerRole:'creator'|'creatorPartner'|'guest'|'guestPartner'|'spectator';winner:'creator'|'guest'|null;
 case:CSCase|null;creatorDrop:Drop|null;guestDrop:Drop|null;
 totalCost:number;rounds:Round[];creatorTotal:number;guestTotal:number;awardedItemCount:number;viewerAwardCount:number;
 createdAt:string
};
const euro=(value:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value/100);
export default function BattleArena({cases,me,onChange}:{cases:CSCase[],me:Player|null,onChange:()=>Promise<void>}){
 const paidCases=cases.filter(c=>c.price>0&&c.items.length>=2);
 const [choice,setChoice]=useState('');
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const [mode,setMode]=useState<'bot'|'player'|'duo'>('bot');
 const [battles,setBattles]=useState<Battle[]>([]);
 const [current,setCurrent]=useState<Battle|null>(null);
 const currentRef=useRef<Battle|null>(null);
 const [animated,setAnimated]=useState<Battle|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [filter,setFilter]=useState<'open'|'recent'>('open');
 const [revision,setRevision]=useState(0);
 const animatedIds=useRef(new Set<string>());
 const applyCurrent=(battle:Battle,playWhenFinished=false)=>{
  const previous=currentRef.current;
  currentRef.current=battle;
  setCurrent(battle);
  const newlyCompleted=battle.status==='FINISHED' &&
   (playWhenFinished||(previous?.id===battle.id&&previous.status==='WAITING'));
  if(newlyCompleted&&!animatedIds.current.has(battle.id)){
   animatedIds.current.add(battle.id);
   setAnimated(battle);
   void onChange();
  }
 };
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const response=await fetch('/api/battles',{cache:'no-store'});
    if(!response.ok)throw Error('Battles nicht erreichbar');
    const json=await response.json() as {battles:Battle[]};
    if(!active)return;
    setBattles(json.battles);
    const open=currentRef.current;
    if(open){
     const found=json.battles.find(b=>b.id===open.id);
     if(found){
      if(found.status==='FINISHED'&&open.status==='WAITING')void onChange();
      applyCurrent(found);
     }
    }
    setError('');
   }catch(e){if(active)setError(e instanceof Error?e.message:'Verbindungsproblem')}
  };
  void load();
  const poll=window.setInterval(()=>void load(),3000);
  return()=>{active=false;window.clearInterval(poll)};
 },[revision,onChange]);
 useEffect(()=>{if(!choice&&paidCases.length)setChoice(paidCases[0].id)},[choice,paidCases.length]);
 const chosen=paidCases.find(c=>c.id===choice);
 const selected=selectedIds.map(id=>paidCases.find(c=>c.id===id)).filter((c):c is CSCase=>!!c);
 const total=selected.reduce((sum,c)=>sum+c.price,0);
 const displayed=filter==='open'?battles.filter(b=>b.status==='WAITING'&&!b.againstBot):battles;
 function addCase(){if(choice&&selectedIds.length<10)setSelectedIds(prev=>[...prev,choice])}
 function removeCase(at:number){setSelectedIds(prev=>prev.filter((_,i)=>i!==at))}
 async function action(type:'create'|'join'|'cancel',args:Record<string,unknown>){
  setLoading(true);setError('');
  try{
   const duo=args.duo===true||args.isDuo===true||typeof args.seat==='string';
   const response=await fetch(duo?'/api/duo-battles':'/api/battles',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({action:type,...args})
   });
   const json=await response.json();
   if(!response.ok)throw Error(json.error||'Battle fehlgeschlagen');
   // Always read the complete battle with participant names, rounds and the awarded inventory.
   const followup=await fetch('/api/battles?id='+encodeURIComponent(json.battle.id),{cache:'no-store'});
   const detail=await followup.json();
   if(!followup.ok)throw Error(detail.error||'Battle nicht gefunden');
   applyCurrent(detail.battle,true);
   setRevision(x=>x+1);
   if(type==='create')setSelectedIds([]);
   await onChange();
  }catch(e){setError(e instanceof Error?e.message:'Battle konnte nicht gestartet werden')}
  finally{setLoading(false)}
 }
 function show(battle:Battle){applyCurrent(battle,false)}
 const animation=useMemo(()=>{
  if(!animated)return null;
  return animated.rounds.map((round):BattleRoundVisual=>{
   const original=cases.find(c=>c.id===round.caseId);
   return {...round,pool:original?.items??[]};
  });
 },[animated,cases]);
 return <section className="battles">
  <div className="eyebrow">02 / CASE BATTLES</div>
  <h2>CASE <em>BATTLES.</em></h2>
  <p className="battle-intro">Stelle dein eigenes Battle zusammen: unterschiedliche Kisten, bis zu 10 Runden, gegen einen echten Spieler oder Bot. Beide zahlen dieselbe Gesamtsumme.</p>
  {error&&<div className="error" role="alert">{error}</div>}
  <div className="battle-create">
   <div className="battle-builder">
    <div className="eyebrow">CREATE YOUR BATTLE</div><h3>NEUES DUELL</h3>
    <label htmlFor="battle-case">KISTE HINZUFÜGEN</label>
    <div className="battle-add-row">
     <select id="battle-case" value={choice} onChange={e=>setChoice(e.target.value)}>
      {paidCases.map(c=><option value={c.id} key={c.id}>{c.name} · {euro(c.price)}</option>)}
     </select>
     <button className="primary" type="button" disabled={!chosen||selected.length>=10} onClick={addCase}>+ HINZUFÜGEN</button>
    </div>
    <div className="eyebrow battle-selected-label">DEINE KISTEN ({selected.length} / 10)</div>
    <div className="battle-selected-list">
     {selected.length===0?<div className="battle-none">Wähle eine Kiste und klicke auf „Hinzufügen“.</div>:
      selected.map((c,i)=><div className="battle-selected" key={i}>
       <span className="battle-selected-index">{String(i+1).padStart(2,'0')}</span>
       {c.imageUrl?<img src={c.imageUrl} alt="" />:null}
       <span className="battle-selected-name">{c.name}</span>
       <strong>{euro(c.price)}</strong>
       <button title="Kiste entfernen" aria-label={c.name+' entfernen'} onClick={()=>removeCase(i)}>✕</button>
      </div>)}
    </div>
    <div className="battle-total"><span>GESAMTPREIS PRO SPIELER</span><strong>{euro(total)}</strong></div>
    <div className="battle-modes">
     <button className={mode==='bot'?'active':''} onClick={()=>setMode('bot')}>GEGEN BOT</button>
     <button className={mode==='player'?'active':''} onClick={()=>setMode('player')}>1 GEGEN 1</button>
     <button className={mode==='duo'?'active':''} onClick={()=>setMode('duo')}>DUO 2V2</button>
    </div>
    <button className="primary wide" disabled={loading||!me||!selected.length||me.coins<total}
      onClick={()=>void action('create',{caseIds:selectedIds,againstBot:mode==='bot',duo:mode==='duo'})}>
     {loading?'WIRD ERSTELLT…':!me?'BITTE ANMELDEN':!selected.length?'ZUERST KISTEN HINZUFÜGEN':
     me.coins<total?'NICHT GENÜGEND GUTHABEN':'BATTLE STARTEN · '+euro(total)}
    </button>
   </div>
   <div className="battle-rules">
    <div className="eyebrow">HOW IT WORKS</div>
    <div className="battle-rule"><b>01</b><span>Wähle bis zu zehn Kisten in beliebiger Reihenfolge. Du kannst 1-€- und 2.000-€-Kisten kombinieren.</span></div>
    <div className="battle-rule"><b>02</b><span>Der Gesamtpreis ist der Einsatz je Teilnehmer. Beide öffnen dieselben Kisten mit denselben Wahrscheinlichkeiten.</span></div>
    <div className="battle-rule"><b>03</b><span>Jede Runde zeigt zwei rotierende Waffenstreifen. Die serverseitigen Gewinne stehen vorher fest.</span></div>
    <div className="battle-rule"><b>04</b><span>Im Duo-Modus treten zwei Teams mit je zwei Spielern gegeneinander an. Jeder zahlt den Gesamtpreis; beide Spieler des Gewinnerteams erhalten je zwei Items pro Runde. Offene Battles sind erstattungsfähig.</span></div>
   </div>
  </div>
  <div className="battle-list-head"><div className="eyebrow">ACTIVE ARENA</div>
   <div className="battle-filters">
    <button className={filter==='open'?'active':''} onClick={()=>setFilter('open')}>OFFEN</button>
    <button className={filter==='recent'?'active':''} onClick={()=>setFilter('recent')}>VERGANGEN</button>
   </div>
  </div>
  <div className="battle-list">
   {displayed.length===0?<p className="battle-empty">Hier gibt es noch keine Battles. Erstelle das erste Duell!</p>:
   displayed.map(b=><div className="battle-row" key={b.id}>
    <div className="battle-case-preview">{b.case?.imageUrl?<img src={b.case.imageUrl} alt=""/>:'▰'}</div>
    <div className="battle-row-name">
     <strong>{b.rounds.length} Kiste{b.rounds.length===1?'':'n'} · {b.rounds.map(r=>r.case?.name).filter(Boolean).slice(0,3).join(' + ')}{b.rounds.length>3?' …':''}</strong>
     <small>{b.duo?'DUO 2V2 · '+b.creator+' + '+(b.creatorPartner??'FREI')+' vs. '+(b.guest??'FREI')+' + '+(b.guestPartner??'FREI'):b.creator+' vs. '+(b.guest??'OFFEN')}</small>
    </div>
    <div className="battle-row-price">{euro(b.totalCost)}<small>{b.status==='WAITING'?'WARTET':b.status==='FINISHED'?'BEENDET':'ABGEBROCHEN'}</small></div>
    <button className="secondary" onClick={()=>show(b)}>ANSEHEN</button>
    {b.status==='WAITING'&&b.viewerRole==='spectator'&&me&&
     <button className="primary" disabled={loading||me.coins<b.totalCost} onClick={()=>b.duo?show(b):void action('join',{battleId:b.id})}>{b.duo?'TEAM WÄHLEN':'BEITRETEN'}</button>}
    {b.status==='WAITING'&&b.viewerRole==='creator'&&
     <button className="battle-cancel" disabled={loading} onClick={()=>void action('cancel',{battleId:b.id,isDuo:b.duo})}>ABBRECHEN</button>}
   </div>)}
  </div>
  {current&&!animated&&<div className="overlay" onClick={()=>{currentRef.current=null;setCurrent(null)}}>
   <section className="modal battle-modal" role="dialog" aria-modal="true" aria-label="Battle" onClick={e=>e.stopPropagation()}>
    <button className="x" onClick={()=>{currentRef.current=null;setCurrent(null)}}>✕</button>
    <div className="eyebrow">BATTLE #{current.id.slice(0,8).toUpperCase()}</div>
    <h2>{current.status==='WAITING'?'GEGNER GESUCHT':current.status==='CANCELED'?'ABGEBROCHEN':'BATTLE ERGEBNIS'}</h2>
    <div className="battle-breakdown">
     {current.rounds.map(r=><span key={r.position}>{r.position+1}. {r.case?.name??'Kiste'} · {euro(r.casePrice)}</span>)}
    </div>
    <p><strong>{euro(current.totalCost)}</strong> virtueller Einsatz pro Spieler {current.duo?'· DUO 2V2':''}</p>
    {current.duo&&<div className="duo-lobby">
     <div><strong>TEAM A</strong><span>{current.creator}</span><span>{current.creatorPartner??'FREIER PLATZ'}</span></div>
     <div className="duo-vs">VS</div>
     <div><strong>TEAM B</strong><span>{current.guest??'FREIER PLATZ'}</span><span>{current.guestPartner??'FREIER PLATZ'}</span></div>
    </div>}
    {current.status==='WAITING'?<>
     <p>Dein Einsatz ist reserviert. {current.duo?'Das Battle startet automatisch, sobald alle vier Plätze besetzt sind.':'Sobald ein Gegner beitritt, starten die Animationen automatisch.'} Die Lobby wird alle drei Sekunden aktualisiert.</p>
     {current.duo&&current.viewerRole==='spectator'&&me&&<div className="duo-join-buttons">
      {([{seat:'creatorPartnerId',name:'TEAM A · SPIELER 2',free:!current.creatorPartner},
         {seat:'guestId',name:'TEAM B · SPIELER 1',free:!current.guest},
         {seat:'guestPartnerId',name:'TEAM B · SPIELER 2',free:!current.guestPartner}] as const)
        .filter(x=>x.free).map(x=><button key={x.seat} className="primary" disabled={loading||me.coins<current.totalCost}
          onClick={()=>void action('join',{battleId:current.id,seat:x.seat})}>BEITRETEN · {x.name}</button>)}
     </div>}
     {current.duo&&current.viewerRole==='creator'&&<button className="secondary wide"
      disabled={loading} onClick={()=>void action('cancel',{battleId:current.id,isDuo:true})}>BATTLE ABBRECHEN · ALLE ERSTATTEN</button>}
    </>:
     current.status==='CANCELED'?<p>Der Einsatz wurde dem Ersteller zurückerstattet.</p>:
     <>
      <div className="battle-versus">
       {(['creator','guest'] as const).map(side=><div key={side}
        className={'battle-contestant '+(current.winner===side?'winner':'')}>
        <div className="battle-name">{current.duo?
         (side==='creator'?current.creator+' + '+current.creatorPartner:current.guest+' + '+current.guestPartner):
         side==='creator'?current.creator:current.guest}</div>
        <div className="battle-drop-price">{euro(side==='creator'?current.creatorTotal:current.guestTotal)}</div>
        <div className="battle-result">{current.winner===side?'GEWINNER · ALLE ITEMS':'VERLOREN'}</div>
       </div>)}
      </div>
      <div className="battle-rounds-summary">{current.rounds.map(r=><div className="battle-round-summary" key={r.position}>
       <div>RUNDE {r.position+1} · <strong>{r.case?.name}</strong></div>
       <div><span>{r.creatorDrop?.name} · {euro(r.creatorDrop?.value??0)}
        {current.duo&&<> + {r.creatorPartnerDrop?.name} · {euro(r.creatorPartnerDrop?.value??0)}</>}</span>
        <span>{r.guestDrop?.name} · {euro(r.guestDrop?.value??0)}
        {current.duo&&<> + {r.guestPartnerDrop?.name} · {euro(r.guestPartnerDrop?.value??0)}</>}</span></div>
      </div>)}</div>
      {current.viewerRole!=='spectator'&&
       <p>{current.winner===(current.viewerRole.startsWith('creator')?'creator':'guest')?
        current.viewerAwardCount>=current.rounds.length*2?
        'Dein Team hat gewonnen! '+current.viewerAwardCount+' Items sind deinem Inventar gutgeschrieben.':
        'Gewonnen – die Gutschrift konnte noch nicht bestätigt werden. Bitte Inventar aktualisieren.':
        'Das andere Team hat gewonnen. Die Items gehören dem Siegerteam.'}</p>}
      {current.viewerRole!=='spectator'&&current.winner===(current.viewerRole.startsWith('creator')?'creator':'guest')&&
       <button className="primary wide" onClick={async()=>{await onChange();currentRef.current=null;setCurrent(null);window.dispatchEvent(new Event('case-rush-show-inventory'))}}>GEWINNE IM INVENTAR ANSEHEN</button>}
      <button className="secondary wide" onClick={()=>{animatedIds.current.delete(current.id);setAnimated(current)}}>ROTATION ERNEUT ANSEHEN</button>
     </>
    }
    <button className="secondary wide" onClick={()=>{currentRef.current=null;setCurrent(null)}}>SCHLIESSEN</button>
   </section>
  </div>}
  {animated&&animation&&<BattleOpeningAnimation
   rounds={animation} participants={{creator:animated.creator,guest:animated.guest??'RUSH BOT',
    creatorPartner:animated.creatorPartner,guestPartner:animated.guestPartner}}
   onFinish={()=>{setAnimated(null);void onChange()}}
  />}
 </section>;
}
