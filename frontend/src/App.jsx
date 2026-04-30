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
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnection = useRef(null);
    const localStream = useRef(null);

    useEffect(() => {
        if (!socket) return;
        const handleIncoming = (data) => setCallState({ status: 'receiving', offer: data.offer, callerName: data.callerName, room: data.room });
        const handleAccepted = async (data) => {
            if(peerConnection.current) {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                setCallState(prev => ({ ...prev, status: 'connected' }));
            }
        };
        const handleIce = async (data) => {
            if(peerConnection.current && data.candidate) {
                try { await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch(e){}
            }
        };
        const handleEnded = () => endCall(false);

        socket.on('incoming_call', handleIncoming);
        socket.on('call_accepted', handleAccepted);
        socket.on('ice_candidate', handleIce);
        socket.on('call_ended', handleEnded);

        return () => {
            socket.off('incoming_call', handleIncoming);
            socket.off('call_accepted', handleAccepted);
            socket.off('ice_candidate', handleIce);
            socket.off('call_ended', handleEnded);
        }
    }, [socket, activeChatRoom]);

    const setupMediaAndPeer = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.current = stream;
        if(localVideoRef.current) localVideoRef.current.srcObject = stream;

        peerConnection.current = new RTCPeerConnection(rtcConfig);
        stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

        peerConnection.current.onicecandidate = (e) => {
            const room = activeChatRoom ? activeChatRoom._id : callState.room;
            if(e.candidate && room) socket.emit('ice_candidate', { room, candidate: e.candidate });
        };
        peerConnection.current.ontrack = (e) => {
            if(remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
        };
    };

    const startCall = async () => {
        if(!activeChatRoom) return;
        setCallState({ status: 'calling', room: activeChatRoom._id });
        await setupMediaAndPeer();
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit('call_user', { room: activeChatRoom._id, offer, callerName: user.name });
    };

    const acceptCall = async () => {
        await setupMediaAndPeer();
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(callState.offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit('accept_call', { room: callState.room, answer });
        setCallState(prev => ({ ...prev, status: 'connected' }));
    };

    const endCall = (emit = true) => {
        const room = activeChatRoom ? activeChatRoom._id : callState.room;
        if(emit && room) socket.emit('end_call', { room });
        if(localStream.current) localStream.current.getTracks().forEach(t => t.stop());
        if(peerConnection.current) peerConnection.current.close();
        peerConnection.current = null;
        setCallState({ status: 'idle', offer: null, callerName: null, room: null });
    };

    useEffect(() => {
        if(localVideoRef.current && localStream.current) localVideoRef.current.srcObject = localStream.current;
    }, [callState.status]);

    return { callState, localVideoRef, remoteVideoRef, startCall, acceptCall, endCall };
};

const CallUI = ({ callState, localVideoRef, remoteVideoRef, acceptCall, endCall }) => {
    if(callState.status === 'idle') return null;
    return (
        <div className="absolute inset-0 bg-gray-900 z-[100] flex flex-col animate-[slideUp_0.3s_ease-out]">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover bg-gray-900" />
            
            {(callState.status === 'calling' || callState.status === 'connected') && (
                <div className="absolute top-6 right-6 w-24 h-36 bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
            )}

            {callState.status === 'receiving' && (
                <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
                    <div className="w-24 h-24 bg-teal-500 rounded-full animate-bounce flex items-center justify-center text-4xl text-white mb-6 shadow-lg shadow-teal-500/50"><i className="fas fa-video"></i></div>
                    <h2 className="text-2xl font-bold text-white mb-2">{callState.callerName} is calling...</h2>
                    <p className="text-gray-400 mb-12">Incoming Video Call</p>
                    <div className="flex gap-8">
                        <button onClick={() => endCall(true)} className="w-16 h-16 bg-red-500 rounded-full text-white text-xl shadow-lg"><i className="fas fa-times"></i></button>
                        <button onClick={acceptCall} className="w-16 h-16 bg-green-500 rounded-full text-white text-xl shadow-lg animate-pulse"><i className="fas fa-video"></i></button>
                    </div>
                </div>
            )}

            {callState.status === 'calling' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none bg-gray-900/50">
                    <h2 className="text-2xl font-bold text-white mb-2">Calling...</h2>
                    <p className="text-gray-300">Waiting for answer</p>
                </div>
            )}

            {(callState.status === 'calling' || callState.status === 'connected') && (
                <div className="absolute bottom-10 left-0 w-full flex justify-center">
                    <button onClick={() => endCall(true)} className="w-16 h-16 bg-red-500 rounded-full text-white text-2xl shadow-lg hover:bg-red-600 transition shadow-red-500/30"><i className="fas fa-phone-slash"></i></button>
                </div>
            )}
        </div>
    );
};

