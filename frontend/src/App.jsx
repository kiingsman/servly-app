import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import io from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', });

let rawUrl = import.meta.env.VITE_BACKEND_URL || 'https://servly-app-icy0.onrender.com';
const backendUrl = rawUrl.replace(/\/$/, "");

// ==========================================
// REUSABLE PAGINATION COMPONENT
// ==========================================
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
        <div className="flex justify-between items-center mt-6 mb-2 pb-4">
            <button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl disabled:opacity-30 font-bold text-xs transition active:scale-95 shadow-sm"><i className="fas fa-chevron-left mr-1"></i> Prev</button>
            <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg">Page {currentPage} of {totalPages}</span>
            <button disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl disabled:opacity-30 font-bold text-xs transition active:scale-95 shadow-sm">Next <i className="fas fa-chevron-right ml-1"></i></button>
        </div>
    );
};

// ==========================================
// UBER-LIKE LIVE MAP ENGINE
// ==========================================
const LiveMapUpdater = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center && center[0] && center[1]) {
            map.flyTo(center, map.getZoom(), { animate: true, duration: 1.5 });
        }
    }, [center, map]);
    return null;
};

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
        return () => {
            if(localStream.current) localStream.current.getTracks().forEach(t => t.stop());
            if(peerConnection.current) peerConnection.current.close();
        };
    }, []);

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
        }; 
    }, [socket, activeChatRoom]);

    const setupMediaAndPeer = async () => { 
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); 
        localStream.current = stream; 
        if(localVideoRef.current) localVideoRef.current.srcObject = stream; 
        
        peerConnection.current = new RTCPeerConnection(rtcConfig); 
        stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream)); 
        
        peerConnection.current.onicecandidate = (e) => { 
            const room = activeChatRoom ? activeChatRoom._id : callState.room; 
            if(e.candidate && room && socket) socket.emit('ice_candidate', { room, candidate: e.candidate }); 
        }; 
        peerConnection.current.ontrack = (e) => { 
            if(remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; 
        }; 
    };

    const startCall = async () => { 
        if(!activeChatRoom || !socket) return; 
        setCallState({ status: 'calling', room: activeChatRoom._id }); 
        await setupMediaAndPeer(); 
        const offer = await peerConnection.current.createOffer(); 
        await peerConnection.current.setLocalDescription(offer); 
        socket.emit('call_user', { room: activeChatRoom._id, offer, callerName: user.name }); 
    };

    const acceptCall = async () => { 
        if(!socket) return;
        await setupMediaAndPeer(); 
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(callState.offer)); 
        const answer = await peerConnection.current.createAnswer(); 
        await peerConnection.current.setLocalDescription(answer); 
        socket.emit('accept_call', { room: callState.room, answer }); 
        setCallState(prev => ({ ...prev, status: 'connected' })); 
    };

    const endCall = (emit = true) => { 
        const room = activeChatRoom ? activeChatRoom._id : callState.room; 
        if(emit && room && socket) socket.emit('end_call', { room }); 
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
                <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-24 h-24 bg-teal-500 rounded-full animate-bounce flex items-center justify-center text-4xl text-white mb-6 shadow-lg">
                        <i className="fas fa-video"></i>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{callState.callerName} is calling...</h2>
                    <p className="text-gray-400 mb-12">Incoming Video Call</p>
                    <div className="flex gap-8">
                        <button onClick={() => endCall(true)} className="w-16 h-16 bg-red-500 rounded-full text-white text-xl">
                            <i className="fas fa-times"></i>
                        </button>
                        <button onClick={acceptCall} className="w-16 h-16 bg-green-500 rounded-full text-white text-xl animate-pulse">
                            <i className="fas fa-video"></i>
                        </button>
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
                    <button onClick={() => endCall(true)} className="w-16 h-16 bg-red-500 rounded-full text-white text-2xl shadow-lg">
                        <i className="fas fa-phone-slash"></i>
                    </button>
                </div>
            )}
        </div>
    );
};

// ==========================================
// AUTHENTICATION SCREEN
// ==========================================
const AuthScreen = () => {
    const [isLogin, setIsLogin] = useState(true); const [isProMode, setIsProMode] = useState(false); const [formData, setFormData] = useState({ name: '', email: '', password: '', title: '', category: 'cleaning', price: '' }); const [error, setError] = useState(''); const [isLoading, setIsLoading] = useState(false); const { login } = useAuth();
    const handleSubmit = async (e) => { e.preventDefault(); setError(''); setIsLoading(true); let endpoint = '/api/login'; if (!isLogin) endpoint = isProMode ? '/api/pro-signup' : '/api/signup'; try { const res = await fetch(`${backendUrl}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }); const isJson = (res.headers.get('content-type') || '').includes('application/json'); const data = isJson ? await res.json() : await res.text(); if (!res.ok) throw new Error(isJson ? (data.message || 'Something went wrong') : 'Server error.'); login(data.user, data.token); } catch (err) { setError(err.message); } finally { setIsLoading(false); } };
    return (<div className="bg-bgLight w-full max-w-md mx-auto h-screen md:h-[850px] md:rounded-[2.5rem] md:shadow-2xl relative overflow-hidden md:border-8 md:border-gray-900 flex flex-col justify-center px-8"><div className="text-center mb-8"><div className={`w-16 h-16 ${isProMode ? 'bg-gray-800' : 'bg-teal-600'} rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg`}><i className="fas fa-tools text-white text-3xl"></i></div><h1 className={`text-4xl font-bold ${isProMode ? 'text-gray-800' : 'text-primary'} mb-2`}>Servly {isProMode && 'Pro'}</h1><p className="text-gray-500 font-medium">{isProMode ? 'Manage your services' : "Your City's Premium Marketplace"}</p></div>{!isLogin && (<div className="flex bg-gray-100 p-1 rounded-xl mb-6"><button type="button" onClick={() => setIsProMode(false)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${!isProMode ? 'bg-white shadow-sm text-teal-600' : 'text-gray-500'}`}>Client</button><button type="button" onClick={() => setIsProMode(true)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${isProMode ? 'bg-gray-800 shadow-sm text-white' : 'text-gray-500'}`}>Professional</button></div>)}<form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-96 overflow-y-auto hide-scrollbar"><h2 className="text-xl font-bold text-primary mb-4">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>{error && <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm mb-4">{error}</div>}{!isLogin && <div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Full Name</label><input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" /></div>}<div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Email Address</label><input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" /></div><div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Password</label><input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" /></div>{!isLogin && isProMode && (<><div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Job Title</label><input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" placeholder="e.g. Cloud Engineer" /></div><div className="mb-3"><label className="text-xs font-bold text-gray-500 ml-1">Category</label><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm"><option value="cleaning">Cleaning</option><option value="electric">Electric</option><option value="plumbing">Plumbing</option><option value="ac">AC Repair</option><option value="tech">Tech & IT</option></select></div><div className="mb-6"><label className="text-xs font-bold text-gray-500 ml-1">Hourly Rate (₦)</label><input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none text-sm" /></div></>)}<button type="submit" disabled={isLoading} className={`w-full ${isProMode && !isLogin ? 'bg-gray-800' : 'bg-teal-600'} text-white font-bold py-3.5 rounded-xl transition shadow-md mt-2`}>{isLoading ? 'Wait...' : (isLogin ? 'Log In' : 'Sign Up')}</button></form><p className="text-center text-sm text-gray-500 mt-6"><span onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-teal-600 font-bold cursor-pointer">{isLogin ? 'Sign Up' : 'Log In'}</span></p><style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style></div>);
};

// ==========================================
// CLIENT DASHBOARD
// ==========================================
const ClientApp = ({ socket, token }) => {
  const { user, login, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  
  // PAGINATION STATES
  const [proPage, setProPage] = useState(1);
  const [bookingPage, setBookingPage] = useState(1);
  const ITEMS_PER_PAGE = 4;
  
  const [viewingProfile, setViewingProfile] = useState(null);
  const [bookingPro, setBookingPro] = useState(null);
  
  const [bookingData, setBookingData] = useState({ date: '', time: '10:00', address: '' });
  const [isBookingSuccess, setIsBookingSuccess] = useState(false);
  
  const [messageList, setMessageList] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [activeChatRoom, setActiveChatRoom] = useState(null); 
  const chatEndRef = useRef(null);
  const avatarInputRef = useRef(null);
  
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [myLocation, setMyLocation] = useState(null); 
  const [partnerLocation, setPartnerLocation] = useState(null);
  const [viewingLiveMap, setViewingLiveMap] = useState(false);
  const watchIdRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const unreadCount = Array.isArray(notifications) ? notifications.filter(n => !n.isRead).length : 0;
  const [favorites, setFavorites] = useState(Array.isArray(user.favorites) ? user.favorites : []);
  
  const callLogic = useVideoCall(socket, activeChatRoom, user);

  // RESET PAGINATION ON SEARCH OR FILTER
  useEffect(() => { setProPage(1); }, [searchQuery, selectedCategory, activeTab]);

  useEffect(() => {
    if (socket && activeChatRoom) {
        socket.emit('join_room', activeChatRoom._id);
        const handleReconnect = () => socket.emit('join_room', activeChatRoom._id);
        socket.on('connect', handleReconnect);
        return () => socket.off('connect', handleReconnect);
    }
  }, [socket, activeChatRoom]);

  useEffect(() => {
      fetch(`${backendUrl}/api/professionals`).then(res => res.json()).then(data => setProfessionals(Array.isArray(data) ? data : []));
      
      if (token) {
        fetch(`${backendUrl}/api/bookings`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()).then(data => setMyBookings(Array.isArray(data) ? data : []));
        fetch(`${backendUrl}/api/notifications`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()).then(data => setNotifications(Array.isArray(data) ? data : []));
      }

      if (!socket) return;
      
      const onReceiveMessage = (data) => {
          setMessageList((list) => [...list, data]);
          if (activeChatRoom && data.room === activeChatRoom._id) {
              socket.emit('mark_messages_read', { bookingId: activeChatRoom._id, userId: user.id });
          }
      };
      
      const onMessagesReadUpdate = () => {
          setMessageList(prev => prev.map(msg => ({ ...msg, isRead: true })));
      };
      
      const onReceiveLocation = (data) => { 
          if (data.lat === null) setPartnerLocation(null); 
          else setPartnerLocation({ lat: data.lat, lng: data.lng, author: data.author }); 
      };
      
      const onNewNotification = (notif) => { setNotifications(prev => [notif, ...prev]); };

      socket.on('receive_message', onReceiveMessage);
      socket.on('messages_read_update', onMessagesReadUpdate);
      socket.on('receive_live_location', onReceiveLocation);
      socket.on('new_notification', onNewNotification);

      return () => {
          socket.off('receive_message', onReceiveMessage);
          socket.off('messages_read_update', onMessagesReadUpdate);
          socket.off('receive_live_location', onReceiveLocation);
          socket.off('new_notification', onNewNotification);
          if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      };
  }, [socket, activeChatRoom, user.id, token]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messageList]);
  
  useEffect(() => { 
      if (activeTab !== 'chat' && isSharingLocation && !viewingLiveMap) { 
          if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); 
          setIsSharingLocation(false); 
          setMyLocation(null);
          if(socket && activeChatRoom) socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name }); 
      } 
  }, [activeTab, activeChatRoom, viewingLiveMap, isSharingLocation, socket, user.name]);

  const toggleLocationSharing = () => { 
      if (!activeChatRoom) return;
      if (isSharingLocation) { 
          if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); 
          setIsSharingLocation(false); 
          setMyLocation(null);
          if(socket) socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name }); 
      } else { 
          if (navigator.geolocation) { 
              watchIdRef.current = navigator.geolocation.watchPosition((pos) => { 
                  const lat = pos.coords.latitude;
                  const lng = pos.coords.longitude;
                  setMyLocation({ lat, lng });
                  if(socket) socket.emit('live_location_update', { room: activeChatRoom._id, lat, lng, author: user.name }); 
              }, () => alert("GPS error. Please enable location services."), { enableHighAccuracy: true }); 
              setIsSharingLocation(true); 
          } 
      } 
  };

  const toggleFavorite = async (e, proId) => { 
    e.stopPropagation(); const isFav = favorites.includes(proId); const method = isFav ? 'DELETE' : 'POST'; 
    try { const res = await fetch(`${backendUrl}/api/user/favorites/${proId}`, { method, headers: { 'Authorization': `Bearer ${token}` }}); const data = await res.json(); if (!res.ok) return alert(`Could not save pro`); setFavorites(Array.isArray(data) ? data : []); } catch(err) { console.error(err); } 
  };
  
  const markNotificationsRead = () => { setShowNotifications(!showNotifications); if (!showNotifications && unreadCount > 0) { fetch(`${backendUrl}/api/notifications/read`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } }); setNotifications(Array.isArray(notifications) ? notifications.map(n => ({...n, isRead: true})) : []); } };
  
  const formatTimeAMPM = (time24) => {
      if (!time24) return '';
      const [h, m] = time24.split(':');
      const hour = parseInt(h, 10);
      return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const handleBookingSubmit = async (e) => { 
      e.preventDefault(); 
      try { 
          const res = await fetch(`${backendUrl}/api/bookings`, { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
              body: JSON.stringify({ 
                  professionalId: bookingPro._id || bookingPro.id, 
                  professionalName: bookingPro.name, 
                  clientName: user.name, 
                  date: bookingData.date, 
                  time: formatTimeAMPM(bookingData.time), 
                  address: bookingData.address, 
                  totalPrice: bookingPro.price 
              }) 
          }); 
          
          if (!res.ok) {
              const data = await res.json();
              if (res.status === 401 || res.status === 403) {
                  logout();
                  alert('Session expired. Please log in again.');
              } else {
                  alert(data.message || 'Booking failed');
              }
              return;
          } 
          setIsBookingSuccess(true); 
      } catch(err) { 
          console.error(err); 
      } 
  };
  
  const handleCancelBooking = async (id) => { if (!window.confirm("Cancel booking?")) return; const res = await fetch(`${backendUrl}/api/bookings/${id}/cancel`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) setMyBookings(prev => prev.map(b => b._id === id ? { ...b, status: 'cancelled' } : b)); };
  
  const openPrivateChat = async (booking) => { 
      setActiveChatRoom(booking); 
      setMessageList([]); 
      setActiveTab('chat'); 
      fetch(`${backendUrl}/api/chat/${booking._id}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setMessageList(Array.isArray(data) ? data : [])); 
  };

  const sendMessage = async () => { 
      if (currentMessage && activeChatRoom && socket) { 
          const msg = { room: activeChatRoom._id, senderId: user.id, author: user.name, message: currentMessage, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), isRead: false }; 
          await socket.emit('send_message', msg); 
          setMessageList(list => [...list, msg]); 
          setCurrentMessage(""); 
      } 
  };

  const categories = [ { id: 'cleaning', name: 'Cleaning', icon: 'fa-broom', bg: 'bg-blue-50', color: 'text-blue-500' }, { id: 'electric', name: 'Electric', icon: 'fa-bolt', bg: 'bg-orange-50', color: 'text-orange-500' }, { id: 'plumbing', name: 'Plumbing', icon: 'fa-wrench', bg: 'bg-teal-50', color: 'text-teal-600' }, { id: 'tech', name: 'Tech & IT', icon: 'fa-laptop-code', bg: 'bg-purple-50', color: 'text-purple-500' } ];
  
  // FILTERING LOGIC
  let displayedPros = []; 
  if (activeTab === 'favorites') { displayedPros = professionals.filter(p => favorites.includes(p._id)); } 
  else { displayedPros = selectedCategory ? professionals.filter(p => p.category === selectedCategory) : professionals; }
  
  const filteredPros = displayedPros.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  
  // PAGINATION CALCULATIONS
  const totalProPages = Math.ceil(filteredPros.length / ITEMS_PER_PAGE);
  const paginatedPros = filteredPros.slice((proPage - 1) * ITEMS_PER_PAGE, proPage * ITEMS_PER_PAGE);

  const totalBookingPages = Math.ceil(myBookings.length / ITEMS_PER_PAGE);
  const paginatedBookings = myBookings.slice((bookingPage - 1) * ITEMS_PER_PAGE, bookingPage * ITEMS_PER_PAGE);

  const handleAvatarUpload = async (e) => { const file = e.target.files[0]; if (!file) return; const formData = new FormData(); formData.append('avatar', file); try { const res = await fetch(`${backendUrl}/api/user/avatar`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData }); const data = await res.json(); if (res.ok) { login({ ...user, avatar: data.avatar }, token); } } catch (err) {} };
  const mapCenter = partnerLocation ? [partnerLocation.lat, partnerLocation.lng] : myLocation ? [myLocation.lat, myLocation.lng] : [11.9964, 8.5167];

  return (
    <div className="bg-bgLight w-full max-w-md mx-auto h-screen md:h-[850px] relative flex flex-col md:rounded-[2.5rem] md:shadow-2xl overflow-hidden text-gray-900">
      <CallUI {...callLogic} />
      
      <div className="bg-white px-6 pt-12 pb-4 rounded-b-[2rem] shadow-sm flex justify-between items-center z-10 sticky top-0">
        <div><h1 className="text-2xl font-black text-primary">Servly</h1><p className="text-xs text-gray-500 font-bold flex items-center"><i className="fas fa-map-marker-alt text-teal-500 mr-1"></i> Kano, NG</p></div>
        <div className="flex items-center gap-3">
            <div className="relative">
                <button onClick={markNotificationsRead} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 relative"><i className="fas fa-bell"></i>{unreadCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}</button>
                {showNotifications && (
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                        <div className="p-3 bg-gray-50 border-b border-gray-100"><h3 className="font-bold text-sm text-gray-700">Notifications</h3></div>
                        <div className="max-h-64 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <p className="p-4 text-center text-sm text-gray-500">No notifications yet</p>
                            ) : (
                                notifications.map(n => (
                                    <div key={n._id} className={`p-3 border-b border-gray-50 ${!n.isRead ? 'bg-teal-50/30' : ''}`}>
                                        <h4 className="text-xs font-bold text-gray-800">{n.title}</h4>
                                        <p className="text-xs text-gray-500 mt-1">{n.message}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
            <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name.replace(/ /g,'+')}&background=0D8ABC&color=fff`} className="w-10 h-10 rounded-full shadow-sm cursor-pointer object-cover" onClick={() => setActiveTab('profile')} alt="Profile" />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pb-28 hide-scrollbar">
        {activeTab === 'home' && (
          <div className="px-6 pt-6">
            <div className="relative mb-6 shadow-sm"><i className="fas fa-search absolute left-4 top-3.5 text-gray-400"></i><input type="text" placeholder="Search services..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white py-3.5 pl-12 pr-4 rounded-2xl text-sm outline-none border border-gray-100" /></div>
            <div className="flex justify-between items-end mb-4"><h2 className="text-lg font-bold text-gray-800">Categories</h2></div>
            <div className="grid grid-cols-4 gap-3 mb-8">{categories.map(cat => (<div key={cat.id} onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)} className={`flex flex-col items-center justify-center p-3 rounded-2xl cursor-pointer transition ${selectedCategory === cat.id ? 'bg-primary text-white shadow-md' : `${cat.bg} ${cat.color}`}`}><i className={`fas ${cat.icon} text-xl mb-2`}></i><span className={`text-[10px] font-bold ${selectedCategory === cat.id ? 'text-white' : 'text-gray-600'}`}>{cat.name}</span></div>))}</div>
            
            <div className="flex justify-between items-end mb-4"><h2 className="text-lg font-bold text-gray-800">Top Professionals</h2></div>
            <div className="flex flex-col gap-4">
                {paginatedPros.map(pro => (
                    <div key={pro._id} onClick={() => setViewingProfile(pro)} className="bg-white p-4 rounded-2xl flex items-center shadow-sm border border-gray-50 cursor-pointer">
                        <div className="relative"><img src={pro.avatar || `https://ui-avatars.com/api/?name=${pro.name.replace(/ /g,'+')}&background=0D8ABC&color=fff`} className="w-16 h-16 rounded-2xl object-cover" alt={pro.name} />{pro.verified && <div className="absolute -top-2 -right-2 bg-blue-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 border-white"><i className="fas fa-check"></i></div>}</div>
                        <div className="ml-4 flex-1"><div><h3 className="font-bold text-gray-800 text-base">{pro.name}</h3><p className="text-xs text-teal-600 font-bold">{pro.title}</p></div><div className="flex items-center mt-2 text-xs text-gray-500 font-medium"><span className="flex items-center text-orange-500 mr-3"><i className="fas fa-star mr-1"></i> {pro.rating}</span><span className="flex items-center"><i className="fas fa-map-marker-alt mr-1"></i> {pro.distance}</span></div></div>
                        <div className="flex flex-col items-end justify-between h-full"><button onClick={(e) => toggleFavorite(e, pro._id)} className="text-gray-300 hover:text-red-500"><i className={`${favorites.includes(pro._id) ? 'fas text-red-500' : 'far'} fa-heart text-lg`}></i></button><p className="font-black text-gray-800 mt-3">₦{pro.price}<span className="text-[10px] text-gray-400 font-medium">/hr</span></p></div>
                    </div>
                ))}
            </div>
            {paginatedPros.length === 0 && <p className="text-center text-sm text-gray-400 py-8">No professionals found.</p>}
            <Pagination currentPage={proPage} totalPages={totalProPages} onPageChange={setProPage} />
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="px-6 pt-6">
            <h2 className="text-2xl font-bold mb-6">My Bookings</h2>
            {paginatedBookings.map(b => (
                <div key={b._id} className="bg-white p-4 rounded-2xl mb-4 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-3 border-b border-gray-50 pb-3"><div><h3 className="font-bold text-gray-800">{b.professionalName}</h3><p className="text-xs text-gray-500">{b.date} at {b.time}</p></div><div className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${b.status === 'confirmed' ? 'bg-green-100 text-green-600' : b.status === 'completed' ? 'bg-blue-100 text-blue-600' : b.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>{b.status}</div></div>
                    <div className="flex gap-2 mt-3"><button onClick={() => openPrivateChat(b)} className="flex-1 py-2 bg-teal-50 text-teal-600 text-xs font-bold rounded-lg"><i className="fas fa-comment-dots mr-1"></i> Chat</button>{b.status === 'pending' && <button onClick={() => handleCancelBooking(b._id)} className="flex-1 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg">Cancel</button>}</div>
                </div>
            ))}
            {paginatedBookings.length === 0 && <p className="text-center text-sm text-gray-400 py-8">You have no bookings.</p>}
            <Pagination currentPage={bookingPage} totalPages={totalBookingPages} onPageChange={setBookingPage} />
          </div>
        )}

        {activeTab === 'chat' && activeChatRoom && (
          <div className="h-full flex flex-col bg-gray-50 relative">
            <div className="bg-white px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20"><div className="flex items-center"><button onClick={() => setActiveTab('bookings')} className="mr-4 text-gray-400"><i className="fas fa-arrow-left"></i></button><div><h3 className="font-bold text-gray-800 text-sm">{activeChatRoom.professionalName}</h3><p className="text-[10px] text-teal-600 font-bold">Booking Chat</p></div></div><div className="flex gap-3"><button onClick={callLogic.startCall} className="w-8 h-8 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center text-xs"><i className="fas fa-video"></i></button></div></div>
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 pb-20">{messageList.map((msg, i) => { const isMe = msg.senderId === user.id; return (<div key={i} className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-primary text-white self-end rounded-br-sm' : 'bg-white text-gray-800 self-start rounded-bl-sm border border-gray-100'}`}><p>{msg.message}</p><div className="flex items-center justify-end mt-1 gap-1"><span className={`text-[9px] ${isMe ? 'text-teal-100' : 'text-gray-400'}`}>{msg.time}</span>{isMe && <span className={`text-[10px] ${msg.isRead ? 'text-blue-300' : 'text-teal-200'}`}>{msg.isRead ? '✓✓' : '✓'}</span>}</div></div>); })}<div ref={chatEndRef} /></div>
            
            <div className="absolute bottom-0 w-full bg-white p-4 border-t border-gray-100 flex items-center gap-2">
                <div className="relative">
                    <button onClick={() => setViewingLiveMap(!viewingLiveMap)} className="w-10 h-10 bg-gray-50 rounded-full text-gray-400 flex items-center justify-center"><i className="fas fa-map-marker-alt"></i></button>
                    {isSharingLocation && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>}
                </div>
                <input type="text" placeholder="Type message..." value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} className="flex-1 bg-gray-50 py-3 px-4 rounded-full text-sm outline-none border border-gray-100" />
                <button onClick={sendMessage} className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center shadow-md"><i className="fas fa-paper-plane"></i></button>
            </div>

            {viewingLiveMap && (
              <div className="absolute inset-0 bg-white z-30 flex flex-col">
                  <div className="p-4 flex justify-between items-center bg-white shadow-sm z-40">
                      <h3 className="font-bold text-sm">Live Location Tracking</h3>
                      <button onClick={() => setViewingLiveMap(false)} className="text-gray-500"><i className="fas fa-times"></i></button>
                  </div>
                  <div className="flex-1 relative">
                      <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
                          <LiveMapUpdater center={mapCenter} />
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          {myLocation && (<Marker position={[myLocation.lat, myLocation.lng]}><Popup>Your Location</Popup></Marker>)}
                          {partnerLocation && (<Marker position={[partnerLocation.lat, partnerLocation.lng]}><Popup>{partnerLocation.author} (Professional)</Popup></Marker>)}
                      </MapContainer>
                      {!partnerLocation && (<div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-900/80 text-white px-4 py-2 rounded-full text-xs font-bold z-[400] shadow-lg animate-pulse">Waiting for Pro's GPS signal...</div>)}
                      <button onClick={toggleLocationSharing} className={`absolute bottom-6 flex items-center gap-2 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full text-white font-bold text-sm shadow-xl z-[400] ${isSharingLocation ? 'bg-red-500' : 'bg-primary'}`}><i className={`fas ${isSharingLocation ? 'fa-stop-circle' : 'fa-location-arrow'}`}></i>{isSharingLocation ? 'Stop Sharing' : 'Share My Location'}</button>
                  </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="px-6 pt-6"><h2 className="text-2xl font-bold mb-6">Profile</h2><div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center mb-6"><input type="file" accept="image/*" className="hidden" ref={avatarInputRef} onChange={handleAvatarUpload}/><div className="relative mb-4"><img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name.replace(/ /g,'+')}&background=0D8ABC&color=fff`} className="w-24 h-24 rounded-full object-cover shadow-md" alt="Avatar" /><button onClick={() => avatarInputRef.current.click()} className="absolute bottom-0 right-0 w-8 h-8 bg-teal-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm"><i className="fas fa-camera text-xs"></i></button></div><h3 className="text-xl font-bold text-gray-800">{user.name}</h3><p className="text-sm text-gray-500">{user.email}</p></div><button onClick={logout} className="w-full py-4 bg-red-50 text-red-500 font-bold rounded-2xl border border-red-100 flex items-center justify-center"><i className="fas fa-sign-out-alt mr-2"></i> Log Out</button></div>
        )}
      </div>

      {viewingProfile && !bookingPro && (<div className="absolute inset-0 bg-white z-50 overflow-y-auto animate-[slideUp_0.3s_ease-out]"><div className="relative h-64 bg-gray-100"><img src={viewingProfile.avatar || `https://ui-avatars.com/api/?name=${viewingProfile.name.replace(/ /g,'+')}&background=0D8ABC&color=fff`} className="w-full h-full object-cover" alt="Profile" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div><button onClick={() => setViewingProfile(null)} className="absolute top-6 left-6 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30"><i className="fas fa-arrow-left"></i></button></div><div className="px-6 -mt-16 relative z-10"><div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-50"><div className="flex justify-between items-start mb-4"><div><h2 className="text-2xl font-black text-gray-800">{viewingProfile.name}</h2><p className="text-teal-600 font-bold mt-1 text-sm">{viewingProfile.headline}</p></div><div className="bg-teal-50 text-primary px-3 py-1.5 rounded-xl font-black text-sm">₦{viewingProfile.price}<span className="text-[10px] text-teal-600/60 ml-1">/hr</span></div></div><div className="flex gap-4 mb-6 text-sm font-bold text-gray-600"><span className="flex items-center"><i className="fas fa-star text-orange-400 mr-1.5"></i> {viewingProfile.rating}</span><span className="flex items-center"><i className="fas fa-map-marker-alt text-teal-400 mr-1.5"></i> {viewingProfile.distance}</span><span className="flex items-center text-blue-500 bg-blue-50 px-2 py-0.5 rounded-lg"><i className="fas fa-check-circle mr-1"></i> Verified</span></div><h3 className="font-bold text-gray-800 mb-3">About</h3><p className="text-sm text-gray-500 leading-relaxed mb-6">Expert {viewingProfile.category} professional with years of experience delivering top-tier service. Committed to quality, punctuality, and client satisfaction.</p><button onClick={() => setBookingPro(viewingProfile)} className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-teal-500/30 active:scale-95 transition">Book Now</button></div></div></div>)}
      {bookingPro && !isBookingSuccess && (<div className="absolute inset-0 bg-bgLight z-[60] flex flex-col"><div className="bg-white px-6 py-4 flex items-center shadow-sm"><button onClick={() => setBookingPro(null)} className="mr-4 text-gray-400"><i className="fas fa-arrow-left"></i></button><h2 className="font-bold text-gray-800">Book Service</h2></div><div className="flex-1 p-6 overflow-y-auto"><div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 flex items-center mb-6"><img src={bookingPro.avatar || `https://ui-avatars.com/api/?name=${bookingPro.name.replace(/ /g,'+')}&background=0D8ABC&color=fff`} className="w-12 h-12 rounded-xl object-cover" alt="Pro" /><div className="ml-3"><h3 className="font-bold text-sm text-gray-800">{bookingPro.name}</h3><p className="text-xs text-gray-500 font-bold">₦{bookingPro.price}/hr</p></div></div><form onSubmit={handleBookingSubmit}><div className="mb-4"><label className="text-xs font-bold text-gray-500 ml-1">Select Date</label><input type="date" required value={bookingData.date} onChange={e => setBookingData({...bookingData, date: e.target.value})} className="w-full bg-white border border-gray-200 p-4 rounded-xl mt-1 outline-none text-sm font-medium shadow-sm" /></div><div className="mb-4"><label className="text-xs font-bold text-gray-500 ml-1">Select Time</label><input type="time" required value={bookingData.time} onChange={e => setBookingData({...bookingData, time: e.target.value})} className="w-full bg-white border border-gray-200 p-4 rounded-xl mt-1 outline-none text-sm font-medium shadow-sm" /></div><div className="mb-8"><label className="text-xs font-bold text-gray-500 ml-1">Service Address</label><textarea required placeholder="Enter full address..." value={bookingData.address} onChange={e => setBookingData({...bookingData, address: e.target.value})} className="w-full bg-white border border-gray-200 p-4 rounded-xl mt-1 outline-none text-sm font-medium shadow-sm h-24 resize-none" /></div><button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-teal-500/30">Confirm Booking</button></form></div></div>)}
      {isBookingSuccess && (<div className="absolute inset-0 bg-primary z-[70] flex flex-col items-center justify-center p-8 text-center animate-[fadeIn_0.3s_ease-out]"><div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-primary text-4xl mb-6 shadow-2xl animate-[bounce_1s_ease-out]"><i className="fas fa-check"></i></div><h2 className="text-3xl font-black text-white mb-2">Booking Confirmed!</h2><p className="text-teal-100 mb-10 text-sm font-medium">Your service with {bookingPro?.name} is scheduled.</p><button onClick={() => { setIsBookingSuccess(false); setBookingPro(null); setViewingProfile(null); setActiveTab('bookings'); }} className="bg-white text-primary font-black py-4 px-12 rounded-2xl shadow-xl w-full">View My Bookings</button></div>)}

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 flex justify-around py-4 px-6 pb-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-10"><button onClick={() => setActiveTab('home')} className={`flex flex-col items-center transition ${activeTab === 'home' ? 'text-primary scale-110' : 'text-gray-400'}`}><i className="fas fa-home text-xl mb-1"></i><span className="text-[9px] font-bold">Home</span></button><button onClick={() => setActiveTab('bookings')} className={`flex flex-col items-center transition ${activeTab === 'bookings' ? 'text-primary scale-110' : 'text-gray-400'}`}><i className="fas fa-calendar-alt text-xl mb-1"></i><span className="text-[9px] font-bold">Bookings</span></button><button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center transition ${activeTab === 'chat' ? 'text-primary scale-110' : 'text-gray-400'}`}><i className="fas fa-comment-dots text-xl mb-1"></i><span className="text-[9px] font-bold">Chat</span></button><button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center transition ${activeTab === 'profile' ? 'text-primary scale-110' : 'text-gray-400'}`}><i className="fas fa-user text-xl mb-1"></i><span className="text-[9px] font-bold">Profile</span></button></div>
    </div>
  );
};

// ==========================================
// PROFESSIONAL DASHBOARD
// ==========================================
const ProfessionalApp = ({ socket, token }) => {
    const { user, logout } = useAuth(); 
    const [activeTab, setActiveTab] = useState('jobs'); 
    const [jobs, setJobs] = useState([]); 
    
    // PAGINATION
    const [jobPage, setJobPage] = useState(1);
    const ITEMS_PER_PAGE = 4;

    const [activeChatRoom, setActiveChatRoom] = useState(null); 
    const [messageList, setMessageList] = useState([]); 
    const [currentMessage, setCurrentMessage] = useState(''); 
    const chatEndRef = useRef(null); 
    
    const [viewingMapForJob, setViewingMapForJob] = useState(null); 
    const [mapPosition, setMapPosition] = useState([11.9964, 8.5167]); 
    const [isSharingLocation, setIsSharingLocation] = useState(false); 
    const [myLocation, setMyLocation] = useState(null); 
    const [partnerLocation, setPartnerLocation] = useState(null); 
    const watchIdRef = useRef(null); 
    
    const callLogic = useVideoCall(socket, activeChatRoom, user); 
    
    const [myProfile, setMyProfile] = useState(null); 
    const [isEditingProfile, setIsEditingProfile] = useState(false); 
    const [editForm, setEditForm] = useState({}); 
    const [isSaving, setIsSaving] = useState(false);

    // GUARANTEE ROOM JOINING
    useEffect(() => {
        if (socket && activeChatRoom) {
            socket.emit('join_room', activeChatRoom._id);
            const handleReconnect = () => socket.emit('join_room', activeChatRoom._id);
            socket.on('connect', handleReconnect);
            return () => socket.off('connect', handleReconnect);
        }
    }, [socket, activeChatRoom]);
    
    useEffect(() => { 
        fetch(`${backendUrl}/api/professionals`).then(res => res.json()).then(data => { if(Array.isArray(data)) { const me = data.find(p => p.userId === user.id); if(me) { setMyProfile(me); setEditForm(me); } } }); 
        
        if (token) {
            fetch(`${backendUrl}/api/pro/bookings`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()).then(data => setJobs(Array.isArray(data) ? data : [])); 
        }
        
        if (!socket) return;
        
        const onReceiveMessage = (data) => { 
            setMessageList((list) => [...list, data]); 
            if (activeChatRoom && data.room === activeChatRoom._id) { 
                socket.emit('mark_messages_read', { bookingId: activeChatRoom._id, userId: user.id }); 
            } 
        };
        const onMessagesReadUpdate = () => { setMessageList(prev => prev.map(msg => ({ ...msg, isRead: true }))); };
        const onReceiveLocation = (data) => { if (data.lat === null) setPartnerLocation(null); else setPartnerLocation({ lat: data.lat, lng: data.lng, author: data.author }); };
        
        socket.on('receive_message', onReceiveMessage); 
        socket.on('messages_read_update', onMessagesReadUpdate);
        socket.on('receive_live_location', onReceiveLocation); 
        
        return () => { 
            socket.off('receive_message', onReceiveMessage); 
            socket.off('messages_read_update', onMessagesReadUpdate);
            socket.off('receive_live_location', onReceiveLocation); 
            if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); 
        }; 
    }, [socket, activeChatRoom, user.id, token]);
    
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messageList]); 
    
    useEffect(() => { 
        if (activeTab !== 'chat' && isSharingLocation && !viewingMapForJob) { 
            if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); 
            setIsSharingLocation(false); 
            setMyLocation(null);
            if (activeChatRoom && socket) socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name }); 
        } 
    }, [activeTab, activeChatRoom, viewingMapForJob, isSharingLocation, socket, user.name]);
    
    const openChat = async (job) => { 
        setActiveChatRoom(job); 
        setMessageList([]); 
        setActiveTab('chat'); 
        fetch(`${backendUrl}/api/chat/${job._id}`, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => setMessageList(Array.isArray(data) ? data : [])); 
    };

    const sendMessage = async () => { 
        if (currentMessage && activeChatRoom && socket) { 
            const msgData = { room: activeChatRoom._id, senderId: user.id, author: user.name, message: currentMessage, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), isRead: false }; 
            await socket.emit('send_message', msgData); 
            setMessageList(list => [...list, msgData]); 
            setCurrentMessage(""); 
        } 
    };

    const updateJobStatus = async (id, status) => { const res = await fetch(`${backendUrl}/api/admin/bookings/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ status }) }); if (res.ok) setJobs(prev => prev.map(j => j._id === id ? { ...j, status } : j)); };
    const handleViewMap = async (job) => { setActiveChatRoom(job); setViewingMapForJob(job); try { const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(job.address)}`); const data = await res.json(); if (data.length > 0) setMapPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)]); } catch (err) {} };
    
    const toggleLocationSharing = () => { 
        if (!activeChatRoom) return alert("Open chat room first"); 
        if (isSharingLocation) { 
            if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); 
            setIsSharingLocation(false); 
            setMyLocation(null);
            if(socket) socket.emit('live_location_update', { room: activeChatRoom._id, lat: null, lng: null, author: user.name }); 
        } else { 
            if (navigator.geolocation) { 
                watchIdRef.current = navigator.geolocation.watchPosition((pos) => { 
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    setMyLocation({ lat, lng });
                    if(socket) socket.emit('live_location_update', { room: activeChatRoom._id, lat, lng, author: user.name }); 
                }, () => alert("GPS error. Please enable location services."), { enableHighAccuracy: true }); 
                setIsSharingLocation(true); 
            } 
        } 
    };
    
    const handleSaveProfile = async (e) => { e.preventDefault(); setIsSaving(true); try { const res = await fetch(`${backendUrl}/api/pro/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(editForm) }); const data = await res.json(); if (!res.ok) return alert('Save failed'); setMyProfile(data); setIsEditingProfile(false); } catch(err) {} finally { setIsSaving(false); } };
    
    const proMapCenter = myLocation ? [myLocation.lat, myLocation.lng] : mapPosition;
    
    // PAGINATION CALCULATION
    const totalJobPages = Math.ceil(jobs.length / ITEMS_PER_PAGE);
    const paginatedJobs = jobs.slice((jobPage - 1) * ITEMS_PER_PAGE, jobPage * ITEMS_PER_PAGE);

    return (
        <div className="bg-gray-900 w-full max-w-md mx-auto h-screen md:h-[850px] relative flex flex-col text-white md:rounded-[2.5rem] md:shadow-2xl overflow-hidden">
            <CallUI {...callLogic} />
            
            {activeTab === 'jobs' && (
                <div className="flex-1 overflow-y-auto px-6 pt-10 pb-28">
                    <h2 className="text-2xl font-bold mb-6">My Jobs</h2>
                    {paginatedJobs.map(job => (
                        <div key={job._id} className="bg-gray-800 p-5 rounded-2xl mb-4">
                            <div className="flex justify-between mb-3 border-b border-gray-700 pb-3"><h3 className="font-bold">{job.clientName}</h3><div className="px-2 py-1 rounded bg-gray-700 text-[10px] uppercase font-bold">{job.status}</div></div>
                            <button onClick={() => handleViewMap(job)} className="bg-gray-700 text-teal-400 px-3 py-1 rounded text-xs mb-4 font-bold shadow-sm flex items-center"><i className="fas fa-map-marker-alt mr-2"></i> View Map</button>
                            <div className="flex gap-2"><button onClick={() => openChat(job)} className="flex-1 py-2 bg-gray-700 text-xs font-bold rounded-lg">Chat</button>{job.status === 'pending' && <button onClick={() => updateJobStatus(job._id, 'confirmed')} className="flex-1 py-2 bg-teal-600 text-xs font-bold rounded-lg">Accept</button>}{job.status === 'confirmed' && <button onClick={() => updateJobStatus(job._id, 'completed')} className="flex-1 py-2 bg-blue-600 text-xs font-bold rounded-lg">Complete</button>}</div>
                        </div>
                    ))}
                    {paginatedJobs.length === 0 && <p className="text-center text-sm text-gray-500 py-8">No jobs found.</p>}
                    <Pagination currentPage={jobPage} totalPages={totalJobPages} onPageChange={setJobPage} />
                </div>
            )}
            
            {activeTab === 'chat' && activeChatRoom && (<div className="flex-1 flex flex-col bg-gray-900 z-20"><div className="bg-gray-800 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20"><div className="flex items-center"><button onClick={() => setActiveTab('jobs')} className="mr-4 text-gray-400"><i className="fas fa-arrow-left"></i></button><div><h3 className="font-bold text-white text-sm">{activeChatRoom.clientName}</h3><p className="text-[10px] text-teal-400 font-bold">Job Chat</p></div></div><div className="flex gap-3"><button onClick={callLogic.startCall} className="w-8 h-8 bg-gray-700 text-teal-400 rounded-full flex items-center justify-center text-xs"><i className="fas fa-video"></i></button></div></div><div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 pb-20">{messageList.map((msg, i) => { const isMe = msg.senderId === user.id; return (<div key={i} className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-teal-600 text-white self-end rounded-br-sm' : 'bg-gray-800 text-gray-200 self-start rounded-bl-sm'}`}><p>{msg.message}</p><div className="flex items-center justify-end mt-1 gap-1"><span className={`text-[9px] ${isMe ? 'text-teal-100' : 'text-gray-400'}`}>{msg.time}</span>{isMe && <span className={`text-[10px] ${msg.isRead ? 'text-blue-300' : 'text-teal-200'}`}>{msg.isRead ? '✓✓' : '✓'}</span>}</div></div>); })}<div ref={chatEndRef} /></div><div className="absolute bottom-0 w-full bg-gray-800 p-4 border-t border-gray-700 flex items-center gap-2"><div className="relative"><button onClick={toggleLocationSharing} className={`w-10 h-10 rounded-full flex items-center justify-center transition ${isSharingLocation ? 'bg-red-500/20 text-red-500' : 'bg-gray-700 text-gray-400'}`}><i className="fas fa-map-marker-alt"></i></button>{isSharingLocation && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>}</div><input type="text" placeholder="Type message..." value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} className="flex-1 bg-gray-700 text-white py-3 px-4 rounded-full text-sm outline-none placeholder-gray-400" /><button onClick={sendMessage} className="w-10 h-10 bg-teal-600 text-white rounded-full flex items-center justify-center shadow-md"><i className="fas fa-paper-plane"></i></button></div></div>)}
            
            {activeTab === 'profile' && (<div className="flex-1 overflow-y-auto px-6 pt-10 pb-28"><h2 className="text-2xl font-bold mb-6">Pro Dashboard</h2>{isEditingProfile ? (<form onSubmit={handleSaveProfile} className="bg-gray-800 p-6 rounded-3xl mb-6"><h3 className="font-bold mb-4 text-teal-400 border-b border-gray-700 pb-2">Edit Public Profile</h3><div className="mb-4"><label className="text-xs text-gray-400 font-bold">Headline (e.g., Expert Electrician)</label><input type="text" value={editForm.headline || ''} onChange={e => setEditForm({...editForm, headline: e.target.value})} className="w-full bg-gray-700 border-none p-3 rounded-xl mt-1 text-sm text-white outline-none focus:ring-1 focus:ring-teal-500" /></div><div className="mb-4"><label className="text-xs text-gray-400 font-bold">Category</label><select value={editForm.category || ''} onChange={e => setEditForm({...editForm, category: e.target.value})} className="w-full bg-gray-700 border-none p-3 rounded-xl mt-1 text-sm text-white outline-none"><option value="cleaning">Cleaning</option><option value="electric">Electric</option><option value="plumbing">Plumbing</option><option value="ac">AC Repair</option><option value="tech">Tech & IT</option></select></div><div className="mb-6"><label className="text-xs text-gray-400 font-bold">Hourly Rate (₦)</label><input type="number" value={editForm.price || ''} onChange={e => setEditForm({...editForm, price: e.target.value})} className="w-full bg-gray-700 border-none p-3 rounded-xl mt-1 text-sm text-white outline-none focus:ring-1 focus:ring-teal-500" /></div><div className="flex gap-3"><button type="button" onClick={() => setIsEditingProfile(false)} className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-bold text-sm">Cancel</button><button type="submit" disabled={isSaving} className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-bold text-sm shadow-lg">{isSaving ? 'Saving...' : 'Save Profile'}</button></div></form>) : myProfile && (<div className="bg-gray-800 p-6 rounded-3xl flex flex-col items-center mb-6 text-center"><img src={myProfile.avatar || `https://ui-avatars.com/api/?name=${myProfile.name.replace(/ /g,'+')}&background=0D8ABC&color=fff`} className="w-20 h-20 rounded-full object-cover mb-4 ring-2 ring-teal-500 ring-offset-2 ring-offset-gray-800" alt="Avatar" /><h3 className="text-xl font-bold">{myProfile.name}</h3><p className="text-teal-400 text-sm font-bold mb-3">{myProfile.headline || myProfile.title}</p><div className="flex gap-4 text-xs font-bold text-gray-400 mb-6"><span className="bg-gray-700 px-3 py-1 rounded-lg">₦{myProfile.price}/hr</span><span className="bg-gray-700 px-3 py-1 rounded-lg"><i className="fas fa-star text-orange-400 mr-1"></i> {myProfile.rating}</span></div><button onClick={() => setIsEditingProfile(true)} className="w-full py-3 bg-gray-700 text-white rounded-xl font-bold text-sm border border-gray-600 mb-3"><i className="fas fa-edit mr-2"></i> Edit Profile</button><button onClick={logout} className="w-full py-3 bg-red-500/10 text-red-500 font-bold rounded-xl border border-red-500/20"><i className="fas fa-sign-out-alt mr-2"></i> Log Out</button></div>)}</div>)}

            {viewingMapForJob && (
              <div className="absolute inset-0 bg-gray-900 z-50 flex flex-col animate-[slideUp_0.3s_ease-out]">
                  <div className="bg-gray-800 px-6 py-4 flex items-center shadow-sm z-10 relative">
                      <button onClick={() => setViewingMapForJob(null)} className="mr-4 text-gray-400"><i className="fas fa-arrow-left"></i></button>
                      <div>
                          <h3 className="font-bold text-white text-sm">Navigation</h3>
                          <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{viewingMapForJob.address}</p>
                      </div>
                  </div>
                  <div className="flex-1 relative z-0">
                      <MapContainer center={proMapCenter} zoom={15} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                          <LiveMapUpdater center={proMapCenter} />
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <Marker position={mapPosition}><Popup>Destination: {viewingMapForJob.address}</Popup></Marker>
                          {myLocation && (<Marker position={[myLocation.lat, myLocation.lng]}><Popup>You (Live)</Popup></Marker>)}
                          {partnerLocation && (<Marker position={[partnerLocation.lat, partnerLocation.lng]}><Popup>Client (Live)</Popup></Marker>)}
                      </MapContainer>
                      {!myLocation && isSharingLocation && (<div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-teal-500 text-white px-4 py-2 rounded-full text-xs font-bold z-[400] shadow-lg animate-pulse">Finding GPS Signal...</div>)}
                  </div>
              </div>
            )}
            
            <div className="absolute bottom-0 w-full bg-gray-800 border-t border-gray-700 flex justify-around py-4 px-6 pb-6 rounded-t-3xl z-10"><button onClick={() => setActiveTab('jobs')} className={`flex flex-col items-center transition ${activeTab === 'jobs' ? 'text-teal-400 scale-110' : 'text-gray-500'}`}><i className="fas fa-briefcase text-xl mb-1"></i><span className="text-[9px] font-bold">Jobs</span></button><button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center transition ${activeTab === 'profile' ? 'text-teal-400 scale-110' : 'text-gray-500'}`}><i className="fas fa-user-cog text-xl mb-1"></i><span className="text-[9px] font-bold">Profile</span></button></div>
        </div>
    );
};

// ==========================================
// MAIN APP COMPONENT
// ==========================================
const AppContent = () => {
    const { user, token } = useAuth();
    const [socket, setSocket] = useState(null);

    // GUARANTEE WEBSOCKETS + AUTO-RECONNECT
    useEffect(() => { 
        if (user && token) { 
            const newSocket = io(backendUrl, { 
                auth: { token },
                transports: ['websocket', 'polling'], // Force Render to use websockets immediately
                reconnection: true,
                reconnectionAttempts: 10
            }); 
            
            newSocket.on('connect', () => {
                console.log('✅ Socket connected successfully with ID:', newSocket.id);
            });

            newSocket.on('connect_error', (err) => {
                console.error('❌ Socket connection error:', err.message);
            });

            setSocket(newSocket); 
            
            return () => {
                newSocket.disconnect(); 
            };
        } 
    }, [user, token]);

    if (!user) return <AuthScreen />;
    return user.role === 'professional' ? <ProfessionalApp socket={socket} token={token} /> : <ClientApp socket={socket} token={token} />;
};

const App = () => { return (<AuthProvider><AppContent /></AuthProvider>); };

export default App;