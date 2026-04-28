import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const App = () => {
  useEffect(() => {
    // In production, this will point to your Render URL. 
    // For local dev, it points to localhost.
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const socket = io(backendUrl);

    socket.on('connect', () => console.log('Connected to realtime server'));
    return () => socket.disconnect();
  }, []);

  return (
    <div className="bg-bgLight w-full max-w-md h-[850px] rounded-[2.5rem] shadow-2xl relative overflow-hidden border-8 border-gray-900 flex flex-col">
        <div className="px-6 pt-10 pb-4 bg-white rounded-b-3xl shadow-sm z-10 text-center">
            <h1 className="text-2xl font-bold text-primary mt-4">Servly</h1>
            <p className="text-sm text-gray-500 mb-2">Cloud-Ready Stack (MongoDB)</p>
            <div className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">UI Ready to Connect</div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto pb-24 flex flex-col items-center justify-center">
            <i className="fas fa-cloud-upload-alt text-6xl text-accent mb-4"></i>
            <p className="text-center text-gray-600 font-medium">Your MongoDB & React setup is complete.</p>
            <p className="text-center text-xs text-gray-400 mt-2">Ready to be pushed to GitHub, Vercel, and Render.</p>
        </div>
    </div>
  );
};
export default App;