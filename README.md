# LIVEdream Creator Bootcamp – App

Statische Web-App (HTML, CSS, JavaScript) mit Supabase für Login, Datenbank und Dateien.
Läuft auf jedem Hoster für statische Seiten (Netlify, Cloudflare Pages, Vercel).

## Einrichten
1. Supabase-Projekt anlegen (Region Frankfurt).
2. In `supabase/setup.sql` ganz unten `DEINE@EMAIL.DE` durch die eigene Adresse ersetzen,
   dann im Supabase SQL Editor komplett ausführen.
3. Supabase > Project Settings > API: Project URL und anon/public key in `config.js` eintragen.
4. Supabase > Authentication > URL Configuration: Site URL = Adresse der App (z. B. https://lda-bootcamp.netlify.app),
   dieselbe Adresse auch unter Redirect URLs.
5. Supabase > Authentication > Email Templates > Magic Link: `{{ .Token }}` in den Text aufnehmen,
   damit auch der 6-stellige Code in der Mail steht (hilft, wenn der Link im falschen Browser aufgeht).
6. Ordner auf Netlify hochladen (Drag & Drop) oder mit GitHub verbinden. Kein Build-Befehl nötig.

## Rollen
- Geschäftsführung: sieht alles, verwaltet Teilnehmer und Themen, exportiert Punkte.
- Manager: sieht nur eigene Creator und vergibt Punkte.
- Creator: Lehrvideo, Aufgabe, Nachweis hochladen; das nächste Thema öffnet sich erst nach der Abgabe.

Lehrvideos werden als (nicht gelistete) YouTube-Links pro Thema eingetragen. Nachweise max. 50 MB pro Datei.
