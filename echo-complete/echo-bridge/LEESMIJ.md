# Echo Bridge: Samsung-tv's en je Windows-pc bedienen

Klein programma dat op je Windows-pc draait. Je opent daarna een afstandsbediening-pagina op je iPhone (zelfde wifi).

## Installeren (eenmalig)
1. Installeer Python van python.org. **Vink "Add python.exe to PATH" aan.**
2. Zet de map `echo-bridge` ergens op je pc.
3. Dubbelklik `start-echo-bridge.bat`.
4. Eerste keer vraagt het naar je tv's: naam, IP-adres en MAC-adres (op de tv: Instellingen > Algemeen > Netwerk > Netwerkstatus). Laat leeg als je geen tv wilt. Je kunt later `config.json` aanpassen.
5. Windows vraagt of Python het netwerk mag gebruiken: kies **alleen Privénetwerk**.
6. In het zwarte venster staat een adres met `#t=…`. Stuur dat naar jezelf (mail/WhatsApp), open het in Safari op je iPhone, en kies Deel > Zet op beginscherm.

Het venster moet open blijven. Wil je dat de bridge automatisch start, zet dan een snelkoppeling naar de .bat in `shell:startup`.

## Samsung-tv
- Eerste commando: de tv toont een melding **"Toestaan?"**. Kies Toestaan. De bridge onthoudt dat daarna (bestand `tv-….token`).
- Aanzetten werkt via Wake-on-LAN en heeft het MAC-adres nodig. Op sommige tv's moet je dit aanzetten (zoek in de netwerkinstellingen naar "Inschakelen met mobiel" of vergelijkbaar; de naam verschilt per model).
- Aan/uit-knop is een wisselknop; "Aanzetten" is de wake-opdracht.
- Gemaakt voor Samsung Smart TV's (Tizen, ongeveer 2016 en nieuwer). Niet getest op jouw model.

## Windows-pc
Vergrendelen, slaapstand, volume, mute, afspelen/pauze, volgende/vorige, apps uit `config.json`.
- **Uitzetten en herstarten** wachten 30 seconden en vragen eerst bevestiging. **Annuleer** stopt het.
- Slaapstand kan op sommige pc's hibernate worden als dat aanstaat.
- Het programma moet draaien in jouw ingelogde Windows-sessie (zoals nu met de .bat).
- Eigen apps toevoegen: in `config.json` onder `apps`, bijv. `"Spotify": "C:\\Users\\jij\\AppData\\Roaming\\Spotify\\Spotify.exe"`. Alleen apps uit dat bestand zijn te starten.

## Beveiliging
- Alleen bereikbaar vanaf privé-IP-adressen (je thuisnetwerk). Zet je router **niet** open naar buiten (geen port-forwarding).
- Elke opdracht vereist de geheime token. Deel het adres met `#t=…` niet.
- Er is geen opdracht om willekeurige commando's uit te voeren; alleen de vaste acties.
- Het verkeer is niet versleuteld (gewoon http op je eigen wifi). Gebruik het dus niet op een openbaar wifi.

## In ECHO
- ECHO > Instellingen > **Echo Bridge-adres**: plak het adres (met `#t=…`) en tik op Opslaan.
- De knop **TV & PC** in ECHO opent dan de afstandsbediening.
- Stemopdrachten in ECHO zelf ("zet de tv harder") werken nog niet: ECHO draait op https en Safari blokkeert vanaf daar verbindingen naar een http-adres op je netwerk. Dat vraagt een andere aanpak (zie chat).

## Niet getest
Ik heb de server, de token-controle en de validatie getest, maar niet met een echte Samsung-tv of op Windows. Werkt iets niet, noteer dan de foutmelding onderin het scherm of in het zwarte venster.
