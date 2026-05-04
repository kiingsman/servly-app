import React, { useState, useEffect } from 'react';
import { Menu, DollarSign, Navigation, ShieldCheck, ChevronUp } from 'lucide-react';

const ProfessionalDashboard = () => {
  const [isOnline, setIsOnline] = useState(false);
  const [todaysEarnings, setTodaysEarnings] = useState(150.00); // Mock data

  const handleToggleOnline = () => {
    setIsOnline(!isOnline);
    // TODO: Emit socket event or API call to update pro's status in the database
  };

  return (
    <div className="relative h-screen w-full bg-slate-100 overflow-hidden font-sans flex flex-col">
      
      {/* MAP BACKGROUND PLACEHOLDER */}
      {/* In the future, this is where you'd put a Google Map or Leaflet Map component */}
      <div className="absolute inset-0 z-0 opacity-40 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-blue-50" />

      {/* TOP HEADER - FLOATING */}
      <div className="relative z-10 p-4 pt-6 flex justify-between items-center w-full">
        {/* Menu Button */}
        <button className="bg-white p-3 rounded-full shadow-lg hover:bg-gray-50 transition">
          <Menu className="w-6 h-6 text-gray-700" />
        </button>

        {/* Earnings Card */}
        <div className="bg-slate-900 text-white px-6 py-2 rounded-full shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800 transition">
          <span className="text-xs text-slate-300 font-medium tracking-wider uppercase">Today</span>
          <span className="text-lg font-bold flex items-center">
            <DollarSign className="w-4 h-4 mr-1" />
            {todaysEarnings.toFixed(2)}
          </span>
        </div>

        {/* Safety/Help Button */}
        <button className="bg-white p-3 rounded-full shadow-lg hover:bg-gray-50 transition text-blue-600">
          <ShieldCheck className="w-6 h-6" />
        </button>
      </div>

      {/* CENTER - THE "GO" BUTTON */}
      <div className="relative z-10 flex-grow flex flex-col items-center justify-center mb-24">
        
        {/* Radar Pulse Animation (Only visible when online) */}
        {isOnline && (
          <>
            <div className="absolute w-48 h-48 bg-blue-500 rounded-full animate-ping opacity-20"></div>
            <div className="absolute w-64 h-64 bg-blue-400 rounded-full animate-ping opacity-10 animation-delay-200"></div>
          </>
        )}

        {/* Main Button */}
        <button 
          onClick={handleToggleOnline}
          className={`relative flex items-center justify-center w-32 h-32 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 z-20
            ${isOnline 
              ? 'bg-red-500 shadow-red-500/50 text-white' 
              : 'bg-blue-600 shadow-blue-600/50 text-white'
            }`}
        >
          <div className="flex flex-col items-center border-4 border-white/20 rounded-full w-28 h-28 justify-center">
            {isOnline ? (
              <span className="text-lg font-bold tracking-widest uppercase">Stop</span>
            ) : (
              <span className="text-3xl font-bold tracking-widest uppercase">Go</span>
            )}
          </div>
        </button>

        {/* Status Text */}
        <div className="mt-8 bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-sm text-center">
          <h2 className={`font-bold text-lg ${isOnline ? 'text-blue-600' : 'text-gray-600'}`}>
            {isOnline ? "You're Online" : "You're Offline"}
          </h2>
          <p className="text-sm text-gray-500">
            {isOnline ? "Finding nearby requests..." : "Tap GO to start accepting jobs"}
          </p>
        </div>
      </div>

      {/* BOTTOM SHEET */}
      <div className="absolute bottom-0 w-full bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-30 transition-transform duration-300 translate-y-0">
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>
        
        <div className="px-6 pb-8 pt-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-800 text-lg">Your Status</h3>
            <button className="text-blue-600 p-2 bg-blue-50 rounded-full">
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 p-4 rounded-2xl">
              <p className="text-xl font-bold text-gray-800">12</p>
              <p className="text-xs text-gray-500 font-medium mt-1">Trips</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl">
              <p className="text-xl font-bold text-gray-800">4.9</p>
              <p className="text-xs text-gray-500 font-medium mt-1">Rating</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl">
              <p className="text-xl font-bold text-gray-800">85%</p>
              <p className="text-xs text-gray-500 font-medium mt-1">Accept</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalDashboard;