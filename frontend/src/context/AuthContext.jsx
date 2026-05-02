import React, { createContext, useState, useContext, useEffect } from 'react';

// Create the context
const AuthContext = createContext();

// Provide the context to the app
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null); // NEW: Track the token in state
  const [loading, setLoading] = useState(true);

  // Check if user is already logged in when the app loads
  useEffect(() => {
    const checkLoggedInUser = () => {
      const savedToken = localStorage.getItem('servly_token');
      const savedUser = localStorage.getItem('servly_user');

      if (savedToken && savedUser) {
        try {
          // Parse the saved user string back into an object
          setUser(JSON.parse(savedUser));
          setToken(savedToken); // Set the token in state
        } catch (error) {
          console.error("Failed to parse saved user data");
          localStorage.removeItem('servly_token');
          localStorage.removeItem('servly_user');
        }
      }
      setLoading(false); // Stop the loading spinner
    };

    checkLoggedInUser();
  }, []);

  // Login function called by App.jsx
  const login = (userData, newToken) => {
    localStorage.setItem('servly_token', newToken);
    localStorage.setItem('servly_user', JSON.stringify(userData));
    setUser(userData);
    setToken(newToken); // Update state
  };

  // Logout function called by App.jsx
  const logout = () => {
    localStorage.removeItem('servly_token');
    localStorage.removeItem('servly_user');
    setUser(null);
    setToken(null); // Clear state
  };

  return (
    // NEW: Exposing 'token' here so App.jsx can use it for socket connection
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to be used in App.jsx
export const useAuth = () => {
  return useContext(AuthContext);
};