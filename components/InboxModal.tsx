import React, { useState } from 'react';
import { Message } from '../types';

interface InboxModalProps {
  messages: Message[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onReply: (toGroup: string, text: string) => void;
}

const InboxModal: React.FC<InboxModalProps> = ({ messages, onClose, onDelete, onReply }) => {
  // Only show messages TO CIOSP
  const inboxMessages = messages.filter(m => !m.to || m.to === 'CIOSP').sort((a,b) => b.createdAt - a.createdAt);
  
  const [replyText, setReplyText] = useState<Record<string, string>>({}); // keyed by msg id
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);

  const handleSendReply = (msg: Message) => {
    const text = replyText[msg.id];
    if (text && text.trim()) {
      onReply(msg.from, text);
      setReplyText({ ...replyText, [msg.id]: '' });
      setActiveReplyId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl p-0 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">📨</span> Caixa de Entrada CIOSP
          </h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {inboxMessages.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>Nenhuma mensagem recebida.</p>
            </div>
          ) : (
            inboxMessages.map((msg) => (
              <div key={msg.id} className="bg-slate-800 border border-slate-700 p-4 rounded-lg relative hover:border-blue-500/30 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded text-sm border border-blue-900/50">
                        {msg.from}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-slate-200 text-sm whitespace-pre-wrap mb-3">{msg.content}</p>
                
                {/* Reply Section */}
                {activeReplyId === msg.id ? (
                    <div className="mt-2 flex gap-2 animate-in fade-in slide-in-from-top-2">
                        <input 
                            type="text" 
                            className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none"
                            placeholder={`Responder para ${msg.from}...`}
                            value={replyText[msg.id] || ''}
                            onChange={(e) => setReplyText({...replyText, [msg.id]: e.target.value})}
                            autoFocus
                        />
                        <button 
                            onClick={() => handleSendReply(msg)}
                            className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs font-bold"
                        >
                            Enviar
                        </button>
                        <button 
                            onClick={() => setActiveReplyId(null)}
                            className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs"
                        >
                            ✕
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-4 border-t border-slate-700/50 pt-2 mt-2">
                         <button 
                            onClick={() => setActiveReplyId(msg.id)}
                            className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                        >
                            ↩ Responder
                        </button>
                        <button 
                            onClick={() => onDelete(msg.id)}
                            className="text-xs text-red-400 hover:text-red-300 hover:underline"
                        >
                            Excluir
                        </button>
                    </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default InboxModal;