# Echo-app (zonder pc, gratis)

## 1. Online zetten (eenmalig, gratis)
Safari geeft de microfoon alleen via https. Zet daarom de map `echo-app` online:
- **Netlify Drop** (het makkelijkst): ga naar app.netlify.com/drop, sleep de hele map `echo-app` erin en maak een gratis account om hem te bewaren. Je krijgt een https-adres.
- Of **GitHub Pages**: nieuwe repository, upload de bestanden, Settings > Pages > Deploy from branch.
Zet het adres niet publiek online als je er een sleutel in zet: de sleutel staat alleen op jouw telefoon, niet op de site.

## 2. Op je iPhone installeren
1. Open het adres in **Safari**, tik op **Deel** en kies **Zet op beginscherm**.
2. Zet in iOS-instellingen **Siri en Dicteren** aan (nodig voor spraakherkenning).
3. Open Echo vanaf het beginscherm en sta microfoon en spraakherkenning toe.

## 3. Gratis AI-sleutel (voor gesprekken)
Weer, nieuws, tijd en briefing werken zonder sleutel. Voor vrije vragen heb je een gratis sleutel nodig:
- Groq: console.groq.com > API Keys, of Google Gemini: aistudio.google.com > Get API key.
- Zet in Echo > **Instellingen** de aanbieder en sleutel in, en kies eventueel een pincode. Modelnamen veranderen soms: kopieer dan de actuele naam uit het dashboard van de aanbieder.
Je vragen gaan dan naar die aanbieder (gratis, met daglimiet).

## 4. Gebruik
- Tik op de cirkel en praat, of zet **Hey Echo** aan en zeg "Hey Echo, wat is het weer?". Laat dan de app open en het scherm aan.
- Na 10:00 verschijnt bij het openen een knop om de briefing af te spelen.
- "Hey Echo, wat is het nieuws?", "hoe laat is het", "zoek op ...".

## 5. Briefing om 10:00 zonder de app te openen
Opdrachten > Automatisering > **+** > Tijd van de dag 10:00, dagelijks, **Direct uitvoeren**. Acties (namen kunnen iets verschillen):
1. Huidig weer ophalen
2. RSS-items ophalen met `https://feeds.nos.nl/nosnieuwsalgemeen`, daarna de eerste 4 items
3. Tekst: "Goedemorgen. Het is [temperatuur] graden, [omstandigheden]. Het nieuws: [titels]"
4. Tekst uitspreken (Nederlands)

## Apps laten maken door Echo
Zeg "Hey Echo, maak me een app die mijn uitgaven bijhoudt" (of alleen "maak me een app" en daarna je idee). Echo laat je AI-dienst een app schrijven en toont hem meteen op het scherm.
- "Pas de app aan: maak de knoppen groter" verbetert de app die je net hebt gemaakt.
- **Opslaan** bewaart hem; "mijn apps" en "open app [naam]" halen hem terug. **Delen** stuurt het bestand door.
- De app is een webpagina in een afgesloten vak: hij kan je sleutel niet zien en geen internet gebruiken, en kan zelf niets bewaren nadat je hem sluit.
- Hij draait binnen Echo. Wil je hem als eigen app op je beginscherm, zet dan het gedeelde bestand online (zoals bij stap 1).
- Gratis modellen schrijven soms foutjes of kappen lange apps af. Probeer het opnieuw of vraag om een eenvoudiger app.

## Wat niet kan zonder pc
- **Alleen jouw stem**: dat vraagt een stemmodel dat in Safari niet betrouwbaar draait. Hier is een **pincode** voor in de plaats. Op iOS 18 en nieuwer kun je de app mogelijk ook met Face ID vergrendelen (icoon ingedrukt houden), controleer of dat werkt.
- **"Hey Echo" op de achtergrond**: iOS laat dat niet toe. Het werkt alleen terwijl de app open staat en het scherm aan is.
- **Melding nieuw apparaat**: een webapp kan je netwerk niet scannen. Zet de apparaatmelding aan in de app van je router, of gebruik het pc-pakket.

## Ray-Ban Meta bril (Echo Glasses)
In de map `ios-companion` staat een kleine iOS-app die je bril met Echo verbindt. Die moet op een Mac met Xcode gebouwd worden, zie `ios-companion/README-XCODE.md`.
- Zet in Echo > Instellingen eerst je AI-aanbieder en sleutel in en tik op **Opslaan**.
- Tik daarna op **Koppel bril-app**. De configuratie staat nu op je klembord; plak hem in de Echo Glasses-app (Instellingen).
- De rest van Echo (spraak, nieuws, weer, app-maker) werkt zoals voorheen en is niet aangepast.
