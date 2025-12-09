import React, { useState, useRef } from 'react';
import { SCHOOL_LIST } from '../types';

interface ResolveModalProps {
  onClose: () => void;
  onConfirm: (category: string, subCategory?: string) => void;
  categories: Record<string, string[]>;
  onCategoryUpdate: (newCats: Record<string, string[]>) => void;
}

const ResolveModal: React.FC<ResolveModalProps> = ({ onClose, onConfirm, categories, onCategoryUpdate }) => {
  // State to track selected main categories
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  
  // State to track selected sub-categories: Record<CategoryName, Set<SubCategoryName>>
  const [selectedSubs, setSelectedSubs] = useState<Record<string, Set<string>>>({});

  // State to track selected Schools (Level 3)
  const [selectedSchools, setSelectedSchools] = useState<Set<string>>(new Set());

  // Editing state
  const [editTarget, setEditTarget] = useState<{cat: string, index: number} | null>(null);
  const [editValue, setEditValue] = useState("");
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter out "Ação Pró-Ativa" and "VIA CIOSP"
  const categoryKeys = Object.keys(categories).filter(cat => cat !== 'Ação Pró-Ativa' && cat !== 'VIA CIOSP');

  const toggleCategory = (cat: string) => {
    const newCats = new Set(selectedCats);
    if (newCats.has(cat)) {
      newCats.delete(cat);
      const newSubs = { ...selectedSubs };
      delete newSubs[cat];
      setSelectedSubs(newSubs);
      if (cat === 'Escolar') setSelectedSchools(new Set());
    } else {
      newCats.add(cat);
    }
    setSelectedCats(newCats);
  };

  const toggleSub = (cat: string, sub: string) => {
    // Don't toggle if we just finished editing
    const currentSubs = selectedSubs[cat] ? new Set(selectedSubs[cat]) : new Set<string>();
    if (currentSubs.has(sub)) {
      currentSubs.delete(sub);
      if (sub === 'UNIDADE ESCOLAR') setSelectedSchools(new Set());
    } else {
      currentSubs.add(sub);
    }
    setSelectedSubs({
      ...selectedSubs,
      [cat]: currentSubs
    });
  };

  const toggleSchool = (schoolName: string) => {
      const newSchools = new Set(selectedSchools);
      if (newSchools.has(schoolName)) {
          newSchools.delete(schoolName);
      } else {
          newSchools.add(schoolName);
      }
      setSelectedSchools(newSchools);
  }

  // --- Long Press Logic ---
  const handleMouseDown = (cat: string, index: number, currentValue: string) => {
    longPressTimerRef.current = setTimeout(() => {
        setEditTarget({ cat, index });
        setEditValue(currentValue);
        // We set this to avoid toggle logic interference? 
        // Actually the toggle logic happens on Click/Change.
        // If we switch to Edit mode, we can just let the UI re-render.
    }, 1000);
  };

  const handleMouseUpOrLeave = () => {
      if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
      }
  };

  const handleSaveEdit = () => {
      if (!editTarget || !editValue.trim()) {
          setEditTarget(null);
          return;
      }

      const { cat, index } = editTarget;
      const currentSubs = [...(categories[cat] || [])];
      
      // Update
      currentSubs[index] = editValue.trim();

      const newCategories = {
          ...categories,
          [cat]: currentSubs
      };

      onCategoryUpdate(newCategories);
      setEditTarget(null);
  };

  const handleConfirm = () => {
    const parts: string[] = [];
    
    selectedCats.forEach(cat => {
      let desc = cat;
      const subs = selectedSubs[cat];
      if (subs && subs.size > 0) {
        const subParts: string[] = [];
        subs.forEach(sub => {
            if (sub === 'UNIDADE ESCOLAR' && selectedSchools.size > 0) {
                subParts.push(`${sub}: ${Array.from(selectedSchools).join(', ')}`);
            } else {
                subParts.push(sub);
            }
        });
        desc += ` (${subParts.join(' - ')})`;
      }
      parts.push(desc);
    });

    const finalCategoryString = parts.join(', ');
    
    if (finalCategoryString) {
        onConfirm(finalCategoryString);
    } else {
        onConfirm("Finalizado sem classificação");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center rounded-t-xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>✅</span> 
            Finalizar Ocorrência
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors">✕</button>
        </div>

        <div className="p-4 bg-slate-800/30 border-b border-slate-800">
            <p className="text-sm text-slate-400">
                Marque com um "X" as opções. 
                <span className="text-xs text-blue-400 block mt-1">💡 Segure 1s sobre um item detalhado para editar.</span>
            </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="flex flex-col gap-2">
              {categoryKeys.map(cat => {
                const isSelected = selectedCats.has(cat);
                const subOptions = categories[cat] || [];
                const hasSubOptions = subOptions.length > 0;

                return (
                  <div key={cat} className={`rounded-lg border transition-all ${isSelected ? 'bg-slate-800 border-blue-500' : 'bg-slate-900/50 border-slate-700'}`}>
                    <label className="flex items-center gap-3 p-4 cursor-pointer select-none">
                        <span className={`font-mono text-lg font-bold transition-colors ${isSelected ? 'text-blue-400' : 'text-slate-500'}`}>
                            {isSelected ? '( X )' : '( \u00A0 )'}
                        </span>
                        
                        <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={isSelected} 
                            onChange={() => toggleCategory(cat)}
                        />
                        <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{cat}</span>
                    </label>

                    {isSelected && hasSubOptions && (
                        <div className="px-4 pb-4 pl-12 grid grid-cols-1 gap-2 animate-in slide-in-from-top-2 fade-in duration-150">
                            {subOptions.map((sub, idx) => {
                                const isSubSelected = selectedSubs[cat]?.has(sub);
                                const isEditingThis = editTarget?.cat === cat && editTarget?.index === idx;

                                return (
                                    <div key={`${cat}-${idx}`} className="flex flex-col">
                                        {isEditingThis ? (
                                            <div className="flex gap-2 p-1 bg-slate-900 rounded border border-blue-500">
                                                <input 
                                                    autoFocus
                                                    className="flex-1 bg-transparent text-white text-xs outline-none"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={handleSaveEdit}
                                                    onKeyDown={(e) => {
                                                        if(e.key === 'Enter') handleSaveEdit();
                                                        if(e.key === 'Escape') setEditTarget(null);
                                                    }}
                                                />
                                                <button onClick={handleSaveEdit} className="text-green-400 text-xs px-1">✓</button>
                                            </div>
                                        ) : (
                                            <label 
                                                className="flex items-center gap-2 cursor-pointer bg-slate-900/50 p-2 rounded hover:bg-slate-700 transition-colors border border-slate-700/50 select-none relative"
                                                onMouseDown={() => handleMouseDown(cat, idx, sub)}
                                                onMouseUp={handleMouseUpOrLeave}
                                                onMouseLeave={handleMouseUpOrLeave}
                                                onTouchStart={() => handleMouseDown(cat, idx, sub)}
                                                onTouchEnd={handleMouseUpOrLeave}
                                                onClick={(e) => {
                                                    // Standard toggle behavior
                                                    // If long press triggered edit, the component re-renders and this might not fire or we might need to block it.
                                                    // But effectively if isEditingThis became true, we are not rendering this label anymore.
                                                    // So standard click works fine for toggling.
                                                }}
                                            >
                                                <span className={`font-mono text-sm font-bold transition-colors ${isSubSelected ? 'text-green-400' : 'text-slate-500'}`}>
                                                    {isSubSelected ? '( X )' : '( \u00A0 )'}
                                                </span>
                                                <input 
                                                    type="checkbox" 
                                                    className="hidden" 
                                                    checked={isSubSelected || false} 
                                                    onChange={() => toggleSub(cat, sub)}
                                                />
                                                <span className="text-xs text-slate-300">{sub}</span>
                                            </label>
                                        )}

                                        {sub === 'UNIDADE ESCOLAR' && isSubSelected && !isEditingThis && (
                                            <div className="ml-6 mt-2 grid grid-cols-1 gap-1 border-l-2 border-slate-600 pl-3 animate-in slide-in-from-top-2">
                                                <p className="text-[10px] text-blue-400 font-bold mb-1 uppercase">Selecione a Unidade:</p>
                                                {SCHOOL_LIST.map(school => {
                                                    const isSchoolSelected = selectedSchools.has(school);
                                                    return (
                                                        <label key={school} className="flex items-center gap-2 cursor-pointer hover:bg-slate-800/50 p-1 rounded select-none">
                                                            <span className={`font-mono text-xs font-bold ${isSchoolSelected ? 'text-blue-300' : 'text-slate-600'}`}>
                                                                {isSchoolSelected ? '(X)' : '( )'}
                                                            </span>
                                                            <input 
                                                                type="checkbox" 
                                                                className="hidden"
                                                                checked={isSchoolSelected}
                                                                onChange={() => toggleSchool(school)}
                                                            />
                                                            <span className={`text-[10px] ${isSchoolSelected ? 'text-blue-200' : 'text-slate-400'}`}>{school}</span>
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-800/50 flex justify-end gap-3 rounded-b-xl">
             <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white font-bold text-sm">Cancelar</button>
             <button 
                onClick={handleConfirm}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm shadow-lg transition-all transform active:scale-95"
            >
                Confirmar Finalização
             </button>
        </div>

      </div>
    </div>
  );
};

export default ResolveModal;