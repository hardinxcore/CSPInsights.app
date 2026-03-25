# Onderhoudshandleiding: CSP Insights

Dit document beschrijft de technische opzet van de applicatie en geeft richtlijnen voor toekomstig onderhoud en beheer.

## 1. Technologie Stack

De applicatie is gebouwd met moderne, performante webtechnologieën:

*   **Framework**: React 19 + TypeScript (voor type-veiligheid).
*   **Build Tool**: Vite (voor razendsnelle opstarttijden en builds).
*   **State Management**: Zustand (lichtgewicht alternatief voor Redux).
*   **Database**: IndexedDB (via `idb` bibliotheek) voor lokale opslag van grote datasets in de browser.
*   **Parsing**: PapaParse (CSV) en SheetJS/xlsx (Excel export).
*   **Performance**: Web Workers (achtergrond processen) voor het inlezen van bestanden zonder de interface te bevriezen.
*   **Styling**: Pure CSS met CSS Variables (in `App.css` en `index.css`) voor thema's (Dark/Light mode).

## 2. Project Structuur

*   `src/components`: Alle UI onderdelen (knoppen, tabellen, upload schermen).
    *   `Dashboard.tsx`: Het hoofdscherm met de factuurdetails.
    *   `PricingView.tsx`: De prijslijst catalogus.
    *   `RebillingTable.tsx`: De gegroepeerde "Re-Billing" tabel per klant.
*   `src/store`: De "hersenen" van de app. Hier wordt data beheerd.
    *   `billingStore.ts`: Bevat de geïmporteerde factuurregels.
    *   `pricingStore.ts`: Bevat de catalogus en favorieten.
    *   `cartStore.ts`: Bevat het winkelmandje.
*   `src/utils`: Hulpprogramma's.
    *   `csvParser.ts`: Logica om de specifieke Microsoft CSV formaten te lezen.
    *   `db.ts`: Directe interactie met de lokale browser database.
    *   `backup.ts`: De logic voor Backup & Restore.
*   `src/workers`: Achtergrondscripts.
    *   `csv.worker.ts` & `pricing.worker.ts`: Zorgen dat de app soepel blijft tijdens het uploaden van grote bestanden.

## 3. Data & Opslag

De app slaat **niets** op in de cloud. Alle data staat lokaal in de browser van de gebruiker (IndexedDB).

*   **Persistentie**: Als je de browser sluit en weer opent, blijft de data bewaard.
*   **Privacy**: Er wordt geen data naar een server gestuurd, behalve als je zelf een externe link klikt (bv. download van Microsoft).
*   **Backup**: Gebruik de Backup-functie in Instellingen om data veilig te stellen of over te zetten naar een andere PC.

## 4. Veelvoorkomende Taken

### A. Microsoft verandert het CSV formaat
Als Microsoft kolommen toevoegt of hernoemt in hun facturatie-export, moet je kijken naar:
1.  `src/utils/csvParser.ts`: Hier worden kolomnamen gemapt naar onze interne `BillingRecord` structuur.
2.  `src/types/BillingData.ts`: Hier definieer je de TypeScript types. Pas dit aan als er nieuwe velden bij komen die je wilt gebruiken.

### B. Nieuwe functionaliteit toevoegen
1.  Maak component in `src/components`.
2.  Als het data nodig heeft, gebruik een 'store' uit `src/store`.
3.  Voeg het toe aan de `App.tsx` routering of als onderdeel van een bestaande pagina.

### C. Updates draaien
Draai regelmatig updates voor beveiliging en performance:
```bash
npm update
```
**Let op**: Grote updates (bijv. React 20) kunnen brekende wijzigingen hebben. Test altijd goed na een update.

## 5. Bekende Aandachtspunten

*   **Geheugen**: Omdat alles in de browser draait, kunnen bestanden van >500MB de browser vertragen. De Web Workers helpen hierbij, maar er is een limiet aan browsergeheugen.
*   **Cache**: Als je een nieuwe versie van de app publiceert ("deploy"), moeten gebruikers soms hun scherm verversen (Ctrl+F5) om de nieuwe versie te zien.

## 6. Backup Strategie voor Ontwikkelaars
Maak altijd een 'commit' in Git voordat je grote wijzigingen doet.
