import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// In-memory storage (in production, use a database)
const users = new Map();
const messages = new Map();
const rooms = new Set(['general', 'random', 'tech']);

// Add default rooms
rooms.forEach(room => {
  messages.set(room, []);
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user to general room by default
  socket.join('general');

  socket.emit('connected', {
    message: 'Connected to chat server',
    rooms: Array.from(rooms)
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      console.log('User disconnected:', user.username);
      socket.broadcast.emit('user_offline', {
        username: user.username,
        timestamp: new Date().toISOString()
      });
      users.delete(socket.id);
      
      // Update online users list
      io.emit('online_users', Array.from(users.values()));
    }
  });

  // User authentication
  socket.on('user_join', (userData) => {
    const user = {
      id: socket.id,
      username: userData.username,
      avatar: userData.avatar || `https://ui-avatars.com/api/?name=${userData.username}`,
      joinedAt: new Date().toISOString()
    };
    
    users.set(socket.id, user);
    
    // Notify all clients about new user
    socket.broadcast.emit('user_joined', {
      username: user.username,
      timestamp: new Date().toISOString()
    });

    // Send online users list
    io.emit('online_users', Array.from(users.values()));

    // Send recent messages from general room
    const recentMessages = messages.get('general')?.slice(-50) || [];
    socket.emit('message_history', recentMessages);
  });

  // Handle new messages
  socket.on('send_message', (messageData) => {
    const user = users.get(socket.id);
    if (!user) return;

    const message = {
      id: uuidv4(),
      username: user.username,
      avatar: user.avatar,
      content: messageData.content,
      room: messageData.room || 'general',
      timestamp: new Date().toISOString(),
      type: 'text'
    };

    // Store message
    if (!messages.has(message.room)) {
      messages.set(message.room, []);
    }
    messages.get(message.room).push(message);

    // Send to room
    io.to(message.room).emit('new_message', message);
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const user = users.get(socket.id);
    if (user) {
      socket.to(data.room).emit('user_typing', {
        username: user.username,
        room: data.room
      });
    }
  });

  socket.on('typing_stop', (data) => {
    const user = users.get(socket.id);
    if (user) {
      socket.to(data.room).emit('user_stop_typing', {
        username: user.username,
        room: data.room
      });
    }
  });

  // Room management
  socket.on('join_room', (roomName) => {
    socket.rooms.forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });
    
    socket.join(roomName);
    socket.emit('room_joined', roomName);
    
    // Send room message history
    const roomMessages = messages.get(roomName) || [];
    socket.emit('message_history', roomMessages);
  });

  // Private messages
  socket.on('send_private_message', (data) => {
    const fromUser = users.get(socket.id);
    const toUser = Array.from(users.values()).find(u => u.username === data.toUsername);
    
    if (fromUser && toUser) {
      const privateMessage = {
        id: uuidv4(),
        from: fromUser.username,
        to: data.toUsername,
        content: data.content,
        timestamp: new Date().toISOString(),
        type: 'private'
      };

      io.to(toUser.id).emit('private_message', privateMessage);
      socket.emit('private_message_sent', privateMessage);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Private messaging
socket.on('send_private_message', (data) => {
  const fromUser = users.get(socket.id);
  const toUser = Array.from(users.values()).find(u => u.username === data.toUsername);
  
  if (fromUser && toUser) {
    const privateMessage = {
      id: uuidv4(),
      from: fromUser.username,
      to: data.toUsername,
      content: data.content,
      timestamp: new Date().toISOString(),
      type: 'private'
    };

    io.to(toUser.id).emit('private_message', privateMessage);
    socket.emit('private_message_sent', privateMessage);
  }
});

// Message reactions
socket.on('message_reaction', (data) => {
  const user = users.get(socket.id);
  if (user) {
    io.emit('message_reaction_added', {
      messageId: data.messageId,
      reaction: data.reaction,
      username: user.username
    });
  }
});