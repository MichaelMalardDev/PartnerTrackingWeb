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

  // --- HANDLERS ---
  const handleSelectPlace = (place) => {
    setSelectedPlace(place);
    setIsAddingMode(false);

    if (!map.current) return;

    const currentZoom = map.current.getZoom();
    const targetZoom = currentZoom > 14 ? currentZoom : 14;

    map.current.flyTo({
      center: [place.longitude, place.latitude],
      zoom: targetZoom,
      speed: 0.6,
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
    // On ne charge la carte QUE si l'utilisateur est connecté
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
          setIsAddingMode(false);
        } catch (error) { console.error(error); }
      }
    });
  }, [user]); // Dépendance ajoutée : user

  // --- LOGIQUE DONNÉES (Firebase) ---

  // 1. Lieux
  useEffect(() => {
    if (!user) return; // Sécurité

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
          el.innerHTML = `<div class="text-2xl cursor-pointer hover:scale-125 transition-transform">📍</div><div class="text-xs text-white font-bold drop-shadow-md text-center">${place.name}</div>`;

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

  // 2. Tracker Utilisateur
  useEffect(() => {
    if (!user) return; // Sécurité

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
            map.current.flyTo({ center: [longitude, latitude], zoom: 14, speed: 0.8 });
          }
        }
      }
    });
    return () => unsubscribe();
  }, [selectedPlace, user]);


  // --- RENDU CONDITIONNEL (LA SÉCURITÉ) ---
  
  if (isLoadingAuth) {
    return <div className="h-screen w-screen bg-black flex items-center justify-center text-zinc-500 font-mono animate-pulse">Chargement du système...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans">

      <div className='absolute top-5 left-5 z-10 w-80 flex flex-col gap-0.5'>
        
        {/* HEADER DE CONNEXION (Nouveau) */}
        {!selectedPlace && (
           <div className="bg-zinc-900/90 backdrop-blur-xl border-x border-t border-white/10 rounded-t-2xl p-4 flex justify-between items-center animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                  <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[140px]">{user.email}</span>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider cursor-pointer"
                title="Se déconnecter"
              >
                <LuLogOut size={12} /> Sortir
              </button>
           </div>
        )}

        <div className={`bg-zinc-900/90 backdrop-blur-xl border border-white/10 ${!selectedPlace ? 'rounded-t-none border-t-0' : 'rounded-t-2xl'} rounded-b-md p-6 shadow-2xl transition-all`}>
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

        {!selectedPlace && (
          <div className='bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-b-2xl rounded-t-md shadow-2xl transition-all'>
            <button
              onClick={() => setIsAddingMode(!isAddingMode)}
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
      </div>

      {isAddingMode && !selectedPlace && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg font-bold text-sm animate-bounce flex items-center gap-2 pointer-events-none border border-white/20">
          📍 Cliquez sur la carte pour placer le point
        </div>
      )}

      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

export default App;