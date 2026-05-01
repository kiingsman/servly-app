require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const auth = require('./middleware/auth');
const Booking = require('./models/Booking');
const Notification = require('./models/Notification'); 

// ==========================================
// LOCAL FILE UPLOAD SETUP (Multer)
// ==========================================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'))
});
const upload = multer({ storage });

// ==========================================
// USER & PRO SCHEMAS
// ==========================================
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['client', 'professional', 'admin'], default: 'client' },
  phone: { type: String, default: '' },
  avatar: { type: String, default: '' }, // NEW: Avatar field
  addresses: [{ label: String, address: String }],
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

const professionalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    avatar: { type: String, default: 'https://ui-avatars.com/api/?name=Pro&background=0D8ABC&color=fff' },
    banner: { type: String, default: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=800&q=80' },
    name: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    title: { type: String, required: true }, 
    headline: { type: String, default: 'Professional Service Provider' }, 
    about: { type: String, default: 'Experienced professional dedicated to delivering top-quality results.' },
    experience: [{ jobTitle: String, company: String, startDate: String, endDate: String, description: String }],
    skills: [{ type: String }],
    contactInfo: { portfolio: String, github: String, linkedin: String, website: String },
    rating: { type: Number, default: 5.0 },
    distance: { type: String, default: "1.0 km away" },
    verified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});
const Professional = mongoose.models.Professional || mongoose.model('Professional', professionalSchema);

const messageSchema = new mongoose.Schema({
    bookingId: { type: String, required: true },
    author: { type: String, required: true },
    message: { type: String, required: true },
    time: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(cors()); 
app.use(express.json());
// Serve the uploads folder so the frontend can display the images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servly', { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('✅ MongoDB Connected!'))
.catch(err => console.log('❌ MongoDB Error:', err));

const userSockets = {}; 
io.on('connection', (socket) => {
    socket.on('register_user', (userId) => { userSockets[userId] = socket.id; });
    socket.on('join_room', (room) => socket.join(room));
    socket.on('send_message', async (data) => {
        try {
            await new Message({ bookingId: data.room, author: data.author, message: data.message, time: data.time }).save();
            socket.to(data.room).emit('receive_message', data);
            const booking = await Booking.findById(data.room);
            if (booking) {
                let recipientUserId = null;
                if (data.author === booking.clientName) {
                    const proProfile = await Professional.findById(booking.professionalId);
                    if (proProfile) recipientUserId = proProfile.userId;
                } else { recipientUserId = booking.userId; }
                if (recipientUserId) {
                    const notif = new Notification({ userId: recipientUserId, title: "New Message", message: `From ${data.author}: "${data.message.substring(0, 30)}..."`, type: "message" });
                    await notif.save();
                    if (userSockets[recipientUserId]) io.to(userSockets[recipientUserId]).emit('new_notification', notif);
                }
            }
        } catch (err) {}
    });
    socket.on('live_location_update', (data) => socket.to(data.room).emit('receive_live_location', data));
    socket.on('call_user', (data) => socket.to(data.room).emit('incoming_call', data));
    socket.on('accept_call', (data) => socket.to(data.room).emit('call_accepted', data));
    socket.on('ice_candidate', (data) => socket.to(data.room).emit('ice_candidate', data));
    socket.on('end_call', (data) => socket.to(data.room).emit('call_ended'));
    socket.on('disconnect', () => { for (const [userId, socketId] of Object.entries(userSockets)) { if (socketId === socket.id) delete userSockets[userId]; } });
});

// ==========================================
// AUTHENTICATION & PROFILE UPLOADS
// ==========================================
app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (await User.findOne({ email })) return res.status(400).json({ message: 'User already exists' });
        const newUser = await new User({ name, email, password: await bcrypt.hash(password, await bcrypt.genSalt(10)), role: 'client', addresses: [] }).save();
        const token = jwt.sign({ userId: newUser._id, name: newUser.name, role: newUser.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        res.status(201).json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role, phone: newUser.phone, avatar: newUser.avatar, addresses: newUser.addresses } });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

app.post('/api/pro-signup', async (req, res) => {
    try {
        const { name, email, password, title, category, price } = req.body;
        if (await User.findOne({ email })) return res.status(400).json({ message: 'Email in use' });
        const newUser = await new User({ name, email, password: await bcrypt.hash(password, await bcrypt.genSalt(10)), role: 'professional' }).save();
        const newPro = await new Professional({ userId: newUser._id, name, title, headline: `${title} | Professional Services`, category, price: Number(price), avatar: `https://ui-avatars.com/api/?name=${name.replace(' ', '+')}&background=0D8ABC&color=fff`, skills: [category], rating: 5.0, distance: "1.0 km away", verified: true }).save();
        const token = jwt.sign({ userId: newUser._id, name: newUser.name, role: newUser.role, proId: newPro._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        res.status(201).json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role, proId: newPro._id, phone: newUser.phone, avatar: newUser.avatar } });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user || !(await bcrypt.compare(req.body.password, user.password))) return res.status(400).json({ message: 'Invalid credentials' });
        let proId = null;
        if (user.role === 'professional') {
            const proProfile = await Professional.findOne({ userId: user._id });
            if (proProfile) proId = proProfile._id;
        }
        const token = jwt.sign({ userId: user._id, name: user.name, role: user.role, proId }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, proId, phone: user.phone, avatar: user.avatar, addresses: user.addresses } });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// NEW: Upload Avatar Endpoint
