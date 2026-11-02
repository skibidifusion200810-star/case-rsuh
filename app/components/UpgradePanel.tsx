'use client';
import {useState} from 'react';
import {UPGRADE_TIERS} from '@/lib/upgrades';

const tiers=UPGRADE_TIERS;
const eur=(cents:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(cents/100);
export default function UpgradePanel({slots,coins,purchase}:{slots:number,coins:number,purchase:(tier:number)=>Promise<boolean>}){
 const [upgrading,setUpgrading]=useState(0);
 return <section className="upgrades">
 <div className="eyebrow">PERMANENT ACCOUNT UPGRADES</div>
 <div className="upgrades-head"><h2>MULTI <em>OPEN.</em></h2><p>Erweitere dauerhaft, wie viele kostenpflichtige Kisten du in einem Zug öffnen kannst.</p></div>
 <div className="upgrades-current">DEIN LIMIT <strong>{slots}×</strong></div>
 <div className="upgrade-grid">{tiers.map(t=><div className={'upgrade-card '+(slots>=t.slots?'owned':'')} key={t.slots}>
 <span className="upgrade-top">{slots>=t.slots?'FREIGESCHALTET':'PERMANENT'}</span>
 <div className="upgrade-count">{t.slots}<span>×</span></div>
 <strong>GLEICHZEITIGE ÖFFNUNGEN</strong>
 <p>Einmalig {eur(t.price)} s Guthaben.</p>
 <button className={slots>=t.slots?'secondary':'primary'} disabled={slots>=t.slots||coins<t.price||!!upgrading} onClick={async()=>{
 setUpgrading(t.slots);
 try{await purchase(t.slots)}finally{setUpgrading(0)}
 }}>{slots>=t.slots?'BEREITS GEKAUFT':upgrading===t.slots?'WIRD GEKAUFT…':coins<t.price?'NICHT GENUG GUTHABEN':'FREISCHALTEN'}</button>
 </div>)}</div>
 <p className="upgrades-foot">Die Upgrades bleiben in deinem Benutzerkonto gespeichert. Beim direkten Kauf einer höheren Stufe werden niedrigere Stufen mit freigeschaltet. Der Kistenpreis wird bei Mehrfachöffnungen pro Kiste berechnet. Kostenlose Kisten bleiben einzeln öffnbar.</p>
 </section>
}
