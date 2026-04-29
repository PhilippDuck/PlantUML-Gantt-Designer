import React, { useState, useMemo } from 'react';
import {
    Plus,
    Trash2,
    ArrowRight,
    Copy,
    Check,
    Calendar,
    Clock,
    Flag,
    Layout,
    ExternalLink,
    RefreshCw,
    AlertCircle,
    CalendarDays,
    Settings,
    Minus,
    X,
    FileText,
    GripVertical,
    Bold,
    Italic
} from 'lucide-react';

/**
 * PlantUML Hex-Encoding
 */
function encodePlantUMLHex(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    return Array.from(data)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Hilfsfunktion: Zieht Tage von einem Datum ab (für visuelles Padding)
function getPaddedStartDate(dateStr, daysToSubtract) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    d.setUTCDate(d.getUTCDate() - Math.abs(daysToSubtract));
    return d.toISOString().split('T')[0];
}

export default function App() {
    const [tasks, setTasks] = useState([
        { id: 'sep1', name: 'Phase 1: Vorbereitung', duration: 0, dependsOn: '', startDate: '', endDate: '', color: '', note: '', showNote: false, isMilestone: false, isSeparator: true },
        { id: '1', name: 'Projekt-Kickoff', duration: 1, dependsOn: '', startDate: '', endDate: '', color: '', note: '', showNote: false, isMilestone: true, isSeparator: false, isBold: true },
        { id: '2', name: 'Marktanalyse', duration: 5, dependsOn: '1', startDate: '', endDate: '', color: '#87ceeb', note: 'Marktdaten sammeln\nWettbewerber analysieren', showNote: true, isMilestone: false, isSeparator: false },
        { id: '3', name: 'Zielgruppen-Definition', duration: 3, dependsOn: '2', startDate: '', endDate: '', color: '', note: '', showNote: false, isMilestone: false, isSeparator: false, isItalic: true },
        { id: 'sep2', name: 'Phase 2: Umsetzung', duration: 0, dependsOn: '', startDate: '', endDate: '', color: '', note: '', showNote: false, isMilestone: false, isSeparator: true },
        { id: '4', name: 'Fester Meilenstein', duration: 1, dependsOn: '', startDate: '2024-05-15', endDate: '', color: '#f08080', note: '', showNote: false, isMilestone: true, isSeparator: false, textColor: '#dc2626', isBold: true },
        { id: '5', name: 'Prototyping', duration: 7, dependsOn: '3', startDate: '', endDate: '', color: '#98fb98', note: '', showNote: false, isMilestone: false, isSeparator: false },
    ]);

    const [title, setTitle] = useState('Mein Projektplan');
    const [startDate, setStartDate] = useState('2024-05-01');
    const [settings, setSettings] = useState({
        scale: 'daily',
        hideWeekends: true,
        language: 'de',
        alignment: 'left', // Standard auf linksbündig für bessere Lesbarkeit
        labelColumn: 'none' // NEU: Spalten-Modus für Aufgaben-Namen
    });
    const [copied, setCopied] = useState(false);
    const [imgError, setImgError] = useState(false);

    // Drag and Drop States
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    const addTask = (index, isSeparator = false) => {
        const newId = Math.max(0, ...tasks.map(t => parseInt(t.id) || 0)) + 1 + "";
        const newTasks = [...tasks];
        newTasks.splice(index + 1, 0, {
            id: newId,
            name: isSeparator ? `Neue Phase ${newId}` : `Neue Aufgabe ${newId}`,
            duration: 5,
            dependsOn: '',
            startDate: '',
            endDate: '',
            color: '',
            note: '',
            showNote: false,
            isMilestone: false,
            isSeparator: isSeparator,
            isBold: false,
            isItalic: false,
            textColor: ''
        });
        setTasks(newTasks);
        setImgError(false);
    };

    const removeTask = (id) => {
        if (tasks.length <= 1) return;
        setTasks(tasks.filter(t => t.id !== id));
        setImgError(false);
    };

    const updateTask = (id, field, value) => {
        setTasks(tasks.map(t => {
            if (t.id === id) {
                const updated = { ...t, [field]: value };
                // Entweder-Oder-Logik: Festes Datum löscht Abhängigkeit und umgekehrt
                if (field === 'startDate' && value !== '') updated.dependsOn = '';
                if (field === 'dependsOn' && value !== '') updated.startDate = '';
                return updated;
            }
            return t;
        }));
        setImgError(false);
    };

    // Drag and Drop Logic
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        // Erlaubt das Verschieben und reduziert die Deckkraft des gezogenen Elements
        e.dataTransfer.effectAllowed = 'move';
        // Firefox braucht manchmal explizite Daten im dataTransfer Objekt
        e.dataTransfer.setData('text/plain', index);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault(); // Zwingend erforderlich, um ein "Drop" zuzulassen
        if (dragOverIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setDragOverIndex(null);
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();

        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        const newTasks = [...tasks];
        const draggedTask = newTasks[draggedIndex];

        // Entferne die Aufgabe an der alten Position und füge sie an der neuen ein
        newTasks.splice(draggedIndex, 1);
        newTasks.splice(dropIndex, 0, draggedTask);

        // Bereinige ungültige Abhängigkeiten (Elternteil muss vor dem Kind stehen)
        const validTasks = newTasks.map((t, i) => {
            if (t.dependsOn) {
                const parentIndex = newTasks.findIndex(pt => pt.id === t.dependsOn);
                if (parentIndex >= i || parentIndex === -1) {
                    return { ...t, dependsOn: '' };
                }
            }
            return t;
        });

        setTasks(validTasks);
        setDraggedIndex(null);
        setDragOverIndex(null);
        setImgError(false);
    };

    const getSafeName = (task) => {
        let base = task.name.replace(/[\[\]]/g, '').trim() || `Task_${task.id}`;

        // PlantUML Creole Tags für Formatierung anwenden
        if (task.textColor) {
            base = `<color:${task.textColor}>${base}</color>`;
        }
        if (task.isItalic) {
            base = `//${base}//`;
        }
        if (task.isBold) {
            base = `**${base}**`;
        }

        return base;
    };

    const plantUMLCode = useMemo(() => {
        let code = `@startgantt\n`;
        code += `skinparam ganttArrowColor #333333\n`;

        // Globale Einstellungen anwenden
        if (settings.language) code += `language ${settings.language}\n`;
        if (settings.scale && settings.scale !== 'daily') code += `printscale ${settings.scale}\n`;
        if (settings.hideWeekends) {
            code += `saturday are closed\n`;
            code += `sunday are closed\n`;
        }

        // NEU: Echte Namens-Spalten basierend auf deinem Doku-Screenshot!
        if (settings.labelColumn === 'first') {
            code += `Label on first column and ${settings.alignment} aligned\n`;
        } else if (settings.labelColumn === 'last') {
            code += `Label on last column and ${settings.alignment} aligned\n`;
        } else {
            // Textausrichtung via Style-Block (nur wenn Labels in den Balken sind)
            code += `<style>\n`;
            code += `ganttDiagram {\n`;
            code += `  task {\n`;
            code += `    HorizontalAlignment ${settings.alignment}\n`;
            code += `  }\n`;
            code += `}\n`;
            code += `</style>\n`;
        }

        if (title) code += `title ${title}\n`;

        // Fallback auf heutiges Datum, falls das Feld leer ist
        const effectiveStartDate = startDate || new Date().toISOString().split('T')[0];

        // PlantUML Bugfix: Padding hinzufügen, damit linke Ränder/Pfeile nicht abgeschnitten werden
        let paddingDays = 2;
        if (settings.scale === 'weekly') paddingDays = 4;
        if (settings.scale === 'monthly') paddingDays = 10;
        if (settings.scale === 'quarterly') paddingDays = 15;
        if (settings.scale === 'yearly') paddingDays = 30;

        const displayStartDate = getPaddedStartDate(effectiveStartDate, paddingDays);
        code += `project starts ${displayStartDate}\n`;
        code += `\n`;

        tasks.forEach((t) => {
            if (t.isSeparator) {
                const separatorName = t.name.replace(/-/g, '').trim() || 'Trennlinie';
                code += `-- ${separatorName} --\n`;
                return;
            }

            const safeName = getSafeName(t);

            // FIX: Die korrekte PlantUML Gantt Syntax für Farben lautet "and is colored in"
            const colorStr = t.color ? ` and is colored in ${t.color}` : '';
            const taskBase = `[${safeName}]`;

            if (t.isMilestone) {
                code += `${taskBase} happens `;
                if (t.startDate) {
                    // Festes Startdatum für den Meilenstein
                    code += `${t.startDate}\n`;
                } else if (t.dependsOn) {
                    const depTask = tasks.find(pt => pt.id === t.dependsOn);
                    if (depTask) {
                        code += `at [${getSafeName(depTask)}]'s end\n`;
                    } else {
                        code += `${effectiveStartDate}\n`; // Explizites Startdatum!
                    }
                } else {
                    code += `${effectiveStartDate}\n`; // Explizites Startdatum!
                }
            } else {
                // Dauer ODER Enddatum
                if (t.endDate) {
                    code += `${taskBase} ends ${t.endDate}${colorStr}\n`;
                } else {
                    code += `${taskBase} lasts ${t.duration} days${colorStr}\n`;
                }

                // Startbedingung für normale Aufgaben
                if (t.startDate) {
                    code += `[${safeName}] starts ${t.startDate}\n`;
                } else if (t.dependsOn) {
                    const depTask = tasks.find(pt => pt.id === t.dependsOn);
                    if (depTask) {
                        code += `[${getSafeName(depTask)}] -> [${safeName}]\n`;
                    } else {
                        code += `[${safeName}] starts ${effectiveStartDate}\n`; // Explizites Startdatum!
                    }
                } else {
                    code += `[${safeName}] starts ${effectiveStartDate}\n`; // Explizites Startdatum!
                }
            }

            // NEU: Notiz anfügen (wird nur angefügt, wenn Text vorhanden ist)
            if (t.note && t.note.trim() !== '') {
                code += `note bottom\n${t.note.trim()}\nend note\n`;
            }
        });

        code += `\n@endgantt`;
        return code;
    }, [tasks, title, startDate, settings]);

    const hexEncoded = useMemo(() => encodePlantUMLHex(plantUMLCode), [plantUMLCode]);
    const previewUrl = `https://www.plantuml.com/plantuml/svg/~h${hexEncoded}`;

    const copyToClipboard = () => {
        const el = document.createElement('textarea');
        el.value = plantUMLCode;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                            <Layout className="text-blue-600" /> Gantt Designer Pro
                        </h1>
                        <p className="text-slate-500">Präzise Projektpläne ohne Syntax-Fehler.</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={copyToClipboard}
                            className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition shadow-sm font-medium"
                        >
                            {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                            {copied ? 'Kopiert!' : 'Code kopieren'}
                        </button>
                        <a
                            href={`https://www.plantuml.com/plantuml/uml/~h${hexEncoded}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm font-medium"
                        >
                            <ExternalLink size={18} />
                            Editor
                        </a>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Editor Section */}
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">Projekttitel</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                                />
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider flex items-center gap-1">
                                    <CalendarDays size={10} /> Projektstart
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                                />
                            </div>

                            {/* Settings Block */}
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 md:col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-wider flex items-center gap-1">
                                    <Settings size={12} /> Darstellung & Kalender
                                </label>
                                <div className="flex flex-wrap gap-x-6 gap-y-3 items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-slate-500 font-bold uppercase">Ansicht:</span>
                                        <select
                                            value={settings.scale}
                                            onChange={(e) => setSettings({ ...settings, scale: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                            <option value="daily">Täglich</option>
                                            <option value="weekly">Wöchentlich (KW)</option>
                                            <option value="monthly">Monatlich</option>
                                            <option value="quarterly">Quartal</option>
                                            <option value="yearly">Jährlich</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-slate-500 font-bold uppercase">Sprache:</span>
                                        <select
                                            value={settings.language}
                                            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                            <option value="de">Deutsch</option>
                                            <option value="en">Englisch</option>
                                            <option value="fr">Französisch</option>
                                        </select>
                                    </div>

                                    {/* NEU: Textausrichtung */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-slate-500 font-bold uppercase">Textausrichtung:</span>
                                        <select
                                            value={settings.alignment}
                                            onChange={(e) => setSettings({ ...settings, alignment: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                            <option value="left">Links</option>
                                            <option value="center">Mittig</option>
                                            <option value="right">Rechts</option>
                                        </select>
                                    </div>

                                    {/* NEU: Spalten-Layout (wie im Doku-Screenshot) */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-slate-500 font-bold uppercase">Beschriftung:</span>
                                        <select
                                            value={settings.labelColumn}
                                            onChange={(e) => setSettings({ ...settings, labelColumn: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                            <option value="none">Am Balken</option>
                                            <option value="first">Erste Spalte (Links)</option>
                                            <option value="last">Letzte Spalte (Rechts)</option>
                                        </select>
                                    </div>

                                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded transition border border-transparent hover:border-slate-200">
                                        <input
                                            type="checkbox"
                                            checked={settings.hideWeekends}
                                            onChange={(e) => setSettings({ ...settings, hideWeekends: e.target.checked })}
                                            className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-[11px] text-slate-500 font-bold uppercase">Wochenenden ausblenden</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                                    <Calendar size={18} className="text-blue-500" /> Aufgabenliste
                                </h2>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] text-slate-400 font-medium bg-slate-200/50 px-2 py-0.5 rounded hidden md:block" title="Nutze die Buttons für Text-Styling!">Tipp: Text markieren und formatieren per Toolbar!</span>
                                    <span className="text-xs text-slate-400 font-medium">{tasks.length} Einträge</span>
                                </div>
                            </div>

                            <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto custom-scrollbar" onDragLeave={handleDragLeave}>
                                {tasks.map((task, index) => (
                                    <div
                                        key={task.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDrop={(e) => handleDrop(e, index)}
                                        onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                                        className={`p-4 transition group flex flex-col gap-3 relative
                      ${task.isSeparator ? 'bg-slate-800 text-white rounded-lg my-1 mx-2 shadow-sm' : 'bg-white hover:bg-slate-50'}
                      ${draggedIndex === index ? 'opacity-40 scale-[0.99]' : ''}
                      ${dragOverIndex === index && draggedIndex !== index ? 'border-t-2 border-t-blue-500 bg-blue-50/30' : ''}
                    `}
                                        style={{ paddingLeft: '16px' }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex flex-col gap-1 mt-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-blue-500">
                                                <GripVertical size={18} className={task.isSeparator ? "text-slate-500" : ""} />
                                            </div>

                                            <div className="flex-1 flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    {task.isSeparator ? (
                                                        <Minus size={16} className="text-slate-400 shrink-0" />
                                                    ) : task.isMilestone ? (
                                                        <Flag size={16} className="text-orange-500 shrink-0 fill-orange-500/20" />
                                                    ) : (
                                                        <Clock size={16} className="text-blue-500 shrink-0" />
                                                    )}
                                                    <input
                                                        type="text"
                                                        value={task.name}
                                                        onChange={(e) => updateTask(task.id, 'name', e.target.value)}
                                                        className={`bg-transparent font-medium border-b border-transparent outline-none flex-1 min-w-[100px] py-0.5 ${task.isSeparator ? 'text-white hover:border-slate-500 focus:border-slate-300 uppercase tracking-wider text-sm' : 'text-slate-800 hover:border-slate-200 focus:border-blue-500'}`}
                                                        style={{
                                                            fontWeight: task.isBold ? 'bold' : 'normal',
                                                            fontStyle: task.isItalic ? 'italic' : 'normal',
                                                            color: task.textColor || 'inherit'
                                                        }}
                                                        placeholder={task.isSeparator ? "Trennlinie / Phase..." : "Name..."}
                                                    />

                                                    {/* NEU: Inline Text-Styling Toolbar */}
                                                    {!task.isSeparator && (
                                                        <div className="flex items-center gap-0.5 bg-slate-100/80 rounded-md border border-slate-200 px-1 py-0.5 shadow-sm opacity-0 focus-within:opacity-100 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => updateTask(task.id, 'isBold', !task.isBold)}
                                                                className={`p-1 rounded transition ${task.isBold ? 'bg-slate-300 text-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'}`}
                                                                title="Fett"
                                                            ><Bold size={12} /></button>

                                                            <button
                                                                onClick={() => updateTask(task.id, 'isItalic', !task.isItalic)}
                                                                className={`p-1 rounded transition ${task.isItalic ? 'bg-slate-300 text-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'}`}
                                                                title="Kursiv"
                                                            ><Italic size={12} /></button>

                                                            <div className="relative flex items-center justify-center w-6 h-6 rounded hover:bg-slate-200 text-slate-400 cursor-pointer overflow-hidden" title="Schriftfarbe">
                                                                <span className="text-[14px] font-serif font-bold leading-none mt-0.5" style={{ color: task.textColor || 'inherit' }}>A</span>
                                                                <input
                                                                    type="color"
                                                                    value={task.textColor || '#000000'}
                                                                    onChange={(e) => updateTask(task.id, 'textColor', e.target.value)}
                                                                    className="absolute -top-2 -left-2 w-10 h-10 opacity-0 cursor-pointer"
                                                                />
                                                            </div>
                                                            {task.textColor && (
                                                                <button
                                                                    onClick={() => updateTask(task.id, 'textColor', '')}
                                                                    className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                                    title="Schriftfarbe zurücksetzen"
                                                                ><X size={12} /></button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {!task.isSeparator && (
                                                    <>
                                                        <div className="flex flex-wrap items-center gap-3 text-[12px]">
                                                            {!task.isMilestone && (
                                                                <div className="flex items-center bg-slate-100 rounded border border-slate-200 overflow-hidden">
                                                                    <select
                                                                        value={task.endDate ? 'date' : 'duration'}
                                                                        onChange={(e) => {
                                                                            if (e.target.value === 'date') {
                                                                                updateTask(task.id, 'endDate', task.startDate || startDate || new Date().toISOString().split('T')[0]);
                                                                            } else {
                                                                                updateTask(task.id, 'endDate', '');
                                                                            }
                                                                        }}
                                                                        className="bg-slate-200 px-2 py-1 outline-none text-[9px] font-bold uppercase text-slate-600 border-r border-slate-300 cursor-pointer"
                                                                        title="Endbedingung wählen"
                                                                    >
                                                                        <option value="duration">Dauer</option>
                                                                        <option value="date">Bis</option>
                                                                    </select>

                                                                    <div className="px-2 py-0.5">
                                                                        {!task.endDate ? (
                                                                            <div className="flex items-center gap-1">
                                                                                <input
                                                                                    type="number"
                                                                                    value={task.duration}
                                                                                    min="1"
                                                                                    onChange={(e) => updateTask(task.id, 'duration', parseInt(e.target.value) || 1)}
                                                                                    className="w-8 bg-transparent font-bold text-center outline-none text-[11px]"
                                                                                />
                                                                                <span className="text-slate-500 text-[11px] font-bold">T</span>
                                                                            </div>
                                                                        ) : (
                                                                            <input
                                                                                type="date"
                                                                                value={task.endDate}
                                                                                onChange={(e) => updateTask(task.id, 'endDate', e.target.value)}
                                                                                className="bg-transparent outline-none text-[11px] max-w-[100px]"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div className="flex items-center bg-slate-100 rounded border border-slate-200 overflow-hidden">
                                                                <select
                                                                    value={task.startDate ? 'date' : 'task'}
                                                                    onChange={(e) => {
                                                                        if (e.target.value === 'date') {
                                                                            updateTask(task.id, 'startDate', startDate || new Date().toISOString().split('T')[0]);
                                                                        } else {
                                                                            updateTask(task.id, 'startDate', '');
                                                                        }
                                                                    }}
                                                                    className="bg-slate-200 px-2 py-1 outline-none text-[9px] font-bold uppercase text-slate-600 border-r border-slate-300 cursor-pointer"
                                                                    title="Startbedingung wählen"
                                                                >
                                                                    <option value="task">Nach</option>
                                                                    <option value="date">Am</option>
                                                                </select>

                                                                <div className="px-2 py-0.5">
                                                                    {!task.startDate ? (
                                                                        <select
                                                                            value={task.dependsOn}
                                                                            onChange={(e) => updateTask(task.id, 'dependsOn', e.target.value)}
                                                                            className="bg-transparent outline-none max-w-[90px] truncate text-[11px]"
                                                                        >
                                                                            <option value="">(Projektstart)</option>
                                                                            {tasks.slice(0, index).filter(t => !t.isSeparator).map(t => (
                                                                                <option key={t.id} value={t.id}>{t.name || `ID ${t.id}`}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : (
                                                                        <input
                                                                            type="date"
                                                                            value={task.startDate}
                                                                            onChange={(e) => updateTask(task.id, 'startDate', e.target.value)}
                                                                            className="bg-transparent outline-none text-[11px] max-w-[100px]"
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title="Farbe wählen">
                                                                <input
                                                                    type="color"
                                                                    value={task.color || '#cbd5e1'}
                                                                    onChange={(e) => updateTask(task.id, 'color', e.target.value)}
                                                                    className="w-4 h-4 p-0 border-0 rounded cursor-pointer bg-transparent"
                                                                />
                                                                {task.color && (
                                                                    <button
                                                                        onClick={() => updateTask(task.id, 'color', '')}
                                                                        className="text-slate-400 hover:text-red-500"
                                                                        title="Farbe zurücksetzen"
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {/* NEU: Notiz Toggle Button */}
                                                            <button
                                                                onClick={() => updateTask(task.id, 'showNote', !task.showNote)}
                                                                className={`flex items-center gap-1 px-2 py-0.5 rounded border transition ${task.showNote ? 'bg-yellow-100 border-yellow-300 text-yellow-700 shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'}`}
                                                                title="Notiz / Memo einblenden"
                                                            >
                                                                <FileText size={10} />
                                                                <span className="font-bold uppercase text-[9px]">Notiz</span>
                                                            </button>

                                                            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 px-2 py-0.5 rounded transition bg-slate-100 border border-slate-200">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={task.isMilestone}
                                                                    onChange={(e) => updateTask(task.id, 'isMilestone', e.target.checked)}
                                                                    className="w-3 h-3 rounded text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-slate-400 font-bold uppercase text-[9px]">MS</span>
                                                            </label>
                                                        </div>

                                                        {/* NEU: Notiz Textarea */}
                                                        {task.showNote && (
                                                            <div className="mt-1 w-full">
                                                                <textarea
                                                                    value={task.note || ''}
                                                                    onChange={(e) => updateTask(task.id, 'note', e.target.value)}
                                                                    placeholder="Notiz eingeben (z.B. Erklärungen, Links, Memos)..."
                                                                    className="w-full bg-yellow-50/80 border border-yellow-200 rounded p-2 text-[11px] text-slate-700 outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 resize-y min-h-[50px] custom-scrollbar shadow-inner"
                                                                />
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                                                <button onClick={() => addTask(index, false)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50" title="Aufgabe darunter einfügen"><Plus size={14} /></button>
                                                <button onClick={() => addTask(index, true)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200" title="Trennlinie darunter einfügen"><Minus size={14} /></button>
                                                <button onClick={() => removeTask(task.id)} className={`p-1.5 rounded-md ${task.isSeparator ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`} title="Löschen"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-px bg-slate-200 border-t border-slate-200">
                                <button
                                    onClick={() => addTask(tasks.length - 1, false)}
                                    className="py-4 bg-white hover:bg-blue-50 text-blue-600 font-bold flex items-center justify-center gap-2 transition"
                                >
                                    <Plus size={18} /> Aufgabe
                                </button>
                                <button
                                    onClick={() => addTask(tasks.length - 1, true)}
                                    className="py-4 bg-white hover:bg-slate-50 text-slate-600 font-bold flex items-center justify-center gap-2 transition"
                                >
                                    <Minus size={18} /> Trennlinie
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Preview Section */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 sticky top-8">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                                    <ArrowRight size={18} className="text-blue-500" /> Live-Vorschau
                                </h2>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4 flex flex-col items-center justify-center min-h-[300px] border border-slate-200 overflow-hidden relative">
                                {imgError ? (
                                    <div className="text-center p-8 text-red-400">
                                        <AlertCircle size={48} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-sm font-medium">Syntax-Fehler im Diagramm.</p>
                                        <p className="text-xs opacity-70">Prüfen Sie Namen auf Sonderzeichen.</p>
                                    </div>
                                ) : (
                                    <img
                                        src={previewUrl}
                                        alt="Gantt Diagramm"
                                        className="max-w-full h-auto transition-all duration-300"
                                        onLoad={() => setImgError(false)}
                                        onError={() => setImgError(true)}
                                    />
                                )}
                            </div>

                            <div className="mt-8">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PlantUML Output</h3>
                                </div>
                                <pre className="text-[11px] bg-slate-900 text-blue-300 p-4 rounded-xl overflow-x-auto border border-slate-800 font-mono leading-normal">
                                    {plantUMLCode}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
        </div>
    );
}