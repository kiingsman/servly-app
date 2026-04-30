import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import io from 'socket.io-client';

let rawUrl = import.meta.env.VITE_BACKEND_URL || 'https://servly-app-icy0.onrender.com';
const backendUrl = rawUrl.replace(/\/$/, "");

const socket = io(backendUrl);

// ==========================================
// AUTHENTICATION SCREEN
// ==========================================
const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setIsLoading(true);
    const endpoint = isLogin ? '/api/login' : '/api/signup';
    const payload = isLogin ? { email, password } : { name, email, password };

    try {
      const res = await fetch(`${backendUrl}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const data = isJson ? await res.json() : await res.text();
      if (!res.ok) throw new Error(isJson ? (data.message || 'Something went wrong') : 'Server returned an invalid format.');
      login(data.user, data.token);
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  return (
    <div className="bg-bgLight w-full max-w-md mx-auto h-screen md:h-[850px] md:rounded-[2.5rem] md:shadow-2xl relative overflow-hidden md:border-8 md:border-gray-900 flex flex-col justify-center px-8">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-teal-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-teal-600/30"><i className="fas fa-tools text-white text-3xl"></i></div>
        <h1 className="text-4xl font-bold text-primary mb-2">Servly</h1>
        <p className="text-gray-500 font-medium">Your City's Premium Marketplace</p>
      </div>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-primary mb-6">{isLogin ? 'Welcome Back' : 'Create an Account'}</h2>
        {error && <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm mb-4">{error}</div>}
        {!isLogin && <div className="mb-4"><label className="text-xs font-bold text-primary ml-1">Full Name</label><input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none focus:ring-2 focus:ring-teal-600 text-sm" placeholder="John Doe" /></div>}
        <div className="mb-4"><label className="text-xs font-bold text-primary ml-1">Email Address</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none focus:ring-2 focus:ring-teal-600 text-sm" placeholder="john@example.com" /></div>
        <div className="mb-6"><label className="text-xs font-bold text-primary ml-1">Password</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none focus:ring-2 focus:ring-teal-600 text-sm" placeholder="••••••••" /></div>
        <button type="submit" disabled={isLoading} className="w-full bg-teal-600 text-white font-bold py-3.5 rounded-xl hover:bg-teal-700 transition shadow-md disabled:opacity-50">{isLoading ? 'Please wait...' : (isLogin ? 'Log In' : 'Sign Up')}</button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-8">{isLogin ? "Don't have an account?" : "Already have an account?"} <span onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-teal-600 font-bold cursor-pointer hover:underline">{isLogin ? 'Sign Up' : 'Log In'}</span></p>
    </div>
  );
};

// ==========================================
// MAIN DASHBOARD SCREEN
// ==========================================
const MainApp = () => {
  const { user, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [loadingPros, setLoadingPros] = useState(true);

  const [myBookings, setMyBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const [adminTab, setAdminTab] = useState('bookings');
  const [adminBookings, setAdminBookings] = useState([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [newProData, setNewProData] = useState({ name: '', title: '', category: 'cleaning', price: '', avatar: '' });
  const [isAddingPro, setIsAddingPro] = useState(false);

  const [viewingProfile, setViewingProfile] = useState(null);
  const [bookingPro, setBookingPro] = useState(null);
  const [bookingData, setBookingData] = useState({ date: '', time: '10:00 AM', address: '' });
  const [isBookingSuccess, setIsBookingSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- CHAT STATE ---
  const [currentMessage, setCurrentMessage] = useState('');
  const [messageList, setMessageList] = useState([]);
  // activeChatRoom now holds the full booking object so we know the Pro's name
  const [activeChatRoom, setActiveChatRoom] = useState(null); 
  const chatEndRef = useRef(null);

  const fetchProfessionals = () => {
    fetch(`${backendUrl}/api/professionals`)
      .then(res => res.json())
      .then(data => { setProfessionals(data); setLoadingPros(false); })
      .catch(() => setLoadingPros(false));
  };

  useEffect(() => { fetchProfessionals(); }, []);

  // Handle incoming socket messages
  useEffect(() => {
      const receiveMessageHandler = (data) => {
          setMessageList((list) => [...list, data]);
      };
      socket.on('receive_message', receiveMessageHandler);
      return () => socket.off('receive_message', receiveMessageHandler);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messageList, activeTab]);

  useEffect(() => {
    if (activeTab === 'bookings') {
      setLoadingBookings(true);
      fetch(`${backendUrl}/api/bookings`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } })
        .then(res => { if (res.status === 401) { logout(); throw new Error("Expired."); } return res.json(); })
        .then(data => { setMyBookings(data); setLoadingBookings(false); })
        .catch(() => setLoadingBookings(false));
    }
    if (activeTab === 'admin' && adminTab === 'bookings') {
      setLoadingAdmin(true);
      fetch(`${backendUrl}/api/admin/bookings`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } })
        .then(res => res.json())
        .then(data => { setAdminBookings(data); setLoadingAdmin(false); })
        .catch(() => setLoadingAdmin(false));
    }
    
    // Join specific room when chat opens
    if (activeTab === 'chat' && activeChatRoom) {
        socket.emit('join_room', activeChatRoom._id);
    }
  }, [activeTab, adminTab, logout, activeChatRoom]);

  const handleBookingSubmit = (e) => {
    e.preventDefault(); setIsSubmitting(true);
    const payload = { professionalId: bookingPro._id || bookingPro.id, professionalName: bookingPro.name, date: bookingData.date, time: bookingData.time, address: bookingData.address, totalPrice: bookingPro.price };
    fetch(`${backendUrl}/api/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }, body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(() => { setIsSubmitting(false); setIsBookingSuccess(true); })
    .catch(() => setIsSubmitting(false));
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Cancel this booking?")) return;
    const res = await fetch(`${backendUrl}/api/bookings/${bookingId}/cancel`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } });
    if (res.ok) setMyBookings(prev => prev.map(b => b._id === bookingId ? { ...b, status: 'cancelled' } : b));
  };

  const handleAdminStatusUpdate = async (bookingId, newStatus) => {
    const res = await fetch(`${backendUrl}/api/admin/bookings/${bookingId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }, body: JSON.stringify({ status: newStatus }) });
    if (res.ok) setAdminBookings(prev => prev.map(b => b._id === bookingId ? { ...b, status: newStatus } : b));
  };

  const handleAddProfessional = async (e) => {
      e.preventDefault(); setIsAddingPro(true);
      try {
          const res = await fetch(`${backendUrl}/api/admin/professionals`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }, body: JSON.stringify({ ...newProData, price: Number(newProData.price) }) });
          if (res.ok) { alert("Professional Added!"); setNewProData({ name: '', title: '', category: 'cleaning', price: '', avatar: '' }); fetchProfessionals(); setActiveTab('home'); }
      } catch (err) { console.error(err); } finally { setIsAddingPro(false); }
  };

  // Open a private chat room
  const openPrivateChat = (booking) => {
      setActiveChatRoom(booking);
      setMessageList([]); // Clear previous chat history for UI
      setActiveTab('chat');
  };

  const sendMessage = async () => {
      if (currentMessage !== "" && activeChatRoom) {
          const messageData = {
              room: activeChatRoom._id, // Send to this exact booking ID room
              author: user.name,
              message: currentMessage,
              time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes()
          };
          await socket.emit('send_message', messageData);
          setMessageList((list) => [...list, messageData]); 
          setCurrentMessage(""); 
      }
  };

  const categories = [
    { id: 'electric', name: 'Electric', icon: 'fa-bolt', color: 'text-orange-500', bg: 'bg-orange-50' },
    { id: 'plumbing', name: 'Plumbing', icon: 'fa-wrench', color: 'text-teal-600', bg: 'bg-teal-50' },
    { id: 'cleaning', name: 'Cleaning', icon: 'fa-broom', color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'ac', name: 'AC Repair', icon: 'fa-snowflake', color: 'text-purple-500', bg: 'bg-purple-50' }
  ];

  const filteredPros = professionals.filter(pro => {
    if (selectedCategory && pro.category !== selectedCategory) return false;
    if (searchQuery && !pro.name.toLowerCase().includes(searchQuery.toLowerCase()) && !pro.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="bg-bgLight w-full max-w-md mx-auto h-screen md:h-[850px] md:rounded-[2.5rem] md:shadow-2xl relative overflow-hidden md:border-8 md:border-gray-900 flex flex-col">
        
        {/* --- HOME TAB --- */}
        {activeTab === 'home' && (
          <>
            <div className="px-6 pt-10 pb-4 bg-white rounded-b-3xl shadow-sm z-10 relative">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <p className="text-xs text-gray-500 font-medium">Hello, {user?.name?.split(' ')[0] || 'Guest'} 👋</p>
                        <div className="flex items-center text-primary font-bold text-lg mt-1"><i className="fas fa-map-marker-alt text-teal-600 mr-2"></i>Kano, NG</div>
                    </div>
                    <div className="w-10 h-10 bg-teal-100 text-teal-600 font-bold rounded-full flex items-center justify-center">{user?.name?.charAt(0).toUpperCase() || 'G'}</div>
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
                    {loadingPros ? <div className="text-center py-10"><i className="fas fa-spinner fa-spin text-teal-600 text-3xl"></i></div> : filteredPros.map(pro => (
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

        {/* --- BOOKINGS TAB --- */}
        {activeTab === 'bookings' && (
          <div className="flex-1 overflow-y-auto px-6 pt-10 pb-28 bg-gray-50">
            <h2 className="text-2xl font-bold text-primary mb-6">My Bookings</h2>
            {loadingBookings ? <div className="text-center py-20"><i className="fas fa-spinner fa-spin text-teal-600 text-4xl"></i></div> : myBookings.length === 0 ? <p className="text-center text-gray-500 mt-10">No bookings yet.</p> : myBookings.map(booking => {
                let statusColor = booking.status === 'confirmed' ? 'bg-teal-50 text-teal-600' : booking.status === 'completed' ? 'bg-blue-50 text-blue-600' : booking.status === 'cancelled' ? 'bg-red-50 text-red-500 line-through opacity-70' : 'bg-orange-50 text-orange-500';
                return (
                  <div key={booking._id} className={`bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-4 relative ${booking.status === 'cancelled' ? 'opacity-60' : ''}`}>
                    <div className={`absolute top-0 left-0 w-1 h-full ${booking.status === 'cancelled' ? 'bg-red-500' : 'bg-teal-600'}`}></div>
                    <div className="flex justify-between items-start border-b border-gray-50 pb-3 mb-3 pl-2">
                      <div><p className="text-xs text-gray-400 font-medium mb-1">Service with</p><h3 className="font-bold text-primary text-lg">{booking.professionalName}</h3></div>
                      <div className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase ${statusColor}`}>{booking.status}</div>
                    </div>
                    <div className="pl-2">
                      <p className="text-sm text-gray-600 mb-4"><i className="far fa-calendar-alt w-6 text-teal-600 text-center"></i>{new Date(booking.date).toLocaleDateString()} at {booking.time}</p>
                      
                      {/* Actions row: Cancel and Chat */}
                      {booking.status !== 'cancelled' && (
                          <div className="flex gap-2">
                              {booking.status === 'pending' && <button onClick={() => handleCancelBooking(booking._id)} className="flex-1 py-2 bg-red-50 text-red-500 text-xs font-bold rounded-xl hover:bg-red-100">Cancel</button>}
                              <button onClick={() => openPrivateChat(booking)} className="flex-1 py-2 bg-teal-50 text-teal-600 text-xs font-bold rounded-xl hover:bg-teal-100"><i className="far fa-comment-dots mr-1"></i> Message Pro</button>
                          </div>
                      )}
                    </div>
                  </div>
                );
            })}
          </div>
        )}

        {/* --- CHAT TAB --- */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col bg-gray-50 pb-20 relative animate-[slideLeft_0.3s_ease-out] z-30">
             {activeChatRoom ? (
                 <>
                    <div className="px-6 pt-10 pb-4 bg-white border-b border-gray-100 shadow-sm z-10 sticky top-0 flex items-center">
                        <button onClick={() => setActiveTab('bookings')} className="mr-4 text-gray-400 hover:text-teal-600"><i className="fas fa-chevron-left text-xl"></i></button>
                        <div>
                            <h2 className="text-lg font-bold text-primary">{activeChatRoom.professionalName}</h2>
                            <p className="text-xs text-teal-600 font-medium mt-0.5"><i className="fas fa-lock text-[8px] mr-1"></i> Private Booking Room</p>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
                        {messageList.length === 0 ? (
                            <div className="text-center text-gray-400 mt-10">
                                <i className="far fa-comments text-4xl mb-3 opacity-50"></i>
                                <p>No messages here yet.</p>
                                <p className="text-xs mt-1">Send a message to {activeChatRoom.professionalName} regarding your booking.</p>
                            </div>
                        ) : (
                            messageList.map((msg, index) => {
                                const isMe = msg.author === user.name;
                                return (
                                    <div key={index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <div className={`px-4 py-3 rounded-2xl max-w-[80%] ${isMe ? 'bg-teal-600 text-white rounded-br-none shadow-md' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none shadow-sm'}`}>
                                            <p className="text-sm">{msg.message}</p>
                                        </div>
                                        <div className="flex gap-2 mt-1 text-[10px] text-gray-400 font-medium px-1">
                                            <span>{msg.time}</span>
                                            <span>•</span>
                                            <span>{msg.author}</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="absolute bottom-[72px] left-0 w-full bg-white border-t border-gray-100 p-4">
                        <div className="flex items-center gap-3">
                            <input type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} onKeyPress={(e) => { e.key === "Enter" && sendMessage(); }} placeholder="Type a message..." className="flex-1 bg-gray-100 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-600" />
                            <button onClick={sendMessage} className="bg-teal-600 text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-teal-700 transition shadow-md"><i className="fas fa-paper-plane"></i></button>
                        </div>
                    </div>
                 </>
             ) : (
                 // If user clicks the raw Chat icon from nav without selecting a booking
                 <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                     <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4"><i className="far fa-comment-dots text-3xl text-gray-400"></i></div>
                     <h2 className="text-xl font-bold text-primary mb-2">No Active Chat</h2>
                     <p className="text-gray-500 text-sm mb-6">Select a booking to start messaging the professional.</p>
                     <button onClick={() => setActiveTab('bookings')} className="bg-teal-600 text-white font-bold px-6 py-3 rounded-xl">Go to My Bookings</button>
                 </div>
             )}
          </div>
        )}

        {/* --- ADMIN DASHBOARD TAB --- */}
        {activeTab === 'admin' && (
          <div className="flex-1 overflow-y-auto bg-gray-900 flex flex-col h-full">
            <div className="px-6 pt-10 pb-4 flex justify-between items-center sticky top-0 bg-gray-900 z-10 border-b border-gray-800">
                <h2 className="text-2xl font-bold text-white"><i className="fas fa-shield-alt mr-2 text-teal-400"></i>Admin</h2>
                <button onClick={() => setActiveTab('profile')} className="text-gray-400 hover:text-white bg-gray-800 px-3 py-1 rounded-lg text-xs font-bold">Close</button>
            </div>
            
            <div className="flex px-6 mt-4 mb-6">
                <button onClick={() => setAdminTab('bookings')} className={`flex-1 py-3 text-sm font-bold rounded-l-xl border border-gray-700 ${adminTab === 'bookings' ? 'bg-teal-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>All Bookings</button>
                <button onClick={() => setAdminTab('addPro')} className={`flex-1 py-3 text-sm font-bold rounded-r-xl border border-gray-700 border-l-0 ${adminTab === 'addPro' ? 'bg-teal-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}><i className="fas fa-user-plus mr-2"></i>Add Pro</button>
            </div>

            <div className="px-6 pb-28">
                {adminTab === 'bookings' && (
                    loadingAdmin ? <div className="text-center py-10"><i className="fas fa-spinner fa-spin text-teal-400 text-4xl"></i></div> : adminBookings.map(booking => {
                        return (
                        <div key={booking._id} className="bg-gray-800 p-5 rounded-2xl mb-4 border border-gray-700">
                            <div className="flex justify-between items-start mb-3 border-b border-gray-700 pb-3">
                                <div><p className="text-xs text-gray-400">Client: <strong className="text-white">{booking.clientName}</strong></p><p className="text-xs text-gray-400">Pro: <strong className="text-white">{booking.professionalName}</strong></p></div>
                                <div className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-gray-700 text-white">{booking.status}</div>
                            </div>
                            {booking.status !== 'cancelled' && (
                                <div className="flex gap-2 mt-4">
                                    {booking.status === 'pending' && <button onClick={() => handleAdminStatusUpdate(booking._id, 'confirmed')} className="flex-1 bg-teal-600 text-white text-xs py-2 rounded-lg font-bold">Confirm</button>}
                                    {booking.status === 'confirmed' && <button onClick={() => handleAdminStatusUpdate(booking._id, 'completed')} className="flex-1 bg-blue-600 text-white text-xs py-2 rounded-lg font-bold">Complete</button>}
                                    <button onClick={() => handleAdminStatusUpdate(booking._id, 'cancelled')} className="flex-1 bg-gray-700 text-red-400 text-xs py-2 rounded-lg font-bold">Cancel</button>
                                </div>
                            )}
                        </div>
                        );
                    })
                )}

                {adminTab === 'addPro' && (
                    <form onSubmit={handleAddProfessional} className="bg-gray-800 p-6 rounded-2xl border border-gray-700 flex flex-col gap-4">
                        <div><label className="text-xs font-bold text-gray-400">Full Name</label><input type="text" required value={newProData.name} onChange={e => setNewProData({...newProData, name: e.target.value})} className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded-xl mt-1" /></div>
                        <div><label className="text-xs font-bold text-gray-400">Job Title</label><input type="text" required value={newProData.title} onChange={e => setNewProData({...newProData, title: e.target.value})} className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded-xl mt-1" /></div>
                        <div><label className="text-xs font-bold text-gray-400">Category</label><select value={newProData.category} onChange={e => setNewProData({...newProData, category: e.target.value})} className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded-xl mt-1"><option value="cleaning">Cleaning</option><option value="electric">Electric</option><option value="plumbing">Plumbing</option><option value="ac">AC Repair</option></select></div>
                        <div><label className="text-xs font-bold text-gray-400">Hourly Price (₦)</label><input type="number" required value={newProData.price} onChange={e => setNewProData({...newProData, price: e.target.value})} className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded-xl mt-1" /></div>
                        <div><label className="text-xs font-bold text-gray-400">Avatar Image URL</label><input type="text" value={newProData.avatar} onChange={e => setNewProData({...newProData, avatar: e.target.value})} className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded-xl mt-1" /></div>
                        <button type="submit" disabled={isAddingPro} className="w-full bg-teal-600 text-white font-bold py-4 rounded-xl mt-4">{isAddingPro ? 'Adding...' : 'Add Professional'}</button>
                    </form>
                )}
            </div>
          </div>
        )}

        {/* --- PROFILE TAB --- */}
        {activeTab === 'profile' && (
          <div className="flex-1 overflow-y-auto px-6 pt-10 pb-28 bg-gray-50">
            <h2 className="text-2xl font-bold text-primary mb-6">My Account</h2>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6 text-center">
              <div className="w-24 h-24 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center text-4xl font-bold mx-auto mb-4 border-4 border-white shadow-md">{user?.name?.charAt(0).toUpperCase() || 'G'}</div>
              <h3 className="font-bold text-xl text-primary">{user?.name || 'User'}</h3>
              <p className="text-gray-500 text-sm mb-6">{user?.email || ''}</p>
              <button onClick={logout} className="bg-red-50 text-red-500 font-bold py-3 px-8 rounded-xl hover:bg-red-100 transition w-full">Log Out</button>
            </div>
            <div onClick={() => setActiveTab('admin')} className="bg-gray-900 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-gray-800 transition shadow-lg mt-4">
                <div className="flex items-center">
                    <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center mr-4"><i className="fas fa-shield-alt text-teal-400"></i></div>
                    <div><h4 className="text-white font-bold text-sm">Admin Dashboard</h4><p className="text-gray-400 text-xs">Manage platform & pros</p></div>
                </div>
                <i className="fas fa-chevron-right text-gray-500 text-sm"></i>
            </div>
          </div>
        )}

        {/* ---------------- OVERLAYS ---------------- */}
        {bookingPro && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col animate-[slideUp_0.3s_ease-out]">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="font-bold text-xl text-primary">Book Service</h2>
                    <button onClick={() => { setBookingPro(null); setIsBookingSuccess(false); }} className="bg-gray-100 h-10 w-10 rounded-full"><i className="fas fa-times"></i></button>
                </div>
                {isBookingSuccess ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mb-6"><i className="fas fa-check text-4xl text-teal-600"></i></div>
                        <h2 className="text-2xl font-bold text-primary mb-2">Booking Confirmed!</h2>
                        <button onClick={() => { setBookingPro(null); setIsBookingSuccess(false); setActiveTab('bookings'); }} className="w-full bg-primary text-white font-bold py-4 rounded-2xl mt-8">View My Bookings</button>
                    </div>
                ) : (
                    <form onSubmit={handleBookingSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col pb-28">
                        <label className="text-sm font-bold text-primary mb-2">Select Date</label>
                        <input type="date" required className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-teal-600" value={bookingData.date} onChange={e => setBookingData({...bookingData, date: e.target.value})} />
                        <label className="text-sm font-bold text-primary mb-2">Select Time</label>
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {['10:00 AM', '1:00 PM', '4:00 PM'].map(time => (
                                <div key={time} onClick={() => setBookingData({...bookingData, time})} className={`text-center py-3 rounded-xl text-sm font-medium cursor-pointer ${bookingData.time === time ? 'bg-primary text-white' : 'bg-gray-50 text-gray-600'}`}>{time}</div>
                            ))}
                        </div>
                        <label className="text-sm font-bold text-primary mb-2">Address</label>
                        <textarea required className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl mb-6 h-28 outline-none focus:ring-2 focus:ring-teal-600 resize-none" value={bookingData.address} onChange={e => setBookingData({...bookingData, address: e.target.value})}></textarea>
                        <button type="submit" disabled={isSubmitting} className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl mt-auto">{isSubmitting ? 'Confirming...' : 'Confirm Booking'}</button>
                    </form>
                )}
            </div>
        )}

        {viewingProfile && !bookingPro && (
             <div className="absolute inset-0 bg-white z-40 flex flex-col animate-[slideLeft_0.3s_ease-out]">
                 <div className="flex justify-between items-center p-6 bg-white border-b border-gray-100">
                     <button onClick={() => setViewingProfile(null)} className="h-10 w-10 rounded-full bg-gray-50 text-gray-600"><i className="fas fa-chevron-left"></i></button>
                 </div>
                 <div className="flex-1 overflow-y-auto pb-28">
                     <img src={viewingProfile.avatar} className="w-28 h-28 rounded-full border-4 border-white shadow-lg mx-auto mt-6 object-cover" />
                     <div className="p-6 text-center">
                         <h1 className="text-2xl font-bold text-primary">{viewingProfile.name}</h1>
                         <p className="text-teal-600 font-medium mb-4">{viewingProfile.title}</p>
                         <button onClick={() => setBookingPro(viewingProfile)} className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl shadow-lg mt-4">Book Service Now</button>
                     </div>
                 </div>
             </div>
        )}

        {/* BOTTOM NAV */}
        <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-6 py-4 flex justify-between items-center pb-8 z-20">
            {['home', 'bookings', 'chat', 'profile'].map((tab, idx) => {
              const icons = ['fa-home', 'fa-calendar-alt', 'fa-comment-dots', 'fa-user'];
              const isSolid = (tab === 'home' && activeTab !== 'admin');
              return (
                <div key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center cursor-pointer ${activeTab === tab ? 'text-teal-600' : 'text-gray-400'}`}>
                    <i className={`${isSolid ? 'fas' : 'far'} ${icons[idx]} text-xl mb-1`}></i>
                    <span className="text-[10px] font-bold mt-1 capitalize">{tab}</span>
                </div>
              );
            })}
        </div>

        <style>{`
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
        `}</style>
    </div>
  );
};

const AppController = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen bg-gray-200 flex items-center justify-center"><i className="fas fa-circle-notch fa-spin text-teal-600 text-4xl"></i></div>;
  return user ? <MainApp /> : <AuthScreen />;
};

const App = () => (
  <AuthProvider>
    <AppController />
  </AuthProvider>
);

export default App;