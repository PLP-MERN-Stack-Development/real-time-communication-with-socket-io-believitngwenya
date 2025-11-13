import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const App = () => {
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [typingUsers, setTypingUsers] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [username, setUsername] = useState('');
  const [rooms, setRooms] = useState(['general', 'random', 'tech']);
  const messagesEndRef = useRef(null);

 useEffect(() => {
  const newSocket = io('http://localhost:5000', {
    // Reconnection settings
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    
    // Other optimization settings
    transports: ['websocket', 'polling'], // Try WebSocket first, then fallback to polling
    forceNew: false,
    autoConnect: true
  });

  setSocket(newSocket);

  // Handle connection events
  newSocket.on('connect', () => {
    console.log('Connected to server');
  });

  newSocket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
  });

  newSocket.on('reconnect_attempt', (attempt) => {
    console.log(`Reconnection attempt ${attempt}`);
  });

  newSocket.on('reconnect', (attempt) => {
    console.log(`Reconnected after ${attempt} attempts`);
  });

  newSocket.on('reconnect_error', (error) => {
    console.log('Reconnection error:', error);
  });

  newSocket.on('reconnect_failed', () => {
    console.log('Failed to reconnect after all attempts');
  });

  // ... rest of your existing event listeners

  return () => newSocket.close();
}, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addSystemMessage = (content) => {
    const systemMessage = {
      id: Date.now(),
      username: 'System',
      content,
      timestamp: new Date().toISOString(),
      type: 'system'
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      const userData = {
        username: username.trim(),
        avatar: `https://ui-avatars.com/api/?name=${username.trim()}&background=random`
      };
      setUser(userData);
      socket.emit('user_join', userData);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim() && socket) {
      socket.emit('send_message', {
        content: inputMessage.trim(),
        room: currentRoom
      });
      setInputMessage('');
      socket.emit('typing_stop', { room: currentRoom });
    }
  };

  const handleTyping = () => {
    if (socket) {
      socket.emit('typing_start', { room: currentRoom });
      
      // Clear previous timeout
      if (window.typingTimeout) {
        clearTimeout(window.typingTimeout);
      }
      
      // Set new timeout to stop typing indicator
      window.typingTimeout = setTimeout(() => {
        socket.emit('typing_stop', { room: currentRoom });
      }, 1000);
    }
  };

  const joinRoom = (roomName) => {
    setCurrentRoom(roomName);
    setMessages([]);
    setTypingUsers([]);
    if (socket) {
      socket.emit('join_room', roomName);
    }
  };

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-form">
          <h1>Join Chat</h1>
          <form onSubmit={handleJoin}>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <button type="submit">Join Chat</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="user-info">
          <img src={user.avatar} alt={user.username} />
          <span>{user.username}</span>
        </div>
        
        <div className="rooms-section">
          <h3>Rooms</h3>
          {rooms.map(room => (
            <button
              key={room}
              className={`room-btn ${currentRoom === room ? 'active' : ''}`}
              onClick={() => joinRoom(room)}
            >
              # {room}
            </button>
          ))}
        </div>

        <div className="online-users">
          <h3>Online Users ({onlineUsers.length})</h3>
          {onlineUsers.map(onlineUser => (
            <div key={onlineUser.id} className="user-item">
              <img src={onlineUser.avatar} alt={onlineUser.username} />
              <span>{onlineUser.username}</span>
              <div className="online-indicator"></div>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-header">
            <div className="connection-status">
  <span className={`status-indicator ${connectionStatus}`}>
    {connectionStatus === 'connected' && '🟢 Online'}
    {connectionStatus === 'disconnected' && '🔴 Offline'}
    {connectionStatus === 'reconnecting' && '🟡 Reconnecting...'}
  </span>
</div>
          <h2># {currentRoom}</h2>
          <div className="room-info">
            {typingUsers.length > 0 && (
              <span className="typing-indicator">
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </span>
            )}
          </div>
        </div>

        <div className="messages-container">
          {messages.map(message => (
            <div key={message.id} className={`message ${message.type}`}>
              {message.type === 'system' ? (
                <div className="system-message">
                  <span>{message.content}</span>
                  <small>{new Date(message.timestamp).toLocaleTimeString()}</small>
                </div>
              ) : (
                <>
                  <img src={message.avatar} alt={message.username} />
                  <div className="message-content">
                    <div className="message-header">
                      <strong>{message.username}</strong>
                      <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p>{message.content}</p>
                  </div>
                </>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="message-form">
          <input
            type="text"
            placeholder="Type a message..."
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              handleTyping();
            }}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
};

export default App;