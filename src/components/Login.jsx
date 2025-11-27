import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from '../lib/firebase';
import { FaCarSide } from "react-icons/fa6";

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError("Erreur : " + err.message);
    }
  };

  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center p-4">
      {/* Responsive padding: p-6 on mobile, p-8 on desktop */}
      <div className="w-full max-w-md bg-zinc-900/90 border border-white/10 p-6 md:p-8 rounded-2xl shadow-2xl backdrop-blur-xl">
        
        <div className="flex flex-col items-center mb-6 md:mb-8">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 text-white text-3xl border border-white/10">
            <FaCarSide />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">Partner Tracker</h1>
          <p className="text-zinc-500 text-sm mt-2">Accès sécurisé requis</p>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase ml-1">Email</label>
            <input 
              type="email" 
              required
              className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-white/30 focus:outline-none transition-colors mt-1"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase ml-1">Mot de passe</label>
            <input 
              type="password" 
              required
              className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-white/30 focus:outline-none transition-colors mt-1"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg text-center">
              {error}
            </div>
          )}

          <button 
            type="submit"
            className="w-full bg-white text-black font-bold py-3 rounded-lg mt-2 hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            {isRegistering ? "Créer un compte" : "Se connecter"}
          </button>
        </form>

        {/* <div className="mt-6 text-center">
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-xs text-zinc-500 hover:text-white transition-colors underline cursor-pointer"
          >
            {isRegistering ? "J'ai déjà un compte" : "Je n'ai pas de compte"}
          </button>
        </div> */}

      </div>
    </div>
  );
}