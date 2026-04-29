# PlantUML Gantt Designer Pro

Ein hochgradig anpassbarer, webbasierter Editor zum einfachen Erstellen und Verwalten von PlantUML Gantt-Diagrammen.

![Gantt Designer Pro](https://raw.githubusercontent.com/PhilippDuck/PlantUML-Gantt-Designer/main/public/preview.png) *(Beispielbild)*

## Features

*   **Visueller Editor:** Aufgaben, Meilensteine und Phasen (Trennlinien) per Drag & Drop organisieren.
*   **Fortschritt & Farben:** Individuelle Farben für Aufgaben und Meilensteine, inklusive visueller Fortschrittsanzeige (zweifarbig).
*   **Abhängigkeiten:** Einfaches Verknüpfen von Aufgaben (z.B. Aufgabe B startet nach Aufgabe A).
*   **Live-Vorschau:** Sofortiges Feedback durch den integrierten PlantUML-Server (`plantuml.com`).
*   **Lokale Speicherung:** Projektdaten bleiben sicher in deinem Browser (IndexedDB) gespeichert.
*   **Export/Import:** Projekte im JSON-Format exportieren und teilen.
*   **Single-File Build:** Das gesamte Tool wird als einzelne `index.html` kompiliert und kann offline genutzt werden.
*   **Direkt-Editor:** Mit einem Klick das Diagramm im offiziellen `editor.plantuml.com` öffnen.

## Nutzung (Live Demo)

Das Projekt wird automatisch über GitHub Pages bereitgestellt:
👉 **[Live ansehen & nutzen](https://philippduck.github.io/PlantUML-Gantt-Designer/)**

## Lokale Entwicklung

Das Projekt basiert auf **React**, **Tailwind CSS** und **Vite**.

1. Repository klonen:
   ```bash
   git clone https://github.com/PhilippDuck/PlantUML-Gantt-Designer.git
   cd PlantUML-Gantt-Designer
   ```

2. Abhängigkeiten installieren:
   ```bash
   npm install
   ```

3. Entwicklungsserver starten:
   ```bash
   npm run dev
   ```

4. Build erstellen (produziert eine portable `dist/index.html`):
   ```bash
   npm run build
   ```

## Lizenz

MIT License
