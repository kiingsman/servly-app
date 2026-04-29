import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://YOUR-RENDER-APP-NAME.onrender.com';

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
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const endpoint = isLogin ? '/api/login' : '/api/signup';
    const payload = isLogin ? { email, password } : { name, email, password };

    try {
      const res = await fetch(`${backendUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Something went wrong');
      login(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-bgLight w-full max-w-md mx-auto h-screen md:h-[850px] md:rounded-[2.5rem] md:shadow-2xl relative overflow-hidden md:border-8 md:border-gray-900 flex flex-col justify-center px-8">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-teal-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-teal-600/30">
            <i className="fas fa-tools text-white text-3xl"></i>
        </div>
        <h1 className="text-4xl font-bold text-primary mb-2">Servly</h1>
        <p className="text-gray-500 font-medium">Your City's Premium Marketplace</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-primary mb-6">{isLogin ? 'Welcome Back' : 'Create an Account'}</h2>
        {error && <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm mb-4">{error}</div>}

        {!isLogin && (
          <div className="mb-4">
            <label className="text-xs font-bold text-primary ml-1">Full Name</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none focus:ring-2 focus:ring-teal-600 text-sm" placeholder="John Doe" />
          </div>
        )}
        <div className="mb-4">
          <label className="text-xs font-bold text-primary ml-1">Email Address</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none focus:ring-2 focus:ring-teal-600 text-sm" placeholder="john@example.com" />
        </div>
        <div className="mb-6">
          <label className="text-xs font-bold text-primary ml-1">Password</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mt-1 outline-none focus:ring-2 focus:ring-teal-600 text-sm" placeholder="••••••••" />
        </div>

        <button type="submit" disabled={isLoading} className="w-full bg-teal-600 text-white font-bold py-3.5 rounded-xl hover:bg-teal-700 transition shadow-md disabled:opacity-50">
          {isLoading ? 'Please wait...' : (isLogin ? 'Log In' : 'Sign Up')}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-8">
        {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
        <span onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-teal-600 font-bold cursor-pointer hover:underline">
          {isLogin ? 'Sign Up' : 'Log In'}
        </span>
      </p>
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

  const [viewingProfile, setViewingProfile] = useState(null);
  const [bookingPro, setBookingPro] = useState(null);
  const [bookingData, setBookingData] = useState({ date: '', time: '10:00 AM', address: '' });
  const [isBookingSuccess, setIsBookingSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${backendUrl}/api/professionals`)
      .then(res => res.json())
      .then(data => { setProfessionals(data); setLoadingPros(false); })
      .catch(err => { console.error(err); setLoadingPros(false); });
  }, []);

  useEffect(() => {
    if (activeTab === 'bookings') {
      setLoadingBookings(true);
      fetch(`${backendUrl}/api/bookings?userId=${user.name}`) // <-- Fetch ONLY this user's bookings!
        .then(res => res.json())
        .then(data => { setMyBookings(data); setLoadingBookings(false); })
        .catch(err => { console.error(err); setLoadingBookings(false); });
    }
  }, [activeTab, user.name]);

  const handleBookingSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      professionalId: bookingPro._id || bookingPro.id,
      professionalName: bookingPro.name,
      clientName: user.name, // <-- Save the real user's name!
      date: bookingData.date,
      time: bookingData.time,
      address: bookingData.address,
      totalPrice: bookingPro.price
    };

    fetch(`${backendUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(() => {
      setIsSubmitting(false);
      setIsBookingSuccess(true);
      if (activeTab === 'bookings') setActiveTab('home'); 
    })
    .catch(err => { console.error(err); setIsSubmitting(false); });
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
                        <p className="text-xs text-gray-500 font-medium">Hello, {user.name.split(' ')[0]} 👋</p>
                        <div className="flex items-center text-primary font-bold text-lg mt-1">
                            <i className="fas fa-map-marker-alt text-teal-600 mr-2"></i>Kano, NG
                        </div>
                    </div>
                    <div className="w-10 h-10 bg-teal-100 text-teal-600 font-bold rounded-full flex items-center justify-center">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                </div>
                <div className="relative flex items-center">
                    <i className="fas fa-search absolute left-4 text-gray-400 z-10"></i>
                    <input type="text" placeholder="What service do you need?" className="w-full bg-gray-100 py-4 pl-12 pr-12 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-teal-600 transition-all relative" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    <button className="absolute right-2 bg-primary text-white p-2.5 rounded-xl"><i className="fas fa-sliders-h"></i></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pt-6 pb-28">
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-primary">Categories</h2>
                        <span className="text-sm font-medium text-teal-600">See All</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        {categories.map(cat => (
                            <div key={cat.id} onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)} className="flex flex-col items-center cursor-pointer group">
                                <div className={`h-14 w-14 rounded-2xl flex justify-center items-center text-xl mb-2 transition-all ${cat.bg} ${cat.color} ${selectedCategory === cat.id ? 'ring-2 ring-teal-600 shadow-md scale-105' : ''}`}>
                                    <i className={`fas ${cat.icon}`}></i>
                                </div>
                                <span className={`text-[10px] font-medium text-center ${selectedCategory === cat.id ? 'text-teal-600 font-bold' : 'text-gray-600'}`}>{cat.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h2 className="text-lg font-bold text-primary mb-4">{selectedCategory ? `${categories.find(c => c.id === selectedCategory)?.name} Pros` : 'Top Rated Near You'}</h2>
                    {loadingPros ? (
                        <div className="text-center py-10"><i className="fas fa-spinner fa-spin text-teal-600 text-3xl"></i></div>
                    ) : filteredPros.map(pro => (
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
            {loadingBookings ? (
              <div className="text-center py-20"><i className="fas fa-spinner fa-spin text-teal-600 text-4xl"></i></div>
            ) : myBookings.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4"><i className="far fa-calendar-times text-3xl text-gray-400"></i></div>
                  <h3 className="font-bold text-primary mb-2">No Bookings Yet</h3>
                  <p className="text-gray-500 text-sm mb-6 px-4">You haven't booked any professionals yet.</p>
                  <button onClick={() => setActiveTab('home')} className="bg-teal-600 text-white font-medium px-6 py-3 rounded-xl">Find a Professional</button>
              </div>
            ) : myBookings.map(booking => (
              <div key={booking._id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-teal-600"></div>
                <div className="flex justify-between items-start border-b border-gray-50 pb-3 mb-3 pl-2">
                  <div>
                    <p className="text-xs text-gray-400 font-medium mb-1">Service with</p>
                    <h3 className="font-bold text-primary text-lg">{booking.professionalName}</h3>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase ${booking.status === 'pending' ? 'bg-orange-50 text-orange-500' : 'bg-teal-50 text-teal-600'}`}>{booking.status}</div>
                </div>
                <div className="pl-2">
                  <div className="flex items-center text-sm text-gray-600 mb-2"><i className="far fa-calendar-alt w-6 text-teal-600 text-center"></i><span className="font-medium">{new Date(booking.date).toLocaleDateString()} at {booking.time}</span></div>
                  <div className="flex items-start text-sm text-gray-600 mb-4"><i className="fas fa-map-marker-alt w-6 text-teal-600 text-center mt-1"></i><span className="flex-1">{booking.address}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- PROFILE TAB (NEW!) --- */}
        {activeTab === 'profile' && (
          <div className="flex-1 overflow-y-auto px-6 pt-10 pb-28 bg-gray-50">
            <h2 className="text-2xl font-bold text-primary mb-6">My Account</h2>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6 text-center">
              <div className="w-24 h-24 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center text-4xl font-bold mx-auto mb-4 border-4 border-white shadow-md">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <h3 className="font-bold text-xl text-primary">{user.name}</h3>
              <p className="text-gray-500 text-sm mb-6">{user.email}</p>
              <button onClick={logout} className="bg-red-50 text-red-500 font-bold py-3 px-8 rounded-xl hover:bg-red-100 transition w-full">
                Log Out
              </button>
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
                        <p className="text-gray-500 mb-8">Your request has been saved. Go to the Bookings tab to view it.</p>
                        <button onClick={() => { setBookingPro(null); setIsBookingSuccess(false); setActiveTab('bookings'); }} className="w-full bg-primary text-white font-bold py-4 rounded-2xl">View My Bookings</button>
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

                        <button type="submit" disabled={isSubmitting} className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl mt-auto">
                            {isSubmitting ? 'Confirming...' : 'Confirm Booking'}
                        </button>
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
                         <p className="text-gray-500 text-sm leading-relaxed mb-6">Highly skilled and reliable professional with years of experience.</p>
                         <button onClick={() => setBookingPro(viewingProfile)} className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl shadow-lg">Book Service Now</button>
                     </div>
                 </div>
             </div>
        )}

        {/* BOTTOM NAV */}
        <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-6 py-4 flex justify-between items-center pb-8 z-20">
            {['home', 'bookings', 'chat', 'profile'].map((tab, idx) => {
              const icons = ['fa-home', 'fa-calendar-alt', 'fa-comment-dots', 'fa-user'];
              const isSolid = (tab === 'home');
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

// ==========================================
// GLOBAL APP WRAPPER
// ==========================================
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