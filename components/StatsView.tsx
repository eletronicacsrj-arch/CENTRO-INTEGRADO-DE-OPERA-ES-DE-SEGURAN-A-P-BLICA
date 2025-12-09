

import React, { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LabelList } from 'recharts';
import { Incident, IncidentStatus } from '../types';
import { analyzeStatistics } from '../services/geminiService';

interface StatsViewProps {
  incidents: Incident[];
  customNames: Record<string, string>;
  onClose: () => void;
  onExportPDF: () => void;
  categories: Record<string, string[]>; // New Prop
}

const StatsView: React.FC<StatsViewProps> = ({ incidents = [], customNames = {}, onClose, onExportPDF, categories }) => {
  const [aiAnalysis, setAiAnalysis] = useState<string>("Gerando análise tática...");

  // Safe helper for names
  const getDisplayName = (id: string) => {
      if (!id) return "Desconhecido";
      return customNames[id] || id;
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

  // --- Process Data using useMemo to avoid re-renders and crashes ---
  const { 
    groupData, 
    categoryData, 
    detalhamentoData, // Modified
    statusData, 
    hotspotData, 
    perGroupData,
    schoolData,
    originData,
    abordagensData, // New
    mariaPenhaData // New
  } = useMemo(() => {
      // 1. SAFETY: Ensure incidents is an array
      const safeIncidents = Array.isArray(incidents) ? incidents : [];

      // 2. Group Data
      const groupCounts: Record<string, number> = {};
      safeIncidents.forEach(inc => {
          if (inc.targetGroup) {
              groupCounts[inc.targetGroup] = (groupCounts[inc.targetGroup] || 0) + 1;
          }
      });
      const groups = Object.keys(groupCounts).map(key => ({
          name: getDisplayName(key),
          count: groupCounts[key]
      })).sort((a, b) => b.count - a.count);

      // 3. Nature Data (Categories) - Split multi-select strings
      const catCounts: Record<string, number> = {};
      safeIncidents.forEach(inc => {
          let catStr = inc.category || "";
          
          if (!catStr && (inc.status === IncidentStatus.RESOLVED)) {
              catStr = "Não Classificado";
          }

          if (catStr && typeof catStr === 'string') {
              const parts = catStr.split(',');
              parts.forEach(part => {
                  const cleanName = part.replace(/\s*\(.*?\)/g, '').trim();
                  if (cleanName && !cleanName.toUpperCase().includes('VIA CIOSP') && !cleanName.toUpperCase().includes('VIA PRÓ-ATIVA') && !cleanName.toUpperCase().includes('AÇÃO PRÓ-ATIVA')) {
                      catCounts[cleanName] = (catCounts[cleanName] || 0) + 1;
                  }
              });
          }
      });
      const cats = Object.keys(catCounts).map(key => ({
          name: key,
          count: catCounts[key]
      })).sort((a, b) => b.count - a.count);

      // 4. Detalhamento (Specifc Categories Only)
      // "Veículo apreendido", "Condução para delegacia", "Apreensão"
      const targetDetalhes = [
          ...(categories['Veículo apreendido'] || []),
          ...(categories['Condução para delegacia'] || []),
          ...(categories['Apreensão'] || [])
      ];

      const detalheCounts: Record<string, number> = {};
      safeIncidents.forEach(inc => {
          const catStr = inc.category || "";
          targetDetalhes.forEach(sub => {
              if (catStr.includes(sub)) {
                  detalheCounts[sub] = (detalheCounts[sub] || 0) + 1;
              }
          });
      });
      const detalheDataList = Object.keys(detalheCounts).map(key => ({
          name: key,
          count: detalheCounts[key]
      })).sort((a, b) => b.count - a.count);

      // 5. ABORDAGENS DATA
      const abordagensSubs = categories['Abordagens'] || [];
      const abordagensByType: Record<string, number> = {};
      const abordagensByGroup: Record<string, number> = {};

      safeIncidents.forEach(inc => {
          const catStr = inc.category || "";
          // Check if incident involves any abordagens sub-type
          let isAbordagem = false;
          abordagensSubs.forEach(sub => {
              // We check if "Abordagens" is in the main category string usually, 
              // but here we check if the specific sub-option text is present.
              // Ideally the user selected "Abordagens" -> "Moto". The string might be "Abordagens (Moto)".
              if (catStr.includes(sub) && catStr.includes("Abordagens")) {
                  abordagensByType[sub] = (abordagensByType[sub] || 0) + 1;
                  isAbordagem = true;
              }
          });

          if (isAbordagem && inc.targetGroup) {
              const gName = getDisplayName(inc.targetGroup);
              abordagensByGroup[gName] = (abordagensByGroup[gName] || 0) + 1;
          }
      });

      const abordagensStats = {
          byType: Object.keys(abordagensByType).map(k => ({ name: k, count: abordagensByType[k] })).sort((a,b) => b.count - a.count),
          byGroup: Object.keys(abordagensByGroup).map(k => ({ name: k, count: abordagensByGroup[k] })).sort((a,b) => b.count - a.count)
      };

      // 6. MARIA DA PENHA DATA
      const mpSubs = categories['Maria da Penha'] || [];
      const mpByType: Record<string, number> = {};
      const mpByGroup: Record<string, number> = {};

      safeIncidents.forEach(inc => {
          const catStr = inc.category || "";
          let isMp = false;
          mpSubs.forEach(sub => {
              if (catStr.includes(sub) && catStr.includes("Maria da Penha")) {
                  mpByType[sub] = (mpByType[sub] || 0) + 1;
                  isMp = true;
              }
          });

          if (isMp && inc.targetGroup) {
              const gName = getDisplayName(inc.targetGroup);
              mpByGroup[gName] = (mpByGroup[gName] || 0) + 1;
          }
      });

      const mpStats = {
          byType: Object.keys(mpByType).map(k => ({ name: k, count: mpByType[k] })).sort((a,b) => b.count - a.count),
          byGroup: Object.keys(mpByGroup).map(k => ({ name: k, count: mpByGroup[k] })).sort((a,b) => b.count - a.count)
      };


      // 7. Status
      const statCounts: Record<string, number> = {};
      safeIncidents.forEach(inc => {
          if (inc.status) {
              statCounts[inc.status] = (statCounts[inc.status] || 0) + 1;
          }
      });
      const stats = Object.keys(statCounts).map(key => ({
          name: key,
          value: statCounts[key]
      }));

      // 8. Hotspots (Accidents)
      const locs: Record<string, { total: number, withVictim: number, withoutVictim: number }> = {};
      safeIncidents.forEach(inc => {
          const catStr = inc.category || "";
          if (inc.location && typeof catStr === 'string' && 
             (catStr.includes("ACIDENTE C/VÍTIMA") || catStr.includes("ACIDENTE S/VÍTIMA"))) {
              
              const loc = inc.location.trim().toUpperCase();
              
              if (!locs[loc]) {
                  locs[loc] = { total: 0, withVictim: 0, withoutVictim: 0 };
              }
              locs[loc].total += 1;
              if (catStr.includes("ACIDENTE C/VÍTIMA")) {
                  locs[loc].withVictim += 1;
              } else {
                  locs[loc].withoutVictim += 1;
              }
          }
      });
      const hotspots = Object.keys(locs)
          .map(loc => ({ name: loc, ...locs[loc] }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10);

      // 9. Per Group Nature
      const groupsWithIncs = Array.from(new Set(safeIncidents.map(i => i.targetGroup).filter(Boolean))) as string[];
      const perGroup = groupsWithIncs.map(group => {
          const groupIncidents = safeIncidents.filter(i => i.targetGroup === group);
          const counts: Record<string, number> = {};
          
          groupIncidents.forEach(inc => {
              let catStr = inc.category || "";
              if (!catStr && (inc.status === IncidentStatus.RESOLVED)) {
                  catStr = "Não Classificado";
              }

              if (catStr && typeof catStr === 'string') {
                  const parts = catStr.split(',');
                  parts.forEach(part => {
                      const cleanName = part.replace(/\s*\(.*?\)/g, '').trim();
                      if (cleanName && !cleanName.toUpperCase().includes('VIA CIOSP') && !cleanName.toUpperCase().includes('VIA PRÓ-ATIVA') && !cleanName.toUpperCase().includes('AÇÃO PRÓ-ATIVA')) {
                          counts[cleanName] = (counts[cleanName] || 0) + 1;
                      }
                  });
              }
          });
          
          const data = Object.keys(counts).map(k => ({ name: k, count: counts[k] })).sort((a,b) => b.count - a.count);
          return { groupName: getDisplayName(group), data: data };
      }).filter(g => g.data.length > 0).sort((a, b) => {
          return b.data.reduce((acc, c) => acc + c.count, 0) - a.data.reduce((acc, c) => acc + c.count, 0);
      });

      // 10. School Statistics
      const schoolStats: Record<string, { total: number, attended: number, preventive: number, social: number }> = {};
      safeIncidents.forEach(inc => {
          const catStr = inc.category || "";
          if (catStr.includes("UNIDADE ESCOLAR:")) {
              const parts = catStr.split("UNIDADE ESCOLAR:");
              if (parts.length > 1) {
                  let schoolPart = parts[1];
                  const match = schoolPart.match(/^(.*?)(?=(\s-\s|\)|$))/);
                  
                  if (match && match[1]) {
                      const schools = match[1].split(',').map(s => s.trim()).filter(Boolean);
                      let isAttended = catStr.includes("OCORRÊNCIA ATENDIDA");
                      let isPreventive = catStr.includes("PATRULHAMENTO PREVENTIVO");
                      let isSocial = catStr.includes("ATIVIDADES SOCIAIS");

                      schools.forEach(school => {
                          if (!schoolStats[school]) {
                              schoolStats[school] = { total: 0, attended: 0, preventive: 0, social: 0 };
                          }
                          schoolStats[school].total += 1;
                          if (isAttended) schoolStats[school].attended += 1;
                          if (isPreventive) schoolStats[school].preventive += 1;
                          if (isSocial) schoolStats[school].social += 1;
                      });
                  }
              }
          }
      });

      const schoolDataList = Object.keys(schoolStats).map(key => ({
          name: key,
          ...schoolStats[key]
      })).sort((a,b) => b.total - a.total);

      // 11. ORIGIN Statistics
      const originStats: Record<string, { ciosp: number, proactive: number }> = {};
      groupsWithIncs.forEach(g => {
          originStats[g] = { ciosp: 0, proactive: 0 };
      });

      safeIncidents.forEach(inc => {
          const grp = inc.targetGroup;
          if (!grp) return;
          if (!originStats[grp]) originStats[grp] = { ciosp: 0, proactive: 0 };

          const catStr = (inc.category || "").toUpperCase();
          if (catStr.includes("VIA CIOSP")) {
              originStats[grp].ciosp += 1;
          } else if (catStr.includes("VIA PRÓ-ATIVA") || catStr.includes("AÇÃO PRÓ-ATIVA")) {
              originStats[grp].proactive += 1;
          }
      });

      const originDataList = Object.keys(originStats).map(key => ({
          name: getDisplayName(key),
          ciosp: originStats[key].ciosp,
          proactive: originStats[key].proactive,
          total: originStats[key].ciosp + originStats[key].proactive
      })).sort((a,b) => b.total - a.total);


      return {
          groupData: groups,
          categoryData: cats,
          detalhamentoData: detalheDataList,
          statusData: stats,
          hotspotData: hotspots,
          perGroupData: perGroup,
          schoolData: schoolDataList,
          originData: originDataList,
          abordagensData: abordagensStats,
          mariaPenhaData: mpStats
      };

  }, [incidents, customNames, categories]);

  const totalOriginCiosp = useMemo(() => originData.reduce((acc, curr) => acc + curr.ciosp, 0), [originData]);
  const totalOriginProactive = useMemo(() => originData.reduce((acc, curr) => acc + curr.proactive, 0), [originData]);

  useEffect(() => {
    let isMounted = true;
    const generateAnalysis = async () => {
      if (!groupData || groupData.length === 0) {
        if(isMounted) setAiAnalysis("Sem dados suficientes para análise.");
        return;
      }
      
      const topAccident = hotspotData.length > 0 ? hotspotData[0].name : "Nenhum";
      const summary = `
        Por Grupo: ${groupData.map(d => `${d.name}: ${d.count}`).join(', ')}.
        Por Natureza: ${categoryData.slice(0, 5).map(d => `${d.name}: ${d.count}`).join(', ')}.
        Local Acidentes Crítico: ${topAccident}.
      `;
      
      const result = await analyzeStatistics(summary);
      if(isMounted) setAiAnalysis(result);
    };
    
    generateAnalysis();
    return () => { isMounted = false; };
  }, [groupData, categoryData, hotspotData]);

  return (
    <div className="fixed inset-0 bg-slate-950 z-40 overflow-y-auto w-full h-full">
      <div className="p-6 max-w-7xl mx-auto min-h-screen pb-20">
        
        {/* HEADER: TITLE + PDF BUTTON */}
        <div className="flex justify-between items-center mb-8 sticky top-0 bg-slate-950/90 backdrop-blur-sm py-4 z-50 border-b border-slate-800">
          <div className="flex items-center gap-4">
              <h2 className="text-3xl font-bold text-white">Estatísticas Operacionais</h2>
              <button 
                  onClick={onExportPDF} 
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-500 border border-blue-500 transition-colors flex items-center gap-2 shadow-lg"
                  title="Baixar Relatório Completo"
              >
                  <span>📥</span> Baixar Relatório (PDF)
              </button>
          </div>
          <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white font-bold rounded hover:bg-slate-700 border border-slate-600 transition-colors">
              Fechar
          </button>
        </div>

        {/* AI INSIGHT */}
        <div className="mb-8 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl shadow-lg">
          <h3 className="text-sm font-bold text-blue-400 mb-2 uppercase tracking-wider flex items-center gap-2">
            <span>🤖</span> Insight Tático (IA)
          </h3>
          <p className="text-slate-200 italic leading-relaxed">{aiAnalysis}</p>
        </div>

        {/* ORIGIN STATISTICS TABLE */}
        <div className="mb-8 border-t border-slate-800 pt-8">
            <h3 className="text-xl font-bold mb-6 text-emerald-400 flex items-center gap-2">
                <span>📡</span> VIA DE ORIGEM DA OCORRÊNCIA (DEMANDA)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-900 p-6 rounded-xl border-l-4 border-blue-500 shadow-lg flex justify-between items-center">
                    <div>
                        <h4 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">TOTAL VIA CIOSP</h4>
                        <p className="text-xs text-slate-500">Ocorrências despachadas pela Central</p>
                    </div>
                    <span className="text-4xl font-black text-blue-400">{totalOriginCiosp}</span>
                </div>
                <div className="bg-slate-900 p-6 rounded-xl border-l-4 border-green-500 shadow-lg flex justify-between items-center">
                     <div>
                        <h4 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">TOTAL VIA PRÓ-ATIVA</h4>
                        <p className="text-xs text-slate-500">Ocorrências geradas pelas Viaturas</p>
                    </div>
                    <span className="text-4xl font-black text-green-400">{totalOriginProactive}</span>
                </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-lg">
                {originData.length > 0 ? (
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-800/50 text-xs uppercase font-bold text-slate-400">
                                <tr>
                                    <th className="px-6 py-3">Unidade / Grupamento</th>
                                    <th className="px-6 py-3 text-center text-blue-400">VIA CIOSP</th>
                                    <th className="px-6 py-3 text-center text-green-400">VIA PRÓ-ATIVA</th>
                                    <th className="px-6 py-3 text-center text-white bg-slate-700/50">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {originData.map((data, idx) => (
                                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-3 font-bold text-white">{data.name}</td>
                                        <td className="px-6 py-3 text-center font-bold text-blue-400">{data.ciosp}</td>
                                        <td className="px-6 py-3 text-center font-bold text-green-400">{data.proactive}</td>
                                        <td className="px-6 py-3 text-center font-bold text-white bg-slate-800/50">{data.total}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-600">
                        Nenhuma informação de origem disponível.
                    </div>
                )}
            </div>
        </div>

        {/* Main Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <h3 className="text-xl font-bold mb-6 text-slate-300">Ocorrências por Grupamento</h3>
            {groupData.length > 0 ? (
                <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupData} layout="vertical" margin={{ left: 10, right: 40, top: 10, bottom: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={110} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}} />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                        <LabelList dataKey="count" position="right" fill="#ffffff" fontSize={12} fontWeight="bold" offset={10} />
                        {groupData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                    </BarChart>
                </ResponsiveContainer>
                </div>
            ) : (
                <div className="h-80 flex items-center justify-center text-slate-600">Sem dados.</div>
            )}
          </div>

          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <h3 className="text-xl font-bold mb-6 text-slate-300">Natureza da Ocorrência (Geral)</h3>
            {categoryData.length > 0 ? (
                <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} margin={{bottom: 40, top: 20}}>
                    <XAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 10}} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis hide />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="count" position="top" fill="#ffffff" fontSize={12} fontWeight="bold" />
                        {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                        ))}
                    </Bar>
                    </BarChart>
                </ResponsiveContainer>
                </div>
            ) : (
                <div className="h-80 flex items-center justify-center text-slate-600">
                    Sem dados de natureza registrados.
                </div>
            )}
          </div>
        </div>

        {/* ABORDAGENS SECTION (NEW) */}
        <div className="mb-8 border-t border-slate-800 pt-8">
            <h3 className="text-xl font-bold mb-6 text-orange-400 flex items-center gap-2">
                <span>✋</span> ABORDAGENS REALIZADAS
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Abordagens Chart */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
                    <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">Por Tipo de Veículo/Pessoa</h4>
                    {abordagensData.byType.length > 0 ? (
                         <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={abordagensData.byType} margin={{bottom: 20}}>
                                <XAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 10}} interval={0} />
                                <YAxis hide />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#f97316">
                                    <LabelList dataKey="count" position="top" fill="#ffffff" fontSize={12} fontWeight="bold" />
                                </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-slate-600">Sem abordagens registradas.</div>
                    )}
                </div>

                {/* Abordagens per Group */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
                     <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">Total por Grupamento</h4>
                     {abordagensData.byGroup.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                            {abordagensData.byGroup.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-slate-800 rounded border border-slate-700">
                                    <span className="text-sm font-bold text-white">{item.name}</span>
                                    <span className="text-xl font-black text-orange-400">{item.count}</span>
                                </div>
                            ))}
                        </div>
                     ) : (
                         <div className="h-64 flex items-center justify-center text-slate-600">Sem abordagens por grupo.</div>
                     )}
                </div>
            </div>
        </div>

        {/* MARIA DA PENHA SECTION (NEW) */}
        <div className="mb-8 border-t border-slate-800 pt-8">
            <h3 className="text-xl font-bold mb-6 text-purple-400 flex items-center gap-2">
                <span>🚺</span> ATENDIMENTO MARIA DA PENHA
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Maria da Penha Chart */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
                    <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">Por Tipo de Violência/Atendimento</h4>
                    {mariaPenhaData.byType.length > 0 ? (
                         <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={mariaPenhaData.byType} layout="vertical" margin={{ left: 5, right: 30, top: 5, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={140} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 600}} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20} fill="#c084fc">
                                    <LabelList dataKey="count" position="right" fill="#ffffff" fontSize={11} fontWeight="bold" />
                                </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-slate-600">Sem registros Maria da Penha.</div>
                    )}
                </div>

                {/* Maria da Penha per Group */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
                     <h4 className="text-sm font-bold text-slate-400 uppercase mb-4">Total por Grupamento</h4>
                     {mariaPenhaData.byGroup.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                            {mariaPenhaData.byGroup.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-slate-800 rounded border border-slate-700">
                                    <span className="text-sm font-bold text-white">{item.name}</span>
                                    <span className="text-xl font-black text-purple-400">{item.count}</span>
                                </div>
                            ))}
                        </div>
                     ) : (
                         <div className="h-64 flex items-center justify-center text-slate-600">Sem registros por grupo.</div>
                     )}
                </div>
            </div>
        </div>

        {/* SCHOOL STATISTICS TABLE */}
        <div className="mb-8 border-t border-slate-800 pt-8">
            <h3 className="text-xl font-bold mb-6 text-blue-400 flex items-center gap-2">
                <span>🎓</span> ATENDIMENTO ESCOLAR
            </h3>
            
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-lg">
                {schoolData.length > 0 ? (
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-800/50 text-xs uppercase font-bold text-slate-400">
                                <tr>
                                    <th className="px-6 py-3">Unidade Escolar</th>
                                    <th className="px-6 py-3 text-center text-green-400">Ocorrência Atendida</th>
                                    <th className="px-6 py-3 text-center text-blue-400">Patr. Preventivo</th>
                                    <th className="px-6 py-3 text-center text-purple-400">Ativ. Sociais</th>
                                    <th className="px-6 py-3 text-center text-white">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {schoolData.map((school, idx) => (
                                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-3 font-bold text-white">{school.name}</td>
                                        <td className="px-6 py-3 text-center font-bold text-green-400">{school.attended}</td>
                                        <td className="px-6 py-3 text-center font-bold text-blue-400">{school.preventive}</td>
                                        <td className="px-6 py-3 text-center font-bold text-purple-400">{school.social}</td>
                                        <td className="px-6 py-3 text-center font-bold text-white bg-slate-800">{school.total}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-600">
                        Nenhuma ocorrência registrada em unidade escolar até o momento.
                    </div>
                )}
            </div>
        </div>


        {/* Accident Hotspots */}
        <div className="mb-8 border-t border-slate-800 pt-8">
            <h3 className="text-xl font-bold mb-6 text-red-400 flex items-center gap-2">
                <span>🚨</span> Pontos Críticos de Acidentes
            </h3>
            
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-lg">
                {hotspotData.length > 0 ? (
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-800/50 text-xs uppercase font-bold text-slate-400">
                                <tr>
                                    <th className="px-6 py-3">Endereço / Local</th>
                                    <th className="px-6 py-3 text-center">Total</th>
                                    <th className="px-6 py-3 text-center text-red-400">C/ Vítima</th>
                                    <th className="px-6 py-3 text-center text-yellow-400">S/ Vítima</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {hotspotData.map((spot, idx) => (
                                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-3 font-bold text-white">{spot.name}</td>
                                        <td className="px-6 py-3 text-center font-bold">{spot.total}</td>
                                        <td className="px-6 py-3 text-center font-bold text-red-400">{spot.withVictim}</td>
                                        <td className="px-6 py-3 text-center font-bold text-yellow-400">{spot.withoutVictim}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-600">
                        Nenhum acidente registrado com localização válida até o momento.
                    </div>
                )}
            </div>
        </div>

        {/* Status and Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {/* Status Pie */}
           <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
            <h3 className="text-lg font-bold mb-4 text-slate-300">Status Geral</h3>
            {statusData.length > 0 ? (
                <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                    <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{fontSize: '10px', color: '#94a3b8'}}/>
                    </PieChart>
                </ResponsiveContainer>
                </div>
            ) : (
                <div className="h-64 flex items-center justify-center text-slate-600">Sem dados.</div>
            )}
          </div>

          {/* Modified Details List */}
           <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 md:col-span-2 shadow-lg">
            <h3 className="text-lg font-bold mb-4 text-slate-300">Detalhamento (Apreensões e Prisões)</h3>
            <p className="text-[10px] text-slate-500 mb-2 uppercase">Filtro: Veículos Apreendidos, Condução e Apreensões</p>
            {detalhamentoData.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-64 overflow-y-auto custom-scrollbar">
                    {detalhamentoData.map((item, idx) => (
                        <div key={idx} className="bg-slate-800 p-4 rounded-lg border-l-4 border-blue-500 flex justify-between items-center shadow">
                            <span className="text-slate-300 font-bold text-xs">{item.name}</span>
                            <span className="text-xl font-black text-white">{item.count}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="h-32 flex items-center justify-center text-slate-600">Nenhum detalhe registrado nestas categorias.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default StatsView;
