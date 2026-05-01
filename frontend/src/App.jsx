import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import io from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', });

let rawUrl = import.meta.env.VITE_BACKEND_URL || 'https://servly-app-icy0.onrender.com';
const backendUrl = rawUrl.replace(/\/$/, "");
const socket = io(backendUrl);

// ==========================================
// SHARED WEBRTC VIDEO CALL LOGIC & UI (Minified)
// ==========================================
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const useVideoCall = (socket, activeChatRoom, user) => {
    const [callState, setCallState] = useState({ status: 'idle', offer: null, callerName: null, room: null }); const localVideoRef = useRef(null); const remoteVideoRef = useRef(null); const peerConnection = useRef(null); const localStream = useRef(null);
    useEffect(() => { if (!socket) return; const handleIncoming = (data) => setCallState({ status: 'receiving', offer: data.offer, callerName: data.callerName, room: data.room }); const handleAccepted = async (data) => { if(peerConnection.current) { await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer)); setCallState(prev => ({ ...prev, status: 'connected' })); } }; const handleIce = async (data) => { if(peerConnection.current && data.candidate) { try { await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch(e){} } }; const handleEnded = () => endCall(false); socket.on('incoming_call', handleIncoming); socket.on('call_accepted', handleAccepted); socket.on('ice_candidate', handleIce); socket.on('call_ended', handleEnded); return () => { socket.off('incoming_call', handleIncoming); socket.off('call_accepted', handleAccepted); socket.off('ice_candidate', handleIce); socket.off('call_ended', handleEnded); } }, [socket, activeChatRoom]);
    const setupMediaAndPeer = async () => { const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); localStream.current = stream; if(localVideoRef.current) localVideoRef.current.srcObject = stream; peerConnection.current = new RTCPeerConnection(rtcConfig); stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream)); peerConnection.current.onicecandidate = (e) => { const room = activeChatRoom ? activeChatRoom._id : callState.room; if(e.candidate && room) socket.emit('ice_candidate', { room, candidate: e.candidate }); }; peerConnection.current.ontrack = (e) => { if(remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; }; };
    const startCall = async () => { if(!activeChatRoom) return; setCallState({ status: 'calling', room: activeChatRoom._id }); await setupMediaAndPeer(); const offer = await peerConnection.current.createOffer(); await peerConnection.current.setLocalDescription(offer); socket.emit('call_user', { room: activeChatRoom._id, offer, callerName: user.name }); };
    const acceptCall = async () => { await setupMediaAndPeer(); await peerConnection.current.setRemoteDescription(new RTCSessionDescription(callState.offer)); const answer = await peerConnection.current.createAnswer(); await peerConnection.current.setLocalDescription(answer); socket.emit('accept_call', { room: callState.room, answer }); setCallState(prev => ({ ...prev, status: 'connected' })); };
    const endCall = (emit = true) => { const room = activeChatRoom ? activeChatRoom._id : callState.room; if(emit && room) socket.emit('end_call', { room }); if(localStream.current) localStream.current.getTracks().forEach(t => t.stop()); if(peerConnection.current) peerConnection.current.close(); peerConnection.current = null; setCallState({ status: 'idle', offer: null, callerName: null, room: null }); };
    useEffect(() => { if(localVideoRef.current && localStream.current) localVideoRef.current.srcObject = localStream.current; }, [callState.status]); return { callState, localVideoRef, remoteVideoRef, startCall, acceptCall, endCall };
};
const CallUI = ({ callState, localVideoRef, remoteVideoRef, acceptCall, endCall }) => {
    if(callState.status === 'idle') return null;
    return (<div className="absolute inset-0 bg-gray-900 z-[100] flex flex-col animate-[slideUp_0.3s_ease-out]"><video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover bg-gray-900" />{(callState.status === 'calling' || callState.status === 'connected') && (<div className="absolute top-6 right-6 w-24 h-36 bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700"><video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" /></div>)}{callState.status === 'receiving' && (<div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center p-6 text-center"><div className="w-24 h-24 bg-teal-500 rounded-full animate-bounce flex items-center justify-center text-4xl text-white mb-6 shadow-lg"><i className="fas fa-video"></i></div><h2 className="text-2xl font-bold text-white mb-2">{callState.callerName} is calling...</h2><p className="text-gray-400 mb-12">Incoming Video Call</p><div className="flex gap-8"><button onClick={() => endCall(true)} className="w-16 h-16 bg-red-500 rounded-full text-white text-xl"><i className="fas fa-times"></i></button><button onClick={acceptCall} className="w-16 h-16 bg-green-500 rounded-full text-white text-xl animate-pulse"><i className="fas fa-video"></i></button></div></div>)}{callState.status === 'calling' && (<div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none bg-gray-900/50"><h2 className="text-2xl font-bold text-white mb-2">Calling...</h2><p className="text-gray-300">Waiting for answer</p></div>)}{(callState.status === 'calling' || callState.status === 'connected') && (<div className="absolute bottom-10 left-0 w-full flex justify-center"><button onClick={() => endCall(true)} className="w-16 h-16 bg-red-500 rounded-full text-white text-2xl shadow-lg"><i className="fas fa-phone-slash"></i></button></div>)}</div>);
};

