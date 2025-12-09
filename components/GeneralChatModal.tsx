
import React, { useState, useEffect, useRef } from 'react';
import { Message } from '../types';

interface GeneralChatModalProps {
  currentUser: string;
  messages: Message[];
  onClose: () => void;
  onSend: (text: string) => void;
}

const GeneralChatModal: React.FC<GeneralChatModalProps> = ({ currentUser, messages, onClose, onSend }) => {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter messages for 'GERAL' channel
  const conversation = messages
    .filter(m => m.to === 'GERAL')
    .sort((a, b) => a.createdAt - b.createdAt);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="fixed inset-0 bg-purple-900/90 flex items-center justify-center z-50 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-purple-500 rounded-lg w-full max-w-2xl shadow-2xl flex flex-col h-[600px] max-h-[90vh] relative overflow-hidden">
        
        {/* Decorative Background Element */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 animate-pulse"></div>

        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-wider">
              <span className="text-2xl">📢</span> REUNIR GERAL
            </h2>
            <p className="text-[10px] text-purple-300 font-bold">CANAL DE COMUNICAÇÃO GLOBAL - TODAS AS UNIDADES</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center font-bold">✕</button>
        </div>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/80 custom-scrollbar">
          {conversation.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
              <span className="text-4xl mb-2">📣</span>
              <p className="text-sm font-bold">Inicie a reunião geral.</p>
              <p className="text-xs">Todas as unidades conectadas verão as mensagens aqui.</p>
            </div>
          ) : (
            conversation.map((msg) => {
              const isMe = msg.from === currentUser;
              const isCiosp = msg.from === 'CIOSP';
              
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                    
                    {/* Sender Name */}
                    <span className={`text-[10px] font-black uppercase mb-0.5 px-1 ${
                        isMe ? 'text-purple-400' : 
                        isCiosp ? 'text-blue-400' : 'text-slate-400'
                    }`}>
                      {msg.from}
                    </span>

                    {/* Bubble */}
                    <div className={`
                      rounded-lg p-3 text-sm shadow-md border
                      ${isMe 
                        ? 'bg-purple-600 text-white border-purple-500 rounded-tr-none' 
                        : isCiosp 
                            ? 'bg-blue-900 text-white border-blue-700 rounded-tl-none'
                            : 'bg-slate-800 text-slate-200 border-slate-700 rounded-tl-none'
                        }
                    `}>
                      <p>{msg.content}</p>
                    </div>

                    {/* Time */}
                    <span className="text-[9px] opacity-40 mt-1 px-1 font-mono">
                      {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Input Area */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-slate-700 bg-slate-800">
          <div className="flex gap-2">
            <input
              className="flex-1 bg-slate-900 border border-slate-600 rounded px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium placeholder-slate-500"
              placeholder="Enviar mensagem para TODOS..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded text-white font-bold transition-colors text-sm uppercase tracking-wide shadow-lg"
            >
              ENVIAR
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GeneralChatModal;
