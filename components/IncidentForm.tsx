import React, { useState, useEffect, useRef } from 'react';
import { GroupName, Incident, IncidentStatus, Message } from '../types';

interface GroupControlModalProps {
  targetGroup: GroupName;
  targetGroupName?: string; // Display Name (Custom)
  incidents: Incident[]; // Active incidents for this group
  messages: Message[];   // Conversation history
  onClose: () => void;
  onSubmit: (data: { description: string; detailedDescription: string; location: string; category: string }) => void;
  onUpdateStatus: (id: string, status: IncidentStatus) => void;
  onSendMessage: (text: string) => void;
}

// IBGE City Interface
interface IBGECity {
  id: number;
  nome: string;
}

// Nominatim Address Interface
interface AddressSuggestion {
  display_name: string;
  road?: string;
  suburb?: string;
}

const IncidentForm: React.FC<GroupControlModalProps> = ({ 
  targetGroup, 
  targetGroupName,
  incidents, 
  messages,
  onClose, 
  onSubmit, 
  onUpdateStatus,
  onSendMessage
}) => {
  // Determine initial tab: if there are incidents, show list. Else show New form.
  const [activeTab, setActiveTab] = useState<'LIST' | 'NEW' | 'CHAT'>(
    incidents.length > 0 ? 'LIST' : 'NEW'
  );

  const displayName = targetGroupName || targetGroup;

  // Form State
  const [description, setDescription] = useState('');
  // Default origin logic: If User is CIOSP, default is 'VIA CIOSP'. If Unit, default is 'VIA PRÓ-ATIVA'.
  const [origin, setOrigin] = useState<string>('VIA PRÓ-ATIVA'); 
  
  // Location Logic
  const [uf, setUf] = useState('RJ'); // Default to RJ
  const [cities, setCities] = useState<IBGECity[]>([]);
  const [selectedCity, setSelectedCity] = useState('Arraial do Cabo'); // Default
  const [streetAddress, setStreetAddress] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chat State
  const [chatText, setChatText] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Cities when UF changes
  useEffect(() => {
    if (uf) {
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
        .then(res => res.json())
        .then(data => {
            setCities(data);
            // If current selected city is not in new list, reset it
            if (!data.find((c: IBGECity) => c.nome === selectedCity)) {
                setSelectedCity(data[0]?.nome || '');
            }
        })
        .catch(err => console.error("Erro ao buscar cidades", err));
    }
  }, [uf]);

  // 2. Search Address Logic (Debounced)
  useEffect(() => {
    if (streetAddress.length < 3) {
        setSuggestions([]);
        return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
        const query = encodeURIComponent(streetAddress);
        const cityFilter = encodeURIComponent(selectedCity);
        const stateFilter = encodeURIComponent(uf);
        
        // Using OpenStreetMap (Nominatim)
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&city=${cityFilter}&state=${stateFilter}&addressdetails=1&limit=5`)
            .then(res => res.json())
            .then(data => {
                setSuggestions(data);
                setShowSuggestions(true);
            })
            .catch(err => console.error("Erro busca endereço", err));
    }, 500); // 500ms delay

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); }
  }, [streetAddress, selectedCity, uf]);


  useEffect(() => {
    if (activeTab === 'CHAT' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activeTab, messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    
    // Construct Full Location String
    const fullLocation = streetAddress 
        ? `${streetAddress}, ${selectedCity} - ${uf}`
        : `${selectedCity} - ${uf}`;

    onSubmit({ 
        description, 
        detailedDescription: "", 
        location: fullLocation,
        category: origin // Pass selected origin explicitly
    });
    
    setDescription('');
    setStreetAddress('');
    setSuggestions([]);
    setActiveTab('LIST');
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    onSendMessage(chatText);
    setChatText('');
  };

  const selectSuggestion = (item: any) => {
      // Try to extract just the road name if available, otherwise use full name
      const road = item.address?.road || item.display_name.split(',')[0];
      setStreetAddress(road);
      setShowSuggestions(false);
  }

  // Filter Chat for this group <-> CIOSP
  const conversation = messages.filter(m => 
    (m.from === 'CIOSP' && m.to === targetGroup) || 
    (m.from === targetGroup && m.to === 'CIOSP')
  ).sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center rounded-t-xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-blue-400">{displayName}</span>
            <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">Central de Comando</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button 
            onClick={() => setActiveTab('LIST')}
            className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'LIST' ? 'border-blue-500 text-blue-400 bg-slate-800/30' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            📋 Ocorrências ({incidents.length})
          </button>
          <button 
            onClick={() => setActiveTab('NEW')}
            className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'NEW' ? 'border-blue-500 text-blue-400 bg-slate-800/30' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            ➕ Nova
          </button>
          <button 
            onClick={() => setActiveTab('CHAT')}
            className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'CHAT' ? 'border-blue-500 text-blue-400 bg-slate-800/30' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            💬 Chat
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-950/30">
          
          {/* TAB: LIST */}
          {activeTab === 'LIST' && (
            <div className="space-y-3">
              {incidents.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <p className="mb-2">Nenhuma ocorrência ativa.</p>
                  <button onClick={() => setActiveTab('NEW')} className="text-blue-400 hover:underline text-sm">Criar nova ocorrência</button>
                </div>
              ) : (
                incidents.slice().reverse().map(incident => (
                  <div key={incident.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3 relative">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            incident.status === IncidentStatus.PENDING ? 'bg-yellow-500/20 text-yellow-500' :
                            incident.status === IncidentStatus.ACKNOWLEDGED ? 'bg-blue-500/20 text-blue-500' :
                            'bg-red-500/20 text-red-500'
                          }`}>
                            {incident.status}
                          </span>
                          <span className="text-[10px] font-bold bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                             {incident.category}
                          </span>
                      </div>
                      <span className="text-[10px] text-slate-500">{new Date(incident.createdAt).toLocaleTimeString()}</span>
                    </div>
                    
                    {/* Location Display */}
                    {incident.location && (
                      <div className="flex items-start gap-1 mb-1 text-xs text-yellow-500 font-bold">
                        <span>📍</span>
                        <span>{incident.location}</span>
                      </div>
                    )}
                    
                    <p className="text-white text-sm mb-3 font-medium">{incident.description}</p>
                    
                    <div className="flex justify-end gap-2 border-t border-slate-700/50 pt-2">
                       {incident.status !== IncidentStatus.RESOLVED && incident.status !== IncidentStatus.CANCELLED && (
                          <button 
                            onClick={() => onUpdateStatus(incident.id, IncidentStatus.CANCELLED)}
                            className="text-xs text-red-400 hover:bg-red-900/30 px-2 py-1 rounded transition-colors"
                          >
                            Cancelar Ocorrência
                          </button>
                       )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: NEW */}
          {activeTab === 'NEW' && (
            <form onSubmit={handleSubmit} className="flex flex-col h-full gap-4 relative">
              <p className="text-sm font-medium text-slate-400">
                Nova ocorrência para <span className="text-white font-bold">{displayName}</span>
              </p>

              {/* LOCATION BLOCK */}
              <div className="flex flex-col gap-2 p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
                  <div className="flex gap-2">
                      <div className="flex flex-col gap-1 w-1/4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Estado</label>
                        <select 
                            value={uf} 
                            onChange={(e) => setUf(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-xs outline-none focus:border-blue-500"
                        >
                            {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u => (
                                <option key={u} value={u}>{u}</option>
                            ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1 w-3/4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Município</label>
                        <select 
                            value={selectedCity} 
                            onChange={(e) => setSelectedCity(e.target.value)}
                            disabled={cities.length === 0}
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-xs outline-none focus:border-blue-500 disabled:opacity-50"
                        >
                            {cities.map(c => (
                                <option key={c.id} value={c.nome}>{c.nome}</option>
                            ))}
                        </select>
                      </div>
                  </div>

                  <div className="flex flex-col gap-1 relative">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Endereço / Rua</label>
                    <input
                        type="text"
                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none placeholder-slate-600"
                        placeholder="Digite o nome da rua..."
                        value={streetAddress}
                        onChange={(e) => setStreetAddress(e.target.value)}
                        onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    />
                    {/* Autocomplete Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <ul className="absolute top-full left-0 right-0 bg-slate-800 border border-slate-600 rounded-b-lg shadow-xl z-50 max-h-40 overflow-y-auto">
                            {suggestions.map((item, idx) => (
                                <li 
                                    key={idx}
                                    onClick={() => selectSuggestion(item)} 
                                    className="p-2 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0"
                                >
                                    {item.display_name}
                                </li>
                            ))}
                        </ul>
                    )}
                  </div>
              </div>

              {/* DESCRIPTION INPUT */}
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Descrição da Ocorrência</label>
                <textarea
                    className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none placeholder-slate-500"
                    placeholder="Descreva o que está acontecendo..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* ORIGIN SELECTION */}
              <div className="flex flex-col gap-2 p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">Origem da Ocorrência</label>
                   <div className="grid grid-cols-2 gap-2">
                       <button
                          type="button"
                          onClick={() => setOrigin('VIA PRÓ-ATIVA')}
                          className={`py-2 text-xs font-bold rounded border ${origin === 'VIA PRÓ-ATIVA' ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                       >
                           VIA PRÓ-ATIVA
                       </button>
                       <button
                          type="button"
                          onClick={() => setOrigin('VIA CIOSP')}
                          className={`py-2 text-xs font-bold rounded border ${origin === 'VIA CIOSP' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                       >
                           VIA CIOSP
                       </button>
                   </div>
                   {origin === 'VIA PRÓ-ATIVA' ? (
                       <span className="text-[9px] text-green-400/70">Ocorrência gerada pela própria viatura ou solicitação direta.</span>
                   ) : (
                       <span className="text-[9px] text-blue-400/70">Ocorrência repassada pela Central ou rádio.</span>
                   )}
              </div>

              <button
                type="submit"
                disabled={!description.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-colors shadow-lg mt-2"
              >
                ENVIAR OCORRÊNCIA
              </button>
            </form>
          )}

          {/* TAB: CHAT */}
          {activeTab === 'CHAT' && (
            <div className="flex flex-col h-full">
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
                {conversation.length === 0 ? (
                  <div className="text-center text-slate-600 text-xs mt-4">Inicie a conversa...</div>
                ) : (
                  conversation.map(msg => {
                    const isMe = msg.from === 'CIOSP';
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-lg p-2 text-xs ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-700 text-slate-200 rounded-tl-none'}`}>
                          <p>{msg.content}</p>
                          <span className="text-[9px] opacity-60 block text-right mt-1">
                             {new Date(msg.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                  placeholder="Mensagem..."
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                />
                <button 
                  type="submit"
                  disabled={!chatText.trim()}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded text-sm font-bold disabled:opacity-50"
                >
                  Enviar
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default IncidentForm;