app.post('/api/user/avatar', auth, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        // Create full URL (e.g., http://localhost:10000/uploads/123-img.jpg)
        const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        const updatedUser = await User.findByIdAndUpdate(req.user.id, { avatar: avatarUrl }, { new: true });
        res.json({ avatar: updatedUser.avatar });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

app.get('/api/user/profile', auth, async (req, res) => {
    try { res.json(await User.findById(req.user.id).select('-password')); } 
    catch (error) { res.status(500).json({ message: 'Server error' }); }
});

app.put('/api/user/profile', auth, async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        res.json(await User.findByIdAndUpdate(req.user.id, { $set: { name, email, phone } }, { new: true }).select('-password'));
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

app.post('/api/user/addresses', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id); user.addresses.push(req.body); await user.save(); res.json(user.addresses);
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

app.delete('/api/user/addresses/:addressId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id); user.addresses = user.addresses.filter(addr => req.params.addressId !== addr._id.toString()); await user.save(); res.json(user.addresses);
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// ==========================================
// MAIN ROUTES
// ==========================================
app.get('/api/professionals', async (req, res) => { res.json(await Professional.find().sort({ createdAt: -1 })); });
app.put('/api/pro/profile', auth, async (req, res) => { try { res.json(await Professional.findOneAndUpdate({ userId: req.user.id }, { $set: req.body }, { new: true })); } catch (error) { res.status(500).json({ message: 'Error' }); } });
app.post('/api/bookings', auth, async (req, res) => {
    try {
        const newBooking = new Booking({ userId: req.user.id, clientName: req.user.name, professionalId: req.body.professionalId, professionalName: req.body.professionalName, date: req.body.date, time: req.body.time, address: req.body.address, totalPrice: req.body.totalPrice });
        const savedBooking = await newBooking.save();
        const proProfile = await Professional.findById(req.body.professionalId);
        if (proProfile && proProfile.userId) {
            const notif = new Notification({ userId: proProfile.userId, title: "New Booking Request!", message: `${req.user.name} booked you for ${req.body.date}.`, type: "booking" });
            await notif.save();
            if (userSockets[proProfile.userId]) io.to(userSockets[proProfile.userId]).emit('new_notification', notif);
        }
        res.status(201).json(savedBooking);
    } catch (error) { res.status(500).json({ message: 'Error' }); }
});
app.get('/api/bookings', auth, async (req, res) => { res.json(await Booking.find({ userId: req.user.id }).sort({ createdAt: -1 })); });
app.get('/api/pro/bookings', auth, async (req, res) => { try { const proProfile = await Professional.findOne({ userId: req.user.id }); if (!proProfile) return res.status(404).json({ message: 'Not found' }); res.json(await Booking.find({ professionalId: proProfile._id }).sort({ createdAt: -1 })); } catch (error) { res.status(500).json({ message: 'Error' }); } });
app.patch('/api/bookings/:id/cancel', auth, async (req, res) => { const booking = await Booking.findById(req.params.id); booking.status = 'cancelled'; res.json(await booking.save()); });
app.patch('/api/admin/bookings/:id/status', auth, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id); booking.status = req.body.status; await booking.save();
        const notif = new Notification({ userId: booking.userId, title: "Booking Update", message: `Your booking with ${booking.professionalName} was marked as ${req.body.status}.`, type: "status" });
        await notif.save(); if (userSockets[booking.userId]) io.to(userSockets[booking.userId]).emit('new_notification', notif); res.json(booking);
    } catch (error) { res.status(500).json({ message: 'Error' }); }
});
app.get('/api/admin/bookings', auth, async (req, res) => { res.json(await Booking.find().sort({ createdAt: -1 })); });
app.get('/api/chat/:bookingId', auth, async (req, res) => { res.json(await Message.find({ bookingId: req.params.bookingId }).sort({ createdAt: 1 })); });
app.get('/api/notifications', auth, async (req, res) => { res.json(await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(30)); });
app.patch('/api/notifications/read', auth, async (req, res) => { await Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true }); res.json({ message: "Marked as read" }); });

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));