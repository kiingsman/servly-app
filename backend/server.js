require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const Professional = require('./models/Professional');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Middleware
app.use(cors());
app.use(express.json());

// Basic Health Route (To test if Render is awake)
app.get('/', (req, res) => {
  res.send('Servly Backend is Running and Connected to MongoDB!');
});

// API Endpoint to fetch all professionals
app.get('/api/professionals', async (req, res) => {
  try {
    // Check if the database has any professionals
    let pros = await Professional.find();
    
    // If the database is empty, immediately return the sample data directly!
    if (pros.length === 0) {
      console.log("Database is empty, returning hardcoded fallback data.");
      return res.json([
        { _id: "1", name: 'Ibrahim Musa', category: 'electric', title: 'Master Electrician', rating: 4.9, reviews: 120, distance: '2.5km', price: 15000, verified: true, avatar: 'https://i.pravatar.cc/150?img=33' },
        { _id: "2", name: 'Amina Yusuf', category: 'cleaning', title: 'Deep Cleaning Pro', rating: 4.7, reviews: 85, distance: '4.1km', price: 10000, verified: true, avatar: 'https://i.pravatar.cc/150?img=47' },
        { _id: "3", name: 'Samuel Obi', category: 'plumbing', title: 'Expert Plumber', rating: 4.8, reviews: 210, distance: '1.2km', price: 12000, verified: true, avatar: 'https://i.pravatar.cc/150?img=11' },
        { _id: "4", name: 'David Okafor', category: 'ac', title: 'HVAC Technician', rating: 4.5, reviews: 42, distance: '3.0km', price: 18000, verified: false, avatar: 'https://i.pravatar.cc/150?img=60' }
      ]);
    }
    
    // Otherwise return the real database data
    res.json(pros);
  } catch (error) {
    console.error('Error fetching professionals:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});