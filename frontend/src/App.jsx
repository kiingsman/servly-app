import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import io from 'socket.io-client';
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
// SHARED WEBRTC VIDEO CALL LOGIC & UI
// ==========================================
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const useVideoCall = (socket, activeChatRoom, user) => {
    const [callState, setCallState] = useState({ status: 'idle', offer: null, callerName: null, room: null });
    const localVideoRef = useRef(null); const remoteVideoRef = useRef(null); const peerConnection = useRef(null); const localStream = useRef(null);
    useEffect(() => {
        if (!socket) return;
        const handleIncoming = (data) => setCallState({ status: 'receiving', offer: data.offer, callerName: data.callerName, room: data.room });
        const handleAccepted = async (data) => { if(peerConnection.current) { await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer)); setCallState(prev => ({ ...prev, status: 'connected' })); } };
        const handleIce = async (data) => { if(peerConnection.current && data.candidate) { try { await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch(e){} } };
        const handleEnded = () => endCall(false);
        socket.on('incoming_call', handleIncoming); socket.on('call_accepted', handleAccepted); socket.on('ice_candidate', handleIce); socket.on('call_ended', handleEnded);
        return () => { socket.off('incoming_call', handleIncoming); socket.off('call_accepted', handleAccepted); socket.off('ice_candidate', handleIce); socket.off('call_ended', handleEnded); }
    }, [socket, activeChatRoom]);
    const setupMediaAndPeer = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); localStream.current = stream; if(localVideoRef.current) localVideoRef.current.srcObject = stream;
        peerConnection.current = new RTCPeerConnection(rtcConfig); stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));
        peerConnection.current.onicecandidate = (e) => { const room = activeChatRoom ? activeChatRoom._id : callState.room; if(e.candidate && room) socket.emit('ice_candidate', { room, candidate: e.candidate }); };
        peerConnection.current.ontrack = (e) => { if(remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; };
    };
    const startCall = async () => { if(!activeChatRoom) return; setCallState({ status: 'calling', room: activeChatRoom._id }); await setupMediaAndPeer(); const offer = await peerConnection.current.createOffer(); await peerConnection.current.setLocalDescription(offer); socket.emit('call_user', { room: activeChatRoom._id, offer, callerName: user.name }); };
    const acceptCall = async () => { await setupMediaAndPeer(); await peerConnection.current.setRemoteDescription(new RTCSessionDescription(callState.offer)); const answer = await peerConnection.current.createAnswer(); await peerConnection.current.setLocalDescription(answer); socket.emit('accept_call', { room: callState.room, answer }); setCallState(prev => ({ ...prev, status: 'connected' })); };
    const endCall = (emit = true) => { const room = activeChatRoom ? activeChatRoom._id : callState.room; if(emit && room) socket.emit('end_call', { room }); if(localStream.current) localStream.current.getTracks().forEach(t => t.stop()); if(peerConnection.current) peerConnection.current.close(); peerConnection.current = null; setCallState({ status: 'idle', offer: null, callerName: null, room: null }); };
    useEffect(() => { if(localVideoRef.current && localStream.current) localVideoRef.current.srcObject = localStream.current; }, [callState.status]);
    return { callState, localVideoRef, remoteVideoRef, startCall, acceptCall, endCall };
};

