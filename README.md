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
Registrierung, Login, serverseitige Sitzung, neun virtuelle Kisten, unbegrenzt kostenlose Starter-Kiste, horizontale Single- und Multi-Opening-Animationen, Inventar, Einzel-/Sammelverkauf, mehrteilige Case Battles gegen Spieler oder Bots, Upgrades und Bestenlisten sind implementiert. Ein geschütztes Adminpanel mit Guthaben-Gutschriften, Spielersperren, Chat-Moderation, Kistenverwaltung und Änderungsprotokoll ist implementiert. Eine vollständige Sicherheits-/Lastprüfung fehlt weiterhin. Keine Echtgeldtransaktionen oder Auszahlungen.

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

## Community: Global-Drop-Alarm, Chat und Guthaben verschenken

**Globaler Drop-Alarm:** Wird bei einer Kistenöffnung oder einem Battle-Gewinn
ein Gegenstand mit mindestens **1.000 virtuellen Euro** gezogen, der zudem
ein Messer, ein Legendary-Skin oder eine Dragon Lore ist, entsteht ein
`RareDropEvent`. Nur diese außergewöhnlichen Drops erscheinen für etwa
14 Sekunden im goldenen globalen Hinweisstreifen oben. Der Ereigniseintrag
enthält Benutzername, Waffenname, virtuellen Wert und ein optionales Bild.
Die Daten bleiben in PostgreSQL gespeichert; die Oberfläche aktualisiert
die Ereignisse alle fünf Sekunden. Der Alarm bezieht sich auf serverseitig
bereits entschiedene und gebuchte Gewinne.

**Öffentlicher Community-Chat:** Über LIVE CHAT oben oder den Chat-Button
unten rechts ist der globale Chat von jeder Unterseite aus erreichbar.
Angemeldete Spieler können Textnachrichten mit maximal **280 Zeichen**
schreiben, mindestens drei Sekunden Abstand. Die letzten 50 Nachrichten
werden für alle Besucher aus PostgreSQL abgerufen und im geöffneten
Chat alle 2,5 Sekunden aktualisiert. Es handelt sich um **kurzintervallige
Live-Aktualisierung**, nicht um eine garantiert sofortige WebSocket-Zustellung.
Nachrichten werden im Browser als reiner Text angezeigt.

**Virtuelles Geld senden:** Der zweite Tab desselben Community-Panels
erlaubt Überweisungen an einen registrierten Benutzernamen, ab 0,01 €
bis maximal **2.000 € virtuellem Guthaben pro Transfer**.
Es ist genau **eine Überweisung alle 24 Stunden pro Absender** zulässig.
Ein Empfänger muss existieren und darf nicht der Absender selbst sein.
Abbuchung beim Sender, Gutschrift beim Empfänger, das Aktualisieren des
24-Stunden-Zeitstempels und die Buchung in `GiftTransfer` erfolgen
atomar als PostgreSQL-Transaktion mit Serializable-Isolation.
Das verhindert doppelte Abbuchungen, Überweisungen ohne Deckung und
gleichzeitiges Umgehen der Sperre. Die letzten fünf Sendungen und die
nächste erlaubte Sendezeit werden im Panel angezeigt. Geschenkte virtuelle
Euro können nicht in Echtgeld umgetauscht oder ausgezahlt werden.

Server-API:
`GET /api/social?feed=drops|chat|wallet`;
`POST /api/social` mit `action=chat|gift` (Cookie-Login erforderlich).
Die Social-Datenbanktabellen werden bei Render mit `npm run db:push`
automatisch angelegt. Der Docker-Start verwendet bereits
`npm run db:push && npm run db:seed && npm run start:production`.
Integrationstest: `npm run test:social`.

Für eine große öffentliche Community sollten vor weiterer Skalierung
ein Melde-/Moderationssystem, strengere Botabwehr und eine langfristige
Archivierungs-/Löschstrategie ergänzt werden.

## 2v2 Case Battles mit Bots

