# Tracker – Design-Notizen

## Richtung
Eine ruhige iPhone-App, die sich wie ein Werkzeug anfühlt. Das Leitbild ist der Teller: ein einzelner Ring, der sich im Laufe des Tages füllt. Er ist das eine Element, an das man sich erinnert. Alles andere ordnet sich unter.

## Tokens
| Rolle          | Hell      | Dunkel    |
|----------------|-----------|-----------|
| Hintergrund    | `#F2F3F5` | `#0B0C0E` |
| Fläche         | `#FFFFFF` | `#17191C` |
| Text           | `#14161A` | `#F2F3F5` |
| Akzent (Basilikum) | `#157A4E` | `#3DBA7E` |
| Über dem Ziel  | `#C8553D` | `#F0806A` |
| Serie (Flamme) | `#E2712B` | `#F59A4E` |

Makros haben feste Farben, die überall gleich sind: Eiweiß `#3E6AD6`, Kohlenhydrate `#DB9A1F`, Fett `#C24F86` (im Dunkelmodus jeweils aufgehellt).

## Typografie
- Text: die Systemschrift (SF Pro). Sie ist nativ, lädt sofort und funktioniert offline.
- Zahlen: `ui-rounded` (SF Pro Rounded) in fett, mit `tabular-nums`. Die runden Ziffern geben der App ihren Charakter.
- Großer Titel mit 34 pt wie in iOS, Abschnittstitel in normaler Groß- und Kleinschreibung. Keine Labels in Versalien.

## Bewegung
- Die Zahl im Ring zählt, und der Ring füllt sich, sobald ein Eintrag dazukommt. Das ist der eine orchestrierte Moment.
- Sheets federn und lassen sich nach unten wegziehen. Listenzeilen klappen beim Löschen zusammen.
- Kein Einblenden der Inhalte beim Laden, keine Hover-Effekte. Wer „Bewegung reduzieren“ nutzt, bekommt keine Animationen.

## Vermeiden
Verläufe, Leuchteffekte, Emojis, Karten-Raster mit Schatten, Pfeile an Links, Punkte als Trenner in Metazeilen.
