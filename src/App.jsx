import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { doc, onSnapshot, collection, addDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from './lib/firebase';
import { LuPlus, LuX, LuMapPin } from "react-icons/lu";

// Composants
import Dashboard from './components/Dashboard';
import PlaceDetails from './components/PlaceDetails';

import 'mapbox-gl/dist/mapbox-gl.css';
import './App.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;;

const App = () => {
  // --- ETATS ---
  const [status, setStatus] = useState("Connexion...");
  const [battery, setBattery] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [lastUpdate, setLastUpdate] = useState("");
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [places, setPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);

  // Refs
  const isAddingRef = useRef(false);
  const mapContainer = useRef(null);
  const map = useRef(null);
  const carMarker = useRef(null);
  const markersRef = useRef({});

  useEffect(() => { isAddingRef.current = isAddingMode; }, [isAddingMode]);

  // --- HANDLERS ---
  const handleSelectPlace = (place) => {
    setSelectedPlace(place);
    setIsAddingMode(false);

    if (!map.current) return;

    // On récupère le zoom actuel de la carte
    const currentZoom = map.current.getZoom();

    // LOGIQUE INTELLIGENTE :
    // Si on est déjà proche (zoom > 13), on garde le zoom actuel pour éviter le "saut".
    // Sinon, on va au zoom 14 (standard).
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
    if (map.current) return;
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

    // Click Carte (Ajout)
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
  }, []);

  // --- LOGIQUE DONNÉES (Firebase) ---

  // 1. Lieux
  useEffect(() => {
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
  }, []);

  // 2. Tracker Utilisateur
  useEffect(() => {
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
  }, [selectedPlace]);



  // --- RENDU ---
  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans">

      <div className='absolute top-5 left-5 z-10 w-80 flex flex-col gap-0.5'>
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-t-2xl rounded-b-md p-6 shadow-2xl transition-all">
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