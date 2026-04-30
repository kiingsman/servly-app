import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import io from 'socket.io-client';

// Map Imports
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

let rawUrl = import.meta.env.VITE_BACKEND_URL || 'https://servly-app-icy0.onrender.com';
const backendUrl = rawUrl.replace(/\/$/, "");
const socket = io(backendUrl);

// ==========================================
// AUTHENTICATION SCREEN
// ==========================================
const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isProMode, setIsProMode] = useState(false); 
  const [formData, setFormData] = useState({ name: '', email: '', password: '', title: '', category: 'cleaning', price: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setIsLoading(true);
    let endpoint = '/api/login';
    if (!isLogin) endpoint = isProMode ? '/api/pro-signup' : '/api/signup';

    try {
      const res = await fetch(`${backendUrl}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const data = isJson ? await res.json() : await res.text();
      if (!res.ok) throw new Error(isJson ? (data.message || 'Something went wrong') : 'Server error.');
      login(data.user, data.token);
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  return (
    <div className="bg-bgLight w-full max-w-md mx-auto h-screen md:h-[850px] md:rounded-[2.5rem] md:shadow-2xl relative overflow-hidden md:border-8 md:border-gray-900 flex flex-col justify-center px-8">
      <div className="text-center mb-8">
        <div className={`w-16 h-16 ${isProMode ? 'bg-gray-800' : 'bg-teal-600'} rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg`}><i className="fas fa-tools text-white text-3xl"></i></div>
        <h1 className={`text-4xl font-bold ${isProMode ? 'text-gray-800' : 'text-primary'} mb-2`}>Servly {isProMode && 'Pro'}</h1>
        <p className="text-gray-500 font-medium">{isProMode ? 'Manage your services & clients' : "Your City's Premium Marketplace"}</p>
      </div>

      {!isLogin && (
          <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
              <button type="button" onClick={() => setIsProMode(false)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${!isProMode ? 'bg-white shadow-sm text-teal-600' : 'text-gray-500'}`}>Client</button>
              <button type="button" onClick={() => setIsProMode(true)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${isProMode ? 'bg-gray-800 shadow-sm text-white' : 'text-gray-500'}`}>Professional</button>
          </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-96 overflow-y-auto hide-scrollbar">
        <h2 className="text-xl font-bold text-primary mb-4">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        {error && <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm mb-4">{error}</div>}
        
        {!isLogin && <div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Full Name</label><input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" placeholder="John Doe" /></div>}
        <div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Email Address</label><input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" placeholder="john@example.com" /></div>
        <div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Password</label><input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" placeholder="••••••••" /></div>

        {!isLogin && isProMode && (
            <>
                <div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Job Title</label><input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" placeholder="e.g. Master Plumber" /></div>
                <div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Category</label><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm"><option value="cleaning">Cleaning</option><option value="electric">Electric</option><option value="plumbing">Plumbing</option><option value="ac">AC Repair</option></select></div>
                <div className="mb-6"><label className="text-xs font-bold text-gray-500 ml-1">Hourly Rate (₦)</label><input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" placeholder="10000" /></div>
            </>
        )}

        <button type="submit" disabled={isLoading} className={`w-full ${isProMode && !isLogin ? 'bg-gray-800' : 'bg-teal-600'} text-white font-bold py-3.5 rounded-xl transition shadow-md disabled:opacity-50 mt-2`}>{isLoading ? 'Please wait...' : (isLogin ? 'Log In' : 'Sign Up')}</button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-6">{isLogin ? "Don't have an account?" : "Already have an account?"} <span onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-teal-600 font-bold cursor-pointer hover:underline">{isLogin ? 'Sign Up' : 'Log In'}</span></p>
      <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};

// ==========================================
// CLIENT DASHBOARD
// ==========================================
const ClientApp = () => {
  const { user, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [loadingPros, setLoadingPros] = useState(true);
  const [myBookings, setMyBookings] = useState([]);

  const [viewingProfile, setViewingProfile] = useState(null);
  const [bookingPro, setBookingPro] = useState(null);
  const [bookingData, setBookingData] = useState({ date: '', time: '10:00 AM', address: '' });
  const [isBookingSuccess, setIsBookingSuccess] = useState(false);

  const [messageList, setMessageList] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [activeChatRoom, setActiveChatRoom] = useState(null); 
  const chatEndRef = useRef(null);

  // --- LIVE LOCATION STATE ---
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [partnerLocation, setPartnerLocation] = useState(null);
  const [viewingLiveMap, setViewingLiveMap] = useState(false);
  const watchIdRef = useRef(null);

  useEffect(() => {
    fetch(`${backendUrl}/api/professionals`).then(res => res.json()).then(data => { setProfessionals(data); setLoadingPros(false); });
    
    socket.on('receive_message', (data) => setMessageList((list) => [...list, data]));
    socket.on('receive_live_location', (data) => {
        if (data.lat === null) setPartnerLocation(null);
        else setPartnerLocation({ lat: data.lat, lng: data.lng, author: data.author });
    });

    return () => { 
        socket.off('receive_message'); 
        socket.off('receive_live_location'); 
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messageList, activeTab]);

  useEffect(() => {
    if (activeTab === 'bookings') {
      fetch(`${backendUrl}/api/bookings`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } })
        .then(res => res.json()).then(data => setMyBookings(data));
    }
    if (activeTab === 'chat' && activeChatRoom) socket.emit('join_room', activeChatRoom._id);

    // Stop sharing location if we leave the chat tab
    if (activeTab !== 'chat' && isSharingLocation) {
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
        setIsSharingLocation(false);
        if (activeChatRoom) socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name });
    }
  }, [activeTab, activeChatRoom]);

  const handleBookingSubmit = (e) => {
    e.preventDefault();
    const payload = { professionalId: bookingPro._id || bookingPro.id, professionalName: bookingPro.name, date: bookingData.date, time: bookingData.time, address: bookingData.address, totalPrice: bookingPro.price };
    fetch(`${backendUrl}/api/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }, body: JSON.stringify(payload) })
    .then(res => res.json()).then(() => setIsBookingSuccess(true));
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Cancel this booking?")) return;
    const res = await fetch(`${backendUrl}/api/bookings/${bookingId}/cancel`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } });
    if (res.ok) setMyBookings(prev => prev.map(b => b._id === bookingId ? { ...b, status: 'cancelled' } : b));
  };

  const openPrivateChat = async (booking) => {
      setActiveChatRoom(booking); setMessageList([]); setActiveTab('chat');
      fetch(`${backendUrl}/api/chat/${booking._id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } })
        .then(res => res.json()).then(data => setMessageList(data));
  };

  const sendMessage = async () => {
      if (currentMessage && activeChatRoom) {
          const messageData = { room: activeChatRoom._id, author: user.name, message: currentMessage, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
          await socket.emit('send_message', messageData);
          setMessageList((list) => [...list, messageData]); setCurrentMessage(""); 
      }
  };

  // --- NEW: Toggle Location Sharing ---
  const toggleLocationSharing = () => {
      if (isSharingLocation) {
          if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
          setIsSharingLocation(false);
          socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name });
      } else {
          if (navigator.geolocation) {
              const id = navigator.geolocation.watchPosition((pos) => {
                  socket.emit('live_location_update', { room: activeChatRoom._id, lat: pos.coords.latitude, lng: pos.coords.longitude, author: user.name });
              }, (err) => alert("Could not access GPS. Please allow location permissions."), { enableHighAccuracy: true });
              watchIdRef.current = id;
              setIsSharingLocation(true);
          } else { alert("Geolocation is not supported by your browser."); }
      }
  };

  const categories = [ { id: 'electric', name: 'Electric', icon: 'fa-bolt', color: 'text-orange-500', bg: 'bg-orange-50' }, { id: 'plumbing', name: 'Plumbing', icon: 'fa-wrench', color: 'text-teal-600', bg: 'bg-teal-50' }, { id: 'cleaning', name: 'Cleaning', icon: 'fa-broom', color: 'text-blue-500', bg: 'bg-blue-50' }, { id: 'ac', name: 'AC Repair', icon: 'fa-snowflake', color: 'text-purple-500', bg: 'bg-purple-50' } ];

  return (
    <div className="bg-bgLight w-full max-w-md mx-auto h-screen md:h-[850px] md:rounded-[2.5rem] md:shadow-2xl relative overflow-hidden md:border-8 md:border-gray-900 flex flex-col">
        {activeTab === 'home' && (
          <>
            <div className="px-6 pt-10 pb-4 bg-white rounded-b-3xl shadow-sm z-10 relative">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <p className="text-xs text-gray-500 font-medium">Hello, {user?.name?.split(' ')[0]} 👋</p>
                        <div className="flex items-center text-primary font-bold text-lg mt-1"><i className="fas fa-map-marker-alt text-teal-600 mr-2"></i>Kano, NG</div>
                    </div>
                    <div className="w-10 h-10 bg-teal-100 text-teal-600 font-bold rounded-full flex items-center justify-center">{user?.name?.charAt(0)}</div>
                </div>
                <div className="relative flex items-center">
                    <i className="fas fa-search absolute left-4 text-gray-400 z-10"></i>
                    <input type="text" placeholder="What service do you need?" className="w-full bg-gray-100 py-4 pl-12 pr-12 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-teal-600 transition-all relative" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pt-6 pb-28">
                <div className="mb-8">
                    <h2 className="text-lg font-bold text-primary mb-4">Categories</h2>
                    <div className="grid grid-cols-4 gap-4">
                        {categories.map(cat => (
                            <div key={cat.id} onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)} className="flex flex-col items-center cursor-pointer group">
                                <div className={`h-14 w-14 rounded-2xl flex justify-center items-center text-xl mb-2 transition-all ${cat.bg} ${cat.color} ${selectedCategory === cat.id ? 'ring-2 ring-teal-600 shadow-md scale-105' : ''}`}><i className={`fas ${cat.icon}`}></i></div>
                                <span className={`text-[10px] font-medium text-center ${selectedCategory === cat.id ? 'text-teal-600 font-bold' : 'text-gray-600'}`}>{cat.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h2 className="text-lg font-bold text-primary mb-4">{selectedCategory ? `${categories.find(c => c.id === selectedCategory)?.name} Pros` : 'Top Rated Near You'}</h2>
                    {loadingPros ? <div className="text-center py-10"><i className="fas fa-spinner fa-spin text-teal-600 text-3xl"></i></div> : professionals.map(pro => (
                        <div key={pro._id || pro.id} onClick={() => setViewingProfile(pro)} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-4 hover:shadow-md transition cursor-pointer">
                            <div className="flex items-center">
                                <img src={pro.avatar} className="w-16 h-16 rounded-2xl object-cover mr-4" />
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-primary text-md">{pro.name} {pro.verified && <i className="fas fa-check-circle text-teal-600 text-xs ml-1"></i>}</h3>
                                        <div className="flex items-center bg-orange-50 px-2 py-1 rounded-lg"><i className="fas fa-star text-orange-400 text-[10px] mr-1"></i><span className="text-xs font-bold text-orange-600">{pro.rating}</span></div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{pro.title} • {pro.distance}</p>
                                    <div className="mt-3 flex justify-between items-center">
                                        <span className="text-sm font-bold text-primary">₦{pro.price.toLocaleString()}<span className="text-xs text-gray-400 font-normal">/hr</span></span>
                                        <button onClick={(e) => { e.stopPropagation(); setBookingPro(pro); }} className="bg-primary text-white text-xs font-medium px-4 py-2 rounded-xl">Book</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </>
        )}

        {activeTab === 'bookings' && (
          <div className="flex-1 overflow-y-auto px-6 pt-10 pb-28 bg-gray-50">
            <h2 className="text-2xl font-bold text-primary mb-6">My Bookings</h2>
            {myBookings.map(booking => {
                let statusColor = booking.status === 'confirmed' ? 'bg-teal-50 text-teal-600' : booking.status === 'completed' ? 'bg-blue-50 text-blue-600' : booking.status === 'cancelled' ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500';
                return (
                  <div key={booking._id} className={`bg-white p-5 rounded-3xl shadow-sm mb-4 relative ${booking.status === 'cancelled' ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between mb-3 pl-2"><h3 className="font-bold">{booking.professionalName}</h3><div className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase ${statusColor}`}>{booking.status}</div></div>
                    <div className="pl-2">
                      <p className="text-sm text-gray-600 mb-4">{new Date(booking.date).toLocaleDateString()} at {booking.time}</p>
                      {booking.status !== 'cancelled' && (
                          <div className="flex gap-2">
                              {booking.status === 'pending' && <button onClick={() => handleCancelBooking(booking._id)} className="flex-1 py-2 bg-red-50 text-red-500 text-xs font-bold rounded-xl">Cancel</button>}
                              <button onClick={() => openPrivateChat(booking)} className="flex-1 py-2 bg-teal-50 text-teal-600 text-xs font-bold rounded-xl">Message Pro</button>
                          </div>
                      )}
                    </div>
                  </div>
                );
            })}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col bg-gray-50 pb-20 relative z-30">
             {activeChatRoom && (
                 <>
                    <div className="px-6 pt-10 pb-4 bg-white border-b flex items-center">
                        <button onClick={() => setActiveTab('bookings')} className="mr-4 text-gray-400"><i className="fas fa-chevron-left"></i></button>
                        <h2 className="text-lg font-bold">{activeChatRoom.professionalName}</h2>
                    </div>

                    {/* LIVE LOCATION NOTIFICATION BANNER */}
                    {partnerLocation && (
                        <div className="bg-blue-50 border-b border-blue-100 p-3 flex justify-between items-center z-10 shadow-sm">
                            <div className="flex items-center">
                                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse mr-2 border border-white"></div>
                                <p className="text-xs text-blue-800 font-bold">{partnerLocation.author} is sharing live location</p>
                            </div>
                            <button onClick={() => setViewingLiveMap(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">View Map</button>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
                        {messageList.map((msg, idx) => (
                            <div key={idx} className={`flex flex-col ${msg.author === user.name ? 'items-end' : 'items-start'}`}>
                                <div className={`px-4 py-3 rounded-2xl max-w-[80%] ${msg.author === user.name ? 'bg-teal-600 text-white rounded-br-none' : 'bg-white rounded-bl-none'}`}><p className="text-sm">{msg.message}</p></div>
                                <span className="text-[10px] text-gray-400 mt-1">{msg.time}</span>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="absolute bottom-[72px] w-full bg-white p-4 flex gap-2 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                        {/* NEW: LIVE LOCATION BUTTON */}
                        <button onClick={toggleLocationSharing} className={`w-12 h-12 rounded-xl flex items-center justify-center transition shadow-sm ${isSharingLocation ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`} title="Share Live Location">
                            <i className={`fas fa-map-marker-alt ${isSharingLocation && 'animate-bounce'}`}></i>
                        </button>
                        <input type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage()} className="flex-1 bg-gray-100 p-3 rounded-xl text-sm outline-none" placeholder="Message..." />
                        <button onClick={sendMessage} className="bg-teal-600 text-white w-12 rounded-xl"><i className="fas fa-paper-plane"></i></button>
                    </div>
                 </>
             )}
          </div>
        )}

        {/* --- LIVE TRACKING MAP OVERLAY (CLIENT) --- */}
        {viewingLiveMap && partnerLocation && (
             <div className="absolute inset-0 bg-white z-50 flex flex-col animate-[slideUp_0.3s_ease-out]">
                 <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                     <div>
                         <h2 className="text-xl font-bold text-primary">Live Tracking</h2>
                         <p className="text-xs text-teal-600 font-medium">Tracking {partnerLocation.author}</p>
                     </div>
                     <button onClick={() => setViewingLiveMap(false)} className="h-10 w-10 rounded-full bg-gray-100 text-gray-600"><i className="fas fa-times"></i></button>
                 </div>
                 <div className="flex-1 w-full relative">
                     <MapContainer center={[partnerLocation.lat, partnerLocation.lng]} zoom={16} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                         <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                         <Marker position={[partnerLocation.lat, partnerLocation.lng]}>
                             <Popup>{partnerLocation.author} is here!</Popup>
                         </Marker>
                     </MapContainer>
                 </div>
             </div>
        )}

        {activeTab === 'profile' && (
          <div className="flex-1 overflow-y-auto px-6 pt-10 bg-gray-50 text-center">
            <h2 className="text-2xl font-bold mb-6">My Account</h2>
            <div className="bg-white p-6 rounded-3xl mb-6 shadow-sm"><div className="w-24 h-24 bg-teal-100 text-teal-600 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl font-bold">{user?.name?.charAt(0)}</div><h3 className="font-bold text-xl">{user?.name}</h3><button onClick={logout} className="bg-red-50 text-red-500 font-bold py-3 mt-6 rounded-xl w-full">Log Out</button></div>
            
            {user?.role === 'admin' && (
                <div onClick={() => setActiveTab('admin')} className="bg-gray-900 p-4 rounded-2xl flex items-center justify-between cursor-pointer mt-4">
                    <div className="flex items-center"><div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center mr-4"><i className="fas fa-shield-alt text-teal-400"></i></div><div><h4 className="text-white font-bold text-sm">Admin Dashboard</h4></div></div>
                </div>
            )}
          </div>
        )}

        {/* BOOKING OVERLAY */}
        {bookingPro && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col">
                <div className="flex justify-between items-center p-6 border-b"><h2 className="font-bold text-xl">Book Service</h2><button onClick={() => { setBookingPro(null); setIsBookingSuccess(false); }} className="bg-gray-100 h-10 w-10 rounded-full"><i className="fas fa-times"></i></button></div>
                {isBookingSuccess ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6"><h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2><button onClick={() => { setBookingPro(null); setIsBookingSuccess(false); setActiveTab('bookings'); }} className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl mt-8">View Bookings</button></div>
                ) : (
                    <form onSubmit={handleBookingSubmit} className="flex-1 p-6 flex flex-col"><input type="date" required className="w-full bg-gray-50 p-4 rounded-xl mb-6" value={bookingData.date} onChange={e => setBookingData({...bookingData, date: e.target.value})} /><div className="grid grid-cols-3 gap-3 mb-6">{['10:00 AM', '1:00 PM', '4:00 PM'].map(time => <div key={time} onClick={() => setBookingData({...bookingData, time})} className={`text-center py-3 rounded-xl text-sm font-medium cursor-pointer ${bookingData.time === time ? 'bg-teal-600 text-white' : 'bg-gray-50'}`}>{time}</div>)}</div><textarea required className="w-full bg-gray-50 p-4 rounded-xl mb-6 h-28" value={bookingData.address} onChange={e => setBookingData({...bookingData, address: e.target.value})} placeholder="E.g. Zoo Road, Kano"></textarea><button type="submit" className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl mt-auto">Confirm Booking</button></form>
                )}
            </div>
        )}

        <div className="absolute bottom-0 w-full bg-white border-t px-6 py-4 flex justify-between z-20">
            {['home', 'bookings', 'chat', 'profile'].map((tab, idx) => (
                <div key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center cursor-pointer ${activeTab === tab ? 'text-teal-600' : 'text-gray-400'}`}><i className={`fas ${['fa-home', 'fa-calendar-alt', 'fa-comment-dots', 'fa-user'][idx]} text-xl mb-1`}></i><span className="text-[10px] font-bold">{tab}</span></div>
            ))}
        </div>
    </div>
  );
};

// ==========================================
// PROFESSIONAL DASHBOARD (WITH LIVE TRACKING)
// ==========================================
const ProfessionalApp = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('jobs');
    const [jobs, setJobs] = useState([]);
    
    const [activeChatRoom, setActiveChatRoom] = useState(null);
    const [messageList, setMessageList] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const chatEndRef = useRef(null);

    // GEOCODING MAP STATE
    const [viewingMapForJob, setViewingMapForJob] = useState(null);
    const [mapPosition, setMapPosition] = useState([11.9964, 8.5167]); 
    const [isMapLoading, setIsMapLoading] = useState(false);

    // --- LIVE LOCATION STATE ---
    const [isSharingLocation, setIsSharingLocation] = useState(false);
    const [partnerLocation, setPartnerLocation] = useState(null);
    const [viewingLiveMap, setViewingLiveMap] = useState(false);
    const watchIdRef = useRef(null);

    useEffect(() => {
        fetch(`${backendUrl}/api/pro/bookings`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } })
            .then(res => res.json()).then(data => setJobs(data));

        socket.on('receive_message', (data) => setMessageList((list) => [...list, data]));
        socket.on('receive_live_location', (data) => {
            if (data.lat === null) setPartnerLocation(null);
            else setPartnerLocation({ lat: data.lat, lng: data.lng, author: data.author });
        });

        return () => { 
            socket.off('receive_message'); 
            socket.off('receive_live_location');
            if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
        };
    }, []);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messageList]);

    useEffect(() => {
        // Stop sharing location if we leave the chat tab
        if (activeTab !== 'chat' && isSharingLocation) {
            if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
            setIsSharingLocation(false);
            if (activeChatRoom) socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name });
        }
      }, [activeTab, activeChatRoom]);

    const openChat = async (job) => {
        setActiveChatRoom(job); setMessageList([]); setActiveTab('chat'); socket.emit('join_room', job._id);
        fetch(`${backendUrl}/api/chat/${job._id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } })
            .then(res => res.json()).then(data => setMessageList(data));
    };

    const sendMessage = async () => {
        if (currentMessage && activeChatRoom) {
            const msgData = { room: activeChatRoom._id, author: user.name, message: currentMessage, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
            await socket.emit('send_message', msgData);
            setMessageList(list => [...list, msgData]); setCurrentMessage(""); 
        }
    };

    const updateJobStatus = async (jobId, status) => {
        const res = await fetch(`${backendUrl}/api/admin/bookings/${jobId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }, body: JSON.stringify({ status }) });
        if (res.ok) setJobs(prev => prev.map(j => j._id === jobId ? { ...j, status } : j));
    };

    const handleViewMap = async (job) => {
        setViewingMapForJob(job);
        setIsMapLoading(true);
        try {
            const searchQuery = job.address.toLowerCase().includes('kano') ? job.address : `${job.address}, Kano, Nigeria`;
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            if (data && data.length > 0) setMapPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
            else setMapPosition([11.9964, 8.5167]); 
        } catch (err) { setMapPosition([11.9964, 8.5167]); } finally { setIsMapLoading(false); }
    };

    // --- NEW: Toggle Location Sharing ---
    const toggleLocationSharing = () => {
        if (isSharingLocation) {
            if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
            setIsSharingLocation(false);
            socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name });
        } else {
            if (navigator.geolocation) {
                const id = navigator.geolocation.watchPosition((pos) => {
                    socket.emit('live_location_update', { room: activeChatRoom._id, lat: pos.coords.latitude, lng: pos.coords.longitude, author: user.name });
                }, (err) => alert("Could not access GPS. Please allow location permissions."), { enableHighAccuracy: true });
                watchIdRef.current = id;
                setIsSharingLocation(true);
            } else { alert("Geolocation is not supported by your browser."); }
        }
    };

    return (
        <div className="bg-gray-900 w-full max-w-md mx-auto h-screen md:h-[850px] relative flex flex-col text-white md:rounded-[2.5rem] md:shadow-2xl">
            {activeTab === 'jobs' && (
                <div className="flex-1 overflow-y-auto px-6 pt-10 pb-28">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">My Jobs</h2>
                    </div>
                    {jobs.map(job => (
                        <div key={job._id} className="bg-gray-800 p-5 rounded-2xl mb-4">
                            <div className="flex justify-between mb-3 border-b border-gray-700 pb-3"><h3 className="font-bold">{job.clientName}</h3><div className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-gray-700">{job.status}</div></div>
                            <p className="text-sm text-gray-300 mb-2"><i className="far fa-calendar-alt text-teal-400 mr-2"></i>{new Date(job.date).toLocaleDateString()} at {job.time}</p>
                            
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-sm text-gray-300"><i className="fas fa-map-marker-alt text-teal-400 mr-2"></i>{job.address.substring(0, 20)}...</p>
                                <button onClick={() => handleViewMap(job)} className="bg-gray-700 text-teal-400 px-3 py-1 rounded text-xs font-bold shadow-md hover:bg-gray-600 transition"><i className="fas fa-map mr-1"></i>View Map</button>
                            </div>
                            
                            <div className="flex gap-2 mt-4">
                                <button onClick={() => openChat(job)} className="flex-1 py-2 bg-gray-700 text-xs font-bold rounded-lg">Chat</button>
                                {job.status === 'pending' && <button onClick={() => updateJobStatus(job._id, 'confirmed')} className="flex-1 py-2 bg-teal-600 text-xs font-bold rounded-lg">Accept</button>}
                                {job.status === 'confirmed' && <button onClick={() => updateJobStatus(job._id, 'completed')} className="flex-1 py-2 bg-blue-600 text-xs font-bold rounded-lg">Complete</button>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'chat' && (
                <div className="flex-1 flex flex-col pb-20 z-30">
                    {activeChatRoom && (
                        <>
                            <div className="px-6 pt-10 pb-4 border-b border-gray-800 flex items-center"><button onClick={() => setActiveTab('jobs')} className="mr-4 text-gray-400"><i className="fas fa-chevron-left"></i></button><h2 className="text-lg font-bold">{activeChatRoom.clientName}</h2></div>
                            
                            {/* LIVE LOCATION NOTIFICATION BANNER */}
                            {partnerLocation && (
                                <div className="bg-gray-800 border-b border-teal-500/30 p-3 flex justify-between items-center z-10 shadow-sm">
                                    <div className="flex items-center">
                                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse mr-2 border border-gray-800"></div>
                                        <p className="text-xs text-teal-400 font-bold">{partnerLocation.author} is sharing live location</p>
                                    </div>
                                    <button onClick={() => setViewingLiveMap(true)} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">View Map</button>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
                                {messageList.map((msg, idx) => (
                                    <div key={idx} className={`flex flex-col ${msg.author === user.name ? 'items-end' : 'items-start'}`}><div className={`px-4 py-3 rounded-2xl max-w-[80%] ${msg.author === user.name ? 'bg-teal-600 rounded-br-none' : 'bg-gray-800 rounded-bl-none'}`}><p className="text-sm">{msg.message}</p></div></div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>

                            <div className="absolute bottom-[72px] w-full p-4 border-t border-gray-800 bg-gray-900 flex gap-2 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.2)]">
                                {/* NEW: LIVE LOCATION BUTTON */}
                                <button onClick={toggleLocationSharing} className={`w-12 h-12 rounded-xl flex items-center justify-center transition shadow-sm ${isSharingLocation ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`} title="Share Live Location">
                                    <i className={`fas fa-map-marker-alt ${isSharingLocation && 'animate-bounce'}`}></i>
                                </button>
                                <input type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage()} className="flex-1 bg-gray-800 p-3 rounded-xl text-sm outline-none text-white" placeholder="Message..." />
                                <button onClick={sendMessage} className="bg-teal-600 w-12 rounded-xl"><i className="fas fa-paper-plane"></i></button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* --- LIVE TRACKING MAP OVERLAY (PRO) --- */}
            {viewingLiveMap && partnerLocation && (
                 <div className="absolute inset-0 bg-gray-900 z-50 flex flex-col animate-[slideUp_0.3s_ease-out]">
                     <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                         <div>
                             <h2 className="text-xl font-bold text-white">Live Tracking</h2>
                             <p className="text-xs text-teal-400 font-medium">Tracking {partnerLocation.author}</p>
                         </div>
                         <button onClick={() => setViewingLiveMap(false)} className="h-10 w-10 rounded-full bg-gray-800 text-gray-400"><i className="fas fa-times"></i></button>
                     </div>
                     <div className="flex-1 w-full bg-gray-800 relative">
                         <MapContainer center={[partnerLocation.lat, partnerLocation.lng]} zoom={16} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                             <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                             <Marker position={[partnerLocation.lat, partnerLocation.lng]}>
                                 <Popup>{partnerLocation.author} is here!</Popup>
                             </Marker>
                         </MapContainer>
                     </div>
                 </div>
            )}

            {/* GEOCODING MAP OVERLAY */}
            {viewingMapForJob && (
                 <div className="absolute inset-0 bg-gray-900 z-50 flex flex-col animate-[slideUp_0.3s_ease-out]">
                     <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                         <div>
                             <h2 className="text-xl font-bold text-white">Client Location</h2>
                             <p className="text-xs text-teal-400">Navigating to {viewingMapForJob.clientName}</p>
                         </div>
                         <button onClick={() => setViewingMapForJob(null)} className="h-10 w-10 rounded-full bg-gray-800 text-gray-400"><i className="fas fa-times"></i></button>
                     </div>
                     <div className="flex-1 w-full bg-gray-800 relative flex items-center justify-center">
                         {isMapLoading ? (
                             <div className="text-center">
                                 <i className="fas fa-spinner fa-spin text-teal-400 text-4xl mb-4"></i>
                                 <p className="text-gray-400 text-sm font-medium">Locating address...</p>
                             </div>
                         ) : (
                             <MapContainer key={`${mapPosition[0]}-${mapPosition[1]}`} center={mapPosition} zoom={15} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                                 <TileLayer
                                     attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                     url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                 />
                                 <Marker position={mapPosition}>
                                     <Popup><strong>{viewingMapForJob.clientName}'s Location</strong><br/>{viewingMapForJob.address}</Popup>
                                 </Marker>
                             </MapContainer>
                         )}
                     </div>
                     <div className="p-6 bg-gray-900 border-t border-gray-800 text-center"><p className="text-sm text-gray-400 mb-4">{viewingMapForJob.address}</p><button onClick={() => setViewingMapForJob(null)} className="w-full bg-teal-600 text-white font-bold py-4 rounded-xl">Close Map</button></div>
                 </div>
            )}

            {activeTab === 'profile' && (
                <div className="flex-1 p-6 pt-10 text-center"><h2 className="text-2xl font-bold mb-6">Pro Account</h2><div className="w-24 h-24 bg-gray-800 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold text-teal-400">{user?.name?.charAt(0)}</div><h3 className="font-bold text-xl">{user?.name}</h3><button onClick={logout} className="w-full bg-red-500/20 text-red-400 py-3 rounded-xl mt-6">Log Out</button></div>
            )}

            <div className="absolute bottom-0 w-full border-t border-gray-800 px-6 py-4 flex justify-between z-20 bg-gray-900">
                {['jobs', 'chat', 'profile'].map((tab, idx) => (
                    <div key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center cursor-pointer ${activeTab === tab ? 'text-teal-400' : 'text-gray-600'}`}><i className={`fas ${['fa-briefcase', 'fa-comment-dots', 'fa-user'][idx]} text-xl mb-1`}></i><span className="text-[10px] font-bold">{tab}</span></div>
                ))}
            </div>
        </div>
    );
};

// ==========================================
// GLOBAL ROUTER
// ==========================================
const AppController = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen bg-gray-200 flex items-center justify-center"><i className="fas fa-circle-notch fa-spin text-teal-600 text-4xl"></i></div>;
  if (!user) return <AuthScreen />;
  if (user.role === 'professional') return <ProfessionalApp />;
  return <ClientApp />; 
};
const App = () => ( <AuthProvider><AppController /></AuthProvider> );
export default App;