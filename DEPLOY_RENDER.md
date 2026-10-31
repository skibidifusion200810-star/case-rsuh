# CASE RUSH → Website

GitHub speichert den Code, kann aber nicht selbst eine Next.js-/PostgreSQL-/Socket.IO-Anwendung als GitHub Pages betreiben. Für das Hosting ist `render.yaml` vorbereitet.

1. [Render Dashboard](https://dashboard.render.com/) öffnen und mit GitHub anmelden.
2. **New → Blueprint** auswählen; Repository `skibidifusion200810-star/case-rsuh` auf Branch `main` wählen.
3. Den Blueprint `render.yaml` prüfen, Dienste und Preise kontrollieren und erstellen.
4. Nach dem erfolgreichen Deployment die **von Render angezeigte** `.onrender.com`-Adresse öffnen.
5. `/api/health` prüfen: Die Antwort soll Datenbankstatus melden.

**Vor einer öffentlichen Freigabe**: Rechtliche Seiten ausfüllen, die Rechte an externen Skins prüfen, Adminzugang sicher einrichten, Code- und DB-Tests ausführen, Sicherheitswarnungen beheben und ein verlässliches Datenbankhosting wählen. Kostenlose Datenbanken können verfallen; Free-Dienste schlafen ggf. ein.

Niemals `.env`, Passwörter, Datenbank-URLs oder Adminschlüssel committen.