// ==========================================
// AUTHENTICATION SCREEN
// ==========================================
const AuthScreen = () => {
    // ... (Minified for space)
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
              <><div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Job Title</label><input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" /></div><div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Category</label><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm"><option value="cleaning">Cleaning</option><option value="electric">Electric</option><option value="plumbing">Plumbing</option><option value="ac">AC Repair</option></select></div><div className="mb-6"><label className="text-xs font-bold text-gray-500 ml-1">Hourly Rate (₦)</label><input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" /></div></>
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
  const [selectedCategory, setSelectedCategory] = useState(null);
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

  // VIDEO CALL HOOK
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
  const handleCancelBooking = async (id) => {
    if (!window.confirm("Cancel this booking?")) return;
    const res = await fetch(`${backendUrl}/api/bookings/${id}/cancel`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } });
    if (res.ok) setMyBookings(prev => prev.map(b => b._id === id ? { ...b, status: 'cancelled' } : b));
  };
  const openPrivateChat = async (booking) => { setActiveChatRoom(booking); setMessageList([]); setActiveTab('chat'); fetch(`${backendUrl}/api/chat/${booking._id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }).then(res => res.json()).then(data => setMessageList(data)); };
  const sendMessage = async () => { if (currentMessage && activeChatRoom) { const msg = { room: activeChatRoom._id, author: user.name, message: currentMessage, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }; await socket.emit('send_message', msg); setMessageList(list => [...list, msg]); setCurrentMessage(""); } };
  const toggleLocationSharing = () => { if (isSharingLocation) { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); setIsSharingLocation(false); socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name }); } else { if (navigator.geolocation) { watchIdRef.current = navigator.geolocation.watchPosition((pos) => { socket.emit('live_location_update', { room: activeChatRoom._id, lat: pos.coords.latitude, lng: pos.coords.longitude, author: user.name }); }, () => alert("GPS error."), { enableHighAccuracy: true }); setIsSharingLocation(true); } } };

  return (
    <div className="bg-bgLight w-full max-w-md mx-auto h-screen md:h-[850px] md:rounded-[2.5rem] md:shadow-2xl relative overflow-hidden md:border-8 md:border-gray-900 flex flex-col">
        <CallUI {...callLogic} />
        {/* Same UI code as before... minified for clarity */}
        {activeTab === 'home' && (<div className="flex-1 overflow-y-auto px-6 pt-10 pb-28"><h2 className="text-lg font-bold text-primary mb-4">Top Rated Near You</h2>{professionals.map(pro => (<div key={pro._id} onClick={() => setViewingProfile(pro)} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-4 cursor-pointer"><div className="flex items-center"><img src={pro.avatar} className="w-16 h-16 rounded-2xl mr-4" /><div className="flex-1"><h3 className="font-bold text-primary">{pro.name}</h3><p className="text-xs text-gray-500 mt-1">{pro.title}</p><div className="mt-3 flex justify-between items-center"><span className="text-sm font-bold text-primary">₦{pro.price}</span><button onClick={(e) => { e.stopPropagation(); setBookingPro(pro); }} className="bg-primary text-white text-xs px-4 py-2 rounded-xl">Book</button></div></div></div></div>))}</div>)}
        {activeTab === 'bookings' && (<div className="flex-1 overflow-y-auto px-6 pt-10 pb-28 bg-gray-50"><h2 className="text-2xl font-bold text-primary mb-6">My Bookings</h2>{myBookings.map(b => (<div key={b._id} className="bg-white p-5 rounded-3xl shadow-sm mb-4"><div className="flex justify-between mb-3"><h3 className="font-bold">{b.professionalName}</h3><span className="text-[10px] font-bold uppercase">{b.status}</span></div><div className="flex gap-2">{b.status === 'pending' && <button onClick={() => handleCancelBooking(b._id)} className="flex-1 py-2 bg-red-50 text-red-500 text-xs font-bold rounded-xl">Cancel</button>}<button onClick={() => openPrivateChat(b)} className="flex-1 py-2 bg-teal-50 text-teal-600 text-xs font-bold rounded-xl">Message Pro</button></div></div>))}</div>)}
        {activeTab === 'chat' && activeChatRoom && (
            <div className="flex-1 flex flex-col bg-gray-50 pb-20">
                <div className="px-6 pt-10 pb-4 bg-white border-b flex items-center justify-between">
                    <div className="flex items-center"><button onClick={() => setActiveTab('bookings')} className="mr-4 text-gray-400"><i className="fas fa-chevron-left"></i></button><h2 className="text-lg font-bold">{activeChatRoom.professionalName}</h2></div>
                    {/* VIDEO CALL BUTTON */}
                    <button onClick={callLogic.startCall} className="w-10 h-10 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center hover:bg-teal-100 transition"><i className="fas fa-video"></i></button>
                </div>
                {partnerLocation && (<div className="bg-blue-50 p-3 flex justify-between"><p className="text-xs text-blue-800 font-bold">{partnerLocation.author} is sharing location</p><button onClick={() => setViewingLiveMap(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs">View Map</button></div>)}
                <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">{messageList.map((msg, idx) => (<div key={idx} className={`flex flex-col ${msg.author === user.name ? 'items-end' : 'items-start'}`}><div className={`px-4 py-3 rounded-2xl max-w-[80%] ${msg.author === user.name ? 'bg-teal-600 text-white' : 'bg-white'}`}><p className="text-sm">{msg.message}</p></div></div>))}<div ref={chatEndRef} /></div>
                <div className="absolute bottom-[72px] w-full bg-white p-4 flex gap-2"><button onClick={toggleLocationSharing} className={`w-12 h-12 rounded-xl ${isSharingLocation ? 'bg-red-50 text-red-500' : 'bg-gray-100'}`}><i className="fas fa-map-marker-alt"></i></button><input type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage()} className="flex-1 bg-gray-100 p-3 rounded-xl text-sm outline-none" /><button onClick={sendMessage} className="bg-teal-600 text-white w-12 rounded-xl"><i className="fas fa-paper-plane"></i></button></div>
            </div>
        )}
        {viewingLiveMap && partnerLocation && (<div className="absolute inset-0 bg-white z-50 flex flex-col"><div className="p-6 border-b"><button onClick={() => setViewingLiveMap(false)} className="h-10 w-10 rounded-full bg-gray-100"><i className="fas fa-times"></i></button></div><div className="flex-1"><MapContainer center={[partnerLocation.lat, partnerLocation.lng]} zoom={16} style={{ height: '100%', width: '100%', zIndex: 1 }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Marker position={[partnerLocation.lat, partnerLocation.lng]}><Popup>{partnerLocation.author}</Popup></Marker></MapContainer></div></div>)}
        {activeTab === 'profile' && (<div className="flex-1 p-6 pt-10 text-center"><button onClick={logout} className="bg-red-50 text-red-500 py-3 mt-6 rounded-xl w-full">Log Out</button></div>)}
        <div className="absolute bottom-0 w-full bg-white border-t px-6 py-4 flex justify-between z-20">{['home', 'bookings', 'chat', 'profile'].map((tab, idx) => (<div key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center cursor-pointer ${activeTab === tab ? 'text-teal-600' : 'text-gray-400'}`}><i className={`fas ${['fa-home', 'fa-calendar-alt', 'fa-comment-dots', 'fa-user'][idx]} text-xl mb-1`}></i></div>))}</div>
    </div>
  );
};

