-- Update 3: Quiz nach dem Lehrvideo (3 Fragen pro Thema, zählt nicht für die Punkte)
-- In Supabase: SQL Editor > New query > alles einfügen > Run
-- Format pro Frage: {"q": Frage, "a": [3 Antworten], "c": Nummer der richtigen Antwort (0, 1 oder 2), "h": Hinweis bei falscher Antwort}

alter table public.areas    add column if not exists quiz    jsonb not null default '[]';
alter table public.progress add column if not exists quiz_at timestamptz;

update public.areas set quiz = '[
 {"q":"Wo schaltest du die 2-Schritt-Verifizierung ein?","a":["Im Live unter Geschenke","Einstellungen → Sicherheit","In deiner Bio"],"c":1,"h":"Du findest sie in den Einstellungen unter Sicherheit."},
 {"q":"Was gehört in eine gute Bio?","a":["Wer du bist und wann du live bist","Nur ein Emoji","Deine Handynummer"],"c":0,"h":"Die Bio sagt, wer du bist und wann man dich live findet."},
 {"q":"Wofür ist das Live-Ziel da?","a":["Damit das Live länger läuft","Es ersetzt die Bio","Deine Community hat etwas, worauf sie gemeinsam hinarbeitet"],"c":2,"h":"Das Live-Ziel gibt deiner Community ein gemeinsames Ziel im Live."}
]' where n = 1;

update public.areas set quiz = '[
 {"q":"Was ist die 3-Hook-Regel?","a":["Ton, Text und Bewegung ab Sekunde 1","3 Videos am Tag posten","3 Hashtags pro Video"],"c":0,"h":"Ton, Text und Bewegung packen die Leute gleich in der ersten Sekunde."},
 {"q":"Wie lang sollte ein Video ungefähr sein?","a":["5 Minuten und mehr","15 bis 45 Sekunden","Genau 3 Sekunden"],"c":1,"h":"15 bis 45 Sekunden, ein Gedanke: Hook, Inhalt, Schluss."},
 {"q":"Warum sind Untertitel wichtig?","a":["TikTok verlangt sie","Damit das Video länger wird","Viele schauen ohne Ton"],"c":2,"h":"Viele scrollen ohne Ton. Mit Untertiteln verstehen sie dich trotzdem."}
]' where n = 2;

update public.areas set quiz = '[
 {"q":"Wann postest du dein Anlaufvideo?","a":["15 bis 60 Minuten vor dem Live","Am Tag danach","Während des Lives"],"c":0,"h":"Kurz vorher, also 15 bis 60 Minuten vor dem Live."},
 {"q":"Was gehört auf jeden Fall rein?","a":["Ein langer Tagesrückblick","Startzeit und was im Live passiert","Nur Musik"],"c":1,"h":"Sag, wann du live gehst und was geplant ist."},
 {"q":"Was ist ein Call to Action?","a":["Ein Filter","Ein Geschenk","Eine Aufforderung wie „Komm vorbei“ oder „Teil das Video“"],"c":2,"h":"Ein Call to Action fordert die Leute auf, etwas zu tun."}
]' where n = 3;

update public.areas set quiz = '[
 {"q":"Was ist der erste Schritt für einen guten Hintergrund?","a":["Neue Möbel kaufen","Aufräumen: alles raus, was nicht ins Bild gehört","Mehr Deko dazustellen"],"c":1,"h":"Zuerst aufräumen. Alles, was stört, kommt raus."},
 {"q":"Wo steht deine Kamera am besten?","a":["Fest auf Augenhöhe, immer am gleichen Platz","Von unten schräg","Jedes Mal woanders"],"c":0,"h":"Stabil auf Augenhöhe und immer am gleichen Platz."},
 {"q":"Dein Hintergrund ist schon gut. Was machst du?","a":["Gar nichts","Alles komplett neu","Eine Sache bewusst verändern, z. B. Deko, Licht oder Overlay"],"c":2,"h":"Auch wenn er schon gut ist: eine Sache ausprobieren."}
]' where n = 4;

update public.areas set quiz = '[
 {"q":"Woher sollte dein Licht kommen?","a":["Von hinten","Von vorne","Von unten"],"c":1,"h":"Die Lichtquelle steht vor dir, so ist dein Gesicht hell."},
 {"q":"Was ist mit einem Fenster im Rücken?","a":["Vermeiden, das ist Gegenlicht","Perfekt für Stimmung","Egal"],"c":0,"h":"Ein Fenster im Rücken ist Gegenlicht. Dein Gesicht wird dunkel."},
 {"q":"Was ist beim Stimmungslicht wichtig?","a":["Es ist heller als dein Gesicht","Es wechselt ständig die Farbe","Dein Gesicht bleibt das Hellste im Bild"],"c":2,"h":"Stimmungslicht ist schön, aber dein Gesicht bleibt das Hellste."}
]' where n = 5;

update public.areas set quiz = '[
 {"q":"Mit wem legst du deine Live-Zeiten fest?","a":["Mit deinem Manager","Mit deinen Zuschauern","Mit niemandem"],"c":0,"h":"Deinen Wochenplan machst du zusammen mit deinem Manager."},
 {"q":"Was ist besser?","a":["5 wacklige Lives","3 sichere Lives","Nur live gehen, wenn Lust da ist"],"c":1,"h":"Lieber 3 sichere als 5 wacklige Lives."},
 {"q":"Du kannst an einem Live-Tag nicht. Was tust du?","a":["Einfach weglassen","Den ganzen Plan löschen","Community und Manager vorher Bescheid sagen"],"c":2,"h":"Pausen kündigst du vorher an, bei der Community und beim Manager."}
]' where n = 6;

update public.areas set quiz = '[
 {"q":"Was gehört zu einem starken Start?","a":["Erst mal still abwarten","Begrüßen, ansagen was heute passiert, klares Ziel","Sofort nach Geschenken fragen"],"c":1,"h":"Begrüßung, Ansage und ein klares Ziel."},
 {"q":"Wie viele offene Fragen bereitest du vor?","a":["3","Keine","10"],"c":0,"h":"3 offene Fragen als Gesprächsaufhänger."},
 {"q":"Was schickst du beim Selbst-Check an deinen Manager?","a":["Die ganze Wiederholung","Nichts","Nur deine Antworten auf die 3 Fragen"],"c":2,"h":"Nur deine Antworten, nicht die Wiederholung."}
]' where n = 7;

update public.areas set quiz = '[
 {"q":"Was legst du in deinem Plan für den nächsten Monat fest?","a":["Live-Tage und Uhrzeiten","Nur dein Outfit","Nichts, lieber spontan"],"c":0,"h":"Dein Plan enthält feste Live-Tage und Uhrzeiten."},
 {"q":"Was ist ein Special?","a":["Ein neues Profilbild","Eine besondere Aktion mit Datum, Idee und Ziel","Ein Filter"],"c":1,"h":"Ein Special ist eine besondere Aktion, z. B. eine Challenge, mit Datum, Idee und Ziel."},
 {"q":"Wie kündigst du dein Special an?","a":["Gar nicht, Überraschung","Nur im Live danach","Zum Beispiel mit einem Anlaufvideo"],"c":2,"h":"Kündige es vorher an, z. B. mit einem Anlaufvideo."}
]' where n = 8;
