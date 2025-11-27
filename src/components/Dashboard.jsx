import { useEffect, useState } from "react";
// Import des icônes
import { 
    LuBattery, LuBatteryWarning, LuGauge, 
    LuMapPin, LuArrowUpDown, LuCalendarClock, LuSignal, LuSignalLow , LuArrowRight
} from "react-icons/lu";
import { FaCarSide } from "react-icons/fa6";

const Dashboard = ({ status, battery, speed, places, lastUpdate, onSelectPlace }) => {
    const [sortBy, setSortBy] = useState('name');
    const [timeAgo, setTimeAgo] = useState('À l\'instant');
    const [isOnline, setIsOnline] = useState(true);

    // --- LOGIQUE DE TEMPS (S'exécute chaque minute) ---
    useEffect(() => {
        const checkStatus = () => {
            if (!lastUpdate) return;

            const now = Date.now();
            const diffSeconds = Math.floor((now - lastUpdate) / 1000);

            // 1. Calcul du texte "Il y a X temps"
            if (diffSeconds < 60) setTimeAgo("À l'instant");
            else if (diffSeconds < 3600) setTimeAgo(`Il y a ${Math.floor(diffSeconds / 60)} min`);
            else setTimeAgo(`Il y a ${Math.floor(diffSeconds / 3600)} h`);

            // 2. Décision Online/Offline (Si > 2 minutes sans nouvelles = Offline)
            setIsOnline(diffSeconds < 120);
        };

        // On lance le calcul tout de suite
        checkStatus();

        // Et on le relance toutes les 30 secondes pour mettre à jour le texte
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, [lastUpdate]); // Se relance si une nouvelle donnée arrive

    // --- LOGIQUE DE TRI ---
    const sortedPlaces = [...places].sort((a, b) => {
        if (sortBy === 'name') {
            return a.name.localeCompare(b.name);
        } else {
            return (b.createdAt || 0) - (a.createdAt || 0);
        }
    });

    return (
        <>
            {/* EN-TÊTE AVEC ICÔNE VOITURE */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-zinc-400">
                    <FaCarSide className="text-xl" />
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Partner Tracker</span>
                </div>
                {/* INDICATEUR ONLINE/OFFLINE */}
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase ${isOnline ? 'text-green-500' : 'text-zinc-600'}`}>
                        {isOnline ? 'LIVE' : 'HORS LIGNE'}
                    </span>
                    <div className="flex h-2 w-2 relative">
                        {isOnline ? (
                            <>
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </>
                        ) : (
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-600"></span>
                        )}
                    </div>
                </div>
            </div>

            {/* LE GROS TITRE (STATUT) */}
            <h1 className={`text-3xl font-black leading-none tracking-tight mb-8 transition-colors ${isOnline ? 'text-white' : 'text-zinc-500'}`}>
                {status}
            </h1>

            {/* GRILLE DES STATS (BATTERIE & VITESSE) */}
            <div className="grid grid-cols-2 gap-4 mb-8">

                {/* CARTE BATTERIE */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col justify-center relative overflow-hidden group hover:bg-white/10 transition-colors">
                    <div className="absolute top-2 right-2 text-zinc-600 group-hover:text-zinc-500 transition-colors">
                        {battery < 20 ? <LuBatteryWarning size={18} /> : <LuBattery size={18} />}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-bold mb-1 uppercase tracking-wider">Batterie</span>
                    <span className={`text-2xl font-mono font-bold ${battery < 20 ? 'text-red-500' : 'text-emerald-400'}`}>
                        {battery !== null ? `${battery}%` : '--'}
                    </span>
                </div>

                {/* CARTE VITESSE */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col justify-center relative overflow-hidden group hover:bg-white/10 transition-colors">
                    <div className="absolute top-2 right-2 text-zinc-600 group-hover:text-zinc-500 transition-colors">
                        <LuGauge size={18} />
                    </div>
                    <span className="text-[10px] text-zinc-400 font-bold mb-1 uppercase tracking-wider">Vitesse</span>
                    <span className={`text-2xl font-mono font-bold ${isOnline ? 'text-white' : 'text-zinc-400'}`}>
                        {speed} <span className="text-sm text-zinc-500 font-normal">km/h</span>
                    </span>
                </div>
            </div>

            {/* LISTE DES LIEUX */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-end mb-3 px-1">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-2">
                        <LuMapPin /> Lieux ({places.length})
                    </div>

                    {/* BOUTON DE TRI AMÉLIORÉ */}
                    <button
                        onClick={() => setSortBy(sortBy === 'date' ? 'name' : 'date')}
                        className="text-[10px] bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white px-2 py-1.5 rounded-md border border-white/5 transition-all flex items-center gap-1.5"
                    >
                        {sortBy === 'name' ? <LuArrowUpDown size={12} /> : <LuCalendarClock size={12} />}
                        {sortBy === 'name' ? 'A-Z' : 'Récent'}
                    </button>
                </div>

                <div className="space-y-1 -mr-2">
                    {sortedPlaces.length === 0 && (
                        <div className="text-center py-8 text-zinc-600 text-xs border-2 border-dashed border-zinc-800 rounded-lg">
                            Aucun lieu enregistré
                        </div>
                    )}

                    {sortedPlaces.map((place, index) => (
                        <div
                            key={place.id}
                            onClick={() => onSelectPlace(place)}
                            className={`group flex items-center justify-between p-3 bg-zinc-800/40 hover:bg-white/5 border border-white/5 hover:border-white/10 cursor-pointer transition-all duration-200 ${index === 0 ? 'rounded-t-xl' : ''} ${index === sortedPlaces.length - 1 ? 'rounded-b-xl' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                {/* Petite icône ronde pour chaque lieu */}
                                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all">
                                    <LuMapPin size={14} />
                                </div>
                                <span className="text-sm font-medium text-zinc-300 group-hover:text-white truncate max-w-[130px]">
                                    {place.name}
                                </span>
                            </div>
                            <LuArrowRight className="text-zinc-600 group-hover:text-zinc-400 transition-transform group-hover:translate-x-1" size={14} />
                        </div>
                    ))}
                </div>
            </div>

            <div className="text-right mt-4 border-t border-white/5 pt-3 flex justify-between items-center">
                {/* Icône de signal */}
                <div className={` ${isOnline ? 'text-green-500' : 'text-zinc-600'}`} title={isOnline ? "Signal fort" : "Signal perdu"}>
                    <LuSignal size={14}  />
                </div>
                <span className="text-[10px] text-zinc-500 italic font-mono">
                    {timeAgo}
                </span>
            </div>
        </>
    );
}

export default Dashboard;