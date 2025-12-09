
import React, { useState } from 'react';
import { GROUPS } from '../types';

interface ReportSelectorModalProps {
  customNames: Record<string, string>;
  onClose: () => void;
  onGenerate: (startDate: number, endDate: number, title: string, targetGroup: string) => void;
  currentUser?: string | null; // New prop to identify the user role
}

type ReportType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';

const ReportSelectorModal: React.FC<ReportSelectorModalProps> = ({ customNames, onClose, onGenerate, currentUser }) => {
  const [activeType, setActiveType] = useState<ReportType>('DAILY');
  
  // Initialize targetGroup based on currentUser. If it's a Unit, force their ID.
  const [targetGroup, setTargetGroup] = useState<string>(
      (currentUser && currentUser !== 'CIOSP') ? currentUser : 'TODOS'
  );
  
  // Date inputs
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.floor(new Date().getMonth() / 3)); // 0-3
  const [selectedSemester, setSelectedSemester] = useState<number>(new Date().getMonth() < 6 ? 0 : 1); // 0 or 1

  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 5}, (_, i) => currentYear - i); // Last 5 years

  const getDisplayName = (id: string) => customNames[id] || id;

  const handleGenerate = () => {
    let start = 0;
    let end = 0;
    let title = "";

    // Helper to set time to start of shift (07:00 AM)
    const setShiftStart = (d: Date) => {
        d.setHours(7, 0, 0, 0);
        return d;
    };

    const dateObj = new Date(selectedDate + 'T00:00:00'); // Base date from input

    switch (activeType) {
        case 'DAILY':
            // Start: Selected Day at 07:00
            const startD = new Date(dateObj);
            setShiftStart(startD);
            
            // End: Next Day at 07:00
            const endD = new Date(startD);
            endD.setDate(endD.getDate() + 1);
            
            start = startD.getTime();
            end = endD.getTime();
            
            title = `RELATÓRIO DIÁRIO - PLANTÃO ${dateObj.toLocaleDateString()}`;
            break;

        case 'WEEKLY':
            // Calculate Monday of the selected week
            const day = dateObj.getDay();
            const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1); 
            
            // Start: Monday at 07:00
            const monday = new Date(dateObj);
            monday.setDate(diff);
            setShiftStart(monday);
            
            // End: Next Monday at 07:00 (7 days later)
            const nextMonday = new Date(monday);
            nextMonday.setDate(monday.getDate() + 7);

            start = monday.getTime();
            end = nextMonday.getTime();
            
            // For display purposes, show Monday to Sunday
            const sundayDisplay = new Date(nextMonday);
            sundayDisplay.setDate(sundayDisplay.getDate() - 1);
            
            title = `RELATÓRIO SEMANAL (${monday.toLocaleDateString()} a ${sundayDisplay.toLocaleDateString()})`;
            break;

        case 'MONTHLY':
            // Start: 1st of Month at 07:00
            const startM = new Date(selectedYear, selectedMonth, 1);
            setShiftStart(startM);
            
            // End: 1st of Next Month at 07:00
            const endM = new Date(selectedYear, selectedMonth + 1, 1);
            setShiftStart(endM);
            
            start = startM.getTime();
            end = endM.getTime();
            
            const monthName = new Date(selectedYear, selectedMonth).toLocaleString('pt-BR', { month: 'long' });
            title = `RELATÓRIO MENSAL - ${monthName.toUpperCase()}/${selectedYear}`;
            break;

        case 'QUARTERLY':
            // Q1: Jan(0)-Mar(2), Q2: Apr(3)-Jun(5), ...
            const startMonthQ = selectedQuarter * 3;
            
            // Start: 1st of Starting Month at 07:00
            const startQ = new Date(selectedYear, startMonthQ, 1);
            setShiftStart(startQ);
            
            // End: 1st of Month After Quarter at 07:00
            const endQ = new Date(selectedYear, startMonthQ + 3, 1);
            setShiftStart(endQ);

            start = startQ.getTime();
            end = endQ.getTime();
            title = `RELATÓRIO TRIMESTRAL - ${selectedQuarter + 1}º TRIMESTRE/${selectedYear}`;
            break;

        case 'SEMIANNUAL':
            // S1: Jan(0)-Jun(5), S2: Jul(6)-Dec(11)
            const startMonthS = selectedSemester * 6;
            
            const startS = new Date(selectedYear, startMonthS, 1);
            setShiftStart(startS);
            
            const endS = new Date(selectedYear, startMonthS + 6, 1);
            setShiftStart(endS);

            start = startS.getTime();
            end = endS.getTime();
            title = `RELATÓRIO SEMESTRAL - ${selectedSemester + 1}º SEMESTRE/${selectedYear}`;
            break;

        case 'ANNUAL':
            // Start: Jan 1st at 07:00
            const startA = new Date(selectedYear, 0, 1);
            setShiftStart(startA);
            
            // End: Jan 1st Next Year at 07:00
            const endA = new Date(selectedYear + 1, 0, 1);
            setShiftStart(endA);
            
            start = startA.getTime();
            end = endA.getTime();
            title = `RELATÓRIO ANUAL - ${selectedYear}`;
            break;
    }

    onGenerate(start, end, title, targetGroup);
    onClose();
  };

  const renderContent = () => {
      switch(activeType) {
          case 'DAILY':
              return (
                  <div className="flex flex-col gap-2">
                      <label className="text-xs text-slate-400 font-bold">Selecione o Dia de Início do Plantão:</label>
                      <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500"
                      />
                      <p className="text-[10px] text-yellow-500/80 mt-1">🕒 O relatório cobrirá das 07:00 deste dia até às 07:00 do dia seguinte.</p>
                  </div>
              );
          case 'WEEKLY':
            return (
                <div className="flex flex-col gap-2">
                    <label className="text-xs text-slate-400 font-bold">Selecione um dia da semana desejada:</label>
                    <input 
                      type="date" 
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">O sistema calculará automaticamente o período de Segunda (07:00) a Segunda (07:00).</p>
                </div>
            );
          case 'MONTHLY':
              return (
                  <div className="flex gap-2">
                      <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="flex-1 bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none"
                      >
                          {Array.from({length: 12}, (_, i) => (
                              <option key={i} value={i}>{new Date(2000, i, 1).toLocaleString('pt-BR', { month: 'long' }).toUpperCase()}</option>
                          ))}
                      </select>
                      <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-24 bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none"
                    >
                          {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                  </div>
              );
          case 'QUARTERLY':
              return (
                <div className="flex gap-2">
                    <select 
                        value={selectedQuarter} 
                        onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                        className="flex-1 bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none"
                    >
                        <option value={0}>1º Trimestre (Jan-Mar)</option>
                        <option value={1}>2º Trimestre (Abr-Jun)</option>
                        <option value={2}>3º Trimestre (Jul-Set)</option>
                        <option value={3}>4º Trimestre (Out-Dez)</option>
                    </select>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-24 bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
              );
          case 'SEMIANNUAL':
            return (
                <div className="flex gap-2">
                    <select 
                        value={selectedSemester} 
                        onChange={(e) => setSelectedSemester(Number(e.target.value))}
                        className="flex-1 bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none"
                    >
                        <option value={0}>1º Semestre (Jan-Jun)</option>
                        <option value={1}>2º Semestre (Jul-Dez)</option>
                    </select>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-24 bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
              );
          case 'ANNUAL':
            return (
                <div className="flex flex-col gap-2">
                    <label className="text-xs text-slate-400 font-bold">Selecione o Ano:</label>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            );
      }
  }

  // Check if we should lock the group selector
  const isGroupLocked = currentUser && currentUser !== 'CIOSP';

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
        
        <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📊</span> Gerador de Relatórios
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        <div className="flex bg-slate-950 border-b border-slate-800 overflow-x-auto no-scrollbar">
            {([
                { id: 'DAILY', label: 'Diário' },
                { id: 'WEEKLY', label: 'Semanal' },
                { id: 'MONTHLY', label: 'Mensal' },
                { id: 'QUARTERLY', label: 'Trimestral' },
                { id: 'SEMIANNUAL', label: 'Semestral' },
                { id: 'ANNUAL', label: 'Anual' }
            ] as const).map(type => (
                <button
                    key={type.id}
                    onClick={() => setActiveType(type.id)}
                    className={`px-4 py-3 text-xs font-bold whitespace-nowrap transition-colors border-b-2 ${
                        activeType === type.id 
                        ? 'border-blue-500 text-blue-400 bg-slate-900' 
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                >
                    {type.label}
                </button>
            ))}
        </div>

        <div className="p-6 bg-slate-900 min-h-[150px] flex flex-col gap-6">
            
            {/* Group Selector */}
            <div className="flex flex-col gap-2">
                <label className="text-xs text-blue-400 font-bold uppercase tracking-wide">1. Filtrar por Grupamento</label>
                {isGroupLocked ? (
                    <div className="bg-slate-800 border border-slate-600 rounded p-2 text-white font-bold flex items-center justify-between opacity-80 cursor-not-allowed">
                        <span>{getDisplayName(targetGroup)}</span>
                        <span className="text-[10px] bg-slate-700 px-1.5 rounded">🔒 BLOQUEADO</span>
                    </div>
                ) : (
                    <select 
                        value={targetGroup}
                        onChange={(e) => setTargetGroup(e.target.value)}
                        className="bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500 font-bold"
                    >
                        <option value="TODOS">GERAL (TODOS OS GRUPAMENTOS)</option>
                        <option disabled>--------------------------------</option>
                        {GROUPS.map(g => (
                            <option key={g} value={g}>{getDisplayName(g)}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Date/Time Selector */}
            <div className="flex flex-col gap-2">
                <label className="text-xs text-blue-400 font-bold uppercase tracking-wide">2. Selecionar Período</label>
                {renderContent()}
            </div>
            
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-800/50 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-bold">Cancelar</button>
            <button 
                onClick={handleGenerate}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm shadow-lg flex items-center gap-2"
            >
                <span>📥</span> Gerar PDF
            </button>
        </div>

      </div>
    </div>
  );
};

export default ReportSelectorModal;