// ==========================================
// PROFESSIONAL DASHBOARD
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

    // VIDEO CALL HOOK
    const callLogic = useVideoCall(socket, activeChatRoom, user);

    useEffect(() => {
        fetch(`${backendUrl}/api/pro/bookings`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }).then(res => res.json()).then(data => setJobs(data));
        socket.on('receive_message', (data) => setMessageList((list) => [...list, data]));
        socket.on('receive_live_location', (data) => { if (data.lat === null) setPartnerLocation(null); else setPartnerLocation({ lat: data.lat, lng: data.lng, author: data.author }); });
        return () => { socket.off('receive_message'); socket.off('receive_live_location'); if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
    }, []);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messageList]);
    useEffect(() => { if (activeTab !== 'chat' && isSharingLocation) { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); setIsSharingLocation(false); if (activeChatRoom) socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name }); } }, [activeTab, activeChatRoom]);

    const openChat = async (job) => { setActiveChatRoom(job); setMessageList([]); setActiveTab('chat'); socket.emit('join_room', job._id); fetch(`${backendUrl}/api/chat/${job._id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }).then(res => res.json()).then(data => setMessageList(data)); };
    const sendMessage = async () => { if (currentMessage && activeChatRoom) { const msgData = { room: activeChatRoom._id, author: user.name, message: currentMessage, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }; await socket.emit('send_message', msgData); setMessageList(list => [...list, msgData]); setCurrentMessage(""); } };
    const handleViewMap = async (job) => { setViewingMapForJob(job); try { const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(job.address)}`); const data = await res.json(); if (data.length > 0) setMapPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)]); } catch (err) {} };
    const toggleLocationSharing = () => { if (isSharingLocation) { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); setIsSharingLocation(false); socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name }); } else { if (navigator.geolocation) { watchIdRef.current = navigator.geolocation.watchPosition((pos) => { socket.emit('live_location_update', { room: activeChatRoom._id, lat: pos.coords.latitude, lng: pos.coords.longitude, author: user.name }); }, () => alert("GPS Error"), { enableHighAccuracy: true }); setIsSharingLocation(true); } } };

    return (
        <div className="bg-gray-900 w-full max-w-md mx-auto h-screen md:h-[850px] relative flex flex-col text-white md:rounded-[2.5rem] md:shadow-2xl">
            <CallUI {...callLogic} />
            {activeTab === 'jobs' && (<div className="flex-1 overflow-y-auto px-6 pt-10 pb-28"><h2 className="text-2xl font-bold mb-6">My Jobs</h2>{jobs.map(job => (<div key={job._id} className="bg-gray-800 p-5 rounded-2xl mb-4"><div className="flex justify-between mb-3 border-b border-gray-700 pb-3"><h3 className="font-bold">{job.clientName}</h3><div className="px-2 py-1 rounded bg-gray-700">{job.status}</div></div><button onClick={() => handleViewMap(job)} className="bg-gray-700 text-teal-400 px-3 py-1 rounded text-xs mb-4">View Map</button><div className="flex gap-2"><button onClick={() => openChat(job)} className="flex-1 py-2 bg-gray-700 text-xs font-bold rounded-lg">Chat</button></div></div>))}</div>)}
            {activeTab === 'chat' && activeChatRoom && (
                <div className="flex-1 flex flex-col pb-20 z-30">
                    <div className="px-6 pt-10 pb-4 border-b border-gray-800 flex items-center justify-between">
                        <div className="flex items-center"><button onClick={() => setActiveTab('jobs')} className="mr-4 text-gray-400"><i className="fas fa-chevron-left"></i></button><h2 className="text-lg font-bold">{activeChatRoom.clientName}</h2></div>
                        {/* VIDEO CALL BUTTON */}
                        <button onClick={callLogic.startCall} className="w-10 h-10 bg-teal-600/20 text-teal-400 rounded-full flex items-center justify-center hover:bg-teal-600/40 transition"><i className="fas fa-video"></i></button>
                    </div>
                    {partnerLocation && (<div className="bg-gray-800 p-3 flex justify-between"><p className="text-xs text-teal-400 font-bold">{partnerLocation.author} is sharing location</p><button onClick={() => setViewingLiveMap(true)} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs">View Map</button></div>)}
                    <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">{messageList.map((msg, idx) => (<div key={idx} className={`flex flex-col ${msg.author === user.name ? 'items-end' : 'items-start'}`}><div className={`px-4 py-3 rounded-2xl max-w-[80%] ${msg.author === user.name ? 'bg-teal-600' : 'bg-gray-800'}`}><p className="text-sm">{msg.message}</p></div></div>))}<div ref={chatEndRef} /></div>
                    <div className="absolute bottom-[72px] w-full p-4 border-t border-gray-800 bg-gray-900 flex gap-2"><button onClick={toggleLocationSharing} className={`w-12 h-12 rounded-xl ${isSharingLocation ? 'bg-red-500/20 text-red-400' : 'bg-gray-800'}`}><i className="fas fa-map-marker-alt"></i></button><input type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage()} className="flex-1 bg-gray-800 p-3 rounded-xl text-sm outline-none" /><button onClick={sendMessage} className="bg-teal-600 w-12 rounded-xl"><i className="fas fa-paper-plane"></i></button></div>
                </div>
            )}
            {viewingLiveMap && partnerLocation && (<div className="absolute inset-0 bg-gray-900 z-50 flex flex-col"><div className="p-6 border-b border-gray-800"><button onClick={() => setViewingLiveMap(false)} className="h-10 w-10 rounded-full bg-gray-800"><i className="fas fa-times"></i></button></div><div className="flex-1 w-full bg-gray-800"><MapContainer center={[partnerLocation.lat, partnerLocation.lng]} zoom={16} style={{ height: '100%', width: '100%', zIndex: 1 }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Marker position={[partnerLocation.lat, partnerLocation.lng]}><Popup>{partnerLocation.author}</Popup></Marker></MapContainer></div></div>)}
            {viewingMapForJob && (<div className="absolute inset-0 bg-gray-900 z-50 flex flex-col"><div className="p-6 border-b border-gray-800"><button onClick={() => setViewingMapForJob(null)} className="h-10 w-10 rounded-full bg-gray-800"><i className="fas fa-times"></i></button></div><div className="flex-1 w-full bg-gray-800"><MapContainer key={`${mapPosition[0]}`} center={mapPosition} zoom={15} style={{ height: '100%', width: '100%', zIndex: 1 }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Marker position={mapPosition}></Marker></MapContainer></div></div>)}
            {activeTab === 'profile' && (<div className="flex-1 p-6 pt-10 text-center"><button onClick={logout} className="w-full bg-red-500/20 text-red-400 py-3 rounded-xl mt-6">Log Out</button></div>)}
            <div className="absolute bottom-0 w-full border-t border-gray-800 px-6 py-4 flex justify-between bg-gray-900">{['jobs', 'chat', 'profile'].map((tab, idx) => (<div key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center cursor-pointer ${activeTab === tab ? 'text-teal-400' : 'text-gray-600'}`}><i className={`fas ${['fa-briefcase', 'fa-comment-dots', 'fa-user'][idx]} text-xl mb-1`}></i></div>))}</div>
        </div>
    );
};

const AppController = () => { const { user, loading } = useAuth(); useEffect(() => { if (user) socket.emit('register_user', user.id); }, [user]); if (loading) return <div></div>; if (!user) return <AuthScreen />; if (user.role === 'professional') return <ProfessionalApp />; return <ClientApp />; };
const App = () => ( <AuthProvider><AppController /></AuthProvider> );
export default App;