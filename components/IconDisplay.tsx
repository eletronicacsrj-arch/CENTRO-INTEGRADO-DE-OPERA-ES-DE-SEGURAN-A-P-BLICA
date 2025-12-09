
import React, { useRef, useState } from 'react';

interface IconDisplayProps {
  id?: string; // Original ID (key)
  name: string; // Display Name
  imageSrc?: string;
  soundSrc?: string; // New: Audio Source (Base64)
  isEditable: boolean;
  onImageChange?: (id: string, base64: string) => void;
  onSoundChange?: (id: string, base64: string) => void;
  onRename?: (id: string, newName: string) => void;
  onClick: () => void;
  badgeCount?: number;
  triggerEditOnSingleClick?: boolean;
  onRearrangeMode?: () => void; // New callback for 3s hold
}

const IconDisplay: React.FC<IconDisplayProps> = ({ 
  id,
  name, 
  imageSrc, 
  soundSrc,
  isEditable, 
  onImageChange, 
  onSoundChange,
  onRename,
  onClick, 
  badgeCount,
  triggerEditOnSingleClick,
  onRearrangeMode
}) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const editTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [isPressing, setIsPressing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Use ID if available, otherwise name (legacy support or non-keyed items)
  const entityId = id || name;

  // Start the press action (Touch or Mouse)
  const handleStartPress = () => {
    setIsPressing(true);
    
    // Only start timers if editable
    if (isEditable) {
      
      // 1. Edit Timer (1 second)
      editTimerRef.current = setTimeout(() => {
        // If drag timer hasn't fired yet, show menu
        setShowMenu(true);
        setIsRenaming(false); 
      }, 1000); 

      // 2. Drag/Rearrange Timer (3 seconds)
      if (onRearrangeMode) {
          dragTimerRef.current = setTimeout(() => {
              // 3 seconds elapsed!
              // Cancel the edit menu if it's open
              setShowMenu(false);
              // Trigger Drag Mode in Parent
              onRearrangeMode();
              // Stop pressing visual state
              setIsPressing(false);
          }, 3000);
      }
    }
  };

  // End the press action (Release)
  const handleEndPress = (e: React.SyntheticEvent) => {
    // Clear all timers
    if (editTimerRef.current) {
      clearTimeout(editTimerRef.current);
      editTimerRef.current = null;
    }
    if (dragTimerRef.current) {
        clearTimeout(dragTimerRef.current);
        dragTimerRef.current = null;
    }

    // If we were pressing and menu didn't pop up (and drag didn't trigger), it's a click
    if (isPressing && !showMenu) {
      if (triggerEditOnSingleClick && isEditable) {
        setShowMenu(true);
        setIsRenaming(false);
      } else {
        onClick();
      }
    }
    
    setIsPressing(false);
  };

  // Cancel if mouse leaves or touch moves (scroll)
  const handleCancel = () => {
    if (editTimerRef.current) clearTimeout(editTimerRef.current);
    if (dragTimerRef.current) clearTimeout(dragTimerRef.current);
    editTimerRef.current = null;
    dragTimerRef.current = null;
    setIsPressing(false);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageChange) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageChange(entityId, reader.result as string);
        setShowMenu(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2048 * 1024) { // 2MB limit logic check
        alert("O arquivo de áudio é muito grande. Tente um arquivo menor.");
        // We continue anyway in this mock, but distinct handling is good
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (onSoundChange) {
          const base64 = reader.result as string;
          onSoundChange(entityId, base64);
          
          // Play immediately to confirm
          const audio = new Audio(base64);
          audio.play().catch(e => console.error("Erro ao reproduzir prévia", e));
          
          alert(`Som de notificação atualizado para ${name}!`);
        }
        setShowMenu(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePlayCurrentSound = () => {
      if (soundSrc) {
          const audio = new Audio(soundSrc);
          audio.play().catch(e => alert("Erro ao reproduzir áudio. Verifique o formato."));
      } else {
          alert("Nenhum som personalizado configurado.");
      }
  }

  const handleRenameClick = () => {
    if (onRename) {
        setRenameValue(name);
        setIsRenaming(true);
    }
  }

  const submitRename = () => {
      if (onRename && renameValue.trim()) {
          onRename(entityId, renameValue.trim());
          setShowMenu(false);
      }
  }

  return (
    <div className="relative h-full">
      {/* Hidden Inputs */}
      <input 
        type="file" 
        ref={imageInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleImageFileChange} 
      />
      <input 
        type="file" 
        ref={audioInputRef} 
        className="hidden" 
        accept="audio/*" 
        onChange={handleAudioFileChange} 
      />

      {/* Main Icon Button - Sizes Reduced Further */}
      <div 
        className={`relative flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 cursor-pointer select-none
          ${isPressing ? 'scale-95 bg-slate-700 ring-2 ring-blue-500' : 'bg-slate-800 hover:bg-slate-700'}
          active:bg-slate-700 shadow-lg border border-slate-700 h-full min-h-[45px]
          ${showMenu ? 'z-50 ring-2 ring-white blur-[1px]' : ''}
        `}
        onMouseDown={handleStartPress}
        onMouseUp={handleEndPress}
        onMouseLeave={handleCancel}
        onTouchStart={handleStartPress}
        onTouchEnd={handleEndPress}
        onTouchMove={handleCancel}
        onContextMenu={(e) => e.preventDefault()} // Prevent native context menu
      >
        {/* Reduced image container size: w-8 h-8 -> w-6 h-6 */}
        <div className="w-6 h-6 mb-0.5 rounded-full overflow-hidden bg-slate-900 flex items-center justify-center border border-slate-600 relative pointer-events-none">
          {imageSrc ? (
            <img src={imageSrc} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[8px] font-bold text-slate-400">{name.substring(0, 2)}</span>
          )}
        </div>

        {/* Reduced font size: text-[8px] -> text-[7px] */}
        <span className="text-[7px] font-bold text-center tracking-wider text-slate-200 leading-tight break-words w-full px-0.5 pointer-events-none">
          {name}
        </span>

        {badgeCount !== undefined && badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white shadow-md ring-1 ring-slate-900 animate-pulse pointer-events-none z-10">
            {badgeCount}
          </span>
        )}
      </div>

      {/* Customization Menu (Overlay) */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 border border-slate-500 rounded-lg shadow-2xl p-2 flex flex-col gap-2 min-w-[160px]">
            
            {isRenaming ? (
               <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-bold text-center text-white border-b border-slate-700 pb-1">Novo Nome</h3>
                    <input 
                        type="text" 
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="w-full bg-slate-800 text-white text-xs p-2 rounded border border-slate-600 focus:border-blue-500 outline-none"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && submitRename()}
                    />
                    <div className="flex gap-2 mt-1">
                        <button onClick={() => setIsRenaming(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] py-1.5 rounded">Voltar</button>
                        <button onClick={submitRename} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] py-1.5 rounded font-bold">Salvar</button>
                    </div>
               </div>
            ) : (
                <>
                    <h3 className="text-xs font-bold text-center text-white border-b border-slate-700 pb-1 mb-1">Editar {name}</h3>
                    
                    {onRename && (
                        <button 
                        onClick={handleRenameClick}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs text-white transition-colors"
                    >
                        <span>✏️</span> Renomear
                    </button>
                    )}

                    {onImageChange && (
                    <button 
                        onClick={() => imageInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs text-white transition-colors"
                    >
                        <span>🖼️</span> Mudar Imagem
                    </button>
                    )}

                    {onSoundChange && (
                    <button 
                        onClick={() => audioInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs text-white transition-colors"
                    >
                        <span>🔊</span> Mudar Som
                    </button>
                    )}

                    {soundSrc && (
                        <button 
                            onClick={handlePlayCurrentSound}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-900/40 hover:bg-blue-900/60 rounded text-xs text-blue-200 transition-colors border border-blue-900/50"
                        >
                            <span>🎵</span> Ouvir Som Atual
                        </button>
                    )}

                    <button 
                    onClick={() => setShowMenu(false)}
                    className="mt-1 px-3 py-1 bg-red-900/50 hover:bg-red-900/70 rounded text-xs text-red-200 transition-colors"
                    >
                    Cancelar
                    </button>
                </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default IconDisplay;
