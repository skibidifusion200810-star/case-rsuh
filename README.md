# CASE RUSH

Virtuelles Kisten-Spiel auf Next.js, Prisma und PostgreSQL.

## Aktueller Stand
Registrierung, Login, serverseitige Sitzung, neun virtuelle Kisten, unbegrenzt kostenlose Übungskiste mit selteneren Premium-Drops, individuelle Kistenpools und horizontale Öffnungsanimation, Inventar und Sofortverkauf sind implementiert. Es gibt noch **keine** echten Case Battles, Bots, Adminpanel oder vollständige Sicherheitsüberprüfung. Keine Echtgeldtransaktionen oder Auszahlungen.

## CS2-Itemdaten und Bilder
Die Kisten und Skins werden bei `npm run db:seed` aus der [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API) importiert, die auch von [ByMykel/counter-strike-items](https://github.com/ByMykel/counter-strike-items) verwendet wird.

Bildverweise sind externe Links auf die in ByMykels Metadaten angegebenen Bildquellen; die Bilddateien selbst werden nicht in das Repository kopiert. Verfügbarkeit kann sich ändern. **Die MIT-Lizenz für den Quellcode/Datenkatalog ist keine automatisch gewährte Lizenz für Valve/CS2-Skin-Grafiken.** Vor öffentlicher Nutzung Bildrechte und Markennutzung klären.

## Virtuelle Euro und Preise
Alle numerischen Daten werden in **Euro-Cent-Einheiten** in der Datenbank gespeichert und im Browser als virtuelle € angezeigt. Beispiel: 500 gespeicherte Einheiten sind 5,00 € virtuelles Spielguthaben. **Keine Ein- oder Auszahlung; kein Umtausch gegen echte Euro.**

Itemwerte werden bei der ersten Seed-Erstellung pro Item aus dem [öffentlichen Preis-Snapshot von ByMykel](https://github.com/ByMykel/counter-strike-price-tracker) übernommen, wenn eine eindeutige Kombination aus Skin/Wear und Preis existiert. Der Tracker liefert USD-Cent-Preise. Für die EUR-Umrechnung wird der **historische Referenzkurs 0,8961 EUR je USD vom 30.10.2026** verwendet. Preise sind deshalb **keine aktuellen Marktquotierungen**, sondern eine Referenz für feste **virtuelle** Werte. Fehlen belastbare Preise, werden betroffene Skins nicht für neue Öffnungen freigeschaltet. Bereits existente Itemwerte werden bei künftigen Deployments nicht geändert.

Die durch `db:seed` importierten Werte sind nach der ersten Speicherung dauerhaft; Preise verändern sich **nicht** automatisch mit dem Markt.

## Start / Update
```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Im Render-Deploy führt das Docker-Image die beiden Datenbankbefehle automatisch aus. Änderungen an `prisma/schema.prisma` sind additiv, aber **vor Produktivmigration Datenbank sichern**. Render kann via Dashboard → Webservice → Manual Deploy → Deploy latest commit erneut deployen.

## Registrierung prüfen
Wenn Login oder Registrierung fehlschlagen, wird die Fehlermeldung im Anmeldedialog angezeigt. Prüfe zusätzlich `/api/health`: Status `ok` und `database:online` sind nötig. Der Account benötigt einen Benutzernamen aus 3–24 Buchstaben/Ziffern/Unterstrichen und ein Passwort mit 10–128 Zeichen. Andere Nutzer benötigen eigene Benutzerkonten.

## Veröffentlichung
Siehe [DEPLOY_RENDER.md](DEPLOY_RENDER.md). Diese Anwendung ist noch ein **Teststand** und vor öffentlicher Freigabe fehlen unter anderem Login-Rate-Limits, Anti-Bot-Schutz, Migrationsstrategie, Sicherheits-/Lasttests, Betreiberangaben und die Klärung von Bildrechten.

## Neue Kistenstufen und Öffnungsanimation

Die neun Kisten kosten **0, 1, 5, 20, 75, 250, 500, 1.000 und 2.000 virtuelle Euro**.
Jede Kiste hat einen eigenen gewichteten Item-Pool (siehe `lib/case-config.ts`).
Teurere Kisten haben steigende Chancen auf Epic, Legendary und Knife. In der teuersten
2.000-€-Kiste gibt es **weder Common (grau) noch Uncommon (blau)**. 
Die kostenlose `First Drop` hat nur **0,05 % Grundwahrscheinlichkeit für Rare oder höher**.

**Die kostenlose Kiste darf beliebig oft geöffnet werden**, mit 2,5 Sekunden
serverseitiger Anti-Spam-Pause zwischen den Käufen. Da das Öffnen nichts kostet, bleiben
diese Gewinne **nicht verkaufbare Sammlerstücke**; sonst könnte jeder durch unbegrenzt
kostenlose Öffnungen das virtuelle Guthaben unendlich erhöhen. Kostenpflichtige
Kistengewinne lassen sich weiterhin sofort zum gespeicherten virtuellen Wert verkaufen.

Die horizontal scrollende **links-nach-rechts**-Animation startet erst nach serverseitigem
Kauf und Gewinnentscheid. Der mittige Marker zeigt exakt das serverseitig bestimmte
Item. `Animation überspringen` und `Bewegungen reduzieren` ändern **niemals**
Gewinn oder Drop-Chance. Die Anzahl der sichtbaren Felder bestimmt keine Chance.

Achtung: Die tatsächlichen Drop-Chancen werden aus den **verfügbaren und bepreisten**
Items berechnet. Fehlt eine überprüfte Marktpreis-/Bildquelle, wird das betreffende Item
deaktiviert. Die erste Version enthält bewusst keinen Echtgeldhandel.

## Globale Bestenliste

Über **BESTENLISTE** in der Navigation können Besucher ohne Anmeldung die besten 20 Spieler
in drei Ranglisten sehen:

- **Meistes Guthaben** – nach dem aktuellen virtuellen Euro-Guthaben (absteigend).
- **Wertvollstes Inventar** – Summe der noch nicht verkauften, verkaufbaren Items zum
  gespeicherten **Wert bei der Ziehung**. Kostenlose Demo-Sammlerstücke (`isDemo=true`)
  und bereits verkaufte Items zählen nicht.
- **Meiste Kistenöffnungen** – alle gespeicherten erfolgreichen Öffnungen zusammen,
  auch die unbegrenzte Gratis-Kiste. Zusätzlich werden kostenlose und bezahlte
  Öffnungen getrennt angezeigt.

Jede Rangliste zeigt Benutzername, Guthaben, Inventarwert, Inventar-Itemanzahl und
Kistenöffnungen. Die öffentliche, **nur lesbare** API liegt unter `/api/leaderboard`.
Sie liefert keine Passwörter, Session-Tokens oder Benutzer-UUIDs. Das Ranking kommt
direkt aus PostgreSQL und aktualisiert sich im Browser alle **30 Sekunden**, sowie
beim manuellen Neuladen. Es speichert keine zusätzliche Punktetabelle, deshalb
muss niemand Rankings nachträglich synchronisieren.

Hinweis: Die Rangliste für Kistenöffnungen lässt sich durch häufiges Spielen der
kostenlosen Kiste steigern. Bei Gleichstand entscheiden andere Statistiken und
danach der Benutzername; es gibt kein Echtgeld oder auszahlbare Preise.

Tests: `npm run test:leaderboard` (mit laufender Testdatenbank und Seed).