const CallUI = ({ callState, localVideoRef, remoteVideoRef, acceptCall, endCall }) => {
    if(callState.status === 'idle') return null;
    return (
        <div className="absolute inset-0 bg-gray-900 z-[100] flex flex-col animate-[slideUp_0.3s_ease-out]">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover bg-gray-900" />
            {(callState.status === 'calling' || callState.status === 'connected') && (<div className="absolute top-6 right-6 w-24 h-36 bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700"><video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" /></div>)}
            {callState.status === 'receiving' && (<div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center p-6 text-center"><div className="w-24 h-24 bg-teal-500 rounded-full animate-bounce flex items-center justify-center text-4xl text-white mb-6 shadow-lg"><i className="fas fa-video"></i></div><h2 className="text-2xl font-bold text-white mb-2">{callState.callerName} is calling...</h2><p className="text-gray-400 mb-12">Incoming Video Call</p><div className="flex gap-8"><button onClick={() => endCall(true)} className="w-16 h-16 bg-red-500 rounded-full text-white text-xl"><i className="fas fa-times"></i></button><button onClick={acceptCall} className="w-16 h-16 bg-green-500 rounded-full text-white text-xl animate-pulse"><i className="fas fa-video"></i></button></div></div>)}
            {callState.status === 'calling' && (<div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none bg-gray-900/50"><h2 className="text-2xl font-bold text-white mb-2">Calling...</h2><p className="text-gray-300">Waiting for answer</p></div>)}
            {(callState.status === 'calling' || callState.status === 'connected') && (<div className="absolute bottom-10 left-0 w-full flex justify-center"><button onClick={() => endCall(true)} className="w-16 h-16 bg-red-500 rounded-full text-white text-2xl shadow-lg"><i className="fas fa-phone-slash"></i></button></div>)}
        </div>
    );
};

// ==========================================
// AUTHENTICATION SCREEN
// ==========================================
const AuthScreen = () => {
    const [isLogin, setIsLogin] = useState(true); const [isProMode, setIsProMode] = useState(false); const [formData, setFormData] = useState({ name: '', email: '', password: '', title: '', category: 'cleaning', price: '' }); const [error, setError] = useState(''); const [isLoading, setIsLoading] = useState(false); const { login } = useAuth();
    const handleSubmit = async (e) => { e.preventDefault(); setError(''); setIsLoading(true); let endpoint = '/api/login'; if (!isLogin) endpoint = isProMode ? '/api/pro-signup' : '/api/signup'; try { const res = await fetch(`${backendUrl}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }); const isJson = (res.headers.get('content-type') || '').includes('application/json'); const data = isJson ? await res.json() : await res.text(); if (!res.ok) throw new Error(isJson ? (data.message || 'Something went wrong') : 'Server error.'); login(data.user, data.token); } catch (err) { setError(err.message); } finally { setIsLoading(false); } };
    return (
      <div className="bg-bgLight w-full max-w-md mx-auto h-screen md:h-[850px] md:rounded-[2.5rem] md:shadow-2xl relative overflow-hidden md:border-8 md:border-gray-900 flex flex-col justify-center px-8">
        <div className="text-center mb-8"><div className={`w-16 h-16 ${isProMode ? 'bg-gray-800' : 'bg-teal-600'} rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg`}><i className="fas fa-tools text-white text-3xl"></i></div><h1 className={`text-4xl font-bold ${isProMode ? 'text-gray-800' : 'text-primary'} mb-2`}>Servly {isProMode && 'Pro'}</h1><p className="text-gray-500 font-medium">{isProMode ? 'Manage your services' : "Your City's Premium Marketplace"}</p></div>
        {!isLogin && (<div className="flex bg-gray-100 p-1 rounded-xl mb-6"><button type="button" onClick={() => setIsProMode(false)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${!isProMode ? 'bg-white shadow-sm text-teal-600' : 'text-gray-500'}`}>Client</button><button type="button" onClick={() => setIsProMode(true)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${isProMode ? 'bg-gray-800 shadow-sm text-white' : 'text-gray-500'}`}>Professional</button></div>)}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-96 overflow-y-auto hide-scrollbar">
          <h2 className="text-xl font-bold text-primary mb-4">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>{error && <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm mb-4">{error}</div>}
          {!isLogin && <div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Full Name</label><input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" /></div>}
          <div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Email Address</label><input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" /></div>
          <div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Password</label><input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" /></div>
          {!isLogin && isProMode && (
              <><div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Job Title</label><input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" placeholder="e.g. Cloud Engineer" /></div><div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Category</label><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm"><option value="cleaning">Cleaning</option><option value="electric">Electric</option><option value="plumbing">Plumbing</option><option value="ac">AC Repair</option><option value="tech">Tech & IT</option></select></div><div className="mb-6"><label className="text-xs font-bold text-gray-500 ml-1">Hourly Rate (₦)</label><input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" /></div></>
          )}
          <button type="submit" disabled={isLoading} className={`w-full ${isProMode && !isLogin ? 'bg-gray-800' : 'bg-teal-600'} text-white font-bold py-3.5 rounded-xl transition shadow-md mt-2`}>{isLoading ? 'Wait...' : (isLogin ? 'Log In' : 'Sign Up')}</button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6"><span onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-teal-600 font-bold cursor-pointer">{isLogin ? 'Sign Up' : 'Log In'}</span></p><style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
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
  const [professionals, setProfessionals] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [bookingPro, setBookingPro] = useState(null);
  const [bookingData, setBookingData] = useState({ date: '', time: '10:00 AM', address: '' });
  const [isBookingSuccess, setIsBookingSuccess] = useState(false);
  const [messageList, setMessageList] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [activeChatRoom, setActiveChatRoom] = useState(null); 
  const chatEndRef = useRef(null);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [partnerLocation, setPartnerLocation] = useState(null);
  const [viewingLiveMap, setViewingLiveMap] = useState(false);
  const watchIdRef = useRef(null);

  const callLogic = useVideoCall(socket, activeChatRoom, user);

  useEffect(() => {
    fetch(`${backendUrl}/api/professionals`).then(res => res.json()).then(data => setProfessionals(data));
    socket.on('receive_message', (data) => setMessageList((list) => [...list, data]));
    socket.on('receive_live_location', (data) => { if (data.lat === null) setPartnerLocation(null); else setPartnerLocation({ lat: data.lat, lng: data.lng, author: data.author }); });
    return () => { socket.off('receive_message'); socket.off('receive_live_location'); if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messageList, activeTab]);

  useEffect(() => {
    if (activeTab === 'bookings') fetch(`${backendUrl}/api/bookings`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }).then(res => res.json()).then(data => setMyBookings(data));
    if (activeTab === 'chat' && activeChatRoom) socket.emit('join_room', activeChatRoom._id);
    if (activeTab !== 'chat' && isSharingLocation) { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); setIsSharingLocation(false); if (activeChatRoom) socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name }); }
  }, [activeTab, activeChatRoom]);

  const handleBookingSubmit = (e) => {
    e.preventDefault();
    fetch(`${backendUrl}/api/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }, body: JSON.stringify({ professionalId: bookingPro._id || bookingPro.id, professionalName: bookingPro.name, date: bookingData.date, time: bookingData.time, address: bookingData.address, totalPrice: bookingPro.price }) })
    .then(res => res.json()).then(() => setIsBookingSuccess(true));
  };
  const handleCancelBooking = async (id) => { if (!window.confirm("Cancel booking?")) return; const res = await fetch(`${backendUrl}/api/bookings/${id}/cancel`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }); if (res.ok) setMyBookings(prev => prev.map(b => b._id === id ? { ...b, status: 'cancelled' } : b)); };
  const openPrivateChat = async (booking) => { setActiveChatRoom(booking); setMessageList([]); setActiveTab('chat'); fetch(`${backendUrl}/api/chat/${booking._id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }).then(res => res.json()).then(data => setMessageList(data)); };
  const sendMessage = async () => { if (currentMessage && activeChatRoom) { const msg = { room: activeChatRoom._id, author: user.name, message: currentMessage, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }; await socket.emit('send_message', msg); setMessageList(list => [...list, msg]); setCurrentMessage(""); } };
  const toggleLocationSharing = () => { if (isSharingLocation) { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); setIsSharingLocation(false); socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name }); } else { if (navigator.geolocation) { watchIdRef.current = navigator.geolocation.watchPosition((pos) => { socket.emit('live_location_update', { room: activeChatRoom._id, lat: pos.coords.latitude, lng: pos.coords.longitude, author: user.name }); }, () => alert("GPS error."), { enableHighAccuracy: true }); setIsSharingLocation(true); } } };

  return (
    <div className="bg-bgLight w-full max-w-md mx-auto h-screen md:h-[850px] md:rounded-[2.5rem] md:shadow-2xl relative overflow-hidden md:border-8 md:border-gray-900 flex flex-col">
        <CallUI {...callLogic} />
        {activeTab === 'home' && (<div className="flex-1 overflow-y-auto px-6 pt-10 pb-28"><div className="mb-6"><p className="text-xs text-gray-500 font-medium">Hello, {user?.name?.split(' ')[0]} 👋</p><div className="flex items-center text-primary font-bold text-lg mt-1"><i className="fas fa-map-marker-alt text-teal-600 mr-2"></i>Kano, NG</div></div><div className="relative mb-8"><i className="fas fa-search absolute left-4 top-4 text-gray-400"></i><input type="text" placeholder="What service do you need?" className="w-full bg-white shadow-sm py-4 pl-12 pr-4 rounded-2xl text-sm outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div><h2 className="text-lg font-bold text-primary mb-4">Top Professionals</h2>{professionals.map(pro => (<div key={pro._id} onClick={() => setViewingProfile(pro)} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-4 cursor-pointer"><div className="flex items-center"><img src={pro.avatar} className="w-16 h-16 rounded-2xl mr-4 object-cover" /><div className="flex-1"><h3 className="font-bold text-primary">{pro.name}</h3><p className="text-xs text-gray-500 mt-1 line-clamp-1">{pro.headline || pro.title}</p><div className="mt-3 flex justify-between items-center"><span className="text-sm font-bold text-primary">₦{pro.price.toLocaleString()}</span><button onClick={(e) => { e.stopPropagation(); setBookingPro(pro); }} className="bg-teal-600 text-white text-xs px-4 py-2 rounded-xl font-bold">Book</button></div></div></div></div>))}</div>)}
        {activeTab === 'bookings' && (<div className="flex-1 overflow-y-auto px-6 pt-10 pb-28 bg-gray-50"><h2 className="text-2xl font-bold text-primary mb-6">My Bookings</h2>{myBookings.map(b => (<div key={b._id} className="bg-white p-5 rounded-3xl shadow-sm mb-4"><div className="flex justify-between mb-3"><h3 className="font-bold">{b.professionalName}</h3><span className="text-[10px] font-bold uppercase">{b.status}</span></div><div className="flex gap-2">{b.status === 'pending' && <button onClick={() => handleCancelBooking(b._id)} className="flex-1 py-2 bg-red-50 text-red-500 text-xs font-bold rounded-xl">Cancel</button>}<button onClick={() => openPrivateChat(b)} className="flex-1 py-2 bg-teal-50 text-teal-600 text-xs font-bold rounded-xl">Message Pro</button></div></div>))}</div>)}
        {activeTab === 'chat' && activeChatRoom && (<div className="flex-1 flex flex-col bg-gray-50 pb-20"><div className="px-6 pt-10 pb-4 bg-white border-b flex items-center justify-between"><div className="flex items-center"><button onClick={() => setActiveTab('bookings')} className="mr-4 text-gray-400"><i className="fas fa-chevron-left"></i></button><h2 className="text-lg font-bold">{activeChatRoom.professionalName}</h2></div><button onClick={callLogic.startCall} className="w-10 h-10 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center"><i className="fas fa-video"></i></button></div>{partnerLocation && (<div className="bg-blue-50 p-3 flex justify-between"><p className="text-xs text-blue-800 font-bold">{partnerLocation.author} is sharing location</p><button onClick={() => setViewingLiveMap(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs">View Map</button></div>)}<div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">{messageList.map((msg, idx) => (<div key={idx} className={`flex flex-col ${msg.author === user.name ? 'items-end' : 'items-start'}`}><div className={`px-4 py-3 rounded-2xl max-w-[80%] ${msg.author === user.name ? 'bg-teal-600 text-white' : 'bg-white'}`}><p className="text-sm">{msg.message}</p></div></div>))}<div ref={chatEndRef} /></div><div className="absolute bottom-[72px] w-full bg-white p-4 flex gap-2"><button onClick={toggleLocationSharing} className={`w-12 h-12 rounded-xl ${isSharingLocation ? 'bg-red-50 text-red-500' : 'bg-gray-100'}`}><i className="fas fa-map-marker-alt"></i></button><input type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage()} className="flex-1 bg-gray-100 p-3 rounded-xl text-sm outline-none" /><button onClick={sendMessage} className="bg-teal-600 text-white w-12 rounded-xl"><i className="fas fa-paper-plane"></i></button></div></div>)}
        {viewingLiveMap && partnerLocation && (<div className="absolute inset-0 bg-white z-50 flex flex-col"><div className="p-6 border-b"><button onClick={() => setViewingLiveMap(false)} className="h-10 w-10 rounded-full bg-gray-100"><i className="fas fa-times"></i></button></div><div className="flex-1"><MapContainer center={[partnerLocation.lat, partnerLocation.lng]} zoom={16} style={{ height: '100%', width: '100%', zIndex: 1 }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Marker position={[partnerLocation.lat, partnerLocation.lng]}><Popup>{partnerLocation.author}</Popup></Marker></MapContainer></div></div>)}
        
        {/* --- NEW: LINKEDIN-STYLE PROFESSIONAL PROFILE OVERLAY --- */}
        {viewingProfile && !bookingPro && (
             <div className="absolute inset-0 bg-gray-50 z-40 flex flex-col overflow-y-auto hide-scrollbar">
                 {/* Back Button */}
                 <div className="absolute top-6 left-6 z-50"><button onClick={() => setViewingProfile(null)} className="h-10 w-10 rounded-full bg-black/40 text-white backdrop-blur-md flex items-center justify-center hover:bg-black/60 transition"><i className="fas fa-arrow-left"></i></button></div>
                 
                 {/* 1. Banner & Photo */}
                 <div className="relative bg-white pb-6 shadow-sm border-b">
                     <div className="h-32 w-full bg-gray-200">
                         {viewingProfile.banner && <img src={viewingProfile.banner} className="w-full h-full object-cover" />}
                     </div>
                     <div className="px-6 relative">
                         <img src={viewingProfile.avatar} className="w-24 h-24 rounded-full border-4 border-white absolute -top-12 shadow-md object-cover" />
                         <div className="pt-14">
                             {/* 2. Headline & Core Info */}
                             <h1 className="text-2xl font-bold text-gray-900">{viewingProfile.name} {viewingProfile.verified && <i className="fas fa-check-circle text-teal-600 text-sm ml-1"></i>}</h1>
                             <p className="text-sm font-medium text-gray-800 mt-1">{viewingProfile.headline || viewingProfile.title}</p>
                             <p className="text-xs text-gray-500 mt-1"><i className="fas fa-map-marker-alt mr-1"></i> Kano, NG • <span className="font-bold text-teal-600">{viewingProfile.distance}</span></p>
                             <div className="flex items-center mt-3 gap-2">
                                 <span className="bg-green-50 text-green-700 font-bold px-3 py-1 rounded-lg text-xs">₦{viewingProfile.price.toLocaleString()}/hr</span>
                                 <span className="bg-orange-50 text-orange-600 font-bold px-3 py-1 rounded-lg text-xs"><i className="fas fa-star mr-1"></i>{viewingProfile.rating}</span>
                             </div>
                             <button onClick={() => setBookingPro(viewingProfile)} className="w-full bg-teal-600 text-white font-bold py-3.5 rounded-xl mt-5 shadow-md shadow-teal-600/20">Book Now</button>
                         </div>
                     </div>
                 </div>

                 <div className="p-4 flex flex-col gap-4">
                     {/* 3. About */}
                     <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                         <h2 className="text-sm font-bold text-gray-900 mb-2">About</h2>
                         <p className="text-sm text-gray-600 leading-relaxed">{viewingProfile.about}</p>
                     </div>

                     {/* 4. Experience */}
                     {viewingProfile.experience && viewingProfile.experience.length > 0 && (
                         <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                             <h2 className="text-sm font-bold text-gray-900 mb-4">Experience</h2>
                             {viewingProfile.experience.map((exp, i) => (
                                 <div key={i} className={`flex gap-4 ${i !== viewingProfile.experience.length - 1 ? 'mb-4 border-b pb-4' : ''}`}>
                                     <div className="w-10 h-10 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-400"><i className="fas fa-briefcase"></i></div>
                                     <div>
                                         <h3 className="font-bold text-sm">{exp.jobTitle}</h3>
                                         <p className="text-xs text-gray-600">{exp.company}</p>
                                         <p className="text-[10px] text-gray-400 mt-0.5">{exp.startDate} - {exp.endDate || 'Present'}</p>
                                         <p className="text-xs text-gray-500 mt-2">{exp.description}</p>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     )}

                     {/* 5. Skills */}
                     {viewingProfile.skills && viewingProfile.skills.length > 0 && (
                         <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                             <h2 className="text-sm font-bold text-gray-900 mb-3">Skills & Endorsements</h2>
                             <div className="flex flex-wrap gap-2">
                                 {viewingProfile.skills.map((skill, i) => (
                                     <span key={i} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200">{skill}</span>
                                 ))}
                             </div>
                         </div>
                     )}

                     {/* 8. Featured Projects */}
                     {viewingProfile.projects && viewingProfile.projects.length > 0 && (
                         <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                             <h2 className="text-sm font-bold text-gray-900 mb-4">Featured Projects</h2>
                             <div className="flex overflow-x-auto gap-4 hide-scrollbar pb-2">
                                 {viewingProfile.projects.map((proj, i) => (
                                     <div key={i} className="min-w-[200px] w-48 bg-gray-50 border border-gray-200 p-4 rounded-xl flex-shrink-0">
                                         <h3 className="font-bold text-sm text-gray-900 line-clamp-1">{proj.title}</h3>
                                         <p className="text-xs text-gray-500 mt-1 line-clamp-2 h-8">{proj.description}</p>
                                         {proj.link && <a href={proj.link} target="_blank" rel="noreferrer" className="text-[10px] text-teal-600 font-bold mt-3 inline-block bg-teal-50 px-2 py-1 rounded">View Project</a>}
                                     </div>
                                 ))}
                             </div>
                         </div>
                     )}

                     {/* 11. Contact & Socials */}
                     {viewingProfile.contactInfo && Object.values(viewingProfile.contactInfo).some(v => v) && (
                         <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-20">
                             <h2 className="text-sm font-bold text-gray-900 mb-3">Contact Info</h2>
                             <div className="grid grid-cols-2 gap-3">
                                 {viewingProfile.contactInfo.portfolio && <a href={viewingProfile.contactInfo.portfolio} target="_blank" rel="noreferrer" className="flex items-center text-xs text-gray-600 bg-gray-50 p-2 rounded-lg"><i className="fas fa-globe text-gray-400 w-5"></i> Portfolio</a>}
                                 {viewingProfile.contactInfo.github && <a href={viewingProfile.contactInfo.github} target="_blank" rel="noreferrer" className="flex items-center text-xs text-gray-600 bg-gray-50 p-2 rounded-lg"><i className="fab fa-github text-gray-400 w-5"></i> GitHub</a>}
                                 {viewingProfile.contactInfo.linkedin && <a href={viewingProfile.contactInfo.linkedin} target="_blank" rel="noreferrer" className="flex items-center text-xs text-gray-600 bg-gray-50 p-2 rounded-lg"><i className="fab fa-linkedin text-blue-600 w-5"></i> LinkedIn</a>}
                             </div>
                         </div>
                     )}
                 </div>
                 <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
             </div>
        )}

        {/* BOOKING OVERLAY */}
        {bookingPro && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col">
                <div className="flex justify-between items-center p-6 border-b"><h2 className="font-bold text-xl">Book {bookingPro.name.split(' ')[0]}</h2><button onClick={() => { setBookingPro(null); setIsBookingSuccess(false); }} className="bg-gray-100 h-10 w-10 rounded-full"><i className="fas fa-times"></i></button></div>
                {isBookingSuccess ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6"><div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center text-4xl mb-4"><i className="fas fa-check"></i></div><h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2><p className="text-gray-500 mb-8 text-center">Your request has been sent.</p><button onClick={() => { setBookingPro(null); setIsBookingSuccess(false); setActiveTab('bookings'); }} className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl shadow-lg">View Bookings</button></div>
                ) : (
                    <form onSubmit={handleBookingSubmit} className="flex-1 p-6 flex flex-col overflow-y-auto"><label className="text-xs font-bold text-gray-500 mb-1 ml-1">Select Date</label><input type="date" required className="w-full bg-gray-50 p-4 rounded-xl mb-6 outline-none" value={bookingData.date} onChange={e => setBookingData({...bookingData, date: e.target.value})} /><label className="text-xs font-bold text-gray-500 mb-1 ml-1">Select Time</label><div className="grid grid-cols-3 gap-3 mb-6">{['10:00 AM', '1:00 PM', '4:00 PM'].map(time => <div key={time} onClick={() => setBookingData({...bookingData, time})} className={`text-center py-3 rounded-xl text-sm font-medium cursor-pointer transition ${bookingData.time === time ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>{time}</div>)}</div><label className="text-xs font-bold text-gray-500 mb-1 ml-1">Service Address</label><textarea required className="w-full bg-gray-50 p-4 rounded-xl mb-6 h-28 outline-none" value={bookingData.address} onChange={e => setBookingData({...bookingData, address: e.target.value})} placeholder="E.g. Zoo Road, Kano"></textarea><div className="bg-gray-50 p-4 rounded-xl mb-6 flex justify-between items-center"><span className="text-sm font-bold text-gray-600">Total Price</span><span className="text-lg font-bold text-teal-600">₦{bookingPro.price.toLocaleString()}</span></div><button type="submit" className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl mt-auto shadow-lg shadow-teal-600/30">Confirm Booking</button></form>
                )}
            </div>
        )}

        {activeTab === 'profile' && (<div className="flex-1 p-6 pt-10 text-center"><button onClick={logout} className="bg-red-50 text-red-500 py-3 mt-6 rounded-xl w-full">Log Out</button></div>)}
        <div className="absolute bottom-0 w-full bg-white border-t px-6 py-4 flex justify-between z-20">{['home', 'bookings', 'chat', 'profile'].map((tab, idx) => (<div key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center cursor-pointer ${activeTab === tab ? 'text-teal-600' : 'text-gray-400'}`}><i className={`fas ${['fa-home', 'fa-calendar-alt', 'fa-comment-dots', 'fa-user'][idx]} text-xl mb-1`}></i></div>))}</div>
    </div>
  );
};

// ==========================================
// PROFESSIONAL DASHBOARD (WITH PORTFOLIO EDITOR)
// ==========================================
const ProfessionalApp = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('jobs');
    const [jobs, setJobs] = useState([]);
    const [activeChatRoom, setActiveChatRoom] = useState(null);
    const [messageList, setMessageList] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const chatEndRef = useRef(null);
    const [viewingMapForJob, setViewingMapForJob] = useState(null);
    const [mapPosition, setMapPosition] = useState([11.9964, 8.5167]); 
    const [isSharingLocation, setIsSharingLocation] = useState(false);
    const [partnerLocation, setPartnerLocation] = useState(null);
    const [viewingLiveMap, setViewingLiveMap] = useState(false);
    const watchIdRef = useRef(null);
    const callLogic = useVideoCall(socket, activeChatRoom, user);

    // PROFILE EDIT STATE
    const [myProfile, setMyProfile] = useState(null);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetch(`${backendUrl}/api/pro/bookings`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }).then(res => res.json()).then(data => setJobs(data));
        // Fetch My Profile Data
        fetch(`${backendUrl}/api/professionals`).then(res => res.json()).then(data => { const me = data.find(p => p.userId === user.id); if(me) { setMyProfile(me); setEditForm(me); } });
        
        socket.on('receive_message', (data) => setMessageList((list) => [...list, data]));
        socket.on('receive_live_location', (data) => { if (data.lat === null) setPartnerLocation(null); else setPartnerLocation({ lat: data.lat, lng: data.lng, author: data.author }); });
        return () => { socket.off('receive_message'); socket.off('receive_live_location'); if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
    }, []);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messageList]);
    useEffect(() => { if (activeTab !== 'chat' && isSharingLocation) { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); setIsSharingLocation(false); if (activeChatRoom) socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name }); } }, [activeTab, activeChatRoom]);

    const openChat = async (job) => { setActiveChatRoom(job); setMessageList([]); setActiveTab('chat'); socket.emit('join_room', job._id); fetch(`${backendUrl}/api/chat/${job._id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }).then(res => res.json()).then(data => setMessageList(data)); };
    const sendMessage = async () => { if (currentMessage && activeChatRoom) { const msgData = { room: activeChatRoom._id, author: user.name, message: currentMessage, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }; await socket.emit('send_message', msgData); setMessageList(list => [...list, msgData]); setCurrentMessage(""); } };
    const updateJobStatus = async (id, status) => { const res = await fetch(`${backendUrl}/api/admin/bookings/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }, body: JSON.stringify({ status }) }); if (res.ok) setJobs(prev => prev.map(j => j._id === id ? { ...j, status } : j)); };
    const handleViewMap = async (job) => { setViewingMapForJob(job); try { const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(job.address)}`); const data = await res.json(); if (data.length > 0) setMapPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)]); } catch (err) {} };
    const toggleLocationSharing = () => { if (isSharingLocation) { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); setIsSharingLocation(false); socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name }); } else { if (navigator.geolocation) { watchIdRef.current = navigator.geolocation.watchPosition((pos) => { socket.emit('live_location_update', { room: activeChatRoom._id, lat: pos.coords.latitude, lng: pos.coords.longitude, author: user.name }); }, () => {}, { enableHighAccuracy: true }); setIsSharingLocation(true); } } };

    const handleSaveProfile = async (e) => {
        e.preventDefault(); setIsSaving(true);
        try {
            const res = await fetch(`${backendUrl}/api/pro/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }, body: JSON.stringify(editForm) });
            const data = await res.json();
            setMyProfile(data); setIsEditingProfile(false);
        } catch(err) { alert("Failed to save"); } finally { setIsSaving(false); }
    };

    return (
        <div className="bg-gray-900 w-full max-w-md mx-auto h-screen md:h-[850px] relative flex flex-col text-white md:rounded-[2.5rem] md:shadow-2xl overflow-hidden">
            <CallUI {...callLogic} />
            {activeTab === 'jobs' && (<div className="flex-1 overflow-y-auto px-6 pt-10 pb-28"><h2 className="text-2xl font-bold mb-6">My Jobs</h2>{jobs.map(job => (<div key={job._id} className="bg-gray-800 p-5 rounded-2xl mb-4"><div className="flex justify-between mb-3 border-b border-gray-700 pb-3"><h3 className="font-bold">{job.clientName}</h3><div className="px-2 py-1 rounded bg-gray-700 text-[10px] uppercase font-bold">{job.status}</div></div><button onClick={() => handleViewMap(job)} className="bg-gray-700 text-teal-400 px-3 py-1 rounded text-xs mb-4 font-bold shadow-sm">View Map</button><div className="flex gap-2"><button onClick={() => openChat(job)} className="flex-1 py-2 bg-gray-700 text-xs font-bold rounded-lg">Chat</button>{job.status === 'pending' && <button onClick={() => updateJobStatus(job._id, 'confirmed')} className="flex-1 py-2 bg-teal-600 text-xs font-bold rounded-lg">Accept</button>}{job.status === 'confirmed' && <button onClick={() => updateJobStatus(job._id, 'completed')} className="flex-1 py-2 bg-blue-600 text-xs font-bold rounded-lg">Complete</button>}</div></div>))}</div>)}
            
            {/* PORTFOLIO TAB */}
            {activeTab === 'profile' && !isEditingProfile && (
                <div className="flex-1 overflow-y-auto px-6 pt-10 pb-28">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">My Portfolio</h2>
                        <button onClick={() => setIsEditingProfile(true)} className="bg-teal-600/20 text-teal-400 px-4 py-2 rounded-xl text-xs font-bold">Edit Profile</button>
                    </div>
                    {myProfile ? (
                        <div className="bg-gray-800 rounded-3xl overflow-hidden border border-gray-700 shadow-lg">
                            <div className="h-24 w-full bg-gray-700 relative">{myProfile.banner && <img src={myProfile.banner} className="w-full h-full object-cover opacity-80" />}</div>
                            <div className="px-5 pb-5 relative">
                                <img src={myProfile.avatar} className="w-20 h-20 rounded-full border-4 border-gray-800 absolute -top-10 object-cover" />
                                <div className="pt-12">
                                    <h3 className="text-lg font-bold">{myProfile.name}</h3>
                                    <p className="text-sm text-teal-400 font-medium mb-3">{myProfile.headline}</p>
                                    <div className="bg-gray-900 p-3 rounded-xl text-xs text-gray-300 leading-relaxed mb-4 border border-gray-700">{myProfile.about}</div>
                                    {myProfile.skills && myProfile.skills.length > 0 && (
                                        <div className="mb-4"><h4 className="text-xs font-bold text-gray-400 mb-2 uppercase">Skills</h4><div className="flex flex-wrap gap-2">{myProfile.skills.map((s, i) => <span key={i} className="bg-gray-700 text-gray-200 px-2 py-1 rounded-md text-[10px]">{s}</span>)}</div></div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : <p className="text-center text-gray-500 mt-10">Loading profile...</p>}
                    <button onClick={logout} className="w-full bg-red-500/10 border border-red-500/20 text-red-400 py-4 rounded-2xl mt-6 font-bold shadow-sm">Log Out</button>
                </div>
            )}

            {/* EDIT PORTFOLIO SCREEN */}
            {activeTab === 'profile' && isEditingProfile && (
                <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto px-6 py-6 pb-28 bg-gray-900 relative z-30">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold">Edit Portfolio</h2>
                        <button type="button" onClick={() => { setIsEditingProfile(false); setEditForm(myProfile); }} className="text-gray-400"><i className="fas fa-times"></i></button>
                    </div>
                    
                    <div className="space-y-5">
                        <div><label className="text-xs font-bold text-gray-400 mb-1 block">Headline (Your Value Proposition)</label><input type="text" value={editForm.headline || ''} onChange={e => setEditForm({...editForm, headline: e.target.value})} className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm text-white outline-none focus:border-teal-500" placeholder="e.g. Cloud Engineer | AWS" /></div>
                        <div><label className="text-xs font-bold text-gray-400 mb-1 block">About Me (Elevator Pitch)</label><textarea value={editForm.about || ''} onChange={e => setEditForm({...editForm, about: e.target.value})} className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm text-white h-24 outline-none focus:border-teal-500" placeholder="A short pitch about who you are and what you do..."></textarea></div>
                        <div><label className="text-xs font-bold text-gray-400 mb-1 block">Skills (Comma separated)</label><input type="text" value={editForm.skills ? editForm.skills.join(', ') : ''} onChange={e => setEditForm({...editForm, skills: e.target.value.split(',').map(s=>s.trim()).filter(s=>s)})} className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm text-white outline-none focus:border-teal-500" placeholder="AWS, Node.js, Cybersecurity" /></div>
                        <div><label className="text-xs font-bold text-gray-400 mb-1 block">GitHub Link</label><input type="text" value={editForm.contactInfo?.github || ''} onChange={e => setEditForm({...editForm, contactInfo: {...(editForm.contactInfo||{}), github: e.target.value}})} className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm text-white outline-none focus:border-teal-500" placeholder="https://github.com/yourname" /></div>
                        <div><label className="text-xs font-bold text-gray-400 mb-1 block">LinkedIn Link</label><input type="text" value={editForm.contactInfo?.linkedin || ''} onChange={e => setEditForm({...editForm, contactInfo: {...(editForm.contactInfo||{}), linkedin: e.target.value}})} className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm text-white outline-none focus:border-teal-500" placeholder="https://linkedin.com/in/yourname" /></div>
                    </div>
                    <button type="submit" disabled={isSaving} className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl mt-8 shadow-lg shadow-teal-600/20">{isSaving ? 'Saving...' : 'Save Portfolio'}</button>
                </form>
            )}

            {activeTab === 'chat' && activeChatRoom && (<div className="flex-1 flex flex-col pb-20 z-30"><div className="px-6 pt-10 pb-4 border-b border-gray-800 flex items-center justify-between"><div className="flex items-center"><button onClick={() => setActiveTab('jobs')} className="mr-4 text-gray-400"><i className="fas fa-chevron-left"></i></button><h2 className="text-lg font-bold">{activeChatRoom.clientName}</h2></div><button onClick={callLogic.startCall} className="w-10 h-10 bg-teal-600/20 text-teal-400 rounded-full flex items-center justify-center"><i className="fas fa-video"></i></button></div>{partnerLocation && (<div className="bg-gray-800 p-3 flex justify-between"><p className="text-xs text-teal-400 font-bold">{partnerLocation.author} is sharing location</p><button onClick={() => setViewingLiveMap(true)} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs">View Map</button></div>)}<div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">{messageList.map((msg, idx) => (<div key={idx} className={`flex flex-col ${msg.author === user.name ? 'items-end' : 'items-start'}`}><div className={`px-4 py-3 rounded-2xl max-w-[80%] ${msg.author === user.name ? 'bg-teal-600' : 'bg-gray-800'}`}><p className="text-sm">{msg.message}</p></div></div>))}<div ref={chatEndRef} /></div><div className="absolute bottom-[72px] w-full p-4 border-t border-gray-800 bg-gray-900 flex gap-2"><button onClick={toggleLocationSharing} className={`w-12 h-12 rounded-xl ${isSharingLocation ? 'bg-red-500/20 text-red-400' : 'bg-gray-800'}`}><i className="fas fa-map-marker-alt"></i></button><input type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage()} className="flex-1 bg-gray-800 p-3 rounded-xl text-sm outline-none text-white" /><button onClick={sendMessage} className="bg-teal-600 w-12 rounded-xl"><i className="fas fa-paper-plane"></i></button></div></div>)}
            {viewingLiveMap && partnerLocation && (<div className="absolute inset-0 bg-gray-900 z-50 flex flex-col"><div className="p-6 border-b border-gray-800"><button onClick={() => setViewingLiveMap(false)} className="h-10 w-10 rounded-full bg-gray-800"><i className="fas fa-times"></i></button></div><div className="flex-1 w-full bg-gray-800"><MapContainer center={[partnerLocation.lat, partnerLocation.lng]} zoom={16} style={{ height: '100%', width: '100%', zIndex: 1 }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Marker position={[partnerLocation.lat, partnerLocation.lng]}><Popup>{partnerLocation.author}</Popup></Marker></MapContainer></div></div>)}
            {viewingMapForJob && (<div className="absolute inset-0 bg-gray-900 z-50 flex flex-col"><div className="p-6 border-b border-gray-800"><button onClick={() => setViewingMapForJob(null)} className="h-10 w-10 rounded-full bg-gray-800"><i className="fas fa-times"></i></button></div><div className="flex-1 w-full bg-gray-800"><MapContainer key={`${mapPosition[0]}`} center={mapPosition} zoom={15} style={{ height: '100%', width: '100%', zIndex: 1 }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Marker position={mapPosition}></Marker></MapContainer></div></div>)}
            
            <div className="absolute bottom-0 w-full border-t border-gray-800 px-6 py-4 flex justify-between bg-gray-900 z-40">{['jobs', 'chat', 'profile'].map((tab, idx) => (<div key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center cursor-pointer ${activeTab === tab ? 'text-teal-400' : 'text-gray-600'}`}><i className={`fas ${['fa-briefcase', 'fa-comment-dots', 'fa-user'][idx]} text-xl mb-1`}></i></div>))}</div>
        </div>
    );
};

const AppController = () => { const { user, loading } = useAuth(); useEffect(() => { if (user) socket.emit('register_user', user.id); }, [user]); if (loading) return <div></div>; if (!user) return <AuthScreen />; if (user.role === 'professional') return <ProfessionalApp />; return <ClientApp />; };
const App = () => ( <AuthProvider><AppController /></AuthProvider> );
export default App;