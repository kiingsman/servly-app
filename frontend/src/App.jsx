import React, { useState, useEffect } from 'react';

const App = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Automatically switch between localhost and Render URL
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    // Fetch real data from your MongoDB backend
    fetch(`${backendUrl}/api/professionals`)
      .then(res => res.json())
      .then(data => {
        setProfessionals(data);
        setLoading(false);
      })
      .catch(err => console.error("Error fetching pros:", err));
  }, [backendUrl]);

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
                    <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full"></span>
                </button>
            </div>

            {/* Search */}
            <div className="relative flex items-center">
                <i className="fas fa-search absolute left-4 text-gray-400 z-10"></i>
                <input 
                    type="text" 
                    placeholder="What service do you need?" 
                    className="w-full bg-gray-100 py-4 pl-12 pr-12 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-teal-600 transition-all relative"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button className="absolute right-2 bg-primary text-white p-2.5 rounded-xl hover:bg-gray-800 transition z-10">
                    <i className="fas fa-sliders-h"></i>
                </button>
            </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-28">
            
            {/* Categories Grid */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-primary">Categories</h2>
                    <span className="text-sm font-medium text-teal-600 cursor-pointer hover:underline">See All</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                    {categories.map(cat => (
                        <div key={cat.id} onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)} className="flex flex-col items-center cursor-pointer group">
                            <div className={`h-14 w-14 rounded-2xl flex justify-center items-center text-xl mb-2 transition-all ${cat.bg} ${cat.color} ${selectedCategory === cat.id ? 'ring-2 ring-teal-600 shadow-md scale-105' : 'group-hover:scale-105'}`}>
                                <i className={`fas ${cat.icon}`}></i>
                            </div>
                            <span className={`text-[10px] font-medium text-center ${selectedCategory === cat.id ? 'text-teal-600 font-bold' : 'text-gray-600'}`}>{cat.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Pros List */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-primary">
                        {selectedCategory ? `${categories.find(c => c.id === selectedCategory)?.name} Pros` : 'Top Rated Near You'}
                    </h2>
                </div>
                
                {loading ? (
                    <p className="text-center text-gray-500 mt-10">Loading professionals...</p>
                ) : filteredPros.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-3xl border border-gray-100">
                        <i className="fas fa-search text-3xl text-gray-300 mb-3"></i>
                        <p className="text-gray-500 text-sm">No professionals found.</p>
                    </div>
                ) : (
                    filteredPros.map(pro => (
                        <div key={pro._id || pro.id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-4 hover:shadow-md transition cursor-pointer">
                            <div className="flex items-center">
                                <img src={pro.avatar} alt={pro.name} className="w-16 h-16 rounded-2xl object-cover mr-4" />
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-primary text-md">
                                            {pro.name} {pro.verified && <i className="fas fa-check-circle text-teal-600 text-xs ml-1" title="Verified"></i>}
                                        </h3>
                                        <div className="flex items-center bg-orange-50 px-2 py-1 rounded-lg">
                                            <i className="fas fa-star text-orange-400 text-[10px] mr-1"></i>
                                            <span className="text-xs font-bold text-orange-600">{pro.rating}</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{pro.title} • {pro.distance}</p>
                                    <div className="mt-3 flex justify-between items-center">
                                        <span className="text-sm font-bold text-primary">₦{pro.price.toLocaleString()}<span className="text-xs text-gray-400 font-normal">/hr</span></span>
                                        <button className="bg-primary text-white text-xs font-medium px-4 py-2 rounded-xl hover:bg-gray-800 transition">Book</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Bottom Nav */}
        <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-6 py-4 flex justify-between items-center pb-8 md:rounded-b-[2.5rem] z-20">
            <div onClick={() => setActiveTab('home')} className={`flex flex-col items-center cursor-pointer transition ${activeTab === 'home' ? 'text-teal-600' : 'text-gray-400 hover:text-primary'}`}>
                <i className="fas fa-home text-xl mb-1"></i>
                <span className="text-[10px] font-bold mt-1">Home</span>
            </div>
            <div onClick={() => setActiveTab('bookings')} className={`flex flex-col items-center cursor-pointer transition ${activeTab === 'bookings' ? 'text-teal-600' : 'text-gray-400 hover:text-primary'}`}>
                <i className="far fa-calendar-alt text-xl mb-1"></i>
                <span className="text-[10px] font-medium mt-1">Bookings</span>
            </div>
            <div onClick={() => setActiveTab('chat')} className={`flex flex-col items-center cursor-pointer transition ${activeTab === 'chat' ? 'text-teal-600' : 'text-gray-400 hover:text-primary'}`}>
                <i className="far fa-comment-dots text-xl mb-1"></i>
                <span className="text-[10px] font-medium mt-1">Chat</span>
            </div>
            <div onClick={() => setActiveTab('profile')} className={`flex flex-col items-center cursor-pointer transition ${activeTab === 'profile' ? 'text-teal-600' : 'text-gray-400 hover:text-primary'}`}>
                <i className="far fa-user text-xl mb-1"></i>
                <span className="text-[10px] font-medium mt-1">Profile</span>
            </div>
        </div>
    </div>
  );
};
export default App;