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
  const [isProMode, setIsProMode] = useState(false); // Toggle between Client and Pro signup
  const [formData, setFormData] = useState({ name: '', email: '', password: '', title: '', category: 'cleaning', price: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setIsLoading(true);
    
    let endpoint = '/api/login';
    if (!isLogin) {
        endpoint = isProMode ? '/api/pro-signup' : '/api/signup';
    }

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

      {/* Account Type Toggle */}
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

        {/* Extra fields for Professionals only */}
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
// CLIENT DASHBOARD (What you already built)
// ==========================================
const ClientApp = () => {
    // ... Copy your entire existing <MainApp /> content here ...
    // (I am omitting it to save space, just paste your exact MainApp code here and rename the function to ClientApp)
    return <div className="p-10 text-center"><h1>Please paste your existing MainApp code here and rename it ClientApp</h1></div>
}

// ==========================================
// PROFESSIONAL DASHBOARD (NEW!)
// ==========================================
const ProfessionalApp = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('jobs');
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    const [activeChatRoom, setActiveChatRoom] = useState(null);
    const [messageList, setMessageList] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const chatEndRef = useRef(null);

    useEffect(() => {
        if (activeTab === 'jobs') {
            fetch(`${backendUrl}/api/pro/bookings`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } })
            .then(res => res.json())
            .then(data => { setJobs(data); setLoading(false); })
            .catch(() => setLoading(false));
        }
    }, [activeTab]);

    useEffect(() => {
        socket.on('receive_message', (data) => setMessageList((list) => [...list, data]));
        return () => socket.off('receive_message');
    }, []);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messageList]);

    const openChat = async (job) => {
        setActiveChatRoom(job);
        setMessageList([]);
        setActiveTab('chat');
        socket.emit('join_room', job._id);
        try {
            const res = await fetch(`${backendUrl}/api/chat/${job._id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` } });
            if (res.ok) setMessageList(await res.json());
        } catch (err) {}
    };

    const sendMessage = async () => {
        if (currentMessage !== "" && activeChatRoom) {
            const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const messageData = { room: activeChatRoom._id, author: user.name, message: currentMessage, time: timeString };
            await socket.emit('send_message', messageData);
            setMessageList((list) => [...list, messageData]); 
            setCurrentMessage(""); 
        }
    };

    const updateJobStatus = async (jobId, status) => {
        const res = await fetch(`${backendUrl}/api/admin/bookings/${jobId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('servly_token')}` }, body: JSON.stringify({ status }) });
        if (res.ok) setJobs(prev => prev.map(j => j._id === jobId ? { ...j, status } : j));
    };

    return (
        <div className="bg-gray-900 w-full max-w-md mx-auto h-screen md:h-[850px] md:rounded-[2.5rem] md:shadow-2xl relative overflow-hidden flex flex-col text-white">
            
            {activeTab === 'jobs' && (
                <div className="flex-1 overflow-y-auto px-6 pt-10 pb-28">
                    <h2 className="text-2xl font-bold mb-2">My Jobs</h2>
                    <p className="text-gray-400 text-sm mb-6">Manage your incoming requests.</p>
                    
                    {loading ? <p>Loading...</p> : jobs.length === 0 ? <p className="text-gray-500 text-center mt-10">No jobs assigned to you yet.</p> : jobs.map(job => (
                        <div key={job._id} className="bg-gray-800 p-5 rounded-2xl mb-4 border border-gray-700">
                            <div className="flex justify-between mb-3 border-b border-gray-700 pb-3">
                                <div><p className="text-xs text-gray-400">Client</p><h3 className="font-bold">{job.clientName}</h3></div>
                                <div className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-gray-700">{job.status}</div>
                            </div>
                            <p className="text-sm text-gray-300 mb-2"><i className="far fa-calendar-alt text-teal-400 mr-2"></i>{new Date(job.date).toLocaleDateString()} at {job.time}</p>
                            <p className="text-sm text-gray-300 mb-4"><i className="fas fa-map-marker-alt text-teal-400 mr-2"></i>{job.address}</p>
                            
                            <div className="flex gap-2">
                                <button onClick={() => openChat(job)} className="flex-1 py-2 bg-gray-700 text-white text-xs font-bold rounded-lg"><i className="far fa-comment-dots"></i> Chat</button>
                                {job.status === 'pending' && <button onClick={() => updateJobStatus(job._id, 'confirmed')} className="flex-1 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg">Accept</button>}
                                {job.status === 'confirmed' && <button onClick={() => updateJobStatus(job._id, 'completed')} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg">Complete</button>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'chat' && (
                <div className="flex-1 flex flex-col bg-gray-900 pb-20">
                    {activeChatRoom ? (
                        <>
                            <div className="px-6 pt-10 pb-4 border-b border-gray-800 flex items-center">
                                <button onClick={() => setActiveTab('jobs')} className="mr-4 text-gray-400"><i className="fas fa-chevron-left"></i></button>
                                <div><h2 className="text-lg font-bold">{activeChatRoom.clientName}</h2><p className="text-xs text-teal-400">Client Chat</p></div>
                            </div>
                            <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
                                {messageList.map((msg, index) => {
                                    const isMe = msg.author === user.name;
                                    return (
                                        <div key={index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                            <div className={`px-4 py-3 rounded-2xl max-w-[80%] ${isMe ? 'bg-teal-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none'}`}>
                                                <p className="text-sm">{msg.message}</p>
                                            </div>
                                            <span className="text-[10px] text-gray-500 mt-1 px-1">{msg.time}</span>
                                        </div>
                                    );
                                })}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="absolute bottom-[72px] w-full p-4 border-t border-gray-800 bg-gray-900 flex gap-2">
                                <input type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage()} className="flex-1 bg-gray-800 p-3 rounded-xl outline-none text-sm text-white" placeholder="Message client..." />
                                <button onClick={sendMessage} className="bg-teal-600 w-12 h-12 rounded-xl text-white"><i className="fas fa-paper-plane"></i></button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center p-6 text-center"><p className="text-gray-500">Select a job to chat with the client.</p></div>
                    )}
                </div>
            )}

            {activeTab === 'profile' && (
                <div className="flex-1 p-6 pt-10 text-center">
                    <h2 className="text-2xl font-bold mb-6">Pro Account</h2>
                    <div className="w-24 h-24 bg-gray-800 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold text-teal-400 border-2 border-teal-500">{user?.name?.charAt(0)}</div>
                    <h3 className="font-bold text-xl">{user?.name}</h3>
                    <p className="text-gray-400 mb-6">{user?.email}</p>
                    <button onClick={logout} className="w-full bg-red-500/20 text-red-400 py-3 rounded-xl font-bold">Log Out</button>
                </div>
            )}

            <div className="absolute bottom-0 w-full border-t border-gray-800 bg-gray-900 px-6 py-4 flex justify-between pb-8 z-20">
                {['jobs', 'chat', 'profile'].map((tab, idx) => {
                  const icons = ['fa-briefcase', 'fa-comment-dots', 'fa-user'];
                  return (
                    <div key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center cursor-pointer ${activeTab === tab ? 'text-teal-400' : 'text-gray-600'}`}>
                        <i className={`fas ${icons[idx]} text-xl mb-1`}></i>
                        <span className="text-[10px] font-bold capitalize">{tab}</span>
                    </div>
                  );
                })}
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
  
  // ROUTING LOGIC: If role is professional, show Pro dashboard. Else, show Client dashboard.
  if (user.role === 'professional') return <ProfessionalApp />;
  return <ClientApp />; // Make sure your previous MainApp logic is here!
};

const App = () => ( <AuthProvider><AppController /></AuthProvider> );
export default App;