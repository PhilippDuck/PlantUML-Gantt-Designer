/**
 * IndexedDB Helper für Gantt Designer Pro
 * Speichert und lädt Projektdaten persistent im Browser.
 */

const DB_NAME = 'GanttDesignerPro';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const DEFAULT_KEY = 'current';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveProject(data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ ...data, savedAt: new Date().toISOString() }, DEFAULT_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadProject() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(DEFAULT_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

export function exportToJSON(data) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const filename = `gantt-projekt-${new Date().toISOString().split('T')[0]}.json`;
    
    const triggerLinkDownload = () => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
    };

    // Navigator-basierter Download (moderne Browser), Fallback bei Fehler
    if (window.showSaveFilePicker) {
        window.showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        }).then(async handle => {
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
        }).catch((err) => {
            if (err?.name !== 'AbortError') triggerLinkDownload();
        });
        return;
    }

    triggerLinkDownload();
}

export function importFromJSON() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return reject(new Error('Keine Datei ausgewählt'));
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    resolve(data);
                } catch (err) {
                    reject(new Error('Ungültige JSON-Datei'));
                }
            };
            reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'));
            reader.readAsText(file);
        };
        input.click();
    });
}