// ==========================================
// AUTHENTICATION SCREEN (Minified)
// ==========================================
const AuthScreen = () => {
    const [isLogin, setIsLogin] = useState(true); const [isProMode, setIsProMode] = useState(false); const [formData, setFormData] = useState({ name: '', email: '', password: '', title: '', category: 'cleaning', price: '' }); const [error, setError] = useState(''); const [isLoading, setIsLoading] = useState(false); const { login } = useAuth();
    const handleSubmit = async (e) => { e.preventDefault(); setError(''); setIsLoading(true); let endpoint = '/api/login'; if (!isLogin) endpoint = isProMode ? '/api/pro-signup' : '/api/signup'; try { const res = await fetch(`${backendUrl}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }); const isJson = (res.headers.get('content-type') || '').includes('application/json'); const data = isJson ? await res.json() : await res.text(); if (!res.ok) throw new Error(isJson ? (data.message || 'Something went wrong') : 'Server error.'); login(data.user, data.token); } catch (err) { setError(err.message); } finally { setIsLoading(false); } };
    return (<div className="bg-bgLight w-full max-w-md mx-auto h-screen md:h-[850px] md:rounded-[2.5rem] md:shadow-2xl relative overflow-hidden md:border-8 md:border-gray-900 flex flex-col justify-center px-8"><div className="text-center mb-8"><div className={`w-16 h-16 ${isProMode ? 'bg-gray-800' : 'bg-teal-600'} rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg`}><i className="fas fa-tools text-white text-3xl"></i></div><h1 className={`text-4xl font-bold ${isProMode ? 'text-gray-800' : 'text-primary'} mb-2`}>Servly {isProMode && 'Pro'}</h1><p className="text-gray-500 font-medium">{isProMode ? 'Manage your services' : "Your City's Premium Marketplace"}</p></div>{!isLogin && (<div className="flex bg-gray-100 p-1 rounded-xl mb-6"><button type="button" onClick={() => setIsProMode(false)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${!isProMode ? 'bg-white shadow-sm text-teal-600' : 'text-gray-500'}`}>Client</button><button type="button" onClick={() => setIsProMode(true)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${isProMode ? 'bg-gray-800 shadow-sm text-white' : 'text-gray-500'}`}>Professional</button></div>)}<form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-96 overflow-y-auto hide-scrollbar"><h2 className="text-xl font-bold text-primary mb-4">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>{error && <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm mb-4">{error}</div>}{!isLogin && <div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Full Name</label><input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" /></div>}<div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Email Address</label><input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" /></div><div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Password</label><input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" /></div>{!isLogin && isProMode && (<><div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Job Title</label><input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" placeholder="e.g. Cloud Engineer" /></div><div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Category</label><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm"><option value="cleaning">Cleaning</option><option value="electric">Electric</option><option value="plumbing">Plumbing</option><option value="ac">AC Repair</option><option value="tech">Tech & IT</option></select></div><div className="mb-6"><label className="text-xs font-bold text-gray-500 ml-1">Hourly Rate (₦)</label><input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" /></div></>)}<button type="submit" disabled={isLoading} className={`w-full ${isProMode && !isLogin ? 'bg-gray-800' : 'bg-teal-600'} text-white font-bold py-3.5 rounded-xl transition shadow-md mt-2`}>{isLoading ? 'Wait...' : (isLogin ? 'Log In' : 'Sign Up')}</button></form><p className="text-center text-sm text-gray-500 mt-6"><span onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-teal-600 font-bold cursor-pointer">{isLogin ? 'Sign Up' : 'Log In'}</span></p><style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style></div>);
};

// ==========================================
// UPDATED FULL CLIENT DASHBOARD
// ==========================================
const ClientApp = () => {
  const { user, login, logout } = useAuth();
  
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
  const avatarInputRef = useRef(null);
  
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [partnerLocation, setPartnerLocation] = useState(null);
  const [viewingLiveMap, setViewingLiveMap] = useState(false);
  const watchIdRef = useRef(null);

  // NOTIFICATIONS, SETTINGS & FAVORITES
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const [activePanel, setActivePanel] = useState(null); // null | 'edit_profile' | 'addresses' | 'payments'
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
  const [addresses, setAddresses] = useState(user?.addresses || []);
  const [favorites, setFavorites] = useState(user?.favorites || []);
  const [newAddress, setNewAddress] = useState({ label: '', address: '' });
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const callLogic = useVideoCall(socket, activeChatRoom, user);

  useEffect(() => {
    fetch(`${backendUrl}/api/professionals`).then(res => res.json()).then(data => setProfessionals(data));
    fetch(`${backendUrl}/api/notifications`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }).then(res => res.json()).then(data => setNotifications(data || []));

    // Fetch user profile to guarantee we have their latest avatar, phone, and favorites
    fetch(`${backendUrl}/api/user/profile`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } })
        .then(res => res.json())
        .then(data => {
            if(data) {
                setProfileForm({ name: data.name, email: data.email, phone: data.phone || '' });
                setAddresses(data.addresses || []);
                setFavorites(data.favorites || []);
                // Sync local user context with fresh DB data
                login({ ...user, name: data.name, avatar: data.avatar, phone: data.phone, favorites: data.favorites }, localStorage.getItem('servly_token'));
            }
        });

    socket.on('receive_message', (data) => setMessageList((list) => [...list, data]));
    socket.on('receive_live_location', (data) => { if (data.lat === null) setPartnerLocation(null); else setPartnerLocation({ lat: data.lat, lng: data.lng, author: data.author }); });
    socket.on('new_notification', (data) => setNotifications(prev => [data, ...prev]));

    return () => { socket.off('receive_message'); socket.off('receive_live_location'); socket.off('new_notification'); if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messageList, activeTab]);

  useEffect(() => {
    if (activeTab === 'bookings') fetch(`${backendUrl}/api/bookings`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }).then(res => res.json()).then(data => setMyBookings(data));
    if (activeTab === 'chat' && activeChatRoom) socket.emit('join_room', activeChatRoom._id);
    if (activeTab !== 'chat' && isSharingLocation) { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); setIsSharingLocation(false); if (activeChatRoom) socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name }); }
  }, [activeTab, activeChatRoom]);

  // ==========================
  // PROFILE, AVATAR & SETTINGS LOGIC
  // ==========================
  const handleSaveProfile = async () => {
      try {
          const res = await fetch(`${backendUrl}/api/user/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }, body: JSON.stringify(profileForm) });
          const updatedUser = await res.json();
          login({ ...user, name: updatedUser.name, email: updatedUser.email, phone: updatedUser.phone }, localStorage.getItem('servly_token'));
          setActivePanel(null);
      } catch (err) { alert("Failed to update profile"); }
  };

  const handleAvatarUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setIsUploadingAvatar(true);
      const formData = new FormData();
      formData.append('avatar', file);
      try {
          const res = await fetch(`${backendUrl}/api/user/avatar`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }, body: formData });
          const data = await res.json();
          login({ ...user, avatar: data.avatar }, localStorage.getItem('servly_token'));
      } catch (err) { alert("Failed to upload photo"); } finally { setIsUploadingAvatar(false); }
  };

  const handleAddAddress = async () => {
      if(!newAddress.label || !newAddress.address) return alert("Please fill both fields");
      try {
          const res = await fetch(`${backendUrl}/api/user/addresses`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }, body: JSON.stringify(newAddress) });
          const newAddresses = await res.json();
          setAddresses(newAddresses);
          setNewAddress({ label: '', address: '' });
          setShowAddAddressForm(false);
      } catch (err) { alert("Failed to add address"); }
  };
  const handleDeleteAddress = async (addressId) => {
      try { const res = await fetch(`${backendUrl}/api/user/addresses/${addressId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }); setAddresses(await res.json()); } 
      catch (err) { alert("Failed to delete address"); }
  };

  const toggleFavorite = async (e, proId) => {
      e.stopPropagation();
      const isFav = favorites.includes(proId);
      const method = isFav ? 'DELETE' : 'POST';
      try {
          const res = await fetch(`${backendUrl}/api/user/favorites/${proId}`, { method, headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }});
          setFavorites(await res.json());
      } catch(err) { console.error("Favorite failed", err); }
  };

  const markNotificationsRead = () => { setShowNotifications(!showNotifications); if (!showNotifications && unreadCount > 0) { fetch(`${backendUrl}/api/notifications/read`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }); setNotifications(notifications.map(n => ({...n, isRead: true}))); } };

  const handleBookingSubmit = (e) => { e.preventDefault(); fetch(`${backendUrl}/api/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }, body: JSON.stringify({ professionalId: bookingPro._id || bookingPro.id, professionalName: bookingPro.name, date: bookingData.date, time: bookingData.time, address: bookingData.address, totalPrice: bookingPro.price }) }).then(res => res.json()).then(() => setIsBookingSuccess(true)); };
  const handleCancelBooking = async (id) => { if (!window.confirm("Cancel booking?")) return; const res = await fetch(`${backendUrl}/api/bookings/${id}/cancel`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }); if (res.ok) setMyBookings(prev => prev.map(b => b._id === id ? { ...b, status: 'cancelled' } : b)); };
  const openPrivateChat = async (booking) => { setActiveChatRoom(booking); setMessageList([]); setActiveTab('chat'); fetch(`${backendUrl}/api/chat/${booking._id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }).then(res => res.json()).then(data => setMessageList(data)); };
  const sendMessage = async () => { if (currentMessage && activeChatRoom) { const msg = { room: activeChatRoom._id, author: user.name, message: currentMessage, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }; await socket.emit('send_message', msg); setMessageList(list => [...list, msg]); setCurrentMessage(""); } };
  const toggleLocationSharing = () => { if (isSharingLocation) { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); setIsSharingLocation(false); socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name }); } else { if (navigator.geolocation) { watchIdRef.current = navigator.geolocation.watchPosition((pos) => { socket.emit('live_location_update', { room: activeChatRoom._id, lat: pos.coords.latitude, lng: pos.coords.longitude, author: user.name }); }, () => alert("GPS error."), { enableHighAccuracy: true }); setIsSharingLocation(true); } } };

  const categories = [ { id: 'cleaning', name: 'Cleaning', icon: 'fa-broom', bg: 'bg-blue-50', color: 'text-blue-500' }, { id: 'electric', name: 'Electric', icon: 'fa-bolt', bg: 'bg-orange-50', color: 'text-orange-500' }, { id: 'plumbing', name: 'Plumbing', icon: 'fa-wrench', bg: 'bg-teal-50', color: 'text-teal-600' }, { id: 'tech', name: 'Tech & IT', icon: 'fa-laptop-code', bg: 'bg-purple-50', color: 'text-purple-500' } ];
  
  let displayedPros = [];
  if (activeTab === 'favorites') { displayedPros = professionals.filter(p => favorites.includes(p._id)); }
  else { displayedPros = selectedCategory ? professionals.filter(p => p.category === selectedCategory) : professionals; }

  return (
    <div className="bg-bgLight w-full max-w-md mx-auto h-screen md:h-[850px] md:rounded-[2.5rem] md:shadow-2xl relative overflow-hidden md:border-8 md:border-gray-900 flex flex-col">
        <CallUI {...callLogic} />
        
        {/* --- 1. HOME DASHBOARD --- */}
        {activeTab === 'home' && (
            <div className="flex-1 overflow-y-auto pb-28">
                <div className="bg-white px-6 pt-10 pb-6 rounded-b-3xl shadow-sm relative z-20">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center">
                            {user?.avatar && <img src={user.avatar} className="w-10 h-10 rounded-full mr-3 object-cover shadow-sm border border-gray-100" />}
                            <div>
                                <p className="text-xs text-gray-500 font-medium">Hello, {user?.name?.split(' ')[0]} 👋</p>
                                <div className="flex items-center text-primary font-bold text-lg mt-0.5"><i className="fas fa-map-marker-alt text-teal-600 mr-2 text-sm"></i>Kano, NG</div>
                            </div>
                        </div>
                        <div className="relative">
                            <button onClick={markNotificationsRead} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200 transition"><i className="far fa-bell"></i>{unreadCount > 0 && <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"></span>}</button>
                            {showNotifications && (<div className="absolute top-12 right-0 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 max-h-80 overflow-y-auto"><h3 className="px-4 py-2 font-bold text-sm border-b">Notifications</h3>{notifications.length === 0 ? (<p className="px-4 py-4 text-xs text-gray-500 text-center">No new notifications</p>) : (notifications.map(n => (<div key={n._id} className={`px-4 py-3 border-b border-gray-50 flex gap-3 ${!n.isRead ? 'bg-teal-50/50' : ''}`}><div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${n.type === 'booking' ? 'bg-teal-100 text-teal-600' : 'bg-blue-100 text-blue-600'}`}><i className={`fas ${n.type === 'booking' ? 'fa-calendar-check' : 'fa-comment'}`}></i></div><div><p className="text-xs font-bold text-gray-800">{n.title}</p><p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{n.message}</p></div></div>))))}</div>)}
                        </div>
                    </div>
                    <div className="relative"><i className="fas fa-search absolute left-4 top-4 text-gray-400"></i><input type="text" placeholder="What service do you need?" className="w-full bg-gray-50 border border-gray-100 py-4 pl-12 pr-4 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-teal-600 transition" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
                </div>
                <div className="px-6 pt-6">
                    <div className="mb-8"><div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-primary">Categories</h2>{selectedCategory && <button onClick={() => setSelectedCategory(null)} className="text-xs text-teal-600 font-bold">Clear Filter</button>}</div><div className="grid grid-cols-4 gap-4">{categories.map(cat => (<div key={cat.id} onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)} className="flex flex-col items-center cursor-pointer group"><div className={`h-14 w-14 rounded-2xl flex justify-center items-center text-xl mb-2 transition-all ${cat.bg} ${cat.color} ${selectedCategory === cat.id ? 'ring-2 ring-teal-600 shadow-md scale-105' : 'group-hover:scale-105'}`}><i className={`fas ${cat.icon}`}></i></div><span className={`text-[10px] font-medium text-center ${selectedCategory === cat.id ? 'text-teal-600 font-bold' : 'text-gray-600'}`}>{cat.name}</span></div>))}</div></div>
                    <h2 className="text-lg font-bold text-primary mb-4">{selectedCategory ? `${categories.find(c=>c.id===selectedCategory)?.name} Experts` : 'Top Rated Near You'}</h2>
                    {displayedPros.map(pro => (<div key={pro._id} onClick={() => setViewingProfile(pro)} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-4 cursor-pointer hover:shadow-md transition relative"><button onClick={(e) => toggleFavorite(e, pro._id)} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center hover:bg-red-50 transition"><i className={`fas fa-heart text-sm ${favorites.includes(pro._id) ? 'text-red-500' : 'text-gray-300'}`}></i></button><div className="flex items-center"><img src={pro.avatar} className="w-16 h-16 rounded-2xl mr-4 object-cover" /><div className="flex-1 pr-6"><div className="flex items-center"><h3 className="font-bold text-primary">{pro.name}</h3>{pro.verified && <i className="fas fa-check-circle text-teal-600 text-xs ml-1"></i>}</div><p className="text-xs text-gray-500 mt-1 line-clamp-1">{pro.headline || pro.title}</p><div className="mt-3 flex justify-between items-center"><span className="text-sm font-bold text-primary">₦{pro.price.toLocaleString()}</span><div className="flex items-center bg-orange-50 px-2 py-1 rounded-lg"><i className="fas fa-star text-orange-400 text-[10px] mr-1"></i><span className="text-xs font-bold text-orange-600">{pro.rating}</span></div></div></div></div></div>))}
                    {displayedPros.length === 0 && <p className="text-center text-gray-400 text-sm mt-10">No professionals found.</p>}
                </div>
            </div>
        )}

        {/* --- 2. FAVORITES TAB --- */}
        {activeTab === 'favorites' && (
            <div className="flex-1 overflow-y-auto px-6 pt-10 pb-28 bg-gray-50">
                <h2 className="text-2xl font-bold text-primary mb-6">Saved Pros</h2>
                {displayedPros.length === 0 ? (
                    <div className="text-center mt-20">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-300 text-3xl"><i className="fas fa-heart"></i></div>
                        <h3 className="font-bold text-gray-700">No favorites yet</h3>
                        <p className="text-sm text-gray-500 mt-2">Tap the heart icon on a professional to save them here for later.</p>
                        <button onClick={() => setActiveTab('home')} className="mt-6 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold">Discover Pros</button>
                    </div>
                ) : displayedPros.map(pro => (<div key={pro._id} onClick={() => setViewingProfile(pro)} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-4 cursor-pointer hover:shadow-md transition relative"><button onClick={(e) => toggleFavorite(e, pro._id)} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-red-50 flex items-center justify-center"><i className="fas fa-heart text-red-500 text-sm"></i></button><div className="flex items-center"><img src={pro.avatar} className="w-16 h-16 rounded-2xl mr-4 object-cover" /><div className="flex-1 pr-6"><h3 className="font-bold text-primary">{pro.name} {pro.verified && <i className="fas fa-check-circle text-teal-600 text-xs ml-1"></i>}</h3><p className="text-xs text-gray-500 mt-1 line-clamp-1">{pro.headline || pro.title}</p><div className="mt-3 flex justify-between items-center"><span className="text-sm font-bold text-primary">₦{pro.price.toLocaleString()}</span><button onClick={(e) => { e.stopPropagation(); setBookingPro(pro); }} className="bg-teal-600 text-white text-[10px] px-3 py-1.5 rounded-lg font-bold">Book Now</button></div></div></div></div>))}
            </div>
        )}

        {/* --- 3. BOOKINGS --- */}
        {activeTab === 'bookings' && (<div className="flex-1 overflow-y-auto px-6 pt-10 pb-28 bg-gray-50"><h2 className="text-2xl font-bold text-primary mb-6">My Bookings</h2>{myBookings.length === 0 ? (<div className="text-center mt-20"><div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400 text-3xl"><i className="fas fa-calendar-times"></i></div><h3 className="font-bold text-gray-700">No bookings yet</h3><p className="text-sm text-gray-500 mt-2">Find a professional and book your first service!</p><button onClick={() => setActiveTab('home')} className="mt-6 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold">Explore Services</button></div>) : myBookings.map(b => { let statusColor = b.status === 'confirmed' ? 'bg-teal-50 text-teal-600' : b.status === 'completed' ? 'bg-blue-50 text-blue-600' : b.status === 'cancelled' ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'; return (<div key={b._id} className={`bg-white p-5 rounded-3xl shadow-sm mb-4 border border-gray-100 ${b.status === 'cancelled' ? 'opacity-60' : ''}`}><div className="flex justify-between items-start mb-4"><div><h3 className="font-bold text-gray-900">{b.professionalName}</h3><p className="text-xs text-gray-500 mt-1"><i className="far fa-calendar-alt mr-1"></i> {new Date(b.date).toLocaleDateString()} at {b.time}</p></div><span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase ${statusColor}`}>{b.status}</span></div>{b.status !== 'cancelled' && (<div className="flex gap-2 border-t border-gray-50 pt-4 mt-2">{b.status === 'pending' && <button onClick={() => handleCancelBooking(b._id)} className="flex-1 py-2 bg-red-50 text-red-500 text-xs font-bold rounded-xl hover:bg-red-100 transition">Cancel</button>}<button onClick={() => openPrivateChat(b)} className="flex-1 py-2 bg-teal-50 text-teal-600 text-xs font-bold rounded-xl hover:bg-teal-100 transition"><i className="fas fa-comment-dots mr-1"></i> Message</button></div>)}</div>); })}</div>)}
        
        {/* --- 4. CHAT & LIVE MAP --- */}
        {activeTab === 'chat' && activeChatRoom && (<div className="flex-1 flex flex-col bg-gray-50 pb-20"><div className="px-6 pt-10 pb-4 bg-white border-b flex items-center justify-between"><div className="flex items-center"><button onClick={() => setActiveTab('bookings')} className="mr-4 text-gray-400"><i className="fas fa-chevron-left"></i></button><h2 className="text-lg font-bold">{activeChatRoom.professionalName}</h2></div><button onClick={callLogic.startCall} className="w-10 h-10 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center hover:bg-teal-100"><i className="fas fa-video"></i></button></div>{partnerLocation && (<div className="bg-blue-50 p-3 flex justify-between"><p className="text-xs text-blue-800 font-bold">{partnerLocation.author} is sharing location</p><button onClick={() => setViewingLiveMap(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs">View Map</button></div>)}<div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">{messageList.map((msg, idx) => (<div key={idx} className={`flex flex-col ${msg.author === user.name ? 'items-end' : 'items-start'}`}><div className={`px-4 py-3 rounded-2xl max-w-[80%] ${msg.author === user.name ? 'bg-teal-600 text-white' : 'bg-white shadow-sm border border-gray-100'}`}><p className="text-sm">{msg.message}</p></div></div>))}<div ref={chatEndRef} /></div><div className="absolute bottom-[72px] w-full bg-white p-4 flex gap-2"><button onClick={toggleLocationSharing} className={`w-12 h-12 rounded-xl ${isSharingLocation ? 'bg-red-50 text-red-500' : 'bg-gray-100'} flex items-center justify-center`}><i className="fas fa-map-marker-alt"></i></button><input type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage()} className="flex-1 bg-gray-100 p-3 rounded-xl text-sm outline-none" /><button onClick={sendMessage} className="bg-teal-600 text-white w-12 rounded-xl flex items-center justify-center"><i className="fas fa-paper-plane"></i></button></div></div>)}
        {viewingLiveMap && partnerLocation && (<div className="absolute inset-0 bg-white z-50 flex flex-col"><div className="p-6 border-b flex justify-between items-center"><button onClick={() => setViewingLiveMap(false)} className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center"><i className="fas fa-arrow-left"></i></button><h2 className="text-lg font-bold text-gray-800">Live Map</h2><div className="w-10"></div></div><div className="flex-1 relative"><MapContainer center={[partnerLocation.lat, partnerLocation.lng]} zoom={16} style={{ height: '100%', width: '100%', zIndex: 1 }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Marker position={[partnerLocation.lat, partnerLocation.lng]}><Popup>{partnerLocation.author}</Popup></Marker></MapContainer><div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[400] w-[90%]"><button onClick={toggleLocationSharing} className={`w-full py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 ${isSharingLocation ? 'bg-red-500 text-white' : 'bg-teal-600 text-white'}`}><i className="fas fa-location-arrow"></i> {isSharingLocation ? 'Stop Sharing' : 'Share My Location'}</button></div></div></div>)}
        
        {/* --- 5. MAIN PROFILE TAB --- */}
        {activeTab === 'profile' && !activePanel && (
            <div className="flex-1 overflow-y-auto bg-gray-50 pb-28">
                <div className="bg-teal-600 pt-12 pb-6 px-6 text-center rounded-b-3xl shadow-sm relative">
                    <div className="w-24 h-24 bg-white text-teal-600 border-4 border-teal-500 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl font-bold shadow-lg overflow-hidden relative">
                        {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user?.name?.charAt(0)}
                    </div>
                    <h3 className="font-bold text-xl text-white">{user?.name}</h3>
                    <p className="text-teal-100 text-sm mt-1">{user?.email}</p>
                </div>

                <div className="px-6 pt-6 flex flex-col gap-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <button onClick={() => setActivePanel('edit_profile')} className="w-full flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 transition">
                            <div className="flex items-center text-gray-700"><div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3 text-gray-500"><i className="fas fa-user-edit"></i></div><span className="text-sm font-medium">Edit Profile</span></div><i className="fas fa-chevron-right text-gray-300 text-xs"></i>
                        </button>
                        <button onClick={() => setActivePanel('addresses')} className="w-full flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 transition">
                            <div className="flex items-center text-gray-700"><div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3 text-gray-500"><i className="fas fa-map-marker-alt"></i></div><span className="text-sm font-medium">Saved Addresses</span></div><i className="fas fa-chevron-right text-gray-300 text-xs"></i>
                        </button>
                        <button onClick={() => setActivePanel('payments')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition">
                            <div className="flex items-center text-gray-700"><div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3 text-gray-500"><i className="far fa-credit-card"></i></div><span className="text-sm font-medium">Payment Methods</span></div><i className="fas fa-chevron-right text-gray-300 text-xs"></i>
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <button className="w-full flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 transition">
                            <div className="flex items-center text-gray-700"><div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3 text-gray-500"><i className="far fa-question-circle"></i></div><span className="text-sm font-medium">Help & Support</span></div><i className="fas fa-chevron-right text-gray-300 text-xs"></i>
                        </button>
                    </div>

                    <button onClick={logout} className="bg-white border border-red-100 text-red-500 font-bold py-4 mt-2 rounded-2xl w-full shadow-sm hover:bg-red-50 transition">Log Out</button>
                </div>
            </div>
        )}

        {/* ==================================
            SETTINGS PANELS (SLIDE UP)
            ================================== */}

        {/* A. EDIT PROFILE PANEL WITH PHOTO UPLOAD */}
        {activePanel === 'edit_profile' && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col animate-[slideUp_0.3s_ease-out]">
                <div className="p-6 border-b flex items-center bg-white shadow-sm">
                    <button onClick={() => setActivePanel(null)} className="h-10 w-10 bg-gray-100 rounded-full mr-4 text-gray-600 flex items-center justify-center"><i className="fas fa-arrow-left"></i></button>
                    <h2 className="text-xl font-bold">Edit Profile</h2>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    
                    {/* CAMERA AVATAR UPLOAD UI */}
                    <div className="flex justify-center mb-8 relative">
                        <div className={`w-28 h-28 rounded-full border-4 border-white shadow-md overflow-hidden bg-gray-100 flex items-center justify-center text-4xl font-bold text-teal-600 ${isUploadingAvatar ? 'opacity-50' : ''}`}>
                            {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user?.name?.charAt(0)}
                            {isUploadingAvatar && <div className="absolute inset-0 flex items-center justify-center bg-white/50"><i className="fas fa-spinner fa-spin text-2xl"></i></div>}
                        </div>
                        <button onClick={() => avatarInputRef.current.click()} className="absolute bottom-0 right-1/2 translate-x-10 translate-y-1 w-10 h-10 bg-teal-600 text-white rounded-full flex items-center justify-center border-4 border-white shadow-sm hover:bg-teal-700 transition cursor-pointer z-10">
                            <i className="fas fa-camera"></i>
                        </button>
                        <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
                    </div>

                    <div className="mb-6">
                        <label className="text-xs font-bold text-gray-500 ml-1 block mb-2">Full Name</label>
                        <input type="text" value={profileForm.name} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition" />
                    </div>
                    <div className="mb-6">
                        <label className="text-xs font-bold text-gray-500 ml-1 block mb-2">Email Address</label>
                        <input type="email" value={profileForm.email} onChange={(e) => setProfileForm({...profileForm, email: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition" />
                    </div>
                    <div className="mb-6">
                        <label className="text-xs font-bold text-gray-500 ml-1 block mb-2">Phone Number</label>
                        <input type="tel" placeholder="+234..." value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl outline-none focus:border-teal-500 focus:bg-white transition" />
                    </div>
                    <button onClick={handleSaveProfile} className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl shadow-lg mt-4 hover:bg-teal-700 transition">Save Changes</button>
                </div>
            </div>
        )}

        {/* B. SAVED ADDRESSES PANEL */}
        {activePanel === 'addresses' && (
            <div className="absolute inset-0 bg-gray-50 z-50 flex flex-col animate-[slideUp_0.3s_ease-out]">
                <div className="p-6 border-b bg-white flex items-center shadow-sm">
                    <button onClick={() => { setActivePanel(null); setShowAddAddressForm(false); }} className="h-10 w-10 bg-gray-100 rounded-full mr-4 text-gray-600 flex items-center justify-center"><i className="fas fa-arrow-left"></i></button>
                    <h2 className="text-xl font-bold">Saved Addresses</h2>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    {showAddAddressForm ? (
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 animate-[slideUp_0.2s_ease-out]">
                            <h3 className="font-bold text-gray-800 mb-4">Add New Address</h3>
                            <div className="mb-4">
                                <label className="text-xs font-bold text-gray-500 ml-1 block mb-2">Label (e.g. Home, Office)</label>
                                <input type="text" value={newAddress.label} onChange={(e) => setNewAddress({...newAddress, label: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none text-sm" placeholder="Home" />
                            </div>
                            <div className="mb-4">
                                <label className="text-xs font-bold text-gray-500 ml-1 block mb-2">Full Address</label>
                                <textarea value={newAddress.address} onChange={(e) => setNewAddress({...newAddress, address: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none text-sm h-20" placeholder="E.g. 12 Zoo Road, Kano"></textarea>
                            </div>
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => setShowAddAddressForm(false)} className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl">Cancel</button>
                                <button onClick={handleAddAddress} className="flex-1 bg-teal-600 text-white font-bold py-3 rounded-xl shadow-md">Save</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {addresses.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400 text-2xl"><i className="fas fa-map-marker-alt"></i></div>
                                    <p className="text-gray-500 text-sm font-medium">No saved addresses yet</p>
                                </div>
                            ) : (
                                addresses.map(addr => (
                                    <div key={addr._id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-4 flex items-start justify-between">
                                        <div className="flex">
                                            <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mr-4"><i className={`fas ${addr.label.toLowerCase() === 'home' ? 'fa-home' : addr.label.toLowerCase() === 'office' ? 'fa-briefcase' : 'fa-map-marker-alt'}`}></i></div>
                                            <div>
                                                <h3 className="font-bold text-gray-900">{addr.label}</h3>
                                                <p className="text-xs text-gray-500 mt-1">{addr.address}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => { if(window.confirm("Delete this address?")) handleDeleteAddress(addr._id) }} className="text-red-400 hover:text-red-600 p-2"><i className="fas fa-trash"></i></button>
                                    </div>
                                ))
                            )}
                            <button onClick={() => setShowAddAddressForm(true)} className="w-full border-2 border-dashed border-teal-200 text-teal-600 font-bold py-4 rounded-2xl bg-teal-50/50 mt-4 flex items-center justify-center gap-2 hover:bg-teal-50 transition"><i className="fas fa-plus"></i> Add New Address</button>
                        </>
                    )}
                </div>
            </div>
        )}

        {/* C. PAYMENT METHODS PANEL (Premium UI Mockup) */}
        {activePanel === 'payments' && (
            <div className="absolute inset-0 bg-gray-50 z-50 flex flex-col animate-[slideUp_0.3s_ease-out]">
                <div className="p-6 border-b bg-white flex items-center shadow-sm">
                    <button onClick={() => setActivePanel(null)} className="h-10 w-10 bg-gray-100 rounded-full mr-4 text-gray-600 flex items-center justify-center"><i className="fas fa-arrow-left"></i></button>
                    <h2 className="text-xl font-bold">Payment Methods</h2>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    {/* Beautiful Credit Card Mock */}
                    <div className="w-full h-48 bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 flex flex-col justify-between text-white shadow-xl relative overflow-hidden mb-6">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-10 translate-x-10"></div>
                        <div className="flex justify-between items-start relative z-10">
                            <i className="fas fa-microchip text-2xl text-yellow-400 opacity-80"></i>
                            <div className="font-bold text-lg italic tracking-widest opacity-80">VISA</div>
                        </div>
                        <div className="relative z-10">
                            <p className="font-mono text-xl tracking-widest mb-1 shadow-sm">**** **** **** 4281</p>
                            <div className="flex justify-between items-end">
                                <div><p className="text-[10px] uppercase opacity-70">Card Holder</p><p className="font-bold text-sm uppercase">{user?.name}</p></div>
                                <div><p className="text-[10px] uppercase opacity-70">Expires</p><p className="font-bold text-sm">12/28</p></div>
                            </div>
                        </div>
                    </div>
                    <button className="w-full border-2 border-dashed border-gray-300 text-gray-600 font-bold py-4 rounded-2xl bg-white mt-2 flex items-center justify-center gap-2 hover:bg-gray-50 transition"><i className="fas fa-plus"></i> Add New Card</button>
                    <div className="mt-8 flex items-start gap-3 p-4 bg-blue-50 text-blue-800 rounded-2xl border border-blue-100">
                        <i className="fas fa-shield-alt text-xl mt-0.5"></i>
                        <p className="text-xs font-medium leading-relaxed">Your payment information is encrypted and securely stored. We never share your card details with service professionals.</p>
                    </div>
                </div>
            </div>
        )}

        {/* ==================================
            PRO PORTFOLIO & BOOKING FLOW
            ================================== */}
        
        {viewingProfile && !bookingPro && (
             <div className="absolute inset-0 bg-gray-50 z-40 flex flex-col overflow-y-auto hide-scrollbar">
                 <div className="absolute top-6 left-6 z-50"><button onClick={() => setViewingProfile(null)} className="h-10 w-10 rounded-full bg-black/40 text-white backdrop-blur-md flex items-center justify-center hover:bg-black/60 transition"><i className="fas fa-arrow-left"></i></button></div>
                 <div className="relative bg-white pb-6 shadow-sm border-b">
                     <div className="h-32 w-full bg-gray-200">{viewingProfile.banner && <img src={viewingProfile.banner} className="w-full h-full object-cover" />}</div>
                     <div className="px-6 relative">
                         <img src={viewingProfile.avatar} className="w-24 h-24 rounded-full border-4 border-white absolute -top-12 shadow-md object-cover bg-white" />
                         <div className="pt-14">
                             <div className="flex justify-between items-start">
                                 <div>
                                     <h1 className="text-2xl font-bold text-gray-900">{viewingProfile.name} {viewingProfile.verified && <i className="fas fa-check-circle text-teal-600 text-sm ml-1"></i>}</h1>
                                     <p className="text-sm font-medium text-gray-800 mt-1">{viewingProfile.headline || viewingProfile.title}</p>
                                     <p className="text-xs text-gray-500 mt-1"><i className="fas fa-map-marker-alt mr-1"></i> Kano, NG • <span className="font-bold text-teal-600">{viewingProfile.distance}</span></p>
                                 </div>
                                 <button onClick={(e) => toggleFavorite(e, viewingProfile._id)} className={`w-10 h-10 rounded-full flex items-center justify-center border ${favorites.includes(viewingProfile._id) ? 'bg-red-50 border-red-100 text-red-500' : 'bg-gray-50 border-gray-100 text-gray-400'}`}><i className="fas fa-heart"></i></button>
                             </div>
                             <div className="flex items-center mt-3 gap-2">
                                 <span className="bg-green-50 text-green-700 font-bold px-3 py-1 rounded-lg text-xs">₦{viewingProfile.price.toLocaleString()}/hr</span>
                                 <span className="bg-orange-50 text-orange-600 font-bold px-3 py-1 rounded-lg text-xs"><i className="fas fa-star mr-1"></i>{viewingProfile.rating}</span>
                             </div>
                             <button onClick={() => setBookingPro(viewingProfile)} className="w-full bg-teal-600 text-white font-bold py-3.5 rounded-xl mt-5 shadow-md shadow-teal-600/20 hover:bg-teal-700 transition">Book Now</button>
                         </div>
                     </div>
                 </div>
                 <div className="p-4 flex flex-col gap-4">
                     <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100"><h2 className="text-sm font-bold text-gray-900 mb-2">About</h2><p className="text-sm text-gray-600 leading-relaxed">{viewingProfile.about}</p></div>
                     {viewingProfile.skills && viewingProfile.skills.length > 0 && (<div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100"><h2 className="text-sm font-bold text-gray-900 mb-3">Skills & Endorsements</h2><div className="flex flex-wrap gap-2">{viewingProfile.skills.map((skill, i) => (<span key={i} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200">{skill}</span>))}</div></div>)}
                     {viewingProfile.contactInfo && Object.values(viewingProfile.contactInfo).some(v => v) && (<div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-20"><h2 className="text-sm font-bold text-gray-900 mb-3">Contact Info</h2><div className="grid grid-cols-2 gap-3">{viewingProfile.contactInfo.portfolio && <a href={viewingProfile.contactInfo.portfolio} target="_blank" rel="noreferrer" className="flex items-center text-xs text-gray-600 bg-gray-50 p-2 rounded-lg hover:bg-gray-100"><i className="fas fa-globe text-gray-400 w-5"></i> Portfolio</a>}{viewingProfile.contactInfo.github && <a href={viewingProfile.contactInfo.github} target="_blank" rel="noreferrer" className="flex items-center text-xs text-gray-600 bg-gray-50 p-2 rounded-lg hover:bg-gray-100"><i className="fab fa-github text-gray-400 w-5"></i> GitHub</a>}{viewingProfile.contactInfo.linkedin && <a href={viewingProfile.contactInfo.linkedin} target="_blank" rel="noreferrer" className="flex items-center text-xs text-gray-600 bg-blue-50 text-blue-700 p-2 rounded-lg hover:bg-blue-100"><i className="fab fa-linkedin w-5"></i> LinkedIn</a>}</div></div>)}
                 </div>
                 <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
             </div>
        )}

        {/* BOOKING FORM OVERLAY */}
        {bookingPro && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col">
                <div className="flex justify-between items-center p-6 border-b"><h2 className="font-bold text-xl">Book {bookingPro.name.split(' ')[0]}</h2><button onClick={() => { setBookingPro(null); setIsBookingSuccess(false); }} className="bg-gray-100 h-10 w-10 rounded-full flex items-center justify-center"><i className="fas fa-times"></i></button></div>
                {isBookingSuccess ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6"><div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center text-4xl mb-4"><i className="fas fa-check"></i></div><h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2><p className="text-gray-500 mb-8 text-center">Your request has been sent.</p><button onClick={() => { setBookingPro(null); setIsBookingSuccess(false); setActiveTab('bookings'); }} className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl shadow-lg">View Bookings</button></div>
                ) : (
                    <form onSubmit={handleBookingSubmit} className="flex-1 p-6 flex flex-col overflow-y-auto">
                        <label className="text-xs font-bold text-gray-500 mb-1 ml-1">Select Date</label>
                        <input type="date" required className="w-full bg-gray-50 p-4 rounded-xl mb-6 outline-none" value={bookingData.date} onChange={e => setBookingData({...bookingData, date: e.target.value})} />
                        <label className="text-xs font-bold text-gray-500 mb-1 ml-1">Select Time</label>
                        <div className="grid grid-cols-3 gap-3 mb-6">{['10:00 AM', '1:00 PM', '4:00 PM'].map(time => <div key={time} onClick={() => setBookingData({...bookingData, time})} className={`text-center py-3 rounded-xl text-sm font-medium cursor-pointer transition ${bookingData.time === time ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>{time}</div>)}</div>
                        <label className="text-xs font-bold text-gray-500 mb-1 ml-1">Service Address</label>
                        {addresses.length > 0 && (<div className="mb-2"><select className="w-full bg-teal-50 border border-teal-200 text-teal-700 p-3 rounded-xl outline-none text-sm font-bold" onChange={(e) => { if(e.target.value) setBookingData({...bookingData, address: e.target.value}) }}><option value="">-- Choose from saved addresses --</option>{addresses.map(a => <option key={a._id} value={a.address}>{a.label} ({a.address.substring(0, 15)}...)</option>)}</select></div>)}
                        <textarea required className="w-full bg-gray-50 p-4 rounded-xl mb-6 h-28 outline-none" value={bookingData.address} onChange={e => setBookingData({...bookingData, address: e.target.value})} placeholder="E.g. Zoo Road, Kano"></textarea>
                        <div className="bg-gray-50 p-4 rounded-xl mb-6 flex justify-between items-center"><span className="text-sm font-bold text-gray-600">Total Price</span><span className="text-lg font-bold text-teal-600">₦{bookingPro.price.toLocaleString()}</span></div>
                        <button type="submit" className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl mt-auto shadow-lg shadow-teal-600/30">Confirm Booking</button>
                    </form>
                )}
            </div>
        )}

        {/* BOTTOM NAVIGATION */}
        <div className="absolute bottom-0 w-full bg-white border-t px-6 py-4 flex justify-between z-20 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
            {['home', 'favorites', 'bookings', 'chat', 'profile'].map((tab, idx) => (
                <div key={tab} onClick={() => { setActiveTab(tab); setActivePanel(null); }} className={`flex flex-col items-center cursor-pointer transition-colors ${activeTab === tab ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}>
                    <i className={`fas ${['fa-home', 'fa-heart', 'fa-calendar-alt', 'fa-comment-dots', 'fa-user'][idx]} text-xl mb-1`}></i>
                    <span className="text-[10px] font-bold capitalize">{tab === 'favorites' ? 'Saved' : tab}</span>
                </div>
            ))}
        </div>
    </div>
  );
};


// ==========================================
// PROFESSIONAL DASHBOARD (Minified)
// ==========================================
const ProfessionalApp = () => {
    const { user, logout } = useAuth(); const [activeTab, setActiveTab] = useState('jobs'); const [jobs, setJobs] = useState([]); const [activeChatRoom, setActiveChatRoom] = useState(null); const [messageList, setMessageList] = useState([]); const [currentMessage, setCurrentMessage] = useState(''); const chatEndRef = useRef(null); const [viewingMapForJob, setViewingMapForJob] = useState(null); const [mapPosition, setMapPosition] = useState([11.9964, 8.5167]); const [isSharingLocation, setIsSharingLocation] = useState(false); const [partnerLocation, setPartnerLocation] = useState(null); const [viewingLiveMap, setViewingLiveMap] = useState(false); const watchIdRef = useRef(null); const callLogic = useVideoCall(socket, activeChatRoom, user); const [myProfile, setMyProfile] = useState(null); const [isEditingProfile, setIsEditingProfile] = useState(false); const [editForm, setEditForm] = useState({}); const [isSaving, setIsSaving] = useState(false);
    useEffect(() => { fetch(`${backendUrl}/api/pro/bookings`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }).then(res => res.json()).then(data => setJobs(data)); fetch(`${backendUrl}/api/professionals`).then(res => res.json()).then(data => { const me = data.find(p => p.userId === user.id); if(me) { setMyProfile(me); setEditForm(me); } }); socket.on('receive_message', (data) => setMessageList((list) => [...list, data])); socket.on('receive_live_location', (data) => { if (data.lat === null) setPartnerLocation(null); else setPartnerLocation({ lat: data.lat, lng: data.lng, author: data.author }); }); return () => { socket.off('receive_message'); socket.off('receive_live_location'); if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); }; }, []);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messageList]); useEffect(() => { if (activeTab !== 'chat' && isSharingLocation && !viewingMapForJob) { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); setIsSharingLocation(false); if (activeChatRoom) socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name }); } }, [activeTab, activeChatRoom, viewingMapForJob]);
    const openChat = async (job) => { setActiveChatRoom(job); setMessageList([]); setActiveTab('chat'); socket.emit('join_room', job._id); fetch(`${backendUrl}/api/chat/${job._id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } }).then(res => res.json()).then(data => setMessageList(data)); };
    const sendMessage = async () => { if (currentMessage && activeChatRoom) { const msgData = { room: activeChatRoom._id, author: user.name, message: currentMessage, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }; await socket.emit('send_message', msgData); setMessageList(list => [...list, msgData]); setCurrentMessage(""); } };
    const updateJobStatus = async (id, status) => { const res = await fetch(`${backendUrl}/api/admin/bookings/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }, body: JSON.stringify({ status }) }); if (res.ok) setJobs(prev => prev.map(j => j._id === id ? { ...j, status } : j)); };
    const handleViewMap = async (job) => { setActiveChatRoom(job); setViewingMapForJob(job); try { const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(job.address)}`); const data = await res.json(); if (data.length > 0) setMapPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)]); } catch (err) {} };
    const toggleLocationSharing = () => { if (!activeChatRoom) return alert("Open chat room first"); if (isSharingLocation) { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); setIsSharingLocation(false); socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name }); } else { if (navigator.geolocation) { watchIdRef.current = navigator.geolocation.watchPosition((pos) => { socket.emit('live_location_update', { room: activeChatRoom._id, lat: pos.coords.latitude, lng: pos.coords.longitude, author: user.name }); }, () => {}, { enableHighAccuracy: true }); setIsSharingLocation(true); } } };
    const handleSaveProfile = async (e) => { e.preventDefault(); setIsSaving(true); try { const res = await fetch(`${backendUrl}/api/pro/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }, body: JSON.stringify(editForm) }); const data = await res.json(); setMyProfile(data); setIsEditingProfile(false); } catch(err) { } finally { setIsSaving(false); } };
    return (
        <div className="bg-gray-900 w-full max-w-md mx-auto h-screen md:h-[850px] relative flex flex-col text-white md:rounded-[2.5rem] md:shadow-2xl overflow-hidden">
            <CallUI {...callLogic} />
            {activeTab === 'jobs' && (<div className="flex-1 overflow-y-auto px-6 pt-10 pb-28"><h2 className="text-2xl font-bold mb-6">My Jobs</h2>{jobs.map(job => (<div key={job._id} className="bg-gray-800 p-5 rounded-2xl mb-4"><div className="flex justify-between mb-3 border-b border-gray-700 pb-3"><h3 className="font-bold">{job.clientName}</h3><div className="px-2 py-1 rounded bg-gray-700 text-[10px] uppercase font-bold">{job.status}</div></div><button onClick={() => handleViewMap(job)} className="bg-gray-700 text-teal-400 px-3 py-1 rounded text-xs mb-4 font-bold shadow-sm flex items-center"><i className="fas fa-map-marker-alt mr-2"></i> View Map</button><div className="flex gap-2"><button onClick={() => openChat(job)} className="flex-1 py-2 bg-gray-700 text-xs font-bold rounded-lg">Chat</button>{job.status === 'pending' && <button onClick={() => updateJobStatus(job._id, 'confirmed')} className="flex-1 py-2 bg-teal-600 text-xs font-bold rounded-lg">Accept</button>}{job.status === 'confirmed' && <button onClick={() => updateJobStatus(job._id, 'completed')} className="flex-1 py-2 bg-blue-600 text-xs font-bold rounded-lg">Complete</button>}</div></div>))}</div>)}
            {activeTab === 'profile' && !isEditingProfile && (<div className="flex-1 overflow-y-auto px-6 pt-10 pb-28"><div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">My Portfolio</h2><button onClick={() => setIsEditingProfile(true)} className="bg-teal-600/20 text-teal-400 px-4 py-2 rounded-xl text-xs font-bold">Edit Profile</button></div>{myProfile ? (<div className="bg-gray-800 rounded-3xl overflow-hidden border border-gray-700 shadow-lg"><div className="h-24 w-full bg-gray-700 relative">{myProfile.banner && <img src={myProfile.banner} className="w-full h-full object-cover opacity-80" />}</div><div className="px-5 pb-5 relative"><img src={myProfile.avatar} className="w-20 h-20 rounded-full border-4 border-gray-800 absolute -top-10 object-cover" /><div className="pt-12"><h3 className="text-lg font-bold">{myProfile.name}</h3><p className="text-sm text-teal-400 font-medium mb-3">{myProfile.headline}</p><div className="bg-gray-900 p-3 rounded-xl text-xs text-gray-300 leading-relaxed mb-4 border border-gray-700">{myProfile.about}</div>{myProfile.skills && myProfile.skills.length > 0 && (<div className="mb-4"><h4 className="text-xs font-bold text-gray-400 mb-2 uppercase">Skills</h4><div className="flex flex-wrap gap-2">{myProfile.skills.map((s, i) => <span key={i} className="bg-gray-700 text-gray-200 px-2 py-1 rounded-md text-[10px]">{s}</span>)}</div></div>)}</div></div></div>) : <p className="text-center text-gray-500 mt-10">Loading profile...</p>}<button onClick={logout} className="w-full bg-red-500/10 border border-red-500/20 text-red-400 py-4 rounded-2xl mt-6 font-bold shadow-sm">Log Out</button></div>)}
            {activeTab === 'profile' && isEditingProfile && (<form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto px-6 py-6 pb-28 bg-gray-900 relative z-30"><div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">Edit Portfolio</h2><button type="button" onClick={() => { setIsEditingProfile(false); setEditForm(myProfile); }} className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400"><i className="fas fa-times"></i></button></div><div className="space-y-5"><div><label className="text-xs font-bold text-gray-400 mb-1 block">Headline</label><input type="text" value={editForm.headline || ''} onChange={e => setEditForm({...editForm, headline: e.target.value})} className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm text-white" /></div><div><label className="text-xs font-bold text-gray-400 mb-1 block">About Me</label><textarea value={editForm.about || ''} onChange={e => setEditForm({...editForm, about: e.target.value})} className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm text-white h-24"></textarea></div><div><label className="text-xs font-bold text-gray-400 mb-1 block">Skills (Comma separated)</label><input type="text" value={editForm.skills ? editForm.skills.join(', ') : ''} onChange={e => setEditForm({...editForm, skills: e.target.value.split(',').map(s=>s.trim()).filter(s=>s)})} className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm text-white" /></div><div><label className="text-xs font-bold text-gray-400 mb-1 block">GitHub Link</label><input type="text" value={editForm.contactInfo?.github || ''} onChange={e => setEditForm({...editForm, contactInfo: {...(editForm.contactInfo||{}), github: e.target.value}})} className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm text-white" /></div><div><label className="text-xs font-bold text-gray-400 mb-1 block">LinkedIn Link</label><input type="text" value={editForm.contactInfo?.linkedin || ''} onChange={e => setEditForm({...editForm, contactInfo: {...(editForm.contactInfo||{}), linkedin: e.target.value}})} className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-sm text-white" /></div></div><button type="submit" disabled={isSaving} className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl mt-8">{isSaving ? 'Saving...' : 'Save Portfolio'}</button></form>)}
            {activeTab === 'chat' && activeChatRoom && (<div className="flex-1 flex flex-col pb-20 z-30"><div className="px-6 pt-10 pb-4 border-b border-gray-800 flex items-center justify-between"><div className="flex items-center"><button onClick={() => setActiveTab('jobs')} className="mr-4 text-gray-400"><i className="fas fa-chevron-left"></i></button><h2 className="text-lg font-bold">{activeChatRoom.clientName}</h2></div><button onClick={callLogic.startCall} className="w-10 h-10 bg-teal-600/20 text-teal-400 rounded-full flex items-center justify-center"><i className="fas fa-video"></i></button></div>{partnerLocation && (<div className="bg-gray-800 p-3 flex justify-between items-center"><p className="text-xs text-teal-400 font-bold"><i className="fas fa-map-marker-alt mr-1"></i> {partnerLocation.author} is sharing location</p><button onClick={() => setViewingLiveMap(true)} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">View Map</button></div>)}<div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">{messageList.map((msg, idx) => (<div key={idx} className={`flex flex-col ${msg.author === user.name ? 'items-end' : 'items-start'}`}><div className={`px-4 py-3 rounded-2xl max-w-[80%] ${msg.author === user.name ? 'bg-teal-600' : 'bg-gray-800'}`}><p className="text-sm">{msg.message}</p></div></div>))}<div ref={chatEndRef} /></div><div className="absolute bottom-[72px] w-full p-4 border-t border-gray-800 bg-gray-900 flex gap-2"><button onClick={toggleLocationSharing} className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSharingLocation ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-400'}`}><i className="fas fa-map-marker-alt"></i></button><input type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage()} className="flex-1 bg-gray-800 p-3 rounded-xl text-sm outline-none text-white" /><button onClick={sendMessage} className="bg-teal-600 w-12 rounded-xl flex items-center justify-center"><i className="fas fa-paper-plane text-white"></i></button></div></div>)}
            {viewingLiveMap && partnerLocation && (<div className="absolute inset-0 bg-gray-900 z-50 flex flex-col"><div className="p-6 border-b border-gray-800 flex justify-between items-center"><button onClick={() => setViewingLiveMap(false)} className="h-10 w-10 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center"><i className="fas fa-arrow-left"></i></button><h2 className="text-lg font-bold text-white">Live Tracking</h2><div className="w-10"></div></div><div className="flex-1 relative w-full bg-gray-800"><MapContainer center={[partnerLocation.lat, partnerLocation.lng]} zoom={16} style={{ height: '100%', width: '100%', zIndex: 1 }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Marker position={[partnerLocation.lat, partnerLocation.lng]}><Popup>{partnerLocation.author}</Popup></Marker></MapContainer><div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[400] w-[90%]"><button onClick={toggleLocationSharing} className={`w-full py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 ${isSharingLocation ? 'bg-red-500/90 text-white border border-red-400' : 'bg-teal-600 text-white'}`}><i className="fas fa-location-arrow"></i> {isSharingLocation ? 'Stop Sharing' : 'Share My Location'}</button></div></div></div>)}
            {viewingMapForJob && (<div className="absolute inset-0 bg-gray-900 z-50 flex flex-col"><div className="p-6 border-b border-gray-800 flex justify-between items-center"><button onClick={() => setViewingMapForJob(null)} className="h-10 w-10 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center"><i className="fas fa-arrow-left"></i></button><h2 className="text-lg font-bold text-white">Client Map</h2><div className="w-10"></div></div><div className="flex-1 relative w-full bg-gray-800"><MapContainer key={`${mapPosition[0]}`} center={mapPosition} zoom={15} style={{ height: '100%', width: '100%', zIndex: 1 }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Marker position={mapPosition}></Marker></MapContainer><div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[400] w-[90%]"><button onClick={toggleLocationSharing} className={`w-full py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 ${isSharingLocation ? 'bg-red-500/90 text-white border border-red-400' : 'bg-teal-600 text-white'}`}><i className="fas fa-location-arrow"></i> {isSharingLocation ? 'Stop Sharing Location' : 'Start Navigating (Share Location)'}</button></div></div></div>)}
            <div className="absolute bottom-0 w-full border-t border-gray-800 px-6 py-4 flex justify-between bg-gray-900 z-40">{['jobs', 'chat', 'profile'].map((tab, idx) => (<div key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center cursor-pointer ${activeTab === tab ? 'text-teal-400' : 'text-gray-600'}`}><i className={`fas ${['fa-briefcase', 'fa-comment-dots', 'fa-user'][idx]} text-xl mb-1`}></i></div>))}</div>
        </div>
    );
};

const AppController = () => { const { user, loading } = useAuth(); useEffect(() => { if (user) socket.emit('register_user', user.id); }, [user]); if (loading) return <div></div>; if (!user) return <AuthScreen />; if (user.role === 'professional') return <ProfessionalApp />; return <ClientApp />; };
const App = () => ( <AuthProvider><AppController /></AuthProvider> );
export default App;