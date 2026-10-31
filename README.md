# CASE RUSH

Virtuelles Kisten-Spiel auf Next.js, Prisma und PostgreSQL.

## Aktueller Stand
Registrierung, Login, serverseitige Sitzung, neun virtuelle Kisten, Einmal-Starterkiste, Inventar und Sofortverkauf sind implementiert. Es gibt noch **keine** echten Case Battles, Bots, Adminpanel oder vollständige Sicherheitsüberprüfung. Keine Echtgeldtransaktionen oder Auszahlungen.

## CS2-Itemdaten und Bilder
Die Kisten und Skins werden bei `npm run db:seed` aus der [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API) importiert, die auch von [ByMykel/counter-strike-items](https://github.com/ByMykel/counter-strike-items) verwendet wird.

Bildverweise sind externe Links auf die in ByMykels Metadaten angegebenen Bildquellen; die Bilddateien selbst werden nicht in das Repository kopiert. Verfügbarkeit kann sich ändern. **Die MIT-Lizenz für den Quellcode/Datenkatalog ist keine automatisch gewährte Lizenz für Valve/CS2-Skin-Grafiken.** Vor öffentlicher Nutzung Bildrechte und Markennutzung klären.

## Virtuelle Euro und Preise
Alle numerischen Daten werden in **Euro-Cent-Einheiten** in der Datenbank gespeichert und im Browser als virtuelle € angezeigt. Beispiel: 500 gespeicherte Einheiten sind 5,00 € virtuelles Spielguthaben. **Keine Ein- oder Auszahlung; kein Umtausch gegen echte Euro.**

Itemwerte werden bei der ersten Seed-Erstellung pro Item aus dem [öffentlichen Preis-Snapshot von ByMykel](https://github.com/ByMykel/counter-strike-price-tracker) übernommen, wenn eine eindeutige Kombination aus Skin/Wear und Preis existiert. Der Tracker liefert USD-Cent-Preise. Für die EUR-Umrechnung wird der **historische Referenzkurs 0,8961 EUR je USD vom 30.10.2026** verwendet. Preise sind deshalb **keine aktuellen Marktquotierungen**, sondern eine Referenz für feste **virtuelle** Werte. Fällt die Zuordnung aus, wird ein als `GAME` gekennzeichneter virtueller Spielwert vergeben. Bereits existente Itemwerte werden bei künftigen Deployments nicht geändert.

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