Im Teamduell (`/battles` → **DUO 2V2**) gibt es jetzt pro unbesetztem
Teamplatz die Schaltfläche **„+ BOT HINZUFÜGEN“**. Nur der
Ersteller der offenen Lobby kann Bots hinzufügen oder wieder entfernen.
Höchstens **zwei Bots** können pro Duo-Battle teilnehmen. Somit sind
auch zwei echte Spieler in Team A gegen zwei Bots in Team B möglich;
alternativ kann jedes Team aus einem echten Spieler und einem Bot bestehen.

Jeder Bot bekommt wie ein realer Spieler für jede Kiste einen eigenen
serverseitigen RNG-Drop. Jede Runde zeigt weiterhin alle **vier**
horizontalen Rotationsstreifen. Die beiden Drop-Werte jedes Teams
werden addiert, danach gewinnt das Team mit dem größeren Gesamtwert.
Bei gleicher Summe entscheidet ein 50/50-Zufallsentscheid.

**Keine Fantasiekonten:** Bot-Sitze werden in `Battle.duoBotSeats`
gespeichert und erzeugen keine echten Benutzer, Guthabenabbuchungen,
Öffnungsstatistiken oder menschlichen Inventareinträge. Jedes echte
Teammitglied zahlt den gewählten Kisteneinsatz. Gewinnt ein Team
mit echten Spielern, erhält jedes seiner Mitglieder pro Kiste zwei
Items (seine eigene und die gegenüberliegende Waffe). Bei einem
reinen Bot-Sieg werden die gewonnenen virtuellen Items nicht
an Spieler ausgegeben.

Das Battle wird automatisch ausgewertet, sobald alle vier Sitze
(menschlich oder Bot) belegt sind. Das Hinzufügen, Entfernen und
Einsteigen erfolgt in serialisierbaren PostgreSQL-Transaktionen;
gleichzeitige Anfragen können keine doppelt belegten Plätze erzeugen.
Der Ersteller kann eine noch offene Lobby abbrechen; bereits
bezahlte **echte** Teilnehmer erhalten ihren Einsatz zurück.
Der PostgreSQL-Integrationstest `npm run test:trades-duos` enthält
einen vollständigen Test **2 Menschen gegen 2 Bots**, inklusive
Sitzsperren, Entfernen und erneuten Hinzufügen von Bots sowie
Inventarauszahlung und Rückerstattung.

## Admin-Panel: nur für das konfigurierte Eigentümerkonto

Der Administrator öffnet `/admin` oder verwendet den Hotkey
**Strg + Umschalt + A** (bei eingeloggtem Konto).
Die Admin-Navigation wird ausschließlich für das konfigurierte Konto angezeigt.

**Wichtig – einmalige Einrichtung auf Render:**

1. Logge dich mit dem **bereits registrierten persönlichen CASE-RUSH-Konto** ein.
2. Öffne `https://DEINE-DOMAIN.onrender.com/admin`. Solange noch kein
   Administrator konfiguriert ist, wird deine **eigene Konto-ID (UUID)** angezeigt.
   Verwende diese ID, **nicht** deinen Benutzernamen und keine E-Mail-Adresse.
3. Öffne in Render den Webservice `case-rush` → **Environment** → neue Variable:
   `ADMIN_USER_ID` = diese UUID.
4. Speichere die Umgebungsvariable und starte einen neuen Deploy.
5. Melde dich mit demselben Konto an und öffne erneut `/admin` oder
   **Strg + Umschalt + A**.

**Sicherheit:** `ADMIN_USER_ID` wird ausschließlich serverseitig gelesen.
Der Hotkey und die Admin-URL verleihen keine Berechtigung. Jede GET- und
POST-Anfrage der Admin-API prüft eine gültige Login-Sitzung, die exakte
UUID, eventuelle Kontosperren und bei schreibenden Aktionen den
Anfrageursprung. Ist `ADMIN_USER_ID` nicht eingerichtet oder ungültig,
ist die Admin-API für **alle** Spieler gesperrt. Verwende nicht das
früher genannte einfache Passwort `676767` als Adminschutz und
trage niemals Passwörter in GitHub ein. Verwende für das Eigentümerkonto
ein langes, einzigartiges Passwort; zusätzliche Zwei-Faktor-Authentifizierung
sollte vor größerem öffentlichen Betrieb ergänzt werden.

