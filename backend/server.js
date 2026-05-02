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
const checkRole = require('./middleware/checkRole');

const User = require('./models/User');
const Professional = require('./models/Professional');
const Booking = require('./models/Booking');
const Notification = require('./models/Notification');
const Message = require('./models/Message');

// ==========================================
// 1. LOCAL FILE UPLOAD SETUP (Multer)
// ==========================================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname.split(' ').join('-'))
});
const upload = multer({ storage });

// ==========================================
// 2. APP & DB SETUP
// ==========================================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servly', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('✅ MongoDB Connected!'))
  .catch((err) => console.log('❌ MongoDB Error:', err));

// ==========================================
// 3. SOCKET.IO AUTH (JWT) + EVENTS
// ==========================================
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No auth token'));

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback_secret'
    );

    socket.userId = decoded.userId;
    socket.userRole = decoded.role;
    next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    next(new Error('Authentication error'));
  }
});

const userSockets = {};

io.on('connection', (socket) => {
  // Automatically register user on connection using JWT data
  if (socket.userId) {
    userSockets[socket.userId] = socket.id;
  }

  // Fallback for older clients
  socket.on('register_user', (userId) => {
    if (userId) userSockets[userId] = socket.id;
  });

  socket.on('join_room', (room) => socket.join(room));

  socket.on('send_message', async (data) => {
    try {
      await new Message({
        bookingId: data.room,
        author: data.author || 'User',
        message: data.message || '',
        time: data.time
      }).save();

      socket.to(data.room).emit('receive_message', data);

      const booking = await Booking.findById(data.room);
      if (!booking) return;

      const effectiveSenderId =
        data.senderId || (socket.userId ? String(socket.userId) : null);

      if (!effectiveSenderId) {
        console.warn('send_message without senderId, skipping notification');
        return;
      }

      let recipientUserId = null;

      if (String(effectiveSenderId) === String(booking.userId)) {
        const proProfile = await Professional.findOne({ _id: booking.professionalId });
        if (proProfile) recipientUserId = proProfile.userId;
      } else {
        recipientUserId = booking.userId;
      }

      if (!recipientUserId) return;

      const safeMessagePreview = (data.message || '').substring(0, 30);

      const notif = new Notification({
        userId: recipientUserId,
        title: 'New Message',
        message: `From ${data.author || 'Someone'}: "${safeMessagePreview}..."`,
        type: 'message'
      });

      await notif.save();

      if (userSockets[recipientUserId]) {
        io.to(userSockets[recipientUserId]).emit('new_notification', notif);
      }
    } catch (err) {
      console.error('Socket send_message error:', err);
    }
  });

  socket.on('live_location_update', (data) =>
    socket.to(data.room).emit('receive_live_location', data)
  );

  socket.on('call_user', (data) =>
    socket.to(data.room).emit('incoming_call', data)
  );
  socket.on('accept_call', (data) =>
    socket.to(data.room).emit('call_accepted', data)
  );
  socket.on('ice_candidate', (data) =>
    socket.to(data.room).emit('ice_candidate', data)
  );
  socket.on('end_call', (data) =>
    socket.to(data.room).emit('call_ended')
  );

  socket.on('disconnect', () => {
    for (const [userId, socketId] of Object.entries(userSockets)) {
      if (socketId === socket.id) delete userSockets[userId];
    }
  });
});

// ==========================================
// 4. AUTH & PROFILE ROUTES
// ==========================================
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (await User.findOne({ email })) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const newUser = await new User({
      name,
      email,
      password: hashed,
      role: 'client',
      addresses: [],
      favorites: []
    }).save();

    const token = jwt.sign(
      { userId: newUser._id, name: newUser.name, role: newUser.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
        avatar: newUser.avatar,
        addresses: newUser.addresses,
        favorites: newUser.favorites
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/pro-signup', async (req, res) => {
  try {
    const { name, email, password, title, category, price } = req.body;

    if (await User.findOne({ email })) {
      return res.status(400).json({ message: 'Email in use' });
    }

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ message: 'Invalid price' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const newUser = await new User({
      name,
      email,
      password: hashed,
      role: 'professional'
    }).save();

    const newPro = await Professional.create({
      userId: newUser._id,
      name,
      title,
      headline: `${title} | Professional Services`,
      category,
      price: numericPrice,
      avatar: `https://ui-avatars.com/api/?name=${name.replace(
        / /g,
        '+'
      )}&background=0D8ABC&color=fff`,
      skills: [category],
      rating: 5.0,
      distance: '1.0 km away',
      verified: true
    });

    const token = jwt.sign(
      {
        userId: newUser._id,
        name: newUser.name,
        role: newUser.role,
        proId: newPro._id
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        proId: newPro._id,
        phone: newUser.phone,
        avatar: newUser.avatar
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    let proId = null;
    if (user.role === 'professional') {
      const proProfile = await Professional.findOne({ userId: user._id });
      if (proProfile) proId = proProfile._id;
    }

    const token = jwt.sign(
      { userId: user._id, name: user.name, role: user.role, proId },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        proId,
        phone: user.phone,
        avatar: user.avatar,
        addresses: user.addresses,
        favorites: user.favorites
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/user/profile', auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id).select('-password');
    res.json(u);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/user/profile', auth, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    // 1. Update the User collection
    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { name, email, phone } },
      { new: true }
    ).select('-password');

    // 2. Sync to Professional collection if applicable
    if (req.user.role === 'professional' && name) {
      await Professional.findOneAndUpdate(
        { userId: req.user.id },
        { name: name }
      );
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/user/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: 'No file uploaded' });

    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    // 1. Update the User collection
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: avatarUrl },
      { new: true }
    );

    // 2. Sync to Professional collection if applicable
    if (req.user.role === 'professional') {
      await Professional.findOneAndUpdate(
        { userId: req.user.id },
        { avatar: avatarUrl }
      );
    }

    res.json({ avatar: updatedUser.avatar });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/user/addresses', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.addresses.push(req.body);
    await user.save();
    res.json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/user/addresses/:addressId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.addresses = user.addresses.filter(
      (addr) => req.params.addressId !== addr._id.toString()
    );
    await user.save();
    res.json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/user/favorites/:proId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.favorites.some((id) => id.toString() === req.params.proId)) {
      user.favorites.push(req.params.proId);
      await user.save();
    }
    res.json(user.favorites);
  } catch (error) {
    console.error('Favorites Error:', error);
    res.status(500).json({ message: 'Error adding favorite' });
  }
});

