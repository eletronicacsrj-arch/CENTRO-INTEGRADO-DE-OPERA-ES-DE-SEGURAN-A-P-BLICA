import React, { useState, useEffect, useRef } from 'react';
import { Message } from '../types';

interface MessageModalProps {
  senderName: string;
  messages: Message[]; // Full history
  onClose: () => void;
  onSend: (text: string) => void;
}

const MessageModal: React.FC<MessageModalProps> = ({ senderName, messages, onClose, onSend }) => {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter messages relevant to this conversation (Me <-> CIOSP)
  const conversation = messages.filter(m => 
    (m.from === senderName && (!m.to || m.to === 'CIOSP')) || 
    (m.from === 'CIOSP' && m.to === senderName)
  ).sort((a, b) => a.createdAt - b.createdAt);

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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md shadow-2xl flex flex-col h-[600px] max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>💬</span> Chat com CIOSP
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/50 custom-scrollbar">
          {conversation.length === 0 ? (
            <div className="text-center text-slate-600 text-sm mt-10">
              Nenhuma mensagem.<br/>Inicie a conversa com a Central.
            </div>
          ) : (
            conversation.map((msg) => {
              const isMe = msg.from === senderName;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`
                    max-w-[80%] rounded-lg p-3 text-sm relative
                    ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-700 text-slate-200 rounded-tl-none'}
                  `}>
                    <p className="font-bold text-[10px] opacity-70 mb-1">{isMe ? 'Eu' : 'CIOSP'}</p>
                    <p>{msg.content}</p>
                    <span className="text-[9px] opacity-50 block text-right mt-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Input Area */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800 bg-slate-900">
          <div className="flex gap-2">
            <input
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:ring-1 focus:ring-blue-500 outline-none text-sm"
              placeholder="Digite sua mensagem..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-white font-bold transition-colors text-sm"
            >
              Enviar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MessageModal;