**Funktionen:**

- **Spieler → „€ GEBEN“**: einem Spieler zwischen 0,01 € und
  1.000.000,00 € **virtuelles Guthaben** zusätzlich gutschreiben.
  Jeder Betrag wird als Integer-Cent validiert. Der Server verbucht
  den Betrag atomar, bestätigt den aktualisierten Guthabenstand und
  erstellt innerhalb derselben Transaktion einen unveränderlichen
  Eintrag in `AdminAuditLog` (Administrator, Zielkonto, vorher/nachher,
  Betrag, Zeit). Die Funktion erzeugt kein echtes Geld.
- **Spielersperren**: Konto sperren oder entsperren. Beim Sperren werden
  die bestehenden Sitzungen sofort beendet und eine neue Anmeldung
  verweigert. Das Administrator-Konto kann sich nicht selbst sperren.
- **Kistenverwaltung**: Preise und Drop-Gewichte bearbeiten. Änderungen
  werden in `AdminCaseOverride` und `AdminItemOverride` gespeichert
  und nach automatischen Seed-Importen wieder aufgespielt.
  Die Gewichte sind **relative Gewichte**, keine Prozentwerte.
  Mindestens ein bild- und preisgeprüftes Item muss pro Kiste aktiv bleiben.
- **Chat-Moderation**: letzte 65 Nachrichten einsehen und löschen.
- **Battle-Monitor**: vergangene/offene Duelle ansehen (nur lesend).
- **Protokoll**: letzte 100 Adminaktionen mit Konto, Zeit und Ziel.

Admin-API: `GET /api/admin?view=overview|users|cases|chat|battles|audit`
und `POST /api/admin` mit
`action=grantCoins|ban|unban|deleteMessage|setCasePrice|setDropWeight`.

Die neue Datenbankstruktur wird bei Render durch `prisma db push`
angelegt. CI-Integrationstest: `npm run test:admin`.

## Admin-gesteuerte zeitlich begrenzte Events

Das Adminpanel (`/admin` → **EVENTS**) enthält jetzt einen
serverseitig geschützten Event-Konfigurator. Nur das per
`ADMIN_USER_ID` authentifizierte Eigentümerkonto kann Events
starten oder stoppen.

- Rabatt: **0–90 %**, in 5-%-Schritten (Beispiel: 50 %).
- Luck: **1×, 1,25×, 1,5×, 2×, 2,5×, 3×, 4× oder 5×**.
- Dauer: **1, 5, 10, 15, 30, 60 oder 120 Minuten**.
- Eine Aktion kann Rabatt und Luck gleichzeitig einschalten.
- Während eines laufenden Events lassen sich weitere Events nicht
  überlagern. Der Admin kann es jederzeit manuell stoppen.
- Sämtliche Starts und Stopps werden über `AdminAuditLog` protokolliert.

**Automatisches Ende:** Die Datenbank hält einen globalen Eventdatensatz
`GameEvent` mit `startsAt` und `endsAt`. Jede Kistenöffnung und
Battle-Auswertung prüft auf dem Server, ob der aktuelle Zeitpunkt im
Intervall liegt. Nach Ablauf greifen normale Preise und Gewichte,
auch ohne Neustart und ohne dass der Admin im Browser anwesend ist.

**Preisberechnung:** Für neu bezahlte Öffnungen und neu erstellte
1v1-/2v2-Battles gilt `ceil(Basispreis × (100 − Rabatt)/100)`
mit mindestens 0,01 € für kostenpflichtige Kisten.
Gratis-Kisten bleiben gratis; laufende Battle-Lobbys behalten
den beim Erstellen gespeicherten Einsatz, auch wenn das Event endet.
Der Rabatt ist ausschließlich ein Rabatt auf virtuelle Kistenpreise,
nicht auf Upgrades oder direkte Spielergeld-Transfers.

**Luck-Berechnung:** Bei jeder serverseitig ermittelten Öffnung
werden die Drop-Gewichte für seltene Raritäten (Rare, Epic,
Legendary und Knife) und für Gegenstände oberhalb des normalen
Kistenpreises mit dem gewählten Multiplikator verstärkt.
Beispielsweise verdoppelt 2× Luck das **relative Gewicht** solcher
Drops, **nicht** ihre finale Gewinnwahrscheinlichkeit in Prozent
und **nicht** ihren Markt- oder Verkaufswert.
Das System normalisiert die neuen Gewichte durch die Gesamtsumme.
Luck garantiert daher keinen Gewinn. Für Team-Battles gelten die
aktiven Luck-Gewichte bei der tatsächlichen serverseitigen
Auswertung, während der beim Battle-Start bezahlte Preis erhalten bleibt.

**Anzeige:** Auf jeder Unterseite erscheint ein öffentlicher
Live-Banner mit den aktiven Boni und einem sekundengenauen Countdown.
Die Kistenübersicht zeigt Original-/Rabattpreise sowie die
während des Events effektiven Drop-Gewichte und daraus
berechneten Chancen. Die Oberfläche synchronisiert Änderungen
regelmäßig; der Server ist in allen Fällen die verbindliche Quelle.

Code: `lib/events.ts`,
`app/api/game/route.ts`, `app/api/admin/route.ts`,
`app/admin/EventControls.tsx`, `app/components/EventBanner.tsx`.
Integrationstest: `npm run test:events`.

## Spielerlevel, XP und rotes Admin-Abzeichen

Jeder User erhält `xp Int @default(0)` in PostgreSQL und startet
ab **Level 1**. Das Spielerprofil zeigt Level und animierten
XP-Fortschrittsbalken. Insgesamt gibt es **100 Level**.
Der kumulative XP-Bedarf für Level `n` beträgt
`80 × (n−1) × n / 2`; der Fortschritt und das Level werden
stets aus gespeicherter XP berechnet (nicht vom Client gesetzt).
Beispielsweise erreicht man Level 2 bei 80 XP und Level 3 bei 240 XP.

XP-Gutschriften erfolgen gemeinsam mit der tatsächlichen serverseitigen
Kistenöffnung: **5 XP pro Gratis-Kiste**; bezahlte Kisten erhalten
`min(1200,25+floor(Basispreis-in-Cent/20))` XP pro Roll.
Bei Bot-Battles, 1v1 und 2v2 erhält jeder echte Teilnehmer nach
der vollständigen Battle-Auswertung XP für seine gespielten Runden,
**unabhängig vom Sieg**. Kisten im offenen Battle vergeben noch keine
XP; bei Abbruch ebenso nicht. Bei Mehrfachöffnungen wird die
XP-Zahl multipliziert; gescheiterte Öffnungen zählen nicht.
Luck-/Rabatt-Events verändern die XP-Formel nicht.
Es werden nur virtuelle Level-/Spielwerte vergeben, keine
Echtgeldpreise oder geldwerte Level-Boni.

Neben dem Spielernamen erscheint ein goldener `LVL N`-Marker
auf Startseite, in Navigation, globalem Chat und Bestenliste.
Nur der verifizierte Administrator erhält zusätzlich das
**rote ADMIN-Abzeichen**. Diese Rolle wird ausschließlich mit
der Render-Umgebungsvariable `ADMIN_USER_ID` und der eingeloggten
Konto-ID serverseitig verglichen, nicht aus Browser-Anfragen übernommen.

Nach dem Render-Neustart fügt `db:push` automatisch `xp` für bestehende
Konten hinzu. Ihre bisherigen Coins und Inventare bleiben erhalten;
bereits vor der Einführung geöffnete Kisten vergeben keine
nachträglichen XP. Integrationstest: `npm run test:levels`.
