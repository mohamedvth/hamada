
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Department, Sheet, RatingsData, RatingValue, Statistics, AppState } from './types';
import { INITIAL_DEPARTMENTS, RATING_COLORS, RATING_LABELS } from './constants';
import { storageService } from './services/storageService';
import { exportService } from './services/exportService';

const App: React.FC = () => {
  // --- State ---
  const [departments, setDepartments] = useState<Record<string, Department>>({});
  const [ratings, setRatings] = useState<RatingsData>({});
  const [currentDeptId, setCurrentDeptId] = useState<string>("");
  const [currentSheetId, setCurrentSheetId] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Modals
  const [activeModal, setActiveModal] = useState<"employee" | "task" | "dept" | "sheet" | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [notification, setNotification] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Initialization ---
  useEffect(() => {
    const saved = storageService.load();
    if (saved && saved.departments) {
      setDepartments(saved.departments);
      setRatings(saved.ratings || {});
      const firstDeptId = Object.keys(saved.departments)[0];
      if (firstDeptId) {
        setCurrentDeptId(firstDeptId);
        const firstSheetId = Object.keys(saved.departments[firstDeptId].sheetsData)[0];
        if (firstSheetId) setCurrentSheetId(firstSheetId);
      }
    } else {
      setDepartments(INITIAL_DEPARTMENTS);
      const firstDeptId = Object.keys(INITIAL_DEPARTMENTS)[0];
      setCurrentDeptId(firstDeptId);
      setCurrentSheetId(Object.keys(INITIAL_DEPARTMENTS[firstDeptId].sheetsData)[0]);
    }
    setIsInitialized(true);
  }, []);

  // Auto-save
  useEffect(() => {
    if (isInitialized) {
      storageService.save({ departments, ratings, version: 1 });
    }
  }, [departments, ratings, isInitialized]);

  const showNotify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // --- Derived Data ---
  const currentDept = departments[currentDeptId];
  const currentSheet = currentDept?.sheetsData[currentSheetId];
  const currentSheetRatings = ratings[currentDeptId]?.[currentSheetId] || {};

  const stats: Statistics = useMemo(() => {
    if (!currentSheet) return { individualCompetence: {}, globalCompetence: 0, masteredTasks: {}, levelCounts: { 0: 0, 1: 0, 2: 0, 3: 0 } };
    
    const individualCompetence: Record<number, number> = {};
    const masteredTasks: Record<number, number> = {};
    const levelCounts: Record<RatingValue, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    let totalIndivPercent = 0;

    currentSheet.employees.forEach((_, empIdx) => {
      let mastered = 0;
      currentSheet.tasks.forEach((_, taskIdx) => {
        const r = currentSheetRatings[empIdx]?.[taskIdx] || 0;
        levelCounts[r]++;
        if (r >= 2) mastered++;
      });
      masteredTasks[empIdx] = mastered;
      const percent = currentSheet.tasks.length > 0 ? (mastered / currentSheet.tasks.length) * 100 : 0;
      individualCompetence[empIdx] = percent;
      totalIndivPercent += percent;
    });

    return {
      individualCompetence,
      globalCompetence: currentSheet.employees.length > 0 ? totalIndivPercent / currentSheet.employees.length : 0,
      masteredTasks,
      levelCounts
    };
  }, [currentSheet, currentSheetRatings]);

  // --- Handlers ---
  const handleRatingChange = (empIdx: number, taskIdx: number, value: RatingValue) => {
    setRatings(prev => ({
      ...prev,
      [currentDeptId]: {
        ...prev[currentDeptId],
        [currentSheetId]: {
          ...prev[currentDeptId]?.[currentSheetId],
          [empIdx]: {
            ...prev[currentDeptId]?.[currentSheetId]?.[empIdx],
            [taskIdx]: value
          }
        }
      }
    }));
  };

  const handleCreate = () => {
    if (!inputValue.trim()) return;
    const val = inputValue.trim();

    if (activeModal === "employee" && currentSheet) {
      setDepartments(prev => {
        const next = { ...prev };
        next[currentDeptId].sheetsData[currentSheetId].employees.push(val);
        return next;
      });
      showNotify(`Employé "${val}" ajouté.`);
    } else if (activeModal === "task" && currentSheet) {
      setDepartments(prev => {
        const next = { ...prev };
        next[currentDeptId].sheetsData[currentSheetId].tasks.push(val);
        return next;
      });
      showNotify("Nouvelle tâche créée.");
    } else if (activeModal === "dept") {
      const id = `dept-${Date.now()}`;
      setDepartments(prev => ({
        ...prev,
        [id]: { id, name: val, sheetsData: {} }
      }));
      setCurrentDeptId(id);
      setCurrentSheetId("");
      showNotify(`Département "${val}" créé.`);
    } else if (activeModal === "sheet" && currentDept) {
      const id = `sheet-${Date.now()}`;
      setDepartments(prev => {
        const next = { ...prev };
        next[currentDeptId].sheetsData[id] = { id, service: val, employees: [], tasks: [] };
        return next;
      });
      setCurrentSheetId(id);
      showNotify(`Service "${val}" créé.`);
    }

    setInputValue("");
    setActiveModal(null);
  };

  const deleteDept = () => {
    if (!confirm("Voulez-vous supprimer ce département et toutes ses données ?")) return;
    setDepartments(prev => {
      const next = { ...prev };
      delete next[currentDeptId];
      return next;
    });
    const remaining = Object.keys(departments).filter(id => id !== currentDeptId);
    setCurrentDeptId(remaining[0] || "");
    showNotify("Département supprimé.");
  };

  const deleteSheet = () => {
    if (!confirm("Voulez-vous supprimer ce service ?")) return;
    setDepartments(prev => {
      const next = { ...prev };
      delete next[currentDeptId].sheetsData[currentSheetId];
      return next;
    });
    const remaining = Object.keys(currentDept.sheetsData).filter(id => id !== currentSheetId);
    setCurrentSheetId(remaining[0] || "");
    showNotify("Service supprimé.");
  };

  const removeEmployee = (idx: number) => {
    if (!confirm("Supprimer cet employé ?")) return;
    setDepartments(prev => {
      const next = { ...prev };
      next[currentDeptId].sheetsData[currentSheetId].employees.splice(idx, 1);
      return next;
    });
    // Ratings cleaning (optional, simple logic relies on indices)
  };

  const removeTask = (idx: number) => {
    if (!confirm("Supprimer cette tâche ?")) return;
    setDepartments(prev => {
      const next = { ...prev };
      next[currentDeptId].sheetsData[currentSheetId].tasks.splice(idx, 1);
      return next;
    });
  };

  // --- Import / Export ---
  const exportDatabase = () => {
    const data = JSON.stringify({ departments, ratings, version: 1 }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scap_cb_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showNotify("Base de données exportée.");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as AppState;
        if (data.departments) {
          setDepartments(data.departments);
          setRatings(data.ratings || {});
          const firstDept = Object.keys(data.departments)[0];
          setCurrentDeptId(firstDept || "");
          if (firstDept) setCurrentSheetId(Object.keys(data.departments[firstDept].sheetsData)[0] || "");
          showNotify("Importation réussie !");
        }
      } catch (err) {
        alert("Erreur lors de l'importation. Fichier invalide.");
      }
    };
    reader.readAsText(file);
  };

  // --- Render ---
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white py-6 px-8 shadow-2xl border-b-4 border-sky-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight uppercase">Matrix <span className="text-sky-400">Pro</span></h1>
              <p className="text-slate-400 text-xs font-bold tracking-widest uppercase opacity-60">SCAP CB Competence Framework</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => currentSheet && exportService.toPDF(currentDept, currentSheet.service, currentSheet, currentSheetRatings, stats)}
              className="group bg-white/5 hover:bg-rose-600 border border-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-rose-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
              Export PDF
            </button>
            <button 
              onClick={() => currentSheet && exportService.toPPTX(currentDept, currentSheet.service, currentSheet, currentSheetRatings, stats)}
              className="group bg-white/5 hover:bg-amber-600 border border-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-amber-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              Export PPTX
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="bg-slate-100 p-2 rounded-lg">
              <span className="text-xs font-black text-slate-500 uppercase">Dept</span>
            </div>
            <select 
              value={currentDeptId} 
              onChange={(e) => { setCurrentDeptId(e.target.value); setCurrentSheetId(""); }}
              className="bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:border-sky-500 outline-none transition-all flex-grow min-w-[200px]"
            >
              <option value="" disabled>Choisir un département</option>
              {/* Fix: Added explicit Department type to Object.values map to resolve property access on unknown errors */}
              {Object.values(departments).map((d: Department) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button onClick={() => setActiveModal("dept")} className="p-2.5 text-sky-600 hover:bg-sky-50 rounded-xl transition-colors border border-sky-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            </button>
            {currentDeptId && (
              <button onClick={deleteDept} className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors border border-rose-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="bg-slate-100 p-2 rounded-lg">
              <span className="text-xs font-black text-slate-500 uppercase">Service</span>
            </div>
            <select 
              value={currentSheetId} 
              onChange={(e) => setCurrentSheetId(e.target.value)}
              disabled={!currentDeptId}
              className="bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:border-sky-500 outline-none transition-all flex-grow min-w-[200px] disabled:opacity-50"
            >
              <option value="" disabled>{currentDeptId ? "Choisir un service" : "Sélectionner d'abord un Dept"}</option>
              {/* Fix: Added explicit Sheet type to Object.values map to resolve property access on unknown errors */}
              {currentDept && Object.values(currentDept.sheetsData).map((s: Sheet) => (
                <option key={s.id} value={s.id}>{s.service}</option>
              ))}
            </select>
            <button 
              onClick={() => setActiveModal("sheet")} 
              disabled={!currentDeptId}
              className="p-2.5 text-sky-600 hover:bg-sky-50 rounded-xl transition-colors border border-sky-100 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            </button>
            {currentSheetId && (
              <button onClick={deleteSheet} className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors border border-rose-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-grow p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-10">
        {!currentSheet ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-300 animate-pulse">
            <svg className="w-24 h-24 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <h2 className="text-2xl font-black uppercase tracking-widest text-slate-400">Aucune donnée sélectionnée</h2>
            <p className="mt-2 font-medium">Sélectionnez un département et un service dans la barre supérieure</p>
          </div>
        ) : (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Action Bar for Current Sheet */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-4xl font-black text-slate-800 tracking-tight">{currentSheet.service}</h2>
                <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">{currentDept.name} • {currentSheet.tasks.length} Tâches • {currentSheet.employees.length} Employés</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setActiveModal("employee")} className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider shadow-lg shadow-sky-200 transition-all flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                  Employé
                </button>
                <button onClick={() => setActiveModal("task")} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider shadow-lg shadow-emerald-200 transition-all flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                  Tâche
                </button>
              </div>
            </div>

            {/* Matrix Card */}
            <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="p-6 text-left w-16 font-black text-slate-500">#</th>
                      <th className="p-6 text-left min-w-[350px] font-black uppercase text-xs tracking-widest border-r border-slate-700">Désignation des Tâches</th>
                      {currentSheet.employees.map((emp, idx) => (
                        <th key={idx} className="p-6 text-center min-w-[140px] relative group border-r border-slate-700 last:border-0">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-black uppercase text-[10px] tracking-tighter text-sky-400 block mb-1">Employé</span>
                            <span className="text-sm font-bold truncate w-24">{emp}</span>
                            <button onClick={() => removeEmployee(idx)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-rose-500 text-white rounded-full p-1 shadow-lg transition-all scale-75">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"></path></svg>
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentSheet.tasks.map((task, taskIdx) => (
                      <tr key={taskIdx} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-6 font-black text-slate-300 text-sm border-r border-slate-100">{taskIdx + 1}</td>
                        <td className="p-6 text-slate-700 font-medium relative pr-12 border-r border-slate-100">
                          {task}
                          <button onClick={() => removeTask(taskIdx)} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </td>
                        {currentSheet.employees.map((_, empIdx) => {
                          const rating = currentSheetRatings[empIdx]?.[taskIdx] || 0;
                          return (
                            <td key={empIdx} className="p-0 border-r border-slate-100 last:border-0">
                              <select 
                                value={rating}
                                onChange={(e) => handleRatingChange(empIdx, taskIdx, parseInt(e.target.value) as RatingValue)}
                                className={`w-full h-20 text-center font-black text-lg outline-none cursor-pointer transition-all border-b-4 ${RATING_COLORS[rating]} ${rating > 0 ? 'text-white' : 'text-slate-300 bg-white'}`}
                              >
                                <option value="0">0</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dashboards */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl flex flex-col justify-center">
                <span className="text-slate-400 font-black text-[10px] tracking-widest uppercase mb-2">Compétence Collective</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-slate-800">{stats.globalCompetence.toFixed(1)}</span>
                  <span className="text-xl font-bold text-sky-500">%</span>
                </div>
                <div className="mt-4 w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 transition-all duration-1000" style={{ width: `${stats.globalCompetence}%` }}></div>
                </div>
              </div>

              {currentSheet.employees.map((emp, idx) => (
                <div key={idx} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-sky-50 -mr-8 -mt-8 rounded-full z-0 opacity-50"></div>
                  <div className="relative z-10">
                    <span className="text-slate-400 font-black text-[10px] tracking-widest uppercase mb-1 block">Employé(e)</span>
                    <h4 className="text-xl font-black text-slate-800 truncate mb-6">{emp}</h4>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-4xl font-black text-slate-800">{stats.individualCompetence[idx].toFixed(0)}</span>
                      <span className="text-lg font-bold text-slate-400">%</span>
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
                      Maîtrise : <span className="text-emerald-500">{stats.masteredTasks[idx]}</span> / {currentSheet.tasks.length} tâches
                    </p>
                  </div>
                </div>
              ))}
            </section>

            {/* Legend Card */}
            <div className="bg-slate-900 p-10 rounded-[2.5rem] shadow-2xl text-white">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-2 h-10 bg-sky-500 rounded-full"></div>
                <h3 className="text-2xl font-black uppercase tracking-tight">Légende & Cotation</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.entries(RATING_LABELS).map(([val, label]) => (
                  <div key={val} className="flex flex-col gap-4 p-6 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-lg ${RATING_COLORS[val as unknown as RatingValue].split(' ')[0]}`}>
                      {val}
                    </div>
                    <span className="text-sm font-medium text-slate-300 leading-snug">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Persistence Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 py-12 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left space-y-2">
            <h5 className="font-black text-slate-800 uppercase tracking-widest text-sm">Data Management</h5>
            <p className="text-slate-500 text-xs font-medium">Sauvegarde locale automatique activée. Version de la base : 1.0.4</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
            <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              Importer JSON
            </button>
            <button onClick={exportDatabase} className="px-6 py-3 bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-900 shadow-xl shadow-slate-200 transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Télécharger Backup
            </button>
          </div>
        </div>
        <div className="mt-12 text-center">
           <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Document Propriété SCAP CB • © {new Date().getFullYear()} All Rights Reserved</p>
        </div>
      </footer>

      {/* Creation Modal */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-white/20">
            <div className="p-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800">
                    {activeModal === "employee" ? "Ajouter Employé" : 
                     activeModal === "task" ? "Nouvelle Tâche" : 
                     activeModal === "dept" ? "Nouveau Département" : "Nouveau Service"}
                  </h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Saisie de données</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Libellé / Désignation</label>
                  {activeModal === "task" ? (
                    <textarea 
                      value={inputValue} 
                      onChange={e => setInputValue(e.target.value)}
                      placeholder="Ex: Gestion des stocks, Analyse KPI..."
                      rows={4}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 focus:bg-white focus:border-sky-500 outline-none transition-all resize-none"
                      autoFocus
                    />
                  ) : (
                    <input 
                      type="text" 
                      value={inputValue} 
                      onChange={e => setInputValue(e.target.value)}
                      placeholder={activeModal === "employee" ? "Nom complet" : "Nom de l'entité"}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 focus:bg-white focus:border-sky-500 outline-none transition-all"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    />
                  )}
                </div>

                <div className="flex gap-4">
                  <button onClick={() => { setActiveModal(null); setInputValue(""); }} className="flex-1 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Annuler</button>
                  <button onClick={handleCreate} className="flex-[2] py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-black shadow-xl shadow-slate-200 transition-all">Confirmer</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {notification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 duration-500 z-[100] border border-white/10">
          <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></div>
          <span className="font-bold text-sm tracking-tight">{notification}</span>
        </div>
      )}
    </div>
  );
};

export default App;
