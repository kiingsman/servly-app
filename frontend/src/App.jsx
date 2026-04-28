import React, { useState, useEffect } from 'react';

const App = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Overlays State
  const [viewingProfile, setViewingProfile] = useState(null);
  const [bookingPro, setBookingPro] = useState(null);
  const [bookingData, setBookingData] = useState({ date: '', time: '10:00 AM', address: '' });
  const [isBookingSuccess, setIsBookingSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Force the live Render URL if the environment variable fails
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://YOUR-RENDER-APP-NAME.onrender.com';

  useEffect(() => {
    fetch(`${backendUrl}/api/professionals`)
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        setProfessionals(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching pros:", err);
        setLoading(false);
      });
  }, [backendUrl]);

  const handleBookingSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      professionalId: bookingPro._id || bookingPro.id,
      professionalName: bookingPro.name,
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
    })
    .catch(err => {
      console.error("Booking error:", err);
      setIsSubmitting(false);
    });
  };

  const closeBooking = () => {
    setBookingPro(null);
    setIsBookingSuccess(false);
    setBookingData({ date: '', time: '10:00 AM', address: '' });
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
        
        {/* Header */}
        <div className="px-6 pt-10 pb-4 bg-white rounded-b-3xl shadow-sm z-10 relative">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <p className="text-xs text-gray-500 font-medium">Current Location</p>
                    <div className="flex items-center text-primary font-bold text-lg mt-1">
                        <i className="fas fa-map-marker-alt text-teal-600 mr-2"></i>
                        Kano, NG <i className="fas fa-chevron-down text-sm ml-2 text-gray-400 cursor-pointer"></i>
                    </div>
                </div>
                <button className="bg-gray-100 p-3 rounded-full relative hover:bg-gray-200 transition">
                    <i className="far fa-bell text-gray-600"></i>
                </button>
            </div>
            <div className="relative flex items-center">
                <i className="fas fa-search absolute left-4 text-gray-400 z-10"></i>
                <input type="text" placeholder="What service do you need?" className="w-full bg-gray-100 py-4 pl-12 pr-12 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-teal-600 transition-all relative" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                <button className="absolute right-2 bg-primary text-white p-2.5 rounded-xl hover:bg-gray-800 transition z-10"><i className="fas fa-sliders-h"></i></button>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-28">
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-primary">Categories</h2>
                    <span className="text-sm font-medium text-teal-600 cursor-pointer">See All</span>
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
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-primary">
                        {selectedCategory ? `${categories.find(c => c.id === selectedCategory)?.name} Pros` : 'Top Rated Near You'}
                    </h2>
                </div>
                {loading ? (
                    <div className="text-center py-10"><i className="fas fa-spinner fa-spin text-teal-600 text-3xl mb-3"></i></div>
                ) : filteredPros.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-3xl border border-gray-100">
                        <i className="fas fa-search text-3xl text-gray-300 mb-3"></i><p className="text-gray-500 text-sm">No professionals found.</p>
                    </div>
                ) : (
                    filteredPros.map(pro => (
                        <div 
                            key={pro._id || pro.id} 
                            onClick={() => setViewingProfile(pro)} 
                            className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-4 hover:shadow-md transition cursor-pointer"
                        >
                            <div className="flex items-center">
                                <img src={pro.avatar} alt={pro.name} className="w-16 h-16 rounded-2xl object-cover mr-4" />
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-primary text-md">{pro.name} {pro.verified && <i className="fas fa-check-circle text-teal-600 text-xs ml-1"></i>}</h3>
                                        <div className="flex items-center bg-orange-50 px-2 py-1 rounded-lg"><i className="fas fa-star text-orange-400 text-[10px] mr-1"></i><span className="text-xs font-bold text-orange-600">{pro.rating}</span></div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{pro.title} • {pro.distance}</p>
                                    <div className="mt-3 flex justify-between items-center">
                                        <span className="text-sm font-bold text-primary">₦{pro.price.toLocaleString()}<span className="text-xs text-gray-400 font-normal">/hr</span></span>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setBookingPro(pro); }} 
                                            className="bg-primary text-white text-xs font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition"
                                        >
                                            Book
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* ---------------- PROFESSIONAL PROFILE OVERLAY ---------------- */}
        {viewingProfile && !bookingPro && (
            <div className="absolute inset-0 bg-white z-40 flex flex-col animate-[slideLeft_0.3s_ease-out]">
                {/* Profile Header */}
                <div className="flex justify-between items-center p-6 bg-white border-b border-gray-100 sticky top-0 z-10">
                    <button onClick={() => setViewingProfile(null)} className="h-10 w-10 rounded-full flex justify-center items-center bg-gray-50 text-gray-600 hover:bg-gray-200 transition">
                        <i className="fas fa-chevron-left"></i>
                    </button>
                    <div className="flex space-x-3">
                        <button className="h-10 w-10 rounded-full flex justify-center items-center bg-gray-50 text-gray-600 hover:bg-gray-200"><i className="far fa-heart"></i></button>
                        <button className="h-10 w-10 rounded-full flex justify-center items-center bg-gray-50 text-gray-600 hover:bg-gray-200"><i className="fas fa-share-alt"></i></button>
                    </div>
                </div>

                {/* Profile Scrollable Content */}
                <div className="flex-1 overflow-y-auto pb-28">
                    {/* Hero Image */}
                    <div className="w-full h-48 bg-gray-100 flex items-center justify-center relative overflow-hidden">
                        <img src={viewingProfile.avatar} className="w-full h-full object-cover blur-md opacity-40 absolute" alt="background blur" />
                        <img src={viewingProfile.avatar} className="w-28 h-28 rounded-full border-4 border-white shadow-lg relative z-10 object-cover" alt="profile avatar" />
                    </div>

                    <div className="p-6">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h1 className="text-2xl font-bold text-primary">{viewingProfile.name} {viewingProfile.verified && <i className="fas fa-check-circle text-teal-600 text-sm ml-1"></i>}</h1>
                                <p className="text-teal-600 font-medium">{viewingProfile.title}</p>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xl font-bold text-primary">₦{viewingProfile.price.toLocaleString()}</span>
                                <span className="text-xs text-gray-400">per hour</span>
                            </div>
                        </div>

                        {/* Badges */}
                        <div className="flex space-x-4 mb-6 border-b border-gray-100 pb-6 mt-4">
                            <div className="flex items-center text-sm font-medium text-gray-600">
                                <i className="fas fa-star text-orange-400 mr-2"></i> {viewingProfile.rating} ({viewingProfile.reviews} reviews)
                            </div>
                            <div className="flex items-center text-sm font-medium text-gray-600">
                                <i className="fas fa-map-marker-alt text-gray-400 mr-2"></i> {viewingProfile.distance} away
                            </div>
                        </div>

                        {/* About Section */}
                        <h2 className="text-lg font-bold text-primary mb-3">About</h2>
                        <p className="text-gray-500 text-sm leading-relaxed mb-6">
                            Highly skilled and reliable professional with years of experience providing top-notch service. Committed to customer satisfaction, safety, and delivering high-quality results on every single job.
                        </p>

                        {/* Reviews Preview */}
                        <h2 className="text-lg font-bold text-primary mb-3">Recent Reviews</h2>
                        <div className="bg-gray-50 p-4 rounded-2xl mb-4 border border-gray-100">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex text-orange-400 text-xs">
                                    <i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i>
                                </div>
                                <span className="text-xs text-gray-400">2 days ago</span>
                            </div>
                            <p className="text-sm text-gray-600 font-medium">"Excellent service! Arrived on time and did a fantastic job. Highly recommended."</p>
                        </div>
                    </div>
                </div>

                {/* Bottom Book Bar */}
                <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-6 py-4 pb-8 z-20 md:rounded-b-[2.5rem]">
                    <button onClick={() => setBookingPro(viewingProfile)} className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl hover:bg-teal-700 transition shadow-lg shadow-teal-600/30">
                        Book Service Now
                    </button>
                </div>
            </div>
        )}

        {/* ---------------- BOOKING OVERLAY MODAL ---------------- */}
        {bookingPro && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col animate-[slideUp_0.3s_ease-out]">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white">
                    <h2 className="font-bold text-xl text-primary">Book Service</h2>
                    <button onClick={closeBooking} className="bg-gray-100 h-10 w-10 rounded-full flex justify-center items-center text-gray-500 hover:bg-gray-200"><i className="fas fa-times"></i></button>
                </div>
                
                {isBookingSuccess ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mb-6">
                            <i className="fas fa-check text-4xl text-teal-600"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-primary mb-2">Booking Confirmed!</h2>
                        <p className="text-gray-500 mb-8">Your request has been sent to {bookingPro.name}. They will arrive at the scheduled time.</p>
                        <button onClick={closeBooking} className="w-full bg-primary text-white font-bold py-4 rounded-2xl hover:bg-gray-800 transition">Done</button>
                    </div>
                ) : (
                    <form onSubmit={handleBookingSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col pb-28">
                        <div className="bg-gray-50 p-4 rounded-2xl flex items-center mb-6 border border-gray-100">
                            <img src={bookingPro.avatar} className="w-12 h-12 rounded-xl object-cover mr-4" alt="avatar"/>
                            <div>
                                <p className="font-bold text-primary">{bookingPro.name}</p>
                                <p className="text-xs text-teal-600 font-medium">{bookingPro.title}</p>
                            </div>
                        </div>

                        <label className="text-sm font-bold text-primary mb-2">Select Date</label>
                        <input type="date" required className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-teal-600" value={bookingData.date} onChange={e => setBookingData({...bookingData, date: e.target.value})} />

                        <label className="text-sm font-bold text-primary mb-2">Select Time</label>
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {['10:00 AM', '1:00 PM', '4:00 PM'].map(time => (
                                <div key={time} onClick={() => setBookingData({...bookingData, time})} className={`text-center py-3 rounded-xl text-sm font-medium cursor-pointer transition ${bookingData.time === time ? 'bg-primary text-white' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:border-teal-600'}`}>
                                    {time}
                                </div>
                            ))}
                        </div>

                        <label className="text-sm font-bold text-primary mb-2">Address</label>
                        <textarea required placeholder="House number, street, city..." className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl mb-6 h-28 outline-none focus:ring-2 focus:ring-teal-600 resize-none" value={bookingData.address} onChange={e => setBookingData({...bookingData, address: e.target.value})}></textarea>

                        <div className="mt-auto pt-6 border-t border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-gray-500 font-medium">Total Cost:</span>
                                <span className="text-xl font-bold text-primary">₦{bookingPro.price.toLocaleString()}</span>
                            </div>
                            <button type="submit" disabled={isSubmitting} className="w-full bg-teal-600 text-white font-bold py-4 rounded-2xl hover:bg-teal-700 transition shadow-lg shadow-teal-600/30 disabled:opacity-50">
                                {isSubmitting ? 'Confirming...' : 'Confirm Booking'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        )}

        {/* Bottom Nav */}
        <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-6 py-4 flex justify-between items-center pb-8 md:rounded-b-[2.5rem] z-20">
            <div onClick={() => setActiveTab('home')} className={`flex flex-col items-center cursor-pointer transition ${activeTab === 'home' ? 'text-teal-600' : 'text-gray-400 hover:text-primary'}`}>
                <i className="fas fa-home text-xl mb-1"></i><span className="text-[10px] font-bold mt-1">Home</span>
            </div>
            <div onClick={() => setActiveTab('bookings')} className={`flex flex-col items-center cursor-pointer transition ${activeTab === 'bookings' ? 'text-teal-600' : 'text-gray-400 hover:text-primary'}`}>
                <i className="far fa-calendar-alt text-xl mb-1"></i><span className="text-[10px] font-medium mt-1">Bookings</span>
            </div>
            <div onClick={() => setActiveTab('chat')} className={`flex flex-col items-center cursor-pointer transition ${activeTab === 'chat' ? 'text-teal-600' : 'text-gray-400 hover:text-primary'}`}>
                <i className="far fa-comment-dots text-xl mb-1"></i><span className="text-[10px] font-medium mt-1">Chat</span>
            </div>
            <div onClick={() => setActiveTab('profile')} className={`flex flex-col items-center cursor-pointer transition ${activeTab === 'profile' ? 'text-teal-600' : 'text-gray-400 hover:text-primary'}`}>
                <i className="far fa-user text-xl mb-1"></i><span className="text-[10px] font-medium mt-1">Profile</span>
            </div>
        </div>

        <style>{`
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
        `}</style>
    </div>
  );
};
export default App;