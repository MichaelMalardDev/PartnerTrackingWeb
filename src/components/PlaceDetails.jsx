import React from 'react';

const PlaceDetails = ({ place, onBack, onEdit, onDelete }) => {
    if (!place) return null;

    return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-left-4 duration-300">
            
            <button 
                onClick={onBack}
                className="self-start text-xs text-zinc-400 hover:text-white flex items-center gap-1 mb-4 transition-colors"
            >
                &larr; Retour au dashboard
            </button>

            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-2xl border border-blue-500/30">
                    📍
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white">{place.name}</h2>
                    <div className="text-[10px] text-zinc-500 font-mono">
                        {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                    </div>
                </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/5 mb-6">
                <div className="text-xs text-zinc-400 mb-2">Actions</div>
                <div className="flex flex-col gap-2">
                    <button 
                        onClick={() => onEdit(place)}
                        className="w-full py-2 px-3 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 font-medium text-sm transition-colors text-left flex items-center gap-2"
                    >
                        ✏️ Renommer ce lieu
                    </button>
                    <button 
                        onClick={() => onDelete(place.id)}
                        className="w-full py-2 px-3 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20 font-medium text-sm transition-colors text-left flex items-center gap-2"
                    >
                        🗑️ Supprimer définitivement
                    </button>
                </div>
            </div>

            <div className="mt-auto text-[10px] text-zinc-600 text-center">
                ID: {place.id}
            </div>
        </div>
    );
}

export default PlaceDetails;