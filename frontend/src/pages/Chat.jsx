import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import './Chat.css'; // We'll create this next!

const Chat = () => {
  const { bookingId } = useParams(); // Gets the booking ID from the URL
  const navigate = useNavigate();
  
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);

  // Auto-scroll to the bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 1. Initialize User & Socket on Mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    // Connect to Socket
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:10000', {
      auth: { token }
    });

    setSocket(newSocket);

    // Fetch initial chat history
    const fetchChatHistory = async () => {
      try {
        const res = await axios.get(`http://localhost:10000/api/chat/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessages(res.data);
      } catch (err) {
        console.error('Chat Access Error:', err);
        setError('You do not have permission to view this chat.');
      }
    };

    fetchChatHistory();

    return () => {
      newSocket.disconnect(); // Cleanup on unmount
    };
  }, [bookingId, navigate]);

  // 2. Handle Socket Events
  useEffect(() => {
    if (!socket || !user || !bookingId) return;

    // Join the room
    socket.emit('join_room', bookingId);

    // Tell server we read the messages
    socket.emit('mark_messages_read', { bookingId, userId: user.id });

    // Listen for incoming messages
    const handleReceiveMessage = (data) => {
      setMessages((prev) => [...prev, data]);
      // Instantly mark as read since we have the chat open
      socket.emit('mark_messages_read', { bookingId, userId: user.id });
    };

    // Listen for the other user reading OUR messages
    const handleMessagesRead = () => {
      setMessages((prev) =>
        prev.map((msg) => ({ ...msg, isRead: true }))
      );
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('messages_read_update', handleMessagesRead);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('messages_read_update', handleMessagesRead);
    };
  }, [socket, bookingId, user]);

  // 3. Send Message
  const sendMessage = async () => {
    if (currentMessage.trim() !== '' && socket && user) {
      const messageData = {
        room: bookingId,
        senderId: user.id,
        author: user.name,
        message: currentMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: false // Locally set to false initially
      };

      // Emit to server
      socket.emit('send_message', messageData);
      
      // Update local UI immediately
      setMessages((prev) => [...prev, messageData]);
      setCurrentMessage('');
    }
  };

  if (error) return <div className="chat-error">{error}</div>;
  if (!user) return <div className="chat-loading">Loading chat...</div>;

  return (
    <div className="chat-page-wrapper">
      <div className="chat-window">
        {/* Chat Header */}
        <div className="chat-header">
          <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
          <h2>Booking Chat</h2>
        </div>

        {/* Messages Area */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <p className="no-messages">No messages yet. Say hello!</p>
          ) : (
            messages.map((msg, index) => {
              const isMine = msg.senderId === user.id;
              return (
                <div key={index} className={`message-wrapper ${isMine ? 'mine' : 'theirs'}`}>
                  <div className="message-bubble">
                    {!isMine && <span className="message-author">{msg.author}</span>}
                    <p className="message-text">{msg.message}</p>
                    <div className="message-meta">
                      <span className="message-time">{msg.time}</span>
                      {isMine && (
                        <span className={`read-receipt ${msg.isRead ? 'read' : 'sent'}`}>
                          {msg.isRead ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          <input
            type="text"
            placeholder="Type your message..."
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button onClick={sendMessage} disabled={!currentMessage.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;