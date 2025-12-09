import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Incident, Message, GroupName, IncidentStatus, GROUPS, 
  DataPacket, SyncPayload, INCIDENT_CATEGORIES 
} from './types';
import * as db from './services/db';
import * as connection from './services/connection';
import * as gemini from './services/geminiService';

import IconDisplay from './components/IconDisplay';
import IncidentForm from './components/IncidentForm';
import StatsView from './components/StatsView';
import InboxModal from './components/InboxModal';
import GeneralChatModal from './components/GeneralChatModal';
import ResolveModal from './components/ResolveModal';
import ReportSelectorModal from './components/ReportSelectorModal';
import CentralManagerModal from './components/CentralManagerModal';

// Helper for default/custom icons
const DEFAULT_ICONS: Record<string, string> = {}; 

const App: React.FC = () => {
  // --- STATE ---
  const [role, setRole] = useState<'CIOSP' | GroupName | null>(null);
  const [isHost, setIsHost] = useState(false); // New: Track if we are the authority
  const [connectionCode, setConnectionCode] = useState("");
  const [mirrorCode, setMirrorCode] = useState(""); // New: Code for Mirror Mode
  
  // Data
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [customIcons, setCustomIcons] = useState<Record<string, string>>({});
  const [customSounds, setCustomSounds] = useState<Record<string, string>>({});
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Record<string, string[]>>(INCIDENT_CATEGORIES);
  
  // Config
  const [watermark, setWatermark] = useState<string | null>(null);
  const [appTitle, setAppTitle] = useState("CIOSP SECURITY");
  const [commandLabel, setCommandLabel] = useState("CENTRAL DE COMANDO");
  const [crestLeft, setCrestLeft] = useState<string | null>(null);
  const [crestRight, setCrestRight] = useState<string | null>(null);
  const [backupEmail, setBackupEmail] = useState("");

  // Connection
  const [connectionId, setConnectionId] = useState<string>("OFFLINE");
  const [connectedCount, setConnectedCount] = useState(0);

  // UI
  const [showStats, setShowStats] = useState(false);
  const [showInbox, setShowInbox] = useState(false); // For CIOSP
  const [activeGroupForIncident, setActiveGroupForIncident] = useState<GroupName | null>(null); // For CIOSP to manage a group or Unit to self-manage
  const [showGeneralChat, setShowGeneralChat] = useState(false);
  const [showReportSelector, setShowReportSelector] = useState(false);
  const [reportMode, setReportMode] = useState<'LOG' | 'STATS'>('LOG'); // New state for report type
  const [resolveIncidentId, setResolveIncidentId] = useState<string | null>(null);
  const [showCentralManager, setShowCentralManager] = useState(false);

  // Current Central Info
  const [activeCentralName, setActiveCentralName] = useState("Carregando...");
  
  // Image Upload Logic for Units
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploadIncidentId, setUploadIncidentId] = useState<string | null>(null);

  // --- AUDIO HELPERS ---
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop previous
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const playBeep = () => {
      try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          osc.start();
          osc.stop(ctx.currentTime + 0.1);
      } catch (e) {}
  };

  const playGroupSound = (group: string) => {
      // 1. Try Custom Sound
      const customSound = customSounds[group];
      if (customSound) {
          try {
              const audio = new Audio(customSound);
              audio.play().catch(e => {
                  console.warn("Autoplay blocked or audio error", e);
                  playBeep(); // Fallback if custom fails
              });
          } catch(e) {
              playBeep();
          }
      } else {
          // 2. Default Beep
          playBeep();
      }
  };

  // Distinct sound for General Announcements
  const playGeneralSound = () => {
      try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          const t = ctx.currentTime;
          osc.type = 'sine';
          
          // Ding-Dong effect
          osc.frequency.setValueAtTime(523.25, t); // C5
          osc.frequency.setValueAtTime(659.25, t + 0.2); // E5
          
          gain.gain.setValueAtTime(0.1, t);
          gain.gain.linearRampToValueAtTime(0.1, t + 0.2);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
          
          osc.start(t);
          osc.stop(t + 0.6);
      } catch (e) {}
  };

  // --- EFFECTS ---

  // Load Data
  useEffect(() => {
    const load = () => {
        setIncidents(db.getStoredIncidents());
        setMessages(db.getStoredMessages());
        setCustomIcons(db.getStoredIcons());
        setCustomSounds(db.getStoredSounds());
        setCustomNames(db.getStoredNames());
        setCategories(db.getStoredCategories());
        setWatermark(db.getWatermark());
        setAppTitle(db.getStoredTitle());
        setCommandLabel(db.getStoredCommandLabel());
        setCrestLeft(db.getStoredCrestLeft());
        setCrestRight(db.getStoredCrestRight());
        setBackupEmail(db.getStoredEmail());
        
        const centralInfo = db.getActiveCentralInfo();
        setActiveCentralName(centralInfo.name);
    };
    load();
    window.addEventListener('local-storage-update', load);
    
    return () => {
        window.removeEventListener('local-storage-update', load);
    };
  }, []);

  // --- HANDLERS (General) ---

  const handleLogout = () => {
      connection.destroyConnection();
      setRole(null);
      setIsHost(false);
  };

  const handleIconChange = (id: string, base64: string) => {
      db.saveStoredIcon(id, base64);
      if (isHost) broadcastSync();
  };

  const handleSoundChange = (id: string, base64: string) => {
      db.saveStoredSound(id, base64);
      if (isHost) broadcastSync();
  };

  const handleRenameGroup = (id: string, newName: string) => {
      db.saveStoredName(id, newName);
      if (isHost) broadcastSync();
  };

  const handleWatermarkChange = (id: string, base64: string) => {
      db.saveWatermark(base64);
      if (isHost) broadcastSync();
  };

  const handleCrestChange = (side: 'CREST_LEFT' | 'CREST_RIGHT', base64: string) => {
      if (side === 'CREST_LEFT') db.saveStoredCrestLeft(base64);
      else db.saveStoredCrestRight(base64);
      if (isHost) broadcastSync();
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setBackupEmail(val);
      db.saveStoredEmail(val);
  };

  const handleCopyLink = () => {
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => alert("Link copiado!"));
  };

  const broadcastSync = () => {
      if (role === 'CIOSP' && isHost) {
          const payload: SyncPayload = db.getAllData();
          connection.broadcastData({ type: 'SYNC_STATE', payload });
      }
  };

  // --- HANDLERS (Incidents & Messages) ---

  const handleAddIncident = async (data: { description: string; detailedDescription: string; location: string; category?: string }) => {
      const target = role === 'CIOSP' ? activeGroupForIncident! : (role as GroupName);
      if (!target) return;

      const enhanced = await gemini.enhanceIncidentDescription(data.description, target);
      const selectedCat = data.category || (role === 'CIOSP' ? 'VIA CIOSP' : 'VIA PRÓ-ATIVA');

      const newInc: Incident = {
          id: Date.now().toString(),
          targetGroup: target,
          description: data.description,
          detailedDescription: enhanced,
          location: data.location,
          status: IncidentStatus.PENDING,
          category: selectedCat, 
          createdAt: Date.now(),
          updatedAt: Date.now()
      };

      db.saveIncident(newInc);
      playGroupSound(target);

      if (isHost) {
          connection.broadcastData({ type: 'CMD_ADD_INCIDENT', payload: newInc });
      } else {
          connection.sendCommand({ type: 'CMD_ADD_INCIDENT', payload: newInc });
      }
      setActiveGroupForIncident(null);
  };

  const handleUpdateStatus = (id: string, status: IncidentStatus) => {
      if (status === IncidentStatus.RESOLVED) {
          setResolveIncidentId(id);
      } else {
          updateIncidentStatusDirectly(id, status);
      }
  };

  const updateIncidentStatusDirectly = (id: string, status: IncidentStatus, category?: string) => {
      const currentList = db.getStoredIncidents();
      const inc = currentList.find(i => i.id === id);

      if (!inc) return;

      const categoryToUse = category !== undefined ? category : inc.category;

      const updated = { 
          ...inc, 
          status, 
          category: categoryToUse, 
          updatedAt: Date.now() 
      };
      
      db.saveIncident(updated);
      setIncidents(db.getStoredIncidents());
      
      if (isHost) {
          broadcastSync();
      } else {
          connection.sendCommand({ type: 'CMD_UPDATE_STATUS', payload: { id, status, category: categoryToUse } });
      }
  };

  const handleResolveConfirm = (finalCategory: string) => {
      if (resolveIncidentId) {
          const currentList = db.getStoredIncidents();
          const incident = currentList.find(i => i.id === resolveIncidentId);
          
          let categoryToSave = finalCategory;

          if (incident && incident.category) {
              const currentCat = incident.category.toUpperCase();
              if (currentCat.includes('VIA PRÓ-ATIVA') || currentCat.includes('AÇÃO PRÓ-ATIVA')) {
                  categoryToSave = `VIA PRÓ-ATIVA, ${finalCategory}`;
              } else if (currentCat.includes('VIA CIOSP')) {
                  categoryToSave = `VIA CIOSP, ${finalCategory}`;
              }
          }

          updateIncidentStatusDirectly(resolveIncidentId, IncidentStatus.RESOLVED, categoryToSave);
          setResolveIncidentId(null);
      }
  };

  const handleDeleteIncident = (id: string) => {
      db.deleteIncident(id);
      if (isHost) {
          broadcastSync();
      } else {
          connection.sendCommand({ type: 'CMD_DELETE_INCIDENT', payload: { id } });
      }
  };

  const handleClearHistory = () => {
      if (!confirm("Tem certeza? Isso removerá todas as ocorrências finalizadas e canceladas.")) return;
      
      if (isHost) {
          db.clearResolvedIncidents();
          broadcastSync();
      } else {
          connection.sendCommand({ type: 'CMD_CLEAR_HISTORY', payload: {} });
          db.clearResolvedIncidents();
      }
  };

  const handleSendMessage = (text: string, to?: string) => {
      const from = role || 'Unknown';
      const msg: Message = {
          id: Date.now().toString(),
          from,
          to: to || (role === 'CIOSP' ? activeGroupForIncident || undefined : 'CIOSP'),
          content: text,
          createdAt: Date.now()
      };
      
      db.saveMessage(msg);
      
      if (msg.to === 'GERAL') {
          playGeneralSound();
      }
      
      if (isHost) {
          // Broadcast event instead of just sync, to trigger sounds on clients
          connection.broadcastData({ type: 'CMD_SEND_MESSAGE', payload: msg });
      } else {
          connection.sendCommand({ type: 'CMD_SEND_MESSAGE', payload: msg });
      }
  };

  const handleDeleteMessage = (id: string) => {
      db.deleteMessage(id);
      if (isHost) {
          broadcastSync();
      } else {
          connection.sendCommand({ type: 'CMD_DELETE_MESSAGE', payload: { id } });
      }
  };

  // --- HANDLERS (Image Upload) ---
  const triggerImageUpload = (incidentId: string, type: 'GALLERY' | 'CAMERA') => {
    setUploadIncidentId(incidentId);
    if (type === 'GALLERY') fileInputRef.current?.click();
    else cameraInputRef.current?.click();
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadIncidentId) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);

                const incident = incidents.find(i => i.id === uploadIncidentId);
                if (incident) {
                    const updatedAttachments = [...(incident.attachments || []), compressedBase64];
                    const updatedInc = { ...incident, attachments: updatedAttachments };
                    db.saveIncident(updatedInc);
                    if (isHost) {
                        broadcastSync();
                    } else {
                        connection.sendCommand({ type: 'CMD_ADD_INCIDENT', payload: updatedInc });
                    }
                }
                setUploadIncidentId(null);
            }
        }
    }
  };

  // --- HANDLERS (PDF) ---
  const handleExportPDF = (mode: 'LOG' | 'STATS' = 'LOG') => {
      setReportMode(mode);
      setShowReportSelector(true);
  };

  const handleGenerateReport = (startDate: number, endDate: number, title: string, groupFilter: string) => {
      if (reportMode === 'LOG') {
          generateLogPDF(startDate, endDate, title, groupFilter);
      } else {
          generateStatsPDF(startDate, endDate, title, groupFilter);
      }
  };

  const generateStatsPDF = (startDate: number, endDate: number, title: string, groupFilter: string) => {
      const doc = new jsPDF();
      const filtered = incidents.filter(i => {
          const inTime = i.createdAt >= startDate && i.createdAt <= endDate;
          const inGroup = groupFilter === 'TODOS' ? true : i.targetGroup === groupFilter;
          return inTime && inGroup;
      });

      // --- Helper to Draw Horizontal Bar Charts ---
      const drawHorizontalBarChart = (
          title: string, 
          data: { label: string, value: number }[], 
          color: [number, number, number],
          yStart: number
      ): number => {
          if (yStart > 250) { doc.addPage(); yStart = 20; }
          doc.setFontSize(11);
          doc.setTextColor(0, 0, 0);
          doc.text(title, 14, yStart);
          yStart += 10;

          const maxVal = Math.max(...data.map(d => d.value), 1);
          
          data.forEach(item => {
              if (yStart > 280) { doc.addPage(); yStart = 20; }
              const barWidth = (item.value / maxVal) * 100;
              
              doc.setFontSize(9);
              doc.text(item.label.substring(0, 35) + (item.label.length>35 ? '...' : ''), 14, yStart + 4);
              
              doc.setFillColor(...color);
              doc.rect(80, yStart, barWidth, 5, 'F'); 
              
              doc.setFontSize(8);
              doc.text(item.value.toString(), 82 + barWidth, yStart + 4);
              
              yStart += 8;
          });
          
          return yStart + 10;
      };


      // --- HEADER ---
      if (crestLeft) doc.addImage(crestLeft, 'PNG', 10, 10, 20, 20);
      if (crestRight) doc.addImage(crestRight, 'PNG', 180, 10, 20, 20);
      doc.setFontSize(16);
      doc.text(appTitle, 105, 20, { align: 'center' });
      doc.setFontSize(12);
      doc.text("RELATÓRIO ESTATÍSTICO OPERACIONAL", 105, 30, { align: 'center' });
      doc.setFontSize(10);
      doc.text(title, 105, 38, { align: 'center' });
      doc.setLineWidth(0.5);
      doc.line(10, 42, 200, 42);

      let yPos = 50;

      // --- 1. OVERVIEW BOXES (QUADRO 1) ---
      const total = filtered.length;
      const pending = filtered.filter(i => i.status === IncidentStatus.PENDING).length;
      const active = filtered.filter(i => i.status === IncidentStatus.ACKNOWLEDGED).length;
      const resolved = filtered.filter(i => i.status === IncidentStatus.RESOLVED).length;

      const drawBox = (x: number, label: string, value: number, color: [number, number, number]) => {
          doc.setFillColor(...color);
          doc.rect(x, yPos, 40, 25, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(14);
          doc.text(value.toString(), x + 20, yPos + 12, { align: 'center' });
          doc.setFontSize(8);
          doc.text(label, x + 20, yPos + 20, { align: 'center' });
      };

      drawBox(14, "TOTAL", total, [59, 130, 246]); // Blue
      drawBox(60, "PENDENTES", pending, [234, 179, 8]); // Yellow
      drawBox(106, "EM ANDAMENTO", active, [16, 185, 129]); // Green
      drawBox(152, "FINALIZADAS", resolved, [239, 68, 68]); // Red

      yPos += 35;

      // ... (Rest of PDF generation code remains same - omitted for brevity but logic is preserved) ...
      // Assuming previous PDF logic is here. To save tokens I'm focusing on the sound update logic above.
      // But for completeness in XML I should include it.
      
      // --- 2. VIA DE ORIGEM (QUADRO 2) ---
      doc.setTextColor(0,0,0);
      doc.setFontSize(11);
      doc.text("VIA DE ORIGEM DA OCORRÊNCIA", 14, yPos);
      
      const originStats: Record<string, { ciosp: number, proactive: number }> = {};
      const groupsWithIncs = Array.from(new Set(filtered.map(i => i.targetGroup))).filter(Boolean) as string[];
      if (groupFilter === 'TODOS') {
          GROUPS.forEach(g => originStats[g] = { ciosp: 0, proactive: 0 });
      } else {
          originStats[groupFilter] = { ciosp: 0, proactive: 0 };
      }
      
      filtered.forEach(inc => {
          const grp = inc.targetGroup;
          if (originStats[grp]) {
              const catStr = (inc.category || "").toUpperCase();
              if (catStr.includes("VIA CIOSP")) originStats[grp].ciosp++;
              else if (catStr.includes("VIA PRÓ-ATIVA") || catStr.includes("AÇÃO PRÓ-ATIVA")) originStats[grp].proactive++;
          }
      });

      const originRows = Object.keys(originStats).map(k => [
          customNames[k] || k,
          originStats[k].ciosp,
          originStats[k].proactive,
          originStats[k].ciosp + originStats[k].proactive
      ]).filter(r => (r[3] as number) > 0 || groupFilter !== 'TODOS').sort((a,b) => (b[3] as number) - (a[3] as number));

      if(originRows.length > 0) {
        autoTable(doc, {
            startY: yPos + 5,
            head: [['Grupamento', 'Via CIOSP', 'Via Pró-Ativa', 'Total']],
            body: originRows,
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80] },
            styles: { fontSize: 8 }
        });
        yPos = (doc as any).lastAutoTable.finalY + 15;
      } else {
          yPos += 20;
      }

      // --- 3. OCORRÊNCIAS POR GRUPAMENTO (QUADRO 3 - GRÁFICO) ---
      const groupCounts: Record<string, number> = {};
      filtered.forEach(inc => {
          const gName = customNames[inc.targetGroup] || inc.targetGroup;
          groupCounts[gName] = (groupCounts[gName] || 0) + 1;
      });
      const groupData = Object.keys(groupCounts).map(g => ({ label: g, value: groupCounts[g] })).sort((a,b) => b.value - a.value);

      yPos = drawHorizontalBarChart("OCORRÊNCIAS POR GRUPAMENTO", groupData, [59, 130, 246], yPos);

      // --- 4. NATUREZA DA OCORRÊNCIA (QUADRO 4 - GRÁFICO + TABELA) ---
      const extractStats = (categoryString: string): Record<string, number> => {
          const stats: Record<string, number> = {};
          if (!categoryString) return stats;
          
          const subMatches = categoryString.match(/\((.*?)\)/g);
          if (subMatches) {
              subMatches.forEach(match => {
                  const content = match.replace(/[()]/g, '');
                  const parts = content.split(',').map(s => s.trim());
                  parts.forEach(part => {
                      const [name, qtyStr] = part.split(':').map(s => s.trim());
                      const qty = qtyStr ? parseInt(qtyStr) : 1;
                      if (name && !isNaN(qty)) stats[name] = (stats[name] || 0) + qty;
                  });
              });
          }
          const mainContent = categoryString.replace(/\(.*?\)/g, '');
          const mainParts = mainContent.split(',').map(s => s.trim()).filter(Boolean);
          mainParts.forEach(part => {
              const [name, qtyStr] = part.split(':').map(s => s.trim());
              const qty = qtyStr ? parseInt(qtyStr) : 1;
              if (name && !isNaN(qty) && !name.includes("VIA CIOSP") && !name.includes("VIA PRÓ-ATIVA") && !name.includes("AÇÃO PRÓ-ATIVA")) {
                  stats[name] = (stats[name] || 0) + qty;
              }
          });
          return stats;
      };

      const catCounts: Record<string, number> = {};
      filtered.forEach(inc => {
          const stats = extractStats(inc.category || "");
          Object.keys(stats).forEach(k => catCounts[k] = (catCounts[k] || 0) + stats[k]);
      });
      const catData = Object.keys(catCounts).map(c => ({ label: c, value: catCounts[c] })).sort((a,b) => b.value - a.value);

      // Draw Top 10 as Chart
      yPos = drawHorizontalBarChart("NATUREZA DA OCORRÊNCIA (TOP 10)", catData.slice(0, 10), [234, 179, 8], yPos);

      // --- 5. ABORDAGENS REALIZADAS (QUADRO 5 - GRÁFICO + TABELA) ---
      const abordagensSubs = categories['Abordagens'] || [];
      const abordagensByType: Record<string, number> = {};
      const abordagensByGroup: Record<string, number> = {};

      filtered.forEach(inc => {
          const stats = extractStats(inc.category || "");
          let totalInc = 0;
          abordagensSubs.forEach(sub => { if(stats[sub]) { abordagensByType[sub] = (abordagensByType[sub] || 0) + stats[sub]; totalInc += stats[sub]; } });
          if (totalInc > 0 && inc.targetGroup) { const gName = customNames[inc.targetGroup] || inc.targetGroup; abordagensByGroup[gName] = (abordagensByGroup[gName] || 0) + totalInc; }
      });

      const abTypeData = Object.keys(abordagensByType).map(k => ({ label: k, value: abordagensByType[k] })).sort((a,b) => b.value - a.value);
      const abGroupRows = Object.keys(abordagensByGroup).map(k => [k, abordagensByGroup[k]]).sort((a,b) => (b[1] as number) - (a[1] as number));

      if (abTypeData.length > 0) {
          yPos = drawHorizontalBarChart("ABORDAGENS REALIZADAS (POR TIPO)", abTypeData, [234, 88, 12], yPos);
          
          if (abGroupRows.length > 0) {
            autoTable(doc, {
                startY: yPos,
                head: [['Grupamento', 'Qtd Abordagens']],
                body: abGroupRows,
                theme: 'grid',
                headStyles: { fillColor: [194, 65, 12] },
                styles: { fontSize: 8 }
            });
            yPos = (doc as any).lastAutoTable.finalY + 15;
          }
      }

      // --- 6. ATENDIMENTO MARIA DA PENHA (QUADRO 6 - GRÁFICO + TABELA) ---
      const mpSubs = categories['Maria da Penha'] || [];
      const mpByType: Record<string, number> = {};
      const mpByGroup: Record<string, number> = {};

      filtered.forEach(inc => {
          const stats = extractStats(inc.category || "");
          let totalInc = 0;
          mpSubs.forEach(sub => { if(stats[sub]) { mpByType[sub] = (mpByType[sub] || 0) + stats[sub]; totalInc += stats[sub]; } });
          if (totalInc > 0 && inc.targetGroup) { const gName = customNames[inc.targetGroup] || inc.targetGroup; mpByGroup[gName] = (mpByGroup[gName] || 0) + totalInc; }
      });

      const mpTypeData = Object.keys(mpByType).map(k => ({ label: k, value: mpByType[k] })).sort((a,b) => b.value - a.value);
      const mpGroupRows = Object.keys(mpByGroup).map(k => [k, mpByGroup[k]]).sort((a,b) => (b[1] as number) - (a[1] as number));

      if (mpTypeData.length > 0) {
          yPos = drawHorizontalBarChart("ATENDIMENTO MARIA DA PENHA (POR TIPO)", mpTypeData, [147, 51, 234], yPos);

          if (mpGroupRows.length > 0) {
            autoTable(doc, {
                startY: yPos,
                head: [['Grupamento', 'Qtd Atendimentos']],
                body: mpGroupRows,
                theme: 'grid',
                headStyles: { fillColor: [126, 34, 206] },
                styles: { fontSize: 8 }
            });
            yPos = (doc as any).lastAutoTable.finalY + 15;
          }
      }

      // --- 7. OCORRÊNCIAS DE TRÂNSITO (QUADRO 7 - GRÁFICO + TABELA) ---
      const transitoSubs = categories['Trânsito'] || [];
      const transitoByType: Record<string, number> = {};
      const transitoByGroup: Record<string, number> = {};

      filtered.forEach(inc => {
          const stats = extractStats(inc.category || "");
          let totalInc = 0;
          transitoSubs.forEach(sub => { if(stats[sub]) { transitoByType[sub] = (transitoByType[sub] || 0) + stats[sub]; totalInc += stats[sub]; } });
          if (totalInc > 0 && inc.targetGroup) { const gName = customNames[inc.targetGroup] || inc.targetGroup; transitoByGroup[gName] = (transitoByGroup[gName] || 0) + totalInc; }
      });

      const transitoTypeData = Object.keys(transitoByType).map(k => ({ label: k, value: transitoByType[k] })).sort((a,b) => b.value - a.value);
      const transitoGroupRows = Object.keys(transitoByGroup).map(k => [k, transitoByGroup[k]]).sort((a,b) => (b[1] as number) - (a[1] as number));

      if (transitoTypeData.length > 0) {
          if (yPos > 240) { doc.addPage(); yPos = 20; }
          yPos = drawHorizontalBarChart("OCORRÊNCIAS DE TRÂNSITO (POR TIPO)", transitoTypeData, [6, 182, 212], yPos); // Cyan

          if (transitoGroupRows.length > 0) {
            autoTable(doc, {
                startY: yPos,
                head: [['Grupamento', 'Qtd Trânsito']],
                body: transitoGroupRows,
                theme: 'grid',
                headStyles: { fillColor: [8, 145, 178] },
                styles: { fontSize: 8 }
            });
            yPos = (doc as any).lastAutoTable.finalY + 15;
          }
      }

      // --- 8. STATUS GERAL (QUADRO 8 - GRÁFICO PIZZA -> RESUMO) ---
      // Replicating "Status Geral" Donut Chart as a Percentage Table/List
      if (yPos > 240) { doc.addPage(); yPos = 20; }
      doc.setFontSize(11);
      doc.setTextColor(50, 50, 50);
      doc.text("STATUS GERAL (RESUMO)", 14, yPos);
      
      const statusCounts: Record<string, number> = {};
      filtered.forEach(inc => { if(inc.status) statusCounts[inc.status] = (statusCounts[inc.status] || 0) + 1; });
      const statusTotal = filtered.length;
      
      const statusRows = Object.keys(statusCounts).map(s => {
          const count = statusCounts[s];
          const pct = statusTotal > 0 ? ((count / statusTotal) * 100).toFixed(1) + '%' : '0%';
          return [s, count, pct];
      });

      autoTable(doc, {
          startY: yPos + 5,
          head: [['Status', 'Quantidade', 'Porcentagem']],
          body: statusRows,
          theme: 'striped',
          headStyles: { fillColor: [71, 85, 105] },
          styles: { fontSize: 8 }
      });
      yPos = (doc as any).lastAutoTable.finalY + 15;

      // --- 9. ATENDIMENTO ESCOLAR (QUADRO 9) ---
      const schoolStats: Record<string, {attended:number, preventive:number, social:number}> = {};
      filtered.forEach(inc => {
          const stats = extractStats(inc.category || "");
          if (inc.category && inc.category.includes("UNIDADE ESCOLAR:")) {
             const parts = inc.category.split("UNIDADE ESCOLAR:");
             if(parts[1]) {
                 const match = parts[1].match(/\[(.*?)\]/);
                 const schoolsStr = match ? match[1] : parts[1].split(')')[0];
                 if(schoolsStr) {
                     const schools = schoolsStr.split(',').map(s => s.trim()).filter(Boolean);
                     const attended = stats["OCORRÊNCIA ATENDIDA"] || 0;
                     const preventive = stats["PATRULHAMENTO PREVENTIVO"] || 0;
                     const social = stats["ATIVIDADES SOCIAIS"] || 0;
                     schools.forEach(sch => {
                         if(!schoolStats[sch]) schoolStats[sch] = {attended:0, preventive:0, social:0};
                         schoolStats[sch].attended += attended;
                         schoolStats[sch].preventive += preventive;
                         schoolStats[sch].social += social;
                     });
                 }
             }
          }
      });
      const schoolRows = Object.keys(schoolStats).map(s => [
          s, 
          schoolStats[s].attended, 
          schoolStats[s].preventive, 
          schoolStats[s].social,
          schoolStats[s].attended + schoolStats[s].preventive + schoolStats[s].social
      ]).sort((a,b) => (b[4] as number) - (a[4] as number));

      if (schoolRows.length > 0) {
          doc.setFontSize(11);
          doc.setTextColor(37, 99, 235);
          doc.text("ATENDIMENTO ESCOLAR", 14, yPos);
          autoTable(doc, {
              startY: yPos + 5,
              head: [['Escola', 'Atendida', 'Prev.', 'Social', 'Total']],
              body: schoolRows,
              theme: 'grid',
              headStyles: { fillColor: [30, 64, 175] },
              styles: { fontSize: 8 }
          });
          yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // --- 10. PONTOS CRÍTICOS (QUADRO 10) ---
      const locs: Record<string, number> = {};
      filtered.forEach(inc => {
          const stats = extractStats(inc.category || "");
          const victim = stats["ACIDENTE C/VÍTIMA"] || 0;
          const noVictim = stats["ACIDENTE S/VÍTIMA"] || 0;
          if ((victim > 0 || noVictim > 0) && inc.location) {
              const loc = inc.location.trim().toUpperCase();
              locs[loc] = (locs[loc] || 0) + (victim + noVictim);
          }
      });
      const hotData = Object.keys(locs).map(l => [l, locs[l]]).sort((a,b) => (b[1] as number) - (a[1] as number)).slice(0, 10);

      if (hotData.length > 0) {
        doc.setFontSize(11);
        doc.setTextColor(220, 38, 38);
        doc.text("PONTOS CRÍTICOS DE ACIDENTES", 14, yPos);
        autoTable(doc, {
            startY: yPos + 5,
            head: [['Local', 'Qtd']],
            body: hotData,
            theme: 'grid',
            headStyles: { fillColor: [220, 38, 38] },
            styles: { fontSize: 8 }
        });
        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // --- 11. DETALHAMENTO (QUADRO 11) ---
      if (yPos > 240) { doc.addPage(); yPos = 20; }
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text("DETALHAMENTO (APREENSÕES E PRISÕES)", 14, yPos);

      const targetDetalhes = [
          ...(categories['Veículo apreendido'] || []),
          ...(categories['Condução para delegacia'] || []),
          ...(categories['Apreensão'] || [])
      ];
      const detalheCounts: Record<string, number> = {};
      filtered.forEach(inc => {
          const stats = extractStats(inc.category || "");
          targetDetalhes.forEach(sub => {
              if (stats[sub]) {
                  detalheCounts[sub] = (detalheCounts[sub] || 0) + stats[sub];
              }
          });
      });
      const detalheRows = Object.keys(detalheCounts).map(k => [k, detalheCounts[k]]).sort((a,b) => (b[1] as number) - (a[1] as number));

      if (detalheRows.length > 0) {
          autoTable(doc, {
              startY: yPos + 5,
              head: [['Item / Situação', 'Qtd']],
              body: detalheRows,
              theme: 'striped',
              headStyles: { fillColor: [71, 85, 105] },
              styles: { fontSize: 8 }
          });
          yPos = (doc as any).lastAutoTable.finalY + 15;
      } else {
          doc.setFontSize(8);
          doc.text("Sem registros nestas categorias.", 14, yPos + 10);
          yPos += 20;
      }

      // --- SAVE ---
      if (backupEmail) {
          const fileName = 'relatorio-estatistico-completo.pdf';
          doc.save(fileName); 
          alert(`O relatório completo foi baixado.\n\nSeu email padrão será aberto agora para enviar para: ${backupEmail}.\nPor favor, anexe o arquivo "${fileName}" que acabou de baixar.`);
          
          setTimeout(() => {
              const subject = encodeURIComponent("Backup Relatório Estatístico Completo - CIOSP");
              const body = encodeURIComponent("Segue em anexo o relatório estatístico operacional completo gerado pelo sistema.\n\nPor favor, anexe o arquivo baixado.");
              window.open(`mailto:${backupEmail}?subject=${subject}&body=${body}`, '_blank');
          }, 1500);
      } else {
        doc.save('relatorio-estatistico-completo.pdf');
      }
  };

  const generateLogPDF = (startDate: number, endDate: number, title: string, groupFilter: string) => {
      const doc = new jsPDF();
      
      const filtered = incidents.filter(i => {
          const inTime = i.createdAt >= startDate && i.createdAt <= endDate;
          const inGroup = groupFilter === 'TODOS' ? true : i.targetGroup === groupFilter;
          return inTime && inGroup;
      });

      if (crestLeft) doc.addImage(crestLeft, 'PNG', 10, 10, 20, 20);
      doc.setFontSize(16);
      doc.text(appTitle, 105, 20, { align: 'center' });
      doc.setFontSize(12);
      doc.text(title, 105, 30, { align: 'center' });

      const tableData = filtered.map(inc => {
          const hasImage = inc.attachments && inc.attachments.length > 0;
          return [
              new Date(inc.createdAt).toLocaleString(),
              customNames[inc.targetGroup] || inc.targetGroup,
              inc.location || '-',
              inc.category || '-',
              inc.status, 
              inc.description + (hasImage ? '\n[📸 VER FOTOS]' : ''),
              hasImage ? inc.attachments![0] : ''
          ];
      });

      autoTable(doc, {
          startY: 40,
          head: [['Data/Hora', 'Grupo', 'Local', 'Natureza', 'Status', 'Descrição', 'Foto']],
          body: tableData,
          styles: { fontSize: 8, minCellHeight: 20 },
          didDrawCell: (data) => {
              if (data.section === 'body' && data.column.index === 6) {
                  const base64Img = data.cell.raw as string;
                  if (base64Img) {
                      try {
                        doc.addImage(base64Img, 'JPEG', data.cell.x + 2, data.cell.y + 2, 16, 16);
                      } catch(e) {}
                  }
              }
          },
          didParseCell: (data) => {
              if (data.column.index === 6) {
                  data.cell.text = [];
              }
          }
      });

      const incidentsWithPhotos = filtered.filter(i => i.attachments && i.attachments.length > 0);
      if (incidentsWithPhotos.length > 0) {
          doc.addPage();
          doc.setFontSize(14);
          doc.text("5. REGISTRO FOTOGRÁFICO", 14, 20);
          
          let yPos = 30;
          incidentsWithPhotos.forEach((inc) => {
             const imgs = inc.attachments || [];
             if (yPos > 200) { doc.addPage(); yPos = 20; }
             
             doc.setFontSize(10);
             doc.text(`Ocorrência: ${inc.description.substring(0, 50)}... (${new Date(inc.createdAt).toLocaleString()})`, 14, yPos);
             yPos += 5;
             
             let xPos = 14;
             imgs.forEach(img => {
                 if (xPos > 150) { xPos = 14; yPos += 45; }
                 try {
                     doc.addImage(img, 'JPEG', xPos, yPos, 40, 40);
                     xPos += 45;
                 } catch(e) {}
             });
             yPos += 50;
          });
      }

      if (backupEmail) {
          const fileName = 'relatorio-ciosp.pdf';
          doc.save(fileName); 
          alert(`O relatório foi baixado.\n\nSeu email padrão será aberto agora para enviar para: ${backupEmail}.\nPor favor, anexe o arquivo "${fileName}" que acabou de baixar.`);
          
          setTimeout(() => {
              const subject = encodeURIComponent(`Relatório CIOSP - ${title}`);
              const body = encodeURIComponent("Segue em anexo o relatório operacional gerado pelo sistema.\n\nPor favor, anexe o arquivo baixado.");
              window.open(`mailto:${backupEmail}?subject=${subject}&body=${body}`, '_blank');
          }, 1500);
      } else {
          doc.save('relatorio-ciosp.pdf');
      }
  };

  // --- HANDLERS (Connection) ---

  const startCIOSP = async () => {
      try {
          const id = await connection.initializeHost(
              (packet) => {
                  processPacket(packet);
              },
              (count) => setConnectedCount(count)
          );
          setConnectionId(id);
          setIsHost(true);
          setRole('CIOSP');
          broadcastSync();
      } catch (e) {
          alert("Erro ao iniciar CIOSP: " + e);
      }
  };

  const joinAsMirror = async () => {
      if (!mirrorCode) return alert("Digite o ID de Espelhamento!");
      try {
          await connection.connectToHost(mirrorCode, (packet) => {
              processPacket(packet);
          });
          setConnectionId(mirrorCode);
          setIsHost(false); // Mirror is NOT host
          setRole('CIOSP'); // But sees CIOSP UI
      } catch (e) {
          alert("Erro ao conectar como espelho: " + e);
      }
  }

  const joinAsUnit = async (group: GroupName) => {
      if (!connectionCode) return alert("Digite o código do CIOSP!");
      try {
          await connection.connectToHost(connectionCode, (packet) => {
               processPacket(packet);
          });
          setIsHost(false);
          setRole(group);
      } catch (e) {
          alert("Erro ao conectar: " + e);
      }
  };

  const processPacket = (packet: DataPacket) => {
      switch (packet.type) {
          case 'SYNC_STATE':
              db.bulkUpdateFromSync(packet.payload);
              // Optimistic updates are overwritten by authoritative sync
              setIncidents(db.getStoredIncidents());
              setMessages(db.getStoredMessages());
              setCustomIcons(db.getStoredIcons());
              setCustomSounds(db.getStoredSounds());
              setCustomNames(db.getStoredNames());
              setCategories(db.getStoredCategories());
              setWatermark(db.getWatermark());
              setAppTitle(db.getStoredTitle());
              setCommandLabel(db.getStoredCommandLabel());
              setCrestLeft(db.getStoredCrestLeft());
              setCrestRight(db.getStoredCrestRight());
              break;
          case 'CMD_ADD_INCIDENT':
              db.saveIncident(packet.payload);
              playGroupSound(packet.payload.targetGroup);
              speak(`Nova ocorrência de ${customNames[packet.payload.targetGroup] || packet.payload.targetGroup}`);
              
              if (isHost) {
                  // Relay command to others so they also hear the sound
                  connection.broadcastData(packet);
              }
              break;
          case 'CMD_UPDATE_STATUS':
              updateIncidentStatusDirectly(packet.payload.id, packet.payload.status, packet.payload.category);
              if (isHost && packet.payload.status === IncidentStatus.RESOLVED) {
                  const currentList = db.getStoredIncidents();
                  const inc = currentList.find(i => i.id === packet.payload.id);
                  const grpName = inc ? (customNames[inc.targetGroup] || inc.targetGroup) : "Unidade";
                  playBeep();
                  speak(`Atenção, Ocorrência de ${grpName} Finalizada.`);
              }
              break;
          case 'CMD_SEND_MESSAGE':
              db.saveMessage(packet.payload);
              
              if (packet.payload.to === 'GERAL') {
                  playGeneralSound();
              }

              if (isHost) {
                  // Relay to others so they hear it too
                  connection.broadcastData(packet); 
              }
              break;
          case 'CMD_DELETE_MESSAGE':
              db.deleteMessage(packet.payload.id);
              if (isHost) broadcastSync();
              break;
          case 'CMD_DELETE_INCIDENT':
              db.deleteIncident(packet.payload.id);
              if (isHost) broadcastSync();
              break;
          case 'CMD_CLEAR_HISTORY':
              db.clearResolvedIncidents();
              if (isHost) broadcastSync();
              break;
      }
  };

  const handleOpenGeneralChat = () => setShowGeneralChat(true);

  // --- RENDERERS ---

  const unreadGeneralCount = messages.filter(m => m.to === 'GERAL' && m.from !== 'CIOSP').length;
  const customTitle = appTitle;

  // --- VIEW: LOGIN (CLASSIC / SIMPLE) ---
  if (!role) {
      return (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden text-white">
              
              {/* TOP RIGHT CENTRAL MANAGER */}
              <div className="absolute top-4 right-4 z-20">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-500 uppercase font-bold mb-1">Base Ativa</span>
                    <button 
                        onClick={() => setShowCentralManager(true)}
                        className="bg-slate-800 hover:bg-slate-700 text-blue-300 font-bold px-3 py-2 rounded text-xs border border-blue-900/50 flex items-center gap-2 shadow-lg transition-colors"
                    >
                        <span>🏢</span> {activeCentralName} <span className="text-[9px] ml-1 opacity-50">▼</span>
                    </button>
                  </div>
              </div>

              <div className="text-center mb-6 mt-10">
                  <h1 className="text-3xl font-black mb-1 tracking-widest text-slate-200">
                     SISTEMA INTEGRADO
                  </h1>
                  <p className="text-xs font-bold text-blue-500 tracking-[0.2em]">{appTitle}</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col gap-6">
                  
                  {/* CIOSP LOGIN BLOCK */}
                  <div className="flex flex-col items-center border-b border-slate-800 pb-6 w-full">
                      <h2 className="text-sm font-bold text-slate-400 flex items-center gap-2 mb-3">
                         <span className="text-xl">📡</span> {commandLabel}
                      </h2>
                      
                      <div className="flex flex-col md:flex-row gap-8 w-full justify-center items-center">
                          {/* HOST */}
                          <button 
                            onClick={startCIOSP}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform hover:scale-105 active:scale-95 text-xs w-56 flex flex-col items-center gap-1"
                          >
                             <span>INICIAR PLANTÃO (HOST)</span>
                             <span className="text-[9px] font-normal opacity-70">Criar nova central</span>
                          </button>
                          
                          <div className="flex flex-col items-center justify-center gap-1">
                               <div className="h-8 w-px bg-slate-700 md:block hidden"></div>
                               <span className="text-slate-600 font-bold text-[10px]">OU</span>
                               <div className="h-8 w-px bg-slate-700 md:block hidden"></div>
                          </div>

                          {/* MIRROR */}
                          <div className="flex flex-col gap-2 items-center">
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">ID DE ESPELHAMENTO</label>
                              <div className="flex gap-2">
                                  <input 
                                    placeholder="ID..."
                                    className="bg-slate-950 border border-slate-700 text-white text-center text-sm font-mono uppercase rounded px-3 py-2 w-32 focus:border-blue-500 outline-none placeholder-slate-600"
                                    value={mirrorCode}
                                    onChange={(e) => setMirrorCode(e.target.value.toUpperCase())}
                                    maxLength={4}
                                  />
                                  <button 
                                    onClick={joinAsMirror}
                                    className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded text-xs border border-slate-600 shadow-md"
                                  >
                                    CONECTAR
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* UNIT LOGIN BLOCK */}
                  <div className="flex flex-col items-center">
                      <label className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Código da Central (Unidades)</label>
                      <input 
                        placeholder="----"
                        className="bg-slate-950 border-2 border-slate-700 text-white text-center text-2xl font-mono tracking-[0.5em] rounded-lg py-3 px-4 w-48 uppercase focus:border-blue-500 outline-none transition-colors"
                        value={connectionCode}
                        onChange={(e) => setConnectionCode(e.target.value.toUpperCase())}
                        maxLength={4}
                      />
                  </div>

                  {/* GROUP GRID (6 Columns) */}
                  <div className="mt-2">
                      <h2 className="text-center text-xs font-bold text-slate-500 mb-4 uppercase">Selecione sua Unidade</h2>
                      <div className="grid grid-cols-6 gap-2">
                          {GROUPS.map(g => {
                              // Calculate badges based on local storage data for dashboard view
                              const badgeCount = incidents.filter(i => i.targetGroup === g && (i.status === IncidentStatus.PENDING || i.status === IncidentStatus.ACKNOWLEDGED)).length;
                              
                              return (
                                <div key={g} className="h-16">
                                    <IconDisplay 
                                        id={g}
                                        name={customNames[g] || g}
                                        imageSrc={customIcons[g] || DEFAULT_ICONS[g]}
                                        soundSrc={customSounds[g]} 
                                        isEditable={true}
                                        onImageChange={handleIconChange}
                                        onSoundChange={handleSoundChange}
                                        onRename={handleRenameGroup}
                                        onClick={() => joinAsUnit(g)}
                                        badgeCount={badgeCount}
                                    />
                                </div>
                              );
                          })}
                      </div>
                  </div>
              </div>

              {showCentralManager && (
                  <CentralManagerModal onClose={() => setShowCentralManager(false)} />
              )}
          </div>
      );
  }

  // --- VIEW: CIOSP (CLASSIC SIDEBAR) ---
  if (role === 'CIOSP') {
      const resolvedCount = incidents.filter(i => i.status === IncidentStatus.RESOLVED).length;
      const cancelledCount = incidents.filter(i => i.status === IncidentStatus.CANCELLED).length;
      const totalRemovable = resolvedCount + cancelledCount;
      
      return (
        <div className="flex flex-col h-screen bg-slate-950 text-white relative overflow-hidden">
        {watermark && (
          <div 
            className="fixed inset-0 z-0 opacity-[0.15] pointer-events-none bg-center bg-no-repeat bg-contain"
            style={{ backgroundImage: `url(${watermark})` }}
          ></div>
        )}

        {/* HEADER */}
        <header className="bg-slate-900 border-b border-slate-800 p-2 z-10 flex justify-between items-center shadow-md shrink-0">
            {/* Left: Crest + Title */}
            <div className="flex items-center gap-4 h-full relative">
                 <div className="w-12 h-12 flex items-center justify-center relative group">
                    {crestLeft ? (
                         <img src={crestLeft} className="w-full h-full object-contain" alt="Brasão Esq" />
                    ) : (
                         <div className="w-full h-full border-2 border-dashed border-slate-700 rounded-full flex items-center justify-center text-[8px] text-slate-600">Esq</div>
                    )}
                     {isHost && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full cursor-pointer" onClick={() => handleCrestChange('CREST_LEFT', prompt("Cole o Base64 da imagem") || crestLeft || "")}>
                             <span className="text-[8px]">✏️</span>
                        </div>
                     )}
                 </div>

                 <div className="w-px h-8 bg-blue-600/50 mx-2"></div>
                
                 <div>
                    <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                        {customTitle}
                        <div className="w-6 h-6 rounded-md bg-blue-900 flex items-center justify-center border border-blue-700 shadow-sm ml-2">
                            <span className="text-[10px] font-bold">C</span>
                        </div>
                    </h1>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-[10px] font-bold text-green-400 tracking-wider">ONLINE</span>
                        <span className="text-[9px] text-slate-500 bg-slate-800 px-1 rounded ml-1 border border-slate-700">ID: {connectionId}</span>
                        {isHost ? (
                             <span className="text-[9px] text-slate-500 bg-slate-800 px-1 rounded border border-slate-700">Units: {connectedCount}</span>
                        ) : (
                             <span className="text-[9px] text-purple-400 bg-purple-900/20 px-1 rounded border border-purple-800 font-bold">MODO ESPELHO</span>
                        )}
                        <span className="text-[9px] text-blue-300 bg-blue-900/20 px-1 rounded border border-blue-800 font-bold ml-2">
                            {activeCentralName}
                        </span>
                    </div>
                </div>
            </div>

            {/* Right: Tools + Crest */}
            <div className="flex items-center gap-2">
                 <button
                    onClick={handleOpenGeneralChat}
                    className="flex items-center gap-1 bg-orange-700 hover:bg-orange-600 text-white px-3 py-1.5 rounded border border-orange-600 transition-all text-xs font-bold relative mr-1 shadow-lg"
                 >
                    <span>📢</span> GERAL
                    {unreadGeneralCount > 0 && (
                         <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white shadow-md ring-1 ring-slate-900 animate-pulse">
                            {unreadGeneralCount}
                         </span>
                    )}
                 </button>

                 <button 
                    onClick={() => setShowStats(true)} 
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded border border-slate-700 transition-all text-xs font-bold"
                 >
                    <span>📊</span> STATS
                 </button>
                 <button 
                    onClick={() => handleExportPDF('LOG')}
                    className="flex items-center gap-1 bg-blue-900 hover:bg-blue-800 text-blue-100 px-3 py-1.5 rounded border border-blue-700 transition-all text-xs font-bold"
                 >
                    <span>📄</span> PDF
                 </button>
                 
                 <div className="w-12 h-12 flex items-center justify-center relative group ml-2">
                     {crestRight ? (
                         <img src={crestRight} className="w-full h-full object-contain" alt="Brasão Dir" />
                    ) : (
                         <div className="w-full h-full border-2 border-dashed border-slate-700 rounded-full flex items-center justify-center text-[8px] text-slate-600">Dir</div>
                    )}
                     {isHost && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full cursor-pointer" onClick={() => handleCrestChange('CREST_RIGHT', prompt("Cole o Base64 da imagem") || crestRight || "")}>
                             <span className="text-[8px]">✏️</span>
                        </div>
                     )}
                 </div>
            </div>
        </header>

        {/* MAIN LAYOUT WITH SIDEBAR */}
        <div className="flex flex-1 overflow-hidden relative z-0">
            
            {/* LEFT: INCIDENT LIST */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-950/80">
                
                {/* STATUS BAR */}
                <div className="p-2 flex justify-between items-center bg-slate-900/30 border-b border-slate-800">
                    <div className="flex gap-2">
                        <span className="text-xs font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20">
                            Pendentes: {incidents.filter(i => i.status === IncidentStatus.PENDING).length}
                        </span>
                        <span className="text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                            Em Andamento: {incidents.filter(i => i.status === IncidentStatus.ACKNOWLEDGED).length}
                        </span>
                        <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                            Finalizadas: {resolvedCount}
                        </span>
                    </div>
                    <button 
                        onClick={handleClearHistory}
                        className="text-[10px] text-red-400 hover:text-red-300 hover:bg-red-900/20 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                        🗑️ Limpar Histórico ({totalRemovable})
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {incidents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-600 opacity-60">
                            <span className="text-4xl mb-2">📡</span>
                            <p className="font-bold">Aguardando ocorrências...</p>
                        </div>
                    ) : (
                        incidents
                        .sort((a, b) => {
                            const getWeight = (s: IncidentStatus) => {
                                if (s === IncidentStatus.PENDING) return 10;
                                if (s === IncidentStatus.ACKNOWLEDGED) return 5;
                                return -10; 
                            };
                            const wA = getWeight(a.status);
                            const wB = getWeight(b.status);
                            if (wA !== wB) return wB - wA; 
                            return b.updatedAt - a.updatedAt; 
                        })
                        .map(incident => (
                            <div 
                                key={incident.id} 
                                className={`border rounded-lg p-3 relative shadow-md transition-all duration-300
                                    ${incident.status === IncidentStatus.PENDING ? 'bg-yellow-900/10 border-yellow-600/50' : 
                                      incident.status === IncidentStatus.ACKNOWLEDGED ? 'bg-blue-900/10 border-blue-600/50' : 
                                      'bg-red-800 border-red-600 shadow-red-900/20'} 
                                `}
                            >
                                <div className="flex justify-between items-start mb-2 border-b border-slate-800/50 pb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-white bg-slate-800 px-2 py-0.5 rounded uppercase tracking-wide border border-slate-700">
                                            {customNames[incident.targetGroup] || incident.targetGroup}
                                        </span>
                                        {incident.category && (
                                            <span className="text-[10px] font-bold text-slate-300 bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700/50">
                                                {incident.category}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-500">
                                        {new Date(incident.createdAt).toLocaleTimeString()}
                                    </span>
                                </div>

                                {incident.location && (
                                    <div className="flex items-center gap-1 mb-2">
                                        <span className="text-sm">📍</span>
                                        <span className="text-xs font-bold text-yellow-500">{incident.location}</span>
                                    </div>
                                )}

                                <p className="text-sm text-slate-200 font-medium leading-relaxed mb-3 pl-1 border-l-2 border-slate-700">
                                    {incident.description}
                                </p>
                                
                                {incident.attachments && incident.attachments.length > 0 && (
                                    <div className="flex gap-2 mb-3 overflow-x-auto pb-1 custom-scrollbar">
                                        {incident.attachments.map((img, idx) => (
                                            <div key={idx} className="h-12 w-12 shrink-0 rounded border border-slate-700 overflow-hidden cursor-pointer" onClick={() => {
                                                const w = window.open("");
                                                w?.document.write(`<img src="${img}" style="max-width:100%"/>`);
                                            }}>
                                                <img src={img} className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex justify-between items-center mt-2">
                                    <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border
                                        ${incident.status === IncidentStatus.PENDING ? 'bg-yellow-500 text-black border-yellow-400 animate-pulse' : 
                                          incident.status === IncidentStatus.ACKNOWLEDGED ? 'bg-blue-600 text-white border-blue-400' : 
                                          'bg-white text-red-900 border-red-900'}
                                    `}>
                                        {incident.status}
                                    </div>

                                    <div className="flex gap-2">
                                        {incident.status !== IncidentStatus.RESOLVED && (
                                            <button 
                                                onClick={() => handleDeleteIncident(incident.id)}
                                                className="text-slate-500 hover:text-red-400 transition-colors"
                                                title="Excluir"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* RIGHT: SIDEBAR (UNIDADES & CONTROLES) */}
            <aside className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-800 bg-slate-900">
                     <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Unidades & Controles</h2>
                     
                     {/* System Controls */}
                     <div className="flex flex-col gap-3 mb-6 bg-slate-950/50 p-3 rounded border border-slate-800">
                        <div className="flex gap-2">
                            <div className="h-10 w-10">
                                <IconDisplay 
                                    name="MARCA D'ÁGUA" 
                                    imageSrc={watermark || undefined}
                                    isEditable={isHost}
                                    onImageChange={(id, base64) => handleWatermarkChange(id, base64)}
                                    onRename={handleRenameGroup}
                                    onClick={() => {}}
                                    triggerEditOnSingleClick={true}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <label className="text-[8px] font-bold text-blue-400 uppercase">Email / Backup</label>
                            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-700">
                                <span className="text-[10px]">✉️</span>
                                <input 
                                    className="bg-transparent border-none text-white text-[10px] w-full outline-none placeholder-slate-600"
                                    placeholder="email@exemplo.com"
                                    value={backupEmail}
                                    onChange={handleEmailChange}
                                    disabled={!isHost}
                                />
                            </div>
                        </div>
                     </div>
                     
                     {/* Actions */}
                     <div className="flex gap-2 mb-4">
                         <button onClick={handleCopyLink} className="flex-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-white px-2 py-2 rounded flex items-center justify-center gap-1 border border-slate-700 font-bold">
                            <span>🔗</span> Copiar Link
                         </button>
                         <button onClick={handleLogout} className="flex-1 text-[10px] bg-red-900/80 hover:bg-red-800 text-white px-2 py-2 rounded flex items-center justify-center gap-1 border border-red-800 font-bold">
                            <span>🚪</span> Sair
                         </button>
                     </div>
                </div>

                {/* Group Grid (2 Columns) */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                     <div className="grid grid-cols-2 gap-3">
                        {GROUPS.map((group) => {
                            const badge = incidents.filter(i => i.targetGroup === group && (i.status === IncidentStatus.PENDING || i.status === IncidentStatus.ACKNOWLEDGED)).length;
                            return (
                                <div key={group} className="h-24">
                                    <IconDisplay
                                        id={group}
                                        name={customNames[group] || group}
                                        imageSrc={customIcons[group] || DEFAULT_ICONS[group]}
                                        soundSrc={customSounds[group]}
                                        isEditable={isHost}
                                        onImageChange={handleIconChange}
                                        onSoundChange={handleSoundChange}
                                        onRename={handleRenameGroup}
                                        onClick={() => {
                                            setActiveGroupForIncident(group as GroupName);
                                        }}
                                        badgeCount={badge}
                                    />
                                </div>
                            );
                        })}
                     </div>
                </div>
            </aside>
        </div>

        <button 
           onClick={() => setShowInbox(true)}
           className="fixed bottom-6 right-6 h-14 w-14 bg-blue-600 hover:bg-blue-500 rounded-full shadow-2xl flex items-center justify-center border-2 border-white/20 z-50 transition-transform hover:scale-105 active:scale-95"
        >
            <span className="text-2xl">💬</span>
            {messages.filter(m => (!m.to || m.to === 'CIOSP')).length > 0 && (
                 <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold px-1.5 rounded-full border border-slate-900">
                     {messages.filter(m => (!m.to || m.to === 'CIOSP')).length}
                 </span>
            )}
        </button>

        {activeGroupForIncident && (
            <IncidentForm 
                targetGroup={activeGroupForIncident}
                targetGroupName={customNames[activeGroupForIncident]}
                incidents={incidents.filter(i => i.targetGroup === activeGroupForIncident)}
                messages={messages.filter(m => m.from === activeGroupForIncident || m.to === activeGroupForIncident)}
                onClose={() => setActiveGroupForIncident(null)}
                onSubmit={handleAddIncident}
                onUpdateStatus={handleUpdateStatus}
                onSendMessage={(txt) => handleSendMessage(txt, activeGroupForIncident)}
            />
        )}

        {showStats && (
            <StatsView 
                incidents={incidents}
                customNames={customNames}
                onClose={() => setShowStats(false)}
                onExportPDF={() => handleExportPDF('STATS')}
                categories={categories}
            />
        )}

        {showInbox && (
            <InboxModal 
                messages={messages}
                onClose={() => setShowInbox(false)}
                onDelete={handleDeleteMessage}
                onReply={(to, text) => handleSendMessage(text, to)}
            />
        )}

        {showGeneralChat && (
            <GeneralChatModal 
                currentUser={role}
                messages={messages}
                onClose={() => setShowGeneralChat(false)}
                onSend={(txt) => handleSendMessage(txt, 'GERAL')}
            />
        )}

        {resolveIncidentId && (
            <ResolveModal 
                onClose={() => setResolveIncidentId(null)}
                onConfirm={handleResolveConfirm}
                categories={categories}
                onCategoryUpdate={(newCats) => {
                    db.saveStoredCategories(newCats);
                    setCategories(newCats);
                    if(isHost) broadcastSync();
                }}
            />
        )}

        {showReportSelector && (
            <ReportSelectorModal 
                customNames={customNames}
                onClose={() => setShowReportSelector(false)}
                onGenerate={handleGenerateReport}
                currentUser={role}
            />
        )}
      </div>
      );
  } else {
      // VIEW: UNIT
      const myIncidents = incidents.filter(i => i.targetGroup === role).sort((a, b) => {
         const getWeight = (s: IncidentStatus) => {
             if (s === IncidentStatus.PENDING) return 10;
             if (s === IncidentStatus.ACKNOWLEDGED) return 5;
             return -1;
         };
         const wA = getWeight(a.status);
         const wB = getWeight(b.status);
         if (wA !== wB) return wB - wA; // Highest weight first
         return b.createdAt - a.createdAt;
      });

      return (
        <div className="flex flex-col h-screen bg-slate-950 text-white relative">
            <header className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10">
                        <IconDisplay 
                            name={role} 
                            imageSrc={customIcons[role] || DEFAULT_ICONS[role]}
                            isEditable={false}
                            onClick={() => {}}
                        />
                    </div>
                    <div>
                        <h1 className="text-xl font-black">{customNames[role] || role}</h1>
                        <div className="flex gap-2">
                             <span className="text-[10px] bg-green-900 text-green-300 px-2 rounded border border-green-700">CONECTADO</span>
                             <span className="text-[10px] text-slate-500">{appTitle}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                     <button
                         onClick={() => setActiveGroupForIncident(role as GroupName)}
                         className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold border border-blue-400 shadow-lg animate-pulse"
                     >
                         GERAR OCORRÊNCIA
                     </button>
                     
                     <button 
                        onClick={() => setShowStats(true)} 
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold border border-slate-600 flex items-center gap-1"
                     >
                        <span>📊</span> STATS
                     </button>

                     <button 
                        onClick={() => handleExportPDF('LOG')} 
                        className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-blue-100 rounded text-xs font-bold border border-blue-700 transition-all flex items-center gap-1"
                     >
                        <span>📄</span> PDF
                     </button>

                     <button onClick={handleOpenGeneralChat} className="p-2 bg-purple-600 rounded-full relative">
                         📢 {unreadGeneralCount > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse border border-white"></span>}
                     </button>
                     <button onClick={handleLogout} className="px-3 py-1 bg-red-900 rounded text-xs">Sair</button>
                </div>
            </header>
            
            <div className="flex-1 bg-slate-950 p-4 overflow-hidden relative flex flex-col">
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageFile} />
                 <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageFile} />

                 <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                    {myIncidents.length === 0 ? (
                        <div className="text-center text-slate-500 mt-10 p-6 border-2 border-dashed border-slate-800 rounded-lg">
                            <span className="text-4xl block mb-2">💤</span>
                            <p className="font-bold">Nenhuma ocorrência ativa</p>
                            <p className="text-xs">Aguarde chamados da central.</p>
                        </div>
                    ) : (
                        myIncidents.map(incident => (
                            <div 
                                key={incident.id} 
                                className={`
                                    border rounded-xl p-4 shadow-lg transition-all animate-in slide-in-from-bottom-2 duration-300
                                    ${incident.status === IncidentStatus.PENDING ? 'bg-yellow-900/10 border-yellow-500 shadow-yellow-900/20' : 
                                      incident.status === IncidentStatus.ACKNOWLEDGED ? 'bg-blue-900/10 border-blue-500 shadow-blue-900/20' : 
                                      'bg-red-800 border-red-600 opacity-100'} // Solid Red
                                `}
                            >
                                <div className="flex justify-between items-start mb-3 pb-2 border-b border-white/10">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase
                                            ${incident.status === IncidentStatus.PENDING ? 'bg-yellow-500 text-black animate-pulse' : 
                                              incident.status === IncidentStatus.ACKNOWLEDGED ? 'bg-blue-600 text-white' : 
                                              'bg-white text-red-900 font-black border border-white'}
                                        `}>
                                            {incident.status}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            {new Date(incident.createdAt).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    
                                    {incident.status === IncidentStatus.PENDING && (
                                        <button 
                                            onClick={() => handleUpdateStatus(incident.id, IncidentStatus.ACKNOWLEDGED)}
                                            className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded shadow-lg animate-bounce"
                                        >
                                            ACEITAR OCORRÊNCIA
                                        </button>
                                    )}
                                </div>

                                {incident.location && (
                                    <div className="flex items-start gap-1 mb-2 text-yellow-400">
                                        <span className="text-base">📍</span>
                                        <span className="text-sm font-bold">{incident.location}</span>
                                    </div>
                                )}
                                
                                <p className="text-slate-200 font-medium text-sm mb-4 leading-relaxed pl-2 border-l-2 border-slate-600">
                                    {incident.description}
                                </p>

                                {incident.attachments && incident.attachments.length > 0 && (
                                    <div className="flex gap-2 mb-3 overflow-x-auto pb-1 custom-scrollbar">
                                        {incident.attachments.map((img, idx) => (
                                            <div key={idx} className="h-16 w-16 shrink-0 rounded border border-slate-700 overflow-hidden" onClick={() => {
                                                const w = window.open("");
                                                w?.document.write(`<img src="${img}" style="max-width:100%"/>`);
                                            }}>
                                                <img src={img} className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {incident.status === IncidentStatus.ACKNOWLEDGED && (
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <button 
                                            onClick={() => triggerImageUpload(incident.id, 'CAMERA')}
                                            className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2 rounded border border-slate-600 flex items-center justify-center gap-1"
                                        >
                                            <span>📷</span> CÂMERA
                                        </button>
                                        <button 
                                            onClick={() => triggerImageUpload(incident.id, 'GALLERY')}
                                            className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2 rounded border border-slate-600 flex items-center justify-center gap-1"
                                        >
                                            <span>📎</span> ANEXAR
                                        </button>
                                        <button 
                                            onClick={() => handleUpdateStatus(incident.id, IncidentStatus.RESOLVED)}
                                            className="col-span-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold py-3 rounded shadow-lg"
                                        >
                                            FINALIZAR / QAP
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                 </div>
            </div>
            
            {/* INCIDENT FORM FOR SELF-DISPATCH */}
            {activeGroupForIncident === role && (
                <IncidentForm 
                    targetGroup={role}
                    targetGroupName={customNames[role]}
                    incidents={incidents.filter(i => i.targetGroup === role)}
                    messages={messages.filter(m => m.from === role || m.to === role)}
                    onClose={() => setActiveGroupForIncident(null)}
                    onSubmit={handleAddIncident}
                    onUpdateStatus={handleUpdateStatus}
                    onSendMessage={(txt) => handleSendMessage(txt, role)}
                />
            )}

            {showGeneralChat && (
                <GeneralChatModal 
                    currentUser={role}
                    messages={messages}
                    onClose={() => setShowGeneralChat(false)}
                    onSend={(txt) => handleSendMessage(txt, 'GERAL')}
                />
            )}

            {resolveIncidentId && (
                <ResolveModal 
                    onClose={() => setResolveIncidentId(null)}
                    onConfirm={handleResolveConfirm}
                    categories={categories}
                    onCategoryUpdate={(newCats) => {
                        db.saveStoredCategories(newCats);
                        setCategories(newCats);
                        if(isHost) broadcastSync();
                    }}
                />
            )}

            {showStats && (
                <StatsView 
                    incidents={myIncidents} // Use filtered list
                    customNames={customNames}
                    onClose={() => setShowStats(false)}
                    onExportPDF={() => handleExportPDF('STATS')}
                    categories={categories}
                />
            )}

            {showReportSelector && (
                <ReportSelectorModal 
                    customNames={customNames}
                    onClose={() => setShowReportSelector(false)}
                    onGenerate={handleGenerateReport}
                    currentUser={role}
                />
            )}
        </div>
      );
  }
};

export default App;