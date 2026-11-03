# Teller

Kalorien- und Nährwerttracker fürs iPhone als Web-App (PWA). Du scannst einen Barcode, und die Nährwerte kommen von Open Food Facts. Alle Daten bleiben lokal auf dem Gerät.

## Befehle

```bash
npm install           # einmalig
npm run dev           # Entwicklung am PC: http://localhost:5173
npm run phone         # fertige App per https im WLAN, zum Testen am iPhone
npm test              # Tests für Rechnungen, Streak und Open-Food-Facts-Zuordnung
npm run build         # fertige App in dist/
npm run icons         # App-Icons neu erzeugen
```

Beispieldaten in der Entwicklung: `http://localhost:5173/?demo`. **Achtung:** Das ersetzt alle Daten im Browser.

## Am iPhone testen

1. PC und iPhone müssen im selben WLAN sein. Starte `npm run phone`.
2. Öffne auf dem iPhone in Safari die angezeigte **Network**-Adresse, z. B. `https://192.168.x.x:5443`.
3. Safari warnt vor dem Zertifikat. Wähle „Details einblenden“ und dann „Diese Website besuchen“.
4. Falls Windows fragt, ob Node.js im Netzwerk kommunizieren darf, erlaube es für **private Netzwerke**.

## Dauerhaft installieren

Lade den Ordner `dist/` auf einen kostenlosen https-Host hoch, z. B. GitHub Pages oder Netlify. Die App nutzt relative Pfade und läuft deshalb auch in einem Unterordner.

Danach öffnest du die Adresse in Safari, tippst auf „Teilen“ und wählst „Zum Home-Bildschirm“.

## Aufbau

- `src/lib/`: Datenbank (Dexie/IndexedDB), Nährwerte, Streak, Open Food Facts, Datumsfunktionen
- `src/screens/`: Heute, Eintragen, Fortschritt, Gewicht, Ziele
- `src/ui/`: Sheet, Ring, Balken, Wischzeilen, Kalender (Animationen mit Motion)
- `src/charts/`: Gewichtskurve und Kalorienbalken als SVG
- `DESIGN.md`: Farben, Schrift und Regeln für Bewegung
