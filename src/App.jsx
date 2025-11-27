import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { doc, onSnapshot, collection, addDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from './lib/firebase';
import { db } from './lib/firebase';
import { LuPlus, LuX, LuLogOut } from "react-icons/lu";

// Composants
import Dashboard from './components/Dashboard';
import PlaceDetails from './components/PlaceDetails';
import Login from './components/Login';

import 'mapbox-gl/dist/mapbox-gl.css';
import './App.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const App = () => {
  // --- ETATS ---
  const [status, setStatus] = useState("Connexion...");
  const [battery, setBattery] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [lastUpdate, setLastUpdate] = useState("");
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [places, setPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);

  // États d'authentification
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // États pour le "Bottom Sheet" (Mobile)
  const [sheetMode, setSheetMode] = useState('default');
  const touchStart = useRef(null);
  const touchEnd = useRef(null);

  // Refs
  const isAddingRef = useRef(false);
  const mapContainer = useRef(null);
  const map = useRef(null);
  const carMarker = useRef(null);
  const markersRef = useRef({});

  useEffect(() => { isAddingRef.current = isAddingMode; }, [isAddingMode]);

  // --- AUTHENTIFICATION ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // --- ACTION: BASCULER MODE AJOUT ---
  const toggleAddingMode = () => {
    const nextState = !isAddingMode;
    setIsAddingMode(nextState);

    if (nextState) {
      // On réduit le panneau au minimum pour dégager la vue sur la carte
      setSheetMode('min');
    } else {
      // Si on annule, on remet le panneau en taille normale pour voir la liste
      if (sheetMode === 'min') setSheetMode('default');
    }
  };

  // --- HELPER: CALCUL DU CENTRAGE INTELLIGENT ---
  const getSmartOffset = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (width < 768) {
      // MOBILE
      if (sheetMode === 'min') return [0, -height * 0.05];
      return [0, -height * 0.2];
    } else {
      // DESKTOP
      return [160, 0];
    }
  };

  // --- GESTION DU SWIPE (Mobile) ---
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientY;
  }

  const onTouchMove = (e) => {
    touchEnd.current = e.targetTouches[0].clientY;
  }

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    const isUpSwipe = distance > minSwipeDistance;
    const isDownSwipe = distance < -minSwipeDistance;

    if (isUpSwipe) {
      if (sheetMode === 'min') setSheetMode('default');
      else if (sheetMode === 'default') setSheetMode('full');
    }
    if (isDownSwipe) {
      if (sheetMode === 'full') setSheetMode('default');
      else if (sheetMode === 'default') setSheetMode('min');
    }
  }

  const getMobileHeightClass = () => {
    switch (sheetMode) {
      case 'full': return 'h-[89vh]';
      case 'min': return 'h-[18vh]';
      default: return 'h-[45vh]';
    }
  }

  // --- HANDLERS ---
  const handleSelectPlace = (place) => {
    setSelectedPlace(place);
    setIsAddingMode(false);
    setSheetMode('default');

    if (!map.current) return;

    const currentZoom = map.current.getZoom();
    const targetZoom = currentZoom > 14 ? currentZoom : 14;

    map.current.flyTo({
      center: [place.longitude, place.latitude],
      zoom: targetZoom,
      offset: getSmartOffset(),
      speed: 0.8,
      curve: 1.42,
      essential: true
    });
  };

  const handleDeletePlace = async (id) => {
    if (confirm("Supprimer ce lieu ?")) {
      await deleteDoc(doc(db, "places", id));
      setSelectedPlace(null);
    }
  };

  const handleEditPlace = async (place) => {
    const newName = prompt("Nouveau nom :", place.name);
    if (newName && newName !== place.name) {
      await updateDoc(doc(db, "places", place.id), { name: newName });
    }
  };

  // --- LOGIQUE CARTE ---
  useEffect(() => {
    if (!user || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-73.5673, 45.5017],
      zoom: 12,
      pitch: 45,
      attributionControl: false
    });

    const el = document.createElement('div');
    el.style.backgroundImage = 'url(https://cdn-icons-png.flaticon.com/512/3097/3097180.png)';
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.backgroundSize = 'cover';
    carMarker.current = new mapboxgl.Marker(el)
      .setLngLat([-73.5673, 45.5017])
      .addTo(map.current);

    map.current.on('click', async (e) => {
      if (!isAddingRef.current) return;
      const { lng, lat } = e.lngLat;
      const placeName = window.prompt("Nom de ce lieu ?");
      if (placeName) {
        try {
          await addDoc(collection(db, "places"), {
            name: placeName, latitude: lat, longitude: lng, createdAt: Date.now()
          });
          toggleAddingMode(); // On quitte le mode ajout après succès
        } catch (error) { console.error(error); }
      }
    });
  }, [user]);

  // --- LOGIQUE DONNÉES (Firebase) ---
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(collection(db, "places"), (snapshot) => {
      const placesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPlaces(placesList);

      if (!map.current) return;

      Object.keys(markersRef.current).forEach((id) => {
        if (!placesList.find(p => p.id === id)) {
          markersRef.current[id].remove();
          delete markersRef.current[id];
        }
      });

      placesList.forEach((place) => {
        if (!markersRef.current[place.id]) {
          const el = document.createElement('div');
          el.innerHTML = `<div class="text-2xl cursor-pointer hover:scale-125 transition-transform">📍</div>`;
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            handleSelectPlace(place);
          });
          const marker = new mapboxgl.Marker(el)
            .setLngLat([place.longitude, place.latitude])
            .addTo(map.current);
          markersRef.current[place.id] = marker;
        } else {
          markersRef.current[place.id].setLngLat([place.longitude, place.latitude]);
        }
      });
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, "users", "partner_01"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status) setStatus(data.status);
        if (data.deviceStatus) setBattery(Math.round(data.deviceStatus.batteryLevel * 100));
        if (data.location?.speed) setSpeed(Math.round(data.location.speed));
        setLastUpdate(data.lastUpdated || Date.now());

        if (data.location && map.current && carMarker.current) {
          const { longitude, latitude } = data.location;
          carMarker.current.setLngLat([longitude, latitude]);

          if (!selectedPlace) {
            map.current.flyTo({
              center: [longitude, latitude],
              zoom: 14,
              offset: getSmartOffset(),
              speed: 0.8
            });
          }
        }
      }
    });
    return () => unsubscribe();
  }, [selectedPlace, user, sheetMode]);


  if (isLoadingAuth) {
    return <div className="h-screen w-screen bg-black flex items-center justify-center text-zinc-500 font-mono animate-pulse">Chargement...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans">

      {/* PANEL WRAPPER */}
      <div className='absolute z-10 flex flex-col gap-0.5 transition-all duration-300 ease-in-out
                      w-[calc(100%-2rem)] left-4 bottom-6 
                      md:w-80 md:top-5 md:left-5 md:bottom-auto md:right-auto'>

        {!selectedPlace && (
          <div className={`bg-zinc-900/90 backdrop-blur-xl border-x border-t border-white/10 rounded-t-2xl p-4 flex justify-between items-center
                           ${sheetMode === 'full' ? 'hidden md:flex' : 'flex'}`}>
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] flex-shrink-0"></div>
              <span className="text-[10px] text-zinc-400 font-mono truncate">{user.email}</span>
            </div>
            <button
              onClick={() => signOut(auth)}
              className="text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider flex-shrink-0"
            >
              <LuLogOut size={12} /> Sortir
            </button>
          </div>
        )}

        <div className={`bg-zinc-900/90 backdrop-blur-xl border border-white/10 
                        ${(!selectedPlace && sheetMode !== 'full') ? 'rounded-t-none border-t-0' : 'rounded-2xl'} 
                         shadow-2xl transition-all duration-300 ease-out
                        flex flex-col
                        ${getMobileHeightClass()} md:h-auto md:max-h-[70vh]`}>

          <div
            className="w-full p-3 cursor-grab active:cursor-grabbing flex justify-center md:hidden flex-shrink-0"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="w-12 h-1.5 bg-zinc-700/50 rounded-full" />
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 pt-0 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {selectedPlace ? (
              <PlaceDetails
                place={selectedPlace}
                onBack={() => setSelectedPlace(null)}
                onEdit={handleEditPlace}
                onDelete={handleDeletePlace}
              />
            ) : (
              <Dashboard
                status={status}
                battery={battery}
                speed={speed}
                places={places}
                lastUpdate={lastUpdate}
                onSelectPlace={handleSelectPlace}
              />
            )}
          </div>
        </div>

        {/* BOUTON DESKTOP (Cache en mobile) */}
        {!selectedPlace && sheetMode === 'default' && (
          <div className='bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-b-2xl shadow-2xl transition-all hidden md:block'>
            <button
              onClick={toggleAddingMode}
              className={`w-full py-4 px-4 font-bold text-xs uppercase tracking-wider cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 rounded-b-2xl rounded-t-md border-t border-white/5
                ${isAddingMode
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
            >
              {isAddingMode ? (
                <><LuX size={16} /> Annuler l'ajout</>
              ) : (
                <><LuPlus size={16} /> Ajouter un lieu</>
              )}
            </button>
          </div>
        )}

        {/* BOUTON MOBILE FLOTTANT (Visible même en 'min') */}
        {!selectedPlace && (
          <button
            onClick={toggleAddingMode}
            className={`md:hidden w-full py-4 font-bold  text-xs uppercase tracking-wider flex items-center justify-center gap-2 rounded-b-2xl shadow-xl border-x border-b border-white/10 backdrop-blur-xl transition-colors
               ${isAddingMode
                ? 'bg-red-500/90 text-white'
                : 'bg-zinc-900/90 text-zinc-300'
              }`}
          >
            {isAddingMode ? <LuX size={16} /> : <LuPlus size={16} />}
            {isAddingMode ? "Annuler" : "Ajouter Lieu"}
          </button>
        )}

      </div>

      {isAddingMode && !selectedPlace && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 bg-blue-600/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-lg font-bold text-sm animate-bounce flex items-center gap-2 pointer-events-none border border-white/20 whitespace-nowrap">
          📍 Cliquez sur la carte
        </div>
      )}

      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

export default App;