# Teller auf GitHub Pages veröffentlichen

So kommt die App unter eine feste https-Adresse, die du aufs iPhone holen kannst. Danach reicht ein `git push`, und die neue Version ist nach etwa einer Minute online.

Den Workflow dafür gibt es schon: `.github/workflows/deploy.yml` baut die App, führt die Tests aus und veröffentlicht sie.

## 1. Repository auf GitHub anlegen

1. Melde dich auf [github.com](https://github.com) an und öffne [github.com/new](https://github.com/new).
2. Bei **Repository name** trägst du `teller` ein (oder einen anderen Namen).
3. Wähle **Public**. GitHub Pages ist im kostenlosen Konto nur für öffentliche Repositories verfügbar. Öffentlich ist dabei nur der Code. Deine Essens- und Gewichtsdaten bleiben auf deinem iPhone und landen nie auf GitHub.
4. Lass **keinen** Haken bei README, .gitignore oder License setzen. Das Projekt hat diese Dateien schon.
5. Klicke auf **Create repository**.

## 2. Pages einschalten

Im neuen Repository: **Settings** → **Pages** → bei **Source** die Option **GitHub Actions** wählen. Mehr ist dort nicht einzustellen.

## 3. Projekt hochladen

Öffne ein Terminal im Projektordner `C:\Users\Bluey\Documents\Projects\essenstracker` und führe diese Befehle nacheinander aus. Ersetze `DEIN-NAME` durch deinen GitHub-Benutzernamen.

```bash
git init -b main
```

```bash
git add .
```

```bash
git commit -m "Teller: erste Version"
```

```bash
git remote add origin https://github.com/DEIN-NAME/teller.git
```

```bash
git push -u origin main
```

Beim ersten `git push` öffnet sich ein Fenster, in dem du dich bei GitHub anmeldest. Hat Git dich noch nie nach Name und E-Mail gefragt und `git commit` bricht deshalb ab, gib das vorher einmal ein:

```bash
git config --global user.name "Dein Name"
```

```bash
git config --global user.email "deine@mail.de"
```

## 4. Warten und Adresse öffnen

Unter **Actions** im Repository siehst du den Lauf „Veröffentlichen“. Wenn beide Schritte grün sind (etwa 1–2 Minuten), ist die App erreichbar unter:

```
https://DEIN-NAME.github.io/teller/
```

## 5. Aufs iPhone holen

1. Öffne die Adresse in **Safari**. Andere Browser können auf dem iPhone keine Web-Apps installieren.
2. Tippe auf das **Teilen-Symbol** (Quadrat mit Pfeil) und dann auf **Zum Home-Bildschirm**.
3. Starte Teller über das neue Icon. Beim ersten Scan fragt die App nach der Kamera. Erlaube den Zugriff.

## Später Änderungen veröffentlichen

```bash
git add .
```

```bash
git commit -m "Was du geändert hast"
```

```bash
git push
```

Die installierte App holt sich die neue Version beim nächsten Start von selbst. Deine Daten bleiben dabei erhalten.

## Wenn etwas nicht klappt

- **Lauf unter Actions ist rot:** Klick auf den Lauf, dann auf den roten Schritt. Die Fehlermeldung steht ganz unten.
- **Fehler „Get Pages site failed“ oder 404:** Schritt 2 fehlt. Stell Source auf **GitHub Actions** und starte den Lauf unter Actions über **Re-run all jobs** neu.
- **Seite lädt, bleibt aber weiß:** Prüf, ob die Adresse mit `/teller/` endet (mit Schrägstrich).
- **Wichtig zu deinen Daten:** Sie hängen an der Adresse. Teller unter `localhost` oder der Test-Adresse im WLAN hat andere Daten als die GitHub-Version. Nutze ab jetzt nur noch die Version vom Home-Bildschirm und sichere ab und zu unter **Ziele → Daten sichern**.
