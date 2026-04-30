import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
    Italic,
    Download,
    Upload,
    ChevronDown,
    Eye,
    EyeOff
} from 'lucide-react';
import { saveProject, loadProject, exportToJSON, importFromJSON } from './db.js';

import plantumlEncoder from 'plantuml-encoder';

// Hilfsfunktion: Zieht Tage von einem Datum ab (für visuelles Padding)
function getPaddedStartDate(dateStr, daysToSubtract) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    d.setUTCDate(d.getUTCDate() - Math.abs(daysToSubtract));
    return d.toISOString().split('T')[0];
}

// Hilfsfunktion: Hellt eine Hex-Farbe für den unfertigen Aufgaben-Balken auf
function getLighterColor(hex, percent = 60) {
    if (!hex) return '';
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6) return `#${hex}`;

    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
    g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
    b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export default function App() {
    const [isLoaded, setIsLoaded] = useState(false);

    const defaultTasks = [
        { id: 'sep1', name: 'Phase 1: Vorbereitung', duration: 0, dependsOn: '', startDate: '', endDate: '', color: '', note: '', showNote: false, isMilestone: false, isSeparator: true },
        { id: '1', name: 'Projekt-Kickoff', duration: 1, dependsOn: '', startDate: '', endDate: '', color: '', note: '', showNote: false, isMilestone: true, isSeparator: false, isBold: true },
        { id: '2', name: 'Marktanalyse', duration: 5, dependsOn: '1', startDate: '', endDate: '', color: '#87ceeb', note: 'Marktdaten sammeln\nWettbewerber analysieren', showNote: true, isMilestone: false, isSeparator: false },
        { id: '3', name: 'Zielgruppen-Definition', duration: 3, dependsOn: '2', startDate: '', endDate: '', color: '', note: '', showNote: false, isMilestone: false, isSeparator: false, isItalic: true },
        { id: 'sep2', name: 'Phase 2: Umsetzung', duration: 0, dependsOn: '', startDate: '', endDate: '', color: '', note: '', showNote: false, isMilestone: false, isSeparator: true },
        { id: '4', name: 'Fester Meilenstein', duration: 1, dependsOn: '', startDate: '', endDate: '', color: '#f08080', note: '', showNote: false, isMilestone: true, isSeparator: false, textColor: '#dc2626', isBold: true },
        { id: '5', name: 'Prototyping', duration: 7, dependsOn: '3', startDate: '', endDate: '', color: '#98fb98', note: '', showNote: false, isMilestone: false, isSeparator: false },
    ];


    const [tasks, setTasks] = useState(defaultTasks);


    const [title, setTitle] = useState('Mein Projektplan');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [settings, setSettings] = useState({
        scale: 'daily',
        hideWeekends: true,
        language: 'de',
        alignment: 'left', // Standard auf linksbündig für bessere Lesbarkeit
        labelColumn: 'none', // Spalten-Modus für Aufgaben-Namen
        roundCorner: 0, // Abgerundete Ecken für Balken (0-20)
        hideFootbox: false, // Untere Zeitleiste ausblenden
        printscaleZoom: 1, // Zeitleisten-Zoom (1 = Standard, höher = breiter)
        startPadding: 2, // Tage Vorlauf vor Projektstart
        endPadding: 0, // Tage Nachlauf nach letzter Aufgabe
        milestoneSize: 11, // Globale Größe für Meilensteine
        globalScale: 1, // Zoom für gesamtes Diagramm
        showToday: true // Heute-Indikator anzeigen
    });
    const [copied, setCopied] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [expandedTasks, setExpandedTasks] = useState(new Set());

    const toggleExpanded = useCallback((id) => {
        setExpandedTasks(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const allExpanded = tasks.filter(t => !t.isSeparator).every(t => expandedTasks.has(t.id));
    const toggleAll = () => {
        if (allExpanded) {
            setExpandedTasks(new Set());
        } else {
            setExpandedTasks(new Set(tasks.filter(t => !t.isSeparator).map(t => t.id)));
        }
    };
    const [recentColors, setRecentColors] = useState([]);

    const addRecentColor = useCallback((color) => {
        if (!color) return;
        setRecentColors(prev => [color, ...prev.filter(c => c !== color)].slice(0, 8));
    }, []);

    // === IndexedDB: Laden beim Start ===
    useEffect(() => {
        loadProject().then(data => {
            if (data) {
                if (data.tasks) setTasks(data.tasks);
                if (data.title) setTitle(data.title);
                if (data.startDate) setStartDate(data.startDate);
                if (data.settings) setSettings(prev => ({ ...prev, ...data.settings }));
                if (data.recentColors) setRecentColors(data.recentColors);
            }
            setIsLoaded(true);
        }).catch(() => setIsLoaded(true));
    }, []);

    // === IndexedDB: Auto-Save bei Änderungen ===
    const saveTimer = useRef(null);
    useEffect(() => {
        if (!isLoaded) return;
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            saveProject({ tasks, title, startDate, settings, recentColors });
        }, 500);
        return () => clearTimeout(saveTimer.current);
    }, [tasks, title, startDate, settings, recentColors, isLoaded]);

    // === Export / Import ===
    const handleExport = () => {
        exportToJSON({ tasks, title, startDate, settings, recentColors });
    };

    const handleImport = async () => {
        try {
            const data = await importFromJSON();
            if (data.tasks) setTasks(data.tasks);
            if (data.title) setTitle(data.title);
            if (data.startDate) setStartDate(data.startDate);
            if (data.settings) setSettings(prev => ({ ...prev, ...data.settings }));
            if (data.recentColors) setRecentColors(data.recentColors);
        } catch (err) {
            alert(err.message);
        }
    };

    // Drag and Drop States
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    const addTask = (index, isSeparator = false) => {
        const newId = Math.max(0, ...tasks.map(t => parseInt(t.id) || 0)) + 1 + "";
        const prevTask = tasks[index];
        const autoDepend = !isSeparator && prevTask && !prevTask.isSeparator ? prevTask.id : '';
        const newTasks = [...tasks];
        newTasks.splice(index + 1, 0, {
            id: newId,
            name: isSeparator ? `Neue Phase ${newId}` : `Neue Aufgabe ${newId}`,
            duration: 5,
            dependsOn: autoDepend,
            startDate: '',
            endDate: '',
            color: '',
            note: '',
            showNote: false,
            isMilestone: false,
            isSeparator: isSeparator,
            isBold: false,
            isItalic: false,
            textColor: '',
            disabled: false
        });
        setTasks(newTasks);
        if (!isSeparator) setExpandedTasks(prev => new Set([...prev, newId]));
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
        if (task.fontSize && task.fontSize !== '11') {
            base = `<size:${task.fontSize}>${base}</size>`;
        }
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
        if (settings.globalScale && settings.globalScale !== 1) {
            code += `scale ${settings.globalScale}\n`;
        }
        if (settings.language) code += `language ${settings.language}\n`;
        if (settings.scale && settings.scale !== 'daily') {
            const zoomStr = settings.printscaleZoom > 1 ? ` zoom ${settings.printscaleZoom}` : '';
            code += `printscale ${settings.scale}${zoomStr}\n`;
        }
        if (settings.hideWeekends) {
            code += `saturday are closed\n`;
            code += `sunday are closed\n`;
        }
        if (settings.hideFootbox) {
            code += `hide footbox\n`;
        }

        // NEU: Echte Namens-Spalten basierend auf deinem Doku-Screenshot!
        code += `<style>\n`;
        code += `ganttDiagram {\n`;
        
        if (settings.labelColumn === 'none') {
            code += `  task {\n`;
            code += `    HorizontalAlignment ${settings.alignment}\n`;
            if (settings.roundCorner > 0) code += `    RoundCorner ${settings.roundCorner}\n`;
            code += `  }\n`;
        } else if (settings.roundCorner > 0) {
            code += `  task {\n`;
            code += `    RoundCorner ${settings.roundCorner}\n`;
            code += `  }\n`;
        }

        // Globale Meilenstein-Größe anwenden
        if (settings.milestoneSize && settings.milestoneSize !== 11) {
            code += `  milestone {\n`;
            code += `    FontSize ${settings.milestoneSize}\n`;
            code += `    Padding ${Math.floor((settings.milestoneSize - 11) / 1.5)}\n`;
            code += `  }\n`;
        }

        code += `}\n`;
        code += `</style>\n`;

        if (settings.labelColumn === 'first') {
            code += `Label on first column and ${settings.alignment} aligned\n`;
        } else if (settings.labelColumn === 'last') {
            code += `Label on last column and ${settings.alignment} aligned\n`;
        }

        if (title) code += `title ${title}\n`;

        // Fallback auf heutiges Datum, falls das Feld leer ist
        const effectiveStartDate = startDate || new Date().toISOString().split('T')[0];

        // Visuelles Padding: Vorlauf vor Projektstart
        const displayStartDate = getPaddedStartDate(effectiveStartDate, settings.startPadding);
        code += `project starts ${displayStartDate}\n`;
        
        // Heute-Indikator
        if (settings.showToday !== false) {
            const todayStr = new Date().toISOString().split('T')[0];
            code += `today is ${todayStr} and is colored in #ef4444\n`;
        }
        
        code += `\n`;

        tasks.forEach((t) => {
            if (t.disabled) return;
            if (t.isSeparator) {
                const separatorName = getSafeName(t).replace(/-/g, '').trim() || 'Trennlinie';
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
                
                // Meilenstein Farbe anwenden
                if (t.color) {
                    code += `${taskBase} is colored in ${t.color}\n`;
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

            // NEU: Fortschritt (Progress) für normale Aufgaben
            if (!t.isMilestone && t.progress && t.progress > 0) {
                code += `${taskBase} is ${t.progress}% completed\n`;
            }

            // Notiz anfügen (wird nur angefügt, wenn Text vorhanden ist und nicht deaktiviert)
            if (t.note && t.note.trim() !== '' && !t.noteDisabled) {
                code += `note bottom\n${t.note.trim()}\nend note\n`;
            }
        });

        // Visuelles Padding: Nachlauf nach letzter Aufgabe
        if (settings.endPadding > 0) {
            const lastTask = [...tasks].reverse().find(t => !t.isSeparator);
            if (lastTask) {
                const lastName = getSafeName(lastTask);
                code += `\n[ ] lasts ${settings.endPadding} days and is colored in transparent\n`;
                code += `[${lastName}] -[#transparent]-> [ ]\n`;
            }
        }

        code += `\n@endgantt`;
        return code;
    }, [tasks, title, startDate, settings]);

    const plantumlEncoded = useMemo(() => plantumlEncoder.encode(plantUMLCode), [plantUMLCode]);
    const previewUrl = `https://www.plantuml.com/plantuml/svg/${plantumlEncoded}`;

    // Debounced Preview URL – erst nach IndexedDB-Load und 3 s Ruhe generieren
    const [debouncedPreviewUrl, setDebouncedPreviewUrl] = useState('');
    const debounceTimer = useRef(null);
    useEffect(() => {
        if (!isLoaded) return;
        debounceTimer.current = setTimeout(() => {
            setDebouncedPreviewUrl(previewUrl);
            setImgError(false);
        }, 3000);
        return () => clearTimeout(debounceTimer.current);
    }, [previewUrl, isLoaded]);

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
        <div className="min-h-screen bg-slate-50 text-slate-900 p-3 md:p-5 lg:p-6 font-sans">
            <div className="max-w-[1920px] mx-auto">
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                            <Layout className="text-blue-600" /> Gantt Designer Pro
                        </h1>
                        <p className="text-slate-500">Präzise Projektpläne ohne Syntax-Fehler.</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSettingsOpen(true)}
                            className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition shadow-sm font-medium"
                            title="Einstellungen"
                        >
                            <Settings size={18} />
                            <span className="hidden md:inline">Einstellungen</span>
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition shadow-sm font-medium"
                            title="Projekt exportieren (JSON)"
                        >
                            <Download size={18} />
                            <span className="hidden md:inline">Export</span>
                        </button>
                        <button
                            onClick={handleImport}
                            className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition shadow-sm font-medium"
                            title="Projekt importieren (JSON)"
                        >
                            <Upload size={18} />
                            <span className="hidden md:inline">Import</span>
                        </button>
                        <button
                            onClick={copyToClipboard}
                            className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition shadow-sm font-medium"
                        >
                            {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                            {copied ? 'Kopiert!' : 'Code kopieren'}
                        </button>
                        <a
                            href={`https://editor.plantuml.com/uml/${plantumlEncoded}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm font-medium"
                        >
                            <ExternalLink size={18} />
                            Editor
                        </a>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5 lg:gap-6">
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
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                                    <Calendar size={18} className="text-blue-500" /> Aufgabenliste
                                </h2>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] text-slate-400 font-medium bg-slate-200/50 px-2 py-0.5 rounded hidden md:block" title="Nutze die Buttons für Text-Styling!">Tipp: Text markieren und formatieren per Toolbar!</span>
                                    <button
                                        onClick={toggleAll}
                                        className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 bg-slate-200/50 hover:bg-slate-200 px-2 py-0.5 rounded transition uppercase tracking-wide"
                                        title={allExpanded ? 'Alle einklappen' : 'Alle ausklappen'}
                                    >
                                        <ChevronDown size={11} className={`transition-transform ${allExpanded ? '' : '-rotate-90'}`} />
                                        {allExpanded ? 'Einklappen' : 'Ausklappen'}
                                    </button>
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
                                        <div className={`flex items-start gap-3 ${task.disabled ? 'opacity-40' : ''}`}>
                                            <div className="flex flex-col gap-1 mt-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-blue-500">
                                                <GripVertical size={18} className={task.isSeparator ? "text-slate-500" : ""} />
                                            </div>

                                            <div className="flex-1 flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => updateTask(task.id, 'disabled', !task.disabled)}
                                                        className={`shrink-0 transition-colors ${task.disabled ? 'text-slate-300 hover:text-slate-400' : (task.isSeparator ? 'text-slate-400 hover:text-slate-300' : 'text-slate-400 hover:text-slate-500')}`}
                                                        title={task.disabled ? 'Einschließen' : 'Ausklammern'}
                                                    >
                                                        {task.disabled ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
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
                                                        placeholder={task.isSeparator ? "Trennlinie / Phase..." : "Name..."}
                                                    />

                                                    {/* Inline Text-Styling Toolbar (für alle Zeilen) */}
                                                    <div className={`flex items-center gap-0.5 rounded-md border px-1 py-0.5 shadow-sm opacity-0 focus-within:opacity-100 group-hover:opacity-100 transition-opacity ${task.isSeparator ? 'bg-slate-700/80 border-slate-600' : 'bg-slate-100/80 border-slate-200'}`}>
                                                        <button
                                                            onClick={() => updateTask(task.id, 'isBold', !task.isBold)}
                                                            className={`p-1 rounded transition ${task.isBold ? (task.isSeparator ? 'bg-slate-500 text-white' : 'bg-slate-300 text-slate-800') : (task.isSeparator ? 'text-slate-400 hover:text-white hover:bg-slate-600' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200')}`}
                                                            title="Fett"
                                                        ><Bold size={12} /></button>

                                                        <button
                                                            onClick={() => updateTask(task.id, 'isItalic', !task.isItalic)}
                                                            className={`p-1 rounded transition ${task.isItalic ? (task.isSeparator ? 'bg-slate-500 text-white' : 'bg-slate-300 text-slate-800') : (task.isSeparator ? 'text-slate-400 hover:text-white hover:bg-slate-600' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200')}`}
                                                            title="Kursiv"
                                                        ><Italic size={12} /></button>

                                                        <div className={`relative flex items-center justify-center w-6 h-6 rounded cursor-pointer overflow-hidden ${task.isSeparator ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-200 text-slate-400'}`} title="Schriftfarbe">
                                                            <span className="text-[14px] font-serif font-bold leading-none mt-0.5" style={{ color: task.textColor || 'inherit' }}>A</span>
                                                            <input
                                                                type="color"
                                                                value={task.textColor || '#000000'}
                                                                onChange={(e) => updateTask(task.id, 'textColor', e.target.value)}
                                                                className="absolute -top-2 -left-2 w-10 h-10 opacity-0 cursor-pointer"
                                                            />
                                                        </div>
                                                        <select
                                                            value={task.fontSize || ''}
                                                            onChange={(e) => updateTask(task.id, 'fontSize', e.target.value)}
                                                            className={`bg-transparent outline-none cursor-pointer text-[10px] appearance-none font-bold text-center rounded pl-1 pr-0.5 ml-0.5 transition ${task.isSeparator ? 'text-slate-400 hover:bg-slate-600' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'}`}
                                                            title="Textgröße"
                                                        >
                                                            <option value="9">Größe XS</option>
                                                            <option value="11">Größe S</option>
                                                            <option value="">Größe M</option>
                                                            <option value="16">Größe L</option>
                                                            <option value="20">Größe XL</option>
                                                            <option value="26">Größe XXL</option>
                                                            <option value="36">Größe 3XL</option>
                                                        </select>
                                                        {task.textColor && (
                                                            <button
                                                                onClick={() => updateTask(task.id, 'textColor', '')}
                                                                className={`p-1 rounded ${task.isSeparator ? 'text-slate-400 hover:text-red-400 hover:bg-slate-600' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                                                                title="Schriftfarbe zurücksetzen"
                                                            ><X size={12} /></button>
                                                        )}
                                                    </div>
                                                </div>

                                                {!task.isSeparator && expandedTasks.has(task.id) && (
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
                                                                    onBlur={(e) => addRecentColor(e.target.value)}
                                                                    className="w-4 h-4 p-0 border-0 rounded cursor-pointer bg-transparent"
                                                                />
                                                                {recentColors.map(color => (
                                                                    <button
                                                                        key={color}
                                                                        onClick={() => { updateTask(task.id, 'color', color); }}
                                                                        className="w-3 h-3 rounded-full border border-white/60 shadow-sm flex-shrink-0 hover:scale-125 transition-transform"
                                                                        style={{ backgroundColor: color, outline: task.color === color ? '2px solid #3b82f6' : 'none', outlineOffset: '1px' }}
                                                                        title={color}
                                                                    />
                                                                ))}
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

                                                            {/* NEU: Fortschritts-Slider */}
                                                            {!task.isMilestone && (
                                                                <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title="Fortschritt (%)">
                                                                    <input
                                                                        type="range" min="0" max="100" step="10"
                                                                        value={task.progress || 0}
                                                                        onChange={(e) => updateTask(task.id, 'progress', parseInt(e.target.value))}
                                                                        className="w-16 h-1 accent-blue-500 cursor-pointer"
                                                                    />
                                                                    <span className="text-[10px] font-bold text-slate-500 w-7 text-right">{task.progress || 0}%</span>
                                                                </div>
                                                            )}

                                                            {/* NEU: Notiz Toggle Button */}
                                                            <button
                                                                onClick={() => {
                                                                    if (task.showNote) {
                                                                        updateTask(task.id, 'showNote', false);
                                                                    } else {
                                                                        updateTask(task.id, 'showNote', true);
                                                                    }
                                                                }}
                                                                className={`flex items-center gap-1 px-2 py-0.5 rounded border transition ${(task.note && task.note.trim() !== '') ? 'bg-yellow-100 border-yellow-300 text-yellow-700 shadow-sm' : (task.showNote ? 'bg-slate-200 border-slate-300 text-slate-600' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200')}`}
                                                                title={task.showNote ? 'Notiz einklappen' : 'Notiz einblenden'}
                                                            >
                                                                {task.showNote ? <X size={10} /> : <FileText size={10} />}
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
                                                            <div className="mt-1 w-full relative">
                                                                <textarea
                                                                    value={task.note || ''}
                                                                    onChange={(e) => updateTask(task.id, 'note', e.target.value)}
                                                                    placeholder="Notiz eingeben (z.B. Erklärungen, Links, Memos)..."
                                                                    className={`w-full ${task.noteDisabled ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-yellow-50/80 border-yellow-200 text-slate-700'} rounded p-2 pr-7 pb-6 text-[11px] outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 resize-y min-h-[60px] custom-scrollbar shadow-inner transition-colors`}
                                                                />
                                                                
                                                                <div className="absolute bottom-1.5 left-2 flex items-center gap-1.5">
                                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                                        <input 
                                                                            type="checkbox" 
                                                                            checked={!task.noteDisabled}
                                                                            onChange={(e) => updateTask(task.id, 'noteDisabled', !e.target.checked)}
                                                                            className="w-3 h-3 rounded text-yellow-600 focus:ring-yellow-500"
                                                                        />
                                                                        <span className={`text-[9px] font-bold uppercase ${task.noteDisabled ? 'text-slate-400' : 'text-yellow-700'}`}>Im Diagramm anzeigen</span>
                                                                    </label>
                                                                </div>

                                                                <button
                                                                    onClick={() => setTasks(tasks.map(t => t.id === task.id ? { ...t, note: '', showNote: false, noteDisabled: false } : t))}
                                                                    className="absolute top-1.5 right-1.5 p-0.5 rounded text-yellow-400 hover:text-red-500 hover:bg-red-50 transition"
                                                                    title="Notiz komplett löschen"
                                                                ><X size={12} /></button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-0.5 shrink-0">
                                                {!task.isSeparator && (
                                                    <button
                                                        onClick={() => toggleExpanded(task.id)}
                                                        className={`p-1.5 rounded-md transition ${expandedTasks.has(task.id) ? 'text-blue-500 bg-blue-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
                                                        title={expandedTasks.has(task.id) ? 'Einklappen' : 'Ausklappen'}
                                                    >
                                                        <ChevronDown size={14} className={`transition-transform duration-200 ${expandedTasks.has(task.id) ? '' : '-rotate-90'}`} />
                                                    </button>
                                                )}
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                                                    <button onClick={() => addTask(index, false)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50" title="Aufgabe darunter einfügen"><Plus size={14} /></button>
                                                    <button onClick={() => addTask(index, true)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200" title="Trennlinie darunter einfügen"><Minus size={14} /></button>
                                                    <button onClick={() => removeTask(task.id)} className={`p-1.5 rounded-md ${task.isSeparator ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`} title="Löschen"><Trash2 size={14} /></button>
                                                </div>
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
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar">
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
                                ) : !debouncedPreviewUrl ? (
                                    <div className="text-center p-8 text-slate-400">
                                        <RefreshCw size={32} className="mx-auto mb-2 opacity-40 animate-spin" />
                                        <p className="text-sm">Wird geladen…</p>
                                    </div>
                                ) : (
                                    <img
                                        src={debouncedPreviewUrl}
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

            {/* Settings Drawer */}
            {settingsOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSettingsOpen(false)} />
                    <div className="relative w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-slide-in">
                        <div className="flex items-center justify-between p-5 border-b border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Settings size={20} className="text-blue-600" /> Einstellungen
                            </h2>
                            <button
                                onClick={() => setSettingsOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                            ><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                            {/* Zeitachse */}
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Zeitachse & Projekt</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Projektstart</span>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Vorlauf (Tage)</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range" min="0" max="30"
                                                value={settings.startPadding}
                                                onChange={(e) => setSettings({ ...settings, startPadding: parseInt(e.target.value) })}
                                                className="w-24 h-1.5 accent-blue-500 cursor-pointer"
                                            />
                                            <span className="text-sm text-slate-600 font-mono w-6 text-center">{settings.startPadding}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Nachlauf (Tage)</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range" min="0" max="30"
                                                value={settings.endPadding}
                                                onChange={(e) => setSettings({ ...settings, endPadding: parseInt(e.target.value) })}
                                                className="w-24 h-1.5 accent-blue-500 cursor-pointer"
                                            />
                                            <span className="text-sm text-slate-600 font-mono w-6 text-center">{settings.endPadding}</span>
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-slate-100">
                                        <input
                                            type="checkbox"
                                            checked={settings.showToday !== false}
                                            onChange={(e) => setSettings({ ...settings, showToday: e.target.checked })}
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-slate-600">"Heute"-Linie anzeigen (Rot)</span>
                                    </label>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Ansicht</span>
                                        <select
                                            value={settings.scale}
                                            onChange={(e) => setSettings({ ...settings, scale: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="daily">Täglich</option>
                                            <option value="weekly">Wöchentlich (KW)</option>
                                            <option value="monthly">Monatlich</option>
                                            <option value="quarterly">Quartal</option>
                                            <option value="yearly">Jährlich</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-sm ${settings.scale === 'daily' ? 'text-slate-300' : 'text-slate-600'}`}>Zeitleisten-Zoom</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range" min="1" max="10" step="1"
                                                value={settings.printscaleZoom}
                                                onChange={(e) => setSettings({ ...settings, printscaleZoom: parseInt(e.target.value) })}
                                                className="w-24 h-1.5 accent-blue-500 cursor-pointer"
                                                disabled={settings.scale === 'daily'}
                                            />
                                            <span className={`text-sm font-mono w-6 text-center ${settings.scale === 'daily' ? 'text-slate-300' : 'text-slate-600'}`}>{settings.printscaleZoom}x</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Globaler Zoom</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range" min="0.5" max="3" step="0.1"
                                                value={settings.globalScale || 1}
                                                onChange={(e) => setSettings({ ...settings, globalScale: parseFloat(e.target.value) })}
                                                className="w-24 h-1.5 accent-blue-500 cursor-pointer"
                                            />
                                            <span className="text-sm text-slate-600 font-mono w-8 text-center">{settings.globalScale || 1}x</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Sprache</span>
                                        <select
                                            value={settings.language}
                                            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="de">Deutsch</option>
                                            <option value="en">Englisch</option>
                                            <option value="fr">Französisch</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* Darstellung */}
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Darstellung</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Textausrichtung</span>
                                        <select
                                            value={settings.alignment}
                                            onChange={(e) => setSettings({ ...settings, alignment: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="left">Links</option>
                                            <option value="center">Mittig</option>
                                            <option value="right">Rechts</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Beschriftung</span>
                                        <select
                                            value={settings.labelColumn}
                                            onChange={(e) => setSettings({ ...settings, labelColumn: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="none">Am Balken</option>
                                            <option value="first">Erste Spalte (Links)</option>
                                            <option value="last">Letzte Spalte (Rechts)</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Abgerundete Ecken</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range" min="0" max="20"
                                                value={settings.roundCorner}
                                                onChange={(e) => setSettings({ ...settings, roundCorner: parseInt(e.target.value) })}
                                                className="w-24 h-1.5 accent-blue-500 cursor-pointer"
                                            />
                                            <span className="text-sm text-slate-600 font-mono w-6 text-center">{settings.roundCorner}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Meilenstein-Größe</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range" min="11" max="30"
                                                value={settings.milestoneSize || 11}
                                                onChange={(e) => setSettings({ ...settings, milestoneSize: parseInt(e.target.value) })}
                                                className="w-24 h-1.5 accent-blue-500 cursor-pointer"
                                            />
                                            <span className="text-sm text-slate-600 font-mono w-6 text-center">{settings.milestoneSize || 11}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* Optionen */}
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Optionen</h3>
                                <div className="space-y-2">
                                    <label className="flex items-center justify-between cursor-pointer py-1.5">
                                        <span className="text-sm text-slate-600">Wochenenden ausblenden</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.hideWeekends}
                                            onChange={(e) => setSettings({ ...settings, hideWeekends: e.target.checked })}
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </label>
                                    <label className="flex items-center justify-between cursor-pointer py-1.5">
                                        <span className="text-sm text-slate-600">Footbox ausblenden</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.hideFootbox}
                                            onChange={(e) => setSettings({ ...settings, hideFootbox: e.target.checked })}
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slideIn 0.25s ease-out; }
      `}</style>
        </div>
    );
}