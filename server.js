const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Store active connections and group chats
const groupChats = {}; // { groupId: [messages] }
const activeUsers = {}; // { groupId: [users] }

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);

    // User joins a group chat
    socket.on('join-group', (data) => {
        const { groupId, userName } = data;
        socket.join(`group-${groupId}`);

        if (!groupChats[groupId]) {
            groupChats[groupId] = [];
        }
        if (!activeUsers[groupId]) {
            activeUsers[groupId] = [];
        }

        // Add user to active users if not already there
        if (!activeUsers[groupId].includes(userName)) {
            activeUsers[groupId].push(userName);
        }

        // Notify others that user joined
        io.to(`group-${groupId}`).emit('user-joined', {
            userName,
            activeUsers: activeUsers[groupId],
            timestamp: new Date().toISOString()
        });

        // Send chat history to the new user
        socket.emit('load-messages', groupChats[groupId]);

        console.log(`${userName} joined group ${groupId}`);
    });

    // Handle new messages
    socket.on('send-message', (data) => {
        const { groupId, userName, message, timestamp } = data;

        const messageObj = {
            id: Date.now(),
            userName,
            message,
            timestamp,
            groupId
        };

        if (!groupChats[groupId]) {
            groupChats[groupId] = [];
        }

        groupChats[groupId].push(messageObj);

        // Keep only last 100 messages per group to save memory
        if (groupChats[groupId].length > 100) {
            groupChats[groupId].shift();
        }

        // Broadcast message to all users in the group
        io.to(`group-${groupId}`).emit('receive-message', messageObj);

        console.log(`Message in group ${groupId} from ${userName}`);
    });

    // User leaves group chat
    socket.on('leave-group', (data) => {
        const { groupId, userName } = data;
        socket.leave(`group-${groupId}`);

        if (activeUsers[groupId]) {
            activeUsers[groupId] = activeUsers[groupId].filter(u => u !== userName);
        }

        // Notify others that user left
        io.to(`group-${groupId}`).emit('user-left', {
            userName,
            activeUsers: activeUsers[groupId] || [],
            timestamp: new Date().toISOString()
        });

        console.log(`${userName} left group ${groupId}`);
    });

    // Get active users in group
    socket.on('get-active-users', (data) => {
        const { groupId } = data;
        socket.emit('active-users', {
            users: activeUsers[groupId] || [],
            groupId
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Remove user from all groups they were in
        Object.keys(activeUsers).forEach(groupId => {
            activeUsers[groupId] = activeUsers[groupId].filter(user => user !== socket.id);
        });
    });

    // Error handling
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

// Routes
app.get('/api/groups', (req, res) => {
    res.json({
        groups: Object.keys(groupChats).map(groupId => ({
            groupId,
            messageCount: groupChats[groupId].length,
            activeUsers: activeUsers[groupId] ? activeUsers[groupId].length : 0
        }))
    });
});

app.get('/api/group/:groupId/messages', (req, res) => {
    const { groupId } = req.params;
    res.json({
        messages: groupChats[groupId] || [],
        activeUsers: activeUsers[groupId] || []
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Study Group Finder server running on http://localhost:${PORT}`);
    console.log('Socket.io chat server is ready!');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nServer shutting down...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
