# CASE RUSH

## Website und Navigation (November 2026)

Die Website hat eine eigenständige, animierte Startseite und **echte Unterseiten**:

- `/`: Landingpage mit CSS-Animationen, schwebender Kistengrafik, animiertem Ticker, Hover-Interaktionen und direkt aus `GET /api/game?action=cases` geladenen aktuellen Kistenbildern und Preisen.
- `/cases`: Kistenübersicht, Drops/Chancen, Öffnung, Mehrfachöffnung und Wiederholungsfunktion.
- `/battles`: Case-Battle-Builder, Bot- oder Spielerduelle und Rotationsanimation.
- `/inventory`: persönliches Inventar und Verkauf.
- `/leaderboard`: öffentliche Guthaben-, Inventarwert- und Öffnungsranglisten.
- `/upgrades`: permanente Mehrfachöffnungs-Upgrades.

Die Spielansichten verwenden gemeinsam `app/components/GameApp.tsx` und behalten dadurch die vorhandenen authentifizierten Serverfunktionen bei. Jede Unterseite ist direkt per URL erreichbar, hat ihren aktiven Navigationszustand und einen eigenen Titel. Die Landingpage befindet sich in `app/page.tsx`, ihr Design in `app/home.css`. Die Animationen sind rein visuell, ohne Einfluss auf Gewinnchancen; CSS respektiert `prefers-reduced-motion`. Für die Landingpage werden keine erfundenen Spieler- oder Gewinndaten angezeigt.

Von der Startseite führen die Anmelde- und Spielbuttons nach `/cases?auth=login` bzw. `/cases`; die Kontoerstellung ist im Anmeldedialog erreichbar.

Virtuelles Kisten-Spiel auf Next.js, Prisma und PostgreSQL.

## Aktueller Stand
Registrierung, Login, serverseitige Sitzung, neun virtuelle Kisten, unbegrenzt kostenlose Starter-Kiste, horizontale Single- und Multi-Opening-Animationen, Inventar, Einzel-/Sammelverkauf, mehrteilige Case Battles gegen Spieler oder Bots, Upgrades und Bestenlisten sind implementiert. Ein Adminpanel und die vollständige Sicherheits-/Lastprüfung fehlen weiterhin. Keine Echtgeldtransaktionen oder Auszahlungen.

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
Die kostenlose `First Drop` hat nur **0,0501 % Grundwahrscheinlichkeit für Rare oder höher**.

**Die kostenlose Kiste darf beliebig oft geöffnet werden**, mit 2,5 Sekunden
serverseitiger Anti-Spam-Pause zwischen den Käufen. Auch Gewinne der kostenlosen Kiste sind **sofort und im Inventar verkaufbar**, um virtuelles Guthaben für kostenpflichtige Kisten zu erspielen. Kostenpflichtige
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
  gespeicherten **Wert bei der Ziehung**. Kostenlose, noch unverkaufte Gewinne zählen ebenfalls zum Inventarwert; verkaufte Items nicht.
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

## Verifizierte günstige Skins (kein erfundener Cent-Wert)
Für die häufigen günstigen Drops werden ausdrücklich die **Field-Tested**-Varianten verwendet, keine beliebigen Factory-New-Items. Am 29. Oktober 2026 wurden folgende niedrige EUR-Listings bei CS.MONEY über Veriloot überprüft:
- P250 | Sand Dune (Field-Tested): 0,02 € — https://veriloot.gg/en/skins/p250/sand-dune/field-tested
- MP9 | Sand Dashed (Field-Tested): ca. 0,01 € — https://veriloot.gg/en/skins/mp9/sand-dashed
- SCAR-20 | Sand Mesh (Field-Tested): 0,01 € — https://veriloot.gg/en/skins/scar-20/sand-mesh/field-tested
- MP7 | Army Recon (Field-Tested): 0,02 € — https://veriloot.gg/en/skins/mp7/army-recon/field-tested

Die genaue Quelle, EUR-Cent-Werte, Variante und Datierung stehen in `lib/market-reference.ts`. Die Zahlen sind **historische Angebotsreferenzen**; sie aktualisieren sich nicht in Echtzeit und sind keine Echtgeld-Auszahlungen. Extern beobachtete Marktpreise können sich ändern. Bei einer konfigurierten Live-Preisdatenquelle werden aktuelle genau zugeordnete Werte bevorzugt. Andere, nicht verifizierte Werte werden nicht erfunden.

Bestehende gesammelte Gegenstände werden im Inventar zum damals gespeicherten Wert verkauft. Die kostenlose Kiste bleibt unbegrenzt nutzbar; der 2,5-Sekunden-Cooldown schützt vor schnellen automatisierten Anfragen.

## Case Battles 1-gegen-1 (gemischte Kisten, Spieler oder Bot)

Der Menüpunkt **BATTLES** enthält ein öffentliches Lobby-System für 1v1-Duelle,
mit der Möglichkeit, statt eines zweiten Spielers einen RUSH BOT zu wählen.
Jeder Teilnehmer bekommt unabhängig aus **derselben kostenpflichtigen Kiste**
einen zufälligen Gegenstand. Der höhere virtuelle Drop-Wert gewinnt **beide Items**
für sein Inventar. Bei Gleichstand entscheidet ein fairer 50/50-Zufallsentscheid.
Gewinnt ein Bot, bekommt der menschliche Spieler keine Items. Es gibt
**keine Echtgeldpreise**. Gratis-Kisten sind für Battles ausgeschlossen.

Eine offene Spielerlobby reserviert den Einsatz des Erstellers. Wenn sie vor dem
Start vom Ersteller abgebrochen wird, wird die Reservierung vollständig
zurückerstattet. Der Gegner zahlt erst beim Beitritt. Die serverseitige
PostgreSQL-Transaktion führt Kauf, zufällige Ziehung, Gewinnausschüttung und
Battle-Ergebnis zusammen aus; konkurrierende Join-Versuche können den
Einsatz nicht mehrfach abbuchen. Die Oberfläche fragt neue Battle-Zustände
alle vier Sekunden ab – es handelt sich **nicht** um einen garantierten
dauerhaften Socket.IO-Livekanal.

API: `GET /api/battles`, `POST /api/battles` mit
`action=create|join|cancel`. Nur angemeldete Spieler können handeln.
Aufgelistet werden die letzten 30 Battles. Du kannst höchstens drei
offene eigene Lobbys haben.

## Dauerhafte Mehrfachöffnung-Upgrades

Der Menüpunkt **UPGRADES** bietet folgende einmaligen Freischaltungen:

| Gleichzeitige kostenpflichtige Öffnungen | Kaufpreis (virtuelles Guthaben) |
| ---: | ---: |
| 2× | 100,00 € |
| 4× | 500,00 € |
| 8× | 1.000,00 € |
| 10× | 2.000,00 € |

Mit `openSlots` in PostgreSQL wird die **höchste** gekaufte Stufe
dauerhaft gespeichert. Höhere Stufen können direkt gekauft werden;
doppelte Käufe werden verhindert. Bei jeder Mehrfachöffnung kostet
jede einzelne Kiste ihren regulären Kistenpreis und die Ziehungen
werden gemeinsam serverseitig gebucht. Alle Drops erscheinen in einem
Ergebnisfenster und lassen sich einzeln verkaufen. Kostenlose Kisten
bleiben einzeln öffnbar (Anti-Spam-Pause).

## Kistenbalance und Quellen (November 2026)

Cent-Gewinne von 0,01–0,02 € gibt es nur in der **kostenlosen und der
1-€-Kiste**. Ab 5 € enthalten die Kisten keine dieser billigsten Varianten
mehr. Die 75-€-Kiste hat keinen ein- oder zweicentigen Gewinn.

Die **2.000-€-Karambit-Eclipse-Kiste** enthält als extrem seltenen Jackpot
auch die **AWP | Dragon Lore (Factory New)** mit 4,0 % konfiguriertem
Grundgewicht (vor der marktwertabhängigen Gewichtsanpassung). Der Referenzpreis von **11.501,06 €** wurde als
CS.MONEY-Angebot aus [FragStash](https://fragstash.com/catalog/awp/dragon-lore/)
übernommen. Das ist ein **Angebots-Snapshot**, kein garantiert aktueller
Verkaufswert oder Echtgeld-Auszahlungsversprechen. Der Spielwert bleibt
beim Erhalt gespeichert, damit er später nicht stillschweigend verändert
wird. Die tatsächlichen Drop-Chancen ergeben sich aus den zum Seed-Zeitpunkt
bild- und preisverifizierten Items; sie können vom konfigurierten
Grundgewicht abweichen, wenn ein Item deaktiviert ist.

Tests: `npm run test:battles-upgrades`,
`npm run test:case-config`, `npm run audit:catalog`
und `npm run build`. Der Render-Dienst muss nach dem GitHub-Commit
erst neu bereitgestellt werden.

## Neu: Case-Battle-Warteschlangen, Animationen und Live-Inventar

- Ein Battle kann eine **geordnete Liste aus 1 bis 10 Kisten** enthalten (einschließlich unterschiedlicher Preisstufen).
- Der Gesamtpreis jeder Liste ist der **Einsatz pro Spieler**. Alle Runden werden in PostgreSQL als `BattleRound` gespeichert.
- Sobald ein realer Gegner beitritt oder ein Bot-Duell erstellt wird, werden die tatsächlichen Ergebnisse **einmalig innerhalb einer Datenbanktransaktion** festgelegt. Die Rotation von **beiden Waffenstreifen pro Runde** zeigt nur diese feststehenden Ergebnisse.
- Der Gewinner erhält **beide Gegenstände jeder Runde** im Inventar. Neue Battle-Drops tragen eine `battleId` und die API bestätigt mit `awardedItemCount`, wie viele Items tatsächlich verknüpft sind.
- Der Button „GEWINNE IM INVENTAR ANSEHEN“ aktualisiert das Inventar und wechselt direkt dorthin. Vor dem aktuellen Schema-Update gespeicherte Battle-Drops haben noch keine neue `battleId`; ihre Besitzdaten dürfen bei einer Migration nicht doppelt gutgeschrieben werden.
- Für eine normale **Mehrfachöffnung** werden pro Kiste eigene links-nach-rechts rotierende Waffenlisten angezeigt. Danach kann jeder Drop einzeln oder per **ALLES VERKAUFEN** innerhalb einer einzigen Transaktion verkauft werden.

## Kistenökonomie und Skin.club-Inspiration

CASE RUSH übernimmt keine fremden Grafiken und keine realen Ein-/Auszahlungen. Die öffentliche Darstellung echter Drops mit vielen niedrigen Werten und seltenen Highlights dient lediglich als Konzeptvorbild. Die Kisten nutzen eine eigene Preis-/Chancenberechnung: Beim `db:seed` werden die Dropgewichte an den **beobachteten Preis des konkreten Skin-Zustands** angepasst. Die theoretische durchschnittliche Auszahlung bezahlter Kisten wird nach Möglichkeit auf **höchstens 88 % des Einsatzes** begrenzt; tatsächlich eingespielte Gewinne bleiben unabhängig davon zufällig.

Kostenlose Öffnungen behalten ihr eigenes Dropgewichts-Schema und Gold-Chance (0,0001 %). Die ersten fünf Kisten enthalten einen anhand eines 29.10.2026-Preissnapshots dokumentierten Skin um 1 € (`Tec-9 | Re-Entry (Field-Tested)`). Cent-Skins gibt es ausschließlich in den ersten zwei Kisten. Die 2.000-€-Kiste enthält keine grauen/blauen Items und einen seltenen Dragon-Lore-Hauptgewinn.

Diese Werte sind **keine aktuellen CS.MONEY-Handelspreise oder Gewinnauszahlungen in echten Euro**, sondern virtuelle Wertreferenzen, die sich nur bei dokumentierten Datenbank-Updates verändern. Die aktuelle RTP-Auswertung erscheint im Deploy-Log als `[BALANCE]`; die tatsächlichen Drop-Chancen werden aus den danach gespeicherten Itemgewichten berechnet. Bei fehlenden Marktdaten können sich verfügbare Items und tatsächliche Chancen ändern.