app.delete('/api/user/favorites/:proId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.favorites = user.favorites.filter(
      (id) => id.toString() !== req.params.proId
    );
    await user.save();
    res.json(user.favorites);
  } catch (error) {
    res.status(500).json({ message: 'Error removing favorite' });
  }
});

// ==========================================
// 5. MAIN ROUTES
// ==========================================
app.get('/api/professionals', async (req, res) => {
  try {
    const pros = await Professional.find().sort({ createdAt: -1 });
    res.json(pros);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

app.put(
  '/api/pro/profile',
  auth,
  checkRole('professional'),
  async (req, res) => {
    try {
      const updated = await Professional.findOneAndUpdate(
        { userId: req.user.id },
        { $set: req.body },
        { new: true }
      );
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Error updating profile' });
    }
  }
);

app.post('/api/bookings', auth, async (req, res) => {
  try {
    const newBooking = new Booking({
      userId: req.user.id,
      clientName: req.user.name,
      professionalId: req.body.professionalId,
      professionalName: req.body.professionalName,
      date: req.body.date,
      time: req.body.time,
      address: req.body.address,
      totalPrice: req.body.totalPrice
    });

    const savedBooking = await newBooking.save();

    const proProfile = await Professional.findOne({ _id: req.body.professionalId });
    if (proProfile && proProfile.userId) {
      const notif = new Notification({
        userId: proProfile.userId,
        title: 'New Booking Request!',
        message: `${req.user.name} booked you for ${req.body.date}.`,
        type: 'booking'
      });
      await notif.save();
      if (userSockets[proProfile.userId]) {
        io.to(userSockets[proProfile.userId]).emit('new_notification', notif);
      }
    }

    res.status(201).json(savedBooking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating booking' });
  }
});

app.get('/api/bookings', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id }).sort({
      createdAt: -1
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get(
  '/api/pro/bookings',
  auth,
  checkRole('professional'),
  async (req, res) => {
    try {
      const proProfile = await Professional.findOne({ userId: req.user.id });
      if (!proProfile) {
        return res
          .status(404)
          .json({ message: 'Professional profile not found' });
      }

      const jobs = await Booking.find({
        professionalId: proProfile._id
      }).sort({ createdAt: -1 });

      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching bookings' });
    }
  }
);

app.patch('/api/bookings/:id/cancel', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ message: 'Booking not found' });

    booking.status = 'cancelled';
    const saved = await booking.save();
    res.json(saved);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error cancelling booking' });
  }
});

app.patch(
  '/api/admin/bookings/:id/status',
  auth,
  checkRole('admin', 'professional'),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking)
        return res.status(404).json({ message: 'Booking not found' });

      booking.status = req.body.status;
      await booking.save();

      const notif = new Notification({
        userId: booking.userId,
        title: 'Booking Update',
        message: `Your booking with ${booking.professionalName} was marked as ${req.body.status}.`,
        type: 'status'
      });
      await notif.save();

      if (userSockets[booking.userId]) {
        io.to(userSockets[booking.userId]).emit('new_notification', notif);
      }

      res.json(booking);
    } catch (error) {
      res.status(500).json({ message: 'Error updating status' });
    }
  }
);

app.get('/api/chat/:bookingId', auth, async (req, res) => {
  try {
    const msgs = await Message.find({
      bookingId: req.params.bookingId
    }).sort({ createdAt: 1 });
    res.json(msgs);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/notifications', auth, async (req, res) => {
  try {
    const notifs = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(30);
    res.json(notifs);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/notifications/read', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true }
    );
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ==========================================
// 6. START SERVER
// ==========================================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);