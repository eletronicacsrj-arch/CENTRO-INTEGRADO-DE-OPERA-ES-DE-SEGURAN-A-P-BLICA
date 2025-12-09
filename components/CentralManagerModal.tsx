
import React, { useState, useEffect } from 'react';
import { Central } from '../types';
import * as db from '../services/db';

interface CentralManagerModalProps {
    onClose: () => void;
}

const CentralManagerModal: React.FC<CentralManagerModalProps> = ({ onClose }) => {
    const [centrals, setCentrals] = useState<Central[]>([]);
    const [tab, setTab] = useState<'LOGIN' | 'CREATE'>('LOGIN');
    
    // Login State
    const [selectedCentralId, setSelectedCentralId] = useState<string>('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    // Create State
    const [newName, setNewName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [createError, setCreateError] = useState('');

    useEffect(() => {
        setCentrals(db.getAvailableCentrals());
        // Select current one by default
        const active = db.getActiveCentralInfo();
        setSelectedCentralId(active.id);
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');

        const target = centrals.find(c => c.id === selectedCentralId);
        if (!target) return;

        // Check password if exists
        if (target.password && target.password !== loginPassword) {
            setLoginError('Senha incorreta.');
            return;
        }

        db.setActiveCentral(target.id);
        onClose();
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError('');

        if (!newName.trim()) {
            setCreateError('Nome é obrigatório.');
            return;
        }

        const success = db.createCentral(newName, newPassword);
        if (success) {
            alert('Central criada com sucesso!');
            setCentrals(db.getAvailableCentrals());
            setTab('LOGIN');
            setNewName('');
            setNewPassword('');
        } else {
            setCreateError('Já existe uma central com este nome.');
        }
    };

    const handleDelete = (id: string) => {
        if (id === 'DEFAULT') return;
        const conf = prompt(`Para excluir esta central e TODOS os dados dela, digite "DELETAR"`);
        if (conf === 'DELETAR') {
            db.deleteCentral(id);
            setCentrals(db.getAvailableCentrals());
            if (selectedCentralId === id) setSelectedCentralId('DEFAULT');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span>🏢</span> Gerenciar Centrais
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800">
                    <button 
                        onClick={() => setTab('LOGIN')}
                        className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${tab === 'LOGIN' ? 'border-blue-500 text-blue-400 bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        Acessar Central
                    </button>
                    <button 
                        onClick={() => setTab('CREATE')}
                        className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${tab === 'CREATE' ? 'border-green-500 text-green-400 bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        Nova Base
                    </button>
                </div>

                <div className="p-6">
                    {tab === 'LOGIN' && (
                        <form onSubmit={handleLogin} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-400 uppercase">Selecione a Base</label>
                                <select 
                                    className="bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500"
                                    value={selectedCentralId}
                                    onChange={(e) => {
                                        setSelectedCentralId(e.target.value);
                                        setLoginPassword('');
                                        setLoginError('');
                                    }}
                                >
                                    {centrals.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Show Password Input only if selected central has password */}
                            {centrals.find(c => c.id === selectedCentralId)?.password && (
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Senha de Acesso</label>
                                    <input 
                                        type="password"
                                        className="bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500"
                                        placeholder="Digite a senha..."
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                    />
                                </div>
                            )}

                            {loginError && <p className="text-red-400 text-xs font-bold text-center">{loginError}</p>}

                            <button className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded mt-2 shadow-lg transition-transform active:scale-95">
                                ENTRAR NA CENTRAL
                            </button>

                            {selectedCentralId !== 'DEFAULT' && (
                                <button 
                                    type="button"
                                    onClick={() => handleDelete(selectedCentralId)}
                                    className="text-red-500 text-xs hover:underline mt-2 text-center"
                                >
                                    Excluir esta central permanentemente
                                </button>
                            )}
                        </form>
                    )}

                    {tab === 'CREATE' && (
                         <form onSubmit={handleCreate} className="flex flex-col gap-4">
                             <div className="p-3 bg-green-900/20 border border-green-900/50 rounded mb-2">
                                 <p className="text-xs text-green-200">
                                     Crie uma nova base avançada. Os dados (ocorrências, configurações, ícones) serão totalmente isolados.
                                 </p>
                             </div>

                             <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-400 uppercase">Nome da Central</label>
                                <input 
                                    type="text"
                                    className="bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-green-500"
                                    placeholder="Ex: BASE NORTE"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-400 uppercase">Senha (Opcional)</label>
                                <input 
                                    type="password"
                                    className="bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-green-500"
                                    placeholder="Proteger acesso..."
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>

                            {createError && <p className="text-red-400 text-xs font-bold text-center">{createError}</p>}

                            <button className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded mt-2 shadow-lg transition-transform active:scale-95">
                                CRIAR BASE
                            </button>
                         </form>
                    )}
                </div>

            </div>
        </div>
    );
};

export default CentralManagerModal;
