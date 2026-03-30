// ===================== Study Group Finder App with Auth & Theme =====================

// Socket.io connection
let socket = null;
let socketConnected = false;

// Authentication Manager
class AuthManager {
    constructor() {
        this.currentUser = this.loadCurrentUser();
    }

    loadCurrentUser() {
        return localStorage.getItem('currentUser');
    }

    saveCurrentUser(userData) {
        localStorage.setItem('currentUser', JSON.stringify(userData));
    }

    getUsersDatabase() {
        const users = localStorage.getItem('usersDatabase');
        return users ? JSON.parse(users) : [];
    }

    saveUsersDatabase(users) {
        localStorage.setItem('usersDatabase', JSON.stringify(users));
    }

    register(name, email, password) {
        const users = this.getUsersDatabase();

        // Check if email already exists
        if (users.find(u => u.email === email)) {
            return { success: false, message: 'Email already registered' };
        }

        // Create new user
        const newUser = {
            id: Date.now(),
            name,
            email,
            password // Note: In production, never store plain passwords!
        };

        users.push(newUser);
        this.saveUsersDatabase(users);

        // Auto-login after registration
        const userData = {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email
        };
        this.saveCurrentUser(userData);
        this.currentUser = userData;

        return { success: true, message: 'Registration successful!', user: userData };
    }

    login(email, password) {
        const users = this.getUsersDatabase();
        const user = users.find(u => u.email === email && u.password === password);

        if (!user) {
            return { success: false, message: 'Invalid email or password' };
        }

        const userData = {
            id: user.id,
            name: user.name,
            email: user.email
        };

        this.saveCurrentUser(userData);
        this.currentUser = userData;

        return { success: true, message: 'Login successful!', user: userData };
    }

    logout() {
        localStorage.removeItem('currentUser');
        this.currentUser = null;
        return true;
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }
}

// Theme Manager
class ThemeManager {
    constructor() {
        this.isDarkMode = this.loadTheme();
        this.applyTheme();
    }

    loadTheme() {
        const saved = localStorage.getItem('theme');
        if (saved) {
            return saved === 'dark';
        }
        // Check system preference
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    saveTheme() {
        localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    }

    applyTheme() {
        if (this.isDarkMode) {
            document.body.classList.add('dark-mode');
            this.updateIcon();
        } else {
            document.body.classList.remove('dark-mode');
            this.updateIcon();
        }
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        this.applyTheme();
        this.saveTheme();
    }

    updateIcon() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.querySelector('.theme-icon').textContent = this.isDarkMode ? '☀️' : '🌙';
        }
    }
}

// Data Management
class StudyGroupManager {
    constructor() {
        this.groups = this.loadFromStorage() || [];
        this.userGroups = this.loadUserGroupsFromStorage() || [];
        this.groupIdCounter = this.loadCounterFromStorage() || 1;
        this.setupStorageListeners();
    }

    setupStorageListeners() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'studyGroups') {
                this.groups = e.newValue ? JSON.parse(e.newValue) : [];
                if (uiManager) {
                    uiManager.renderBrowseTab();
                    uiManager.renderMyGroupsTab();
                }
            } else if (e.key === 'userGroups') {
                this.userGroups = e.newValue ? JSON.parse(e.newValue) : [];
                if (uiManager) {
                    uiManager.renderMyGroupsTab();
                    uiManager.renderBrowseTab();
                }
            }
        });
    }

    loadFromStorage() {
        const data = localStorage.getItem('studyGroups');
        return data ? JSON.parse(data) : null;
    }

    saveToStorage() {
        localStorage.setItem('studyGroups', JSON.stringify(this.groups));
    }

    loadUserGroupsFromStorage() {
        const data = localStorage.getItem('userGroups');
        return data ? JSON.parse(data) : null;
    }

    saveUserGroupsToStorage() {
        localStorage.setItem('userGroups', JSON.stringify(this.userGroups));
    }

    loadCounterFromStorage() {
        const data = localStorage.getItem('groupIdCounter');
        return data ? parseInt(data) : null;
    }

    saveCounterToStorage() {
        localStorage.setItem('groupIdCounter', this.groupIdCounter.toString());
    }

    createGroup(groupData) {
        const newGroup = {
            id: this.groupIdCounter++,
            ...groupData,
            createdAt: new Date().toISOString(),
            members: [groupData.creatorName],
            creatorId: groupData.creatorName
        };

        this.groups.push(newGroup);
        this.saveToStorage();
        this.saveCounterToStorage();

        this.userGroups.push(newGroup.id);
        this.saveUserGroupsToStorage();

        return newGroup;
    }

    getAllGroups() {
        return this.groups;
    }

    getUserGroups() {
        return this.groups.filter(group => this.userGroups.includes(group.id));
    }

    joinGroup(groupId, userName) {
        const group = this.groups.find(g => g.id === groupId);
        if (group && !group.members.includes(userName)) {
            if (group.members.length < group.maxMembers) {
                group.members.push(userName);
                this.saveToStorage();

                if (!this.userGroups.includes(groupId)) {
                    this.userGroups.push(groupId);
                    this.saveUserGroupsToStorage();
                }
                return true;
            }
        }
        return false;
    }

    leaveGroup(groupId, userName) {
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
            group.members = group.members.filter(m => m !== userName);
            this.saveToStorage();

            if (group.members.length === 0) {
                this.groups = this.groups.filter(g => g.id !== groupId);
                this.saveToStorage();
            }

            this.userGroups = this.userGroups.filter(id => id !== groupId);
            this.saveUserGroupsToStorage();
            return true;
        }
        return false;
    }

    getGroupById(groupId) {
        return this.groups.find(g => g.id === groupId);
    }

    searchGroups(query, difficulty = '') {
        return this.groups.filter(group => {
            const matchesQuery = query === '' || 
                group.subject.toLowerCase().includes(query.toLowerCase()) ||
                group.courseCode.toLowerCase().includes(query.toLowerCase()) ||
                group.groupName.toLowerCase().includes(query.toLowerCase());

            const matchesDifficulty = difficulty === '' || group.difficulty === difficulty;

            return matchesQuery && matchesDifficulty;
        });
    }

    isUserMember(groupId, userName) {
        const group = this.groups.find(g => g.id === groupId);
        return group ? group.members.includes(userName) : false;
    }
}

// Chat Manager
class ChatManager {
    constructor() {
        this.currentGroupId = null;
        this.messages = {};
        this.activeUsers = {};
    }

    joinGroup(groupId, userName) {
        this.currentGroupId = groupId;
        if (socket && socketConnected) {
            socket.emit('join-group', { groupId, userName });
        }
    }

    leaveGroup(groupId, userName) {
        if (socket && socketConnected) {
            socket.emit('leave-group', { groupId, userName });
        }
        this.currentGroupId = null;
    }

    sendMessage(groupId, userName, message) {
        if (socket && socketConnected && message.trim()) {
            socket.emit('send-message', {
                groupId,
                userName,
                message: message.trim(),
                timestamp: new Date().toISOString()
            });
        }
    }

    loadMessages(groupId) {
        return this.messages[groupId] || [];
    }

    addMessage(message) {
        if (!this.messages[message.groupId]) {
            this.messages[message.groupId] = [];
        }
        this.messages[message.groupId].push(message);
    }

    setMessages(groupId, messages) {
        this.messages[groupId] = messages;
    }

    setActiveUsers(groupId, users) {
        this.activeUsers[groupId] = users;
    }

    getActiveUsers(groupId) {
        return this.activeUsers[groupId] || [];
    }
}

// Initialize managers
const authManager = new AuthManager();
const themeManager = new ThemeManager();
const groupManager = new StudyGroupManager();
const chatManager = new ChatManager();

// UI Management
class UIManager {
    constructor() {
        this.currentChatGroupId = null;
        
        if (!authManager.isLoggedIn()) {
            this.setupAuthUI();
        } else {
            this.showApp();
        }
    }

    setupAuthUI() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const switchToRegister = document.getElementById('switchToRegister');
        const switchToLogin = document.getElementById('switchToLogin');

        // Switch between login and register
        switchToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginPage').classList.remove('active');
            document.getElementById('registerPage').classList.add('active');
        });

        switchToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('registerPage').classList.remove('active');
            document.getElementById('loginPage').classList.add('active');
        });

        // Login form
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            const result = authManager.login(email, password);
            if (result.success) {
                this.showToast(result.message, 'success');
                setTimeout(() => {
                    this.showApp();
                }, 500);
            } else {
                this.showToast(result.message, 'error');
            }
        });

        // Register form
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('registerConfirmPassword').value;

            if (password !== confirmPassword) {
                this.showToast('Passwords do not match', 'error');
                return;
            }

            if (password.length < 6) {
                this.showToast('Password must be at least 6 characters', 'error');
                return;
            }

            const result = authManager.register(name, email, password);
            if (result.success) {
                this.showToast(result.message, 'success');
                setTimeout(() => {
                    this.showApp();
                }, 500);
            } else {
                this.showToast(result.message, 'error');
            }
        });
    }

    showApp() {
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        this.initializeAppUI();
    }

    initializeAppUI() {
        // Update user name
        const userName = authManager.currentUser.name;
        document.getElementById('userName').textContent = userName;

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            themeManager.toggleTheme();
        });

        // User menu
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userDropdown = document.getElementById('userDropdown');

        userMenuBtn.addEventListener('click', () => {
            userDropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-menu')) {
                userDropdown.classList.remove('show');
            }
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                authManager.logout();
                location.reload();
            }
        });

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Create group form
        document.getElementById('createGroupForm').addEventListener('submit', (e) => this.handleCreateGroup(e));

        // Search and filter
        document.getElementById('searchInput').addEventListener('input', () => this.renderBrowseTab());
        document.getElementById('difficultyFilter').addEventListener('change', () => this.renderBrowseTab());

        // Modal close
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        document.querySelector('.close-chat').addEventListener('click', () => this.closeChatModal());
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('groupModal');
            const chatModal = document.getElementById('chatModal');
            if (e.target === modal) this.closeModal();
            if (e.target === chatModal) this.closeChatModal();
        });

        // Chat input
        document.getElementById('sendBtn').addEventListener('click', () => this.handleSendMessage());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        });

        // Initialize Socket.io
        this.initializeSocketIO();

        // Render initial data
        initializeSampleData();
        this.renderBrowseTab();
    }

    initializeSocketIO() {
        const serverUrl = window.location.origin;
        socket = io(serverUrl, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });

        socket.on('connect', () => {
            socketConnected = true;
            this.updateChatStatus('Connected to chat');
        });

        socket.on('disconnect', () => {
            socketConnected = false;
            this.updateChatStatus('Disconnected from chat');
        });

        socket.on('receive-message', (message) => {
            chatManager.addMessage(message);
            if (this.currentChatGroupId === message.groupId) {
                this.displayMessage(message);
            }
        });

        socket.on('load-messages', (messages) => {
            const groupId = this.currentChatGroupId;
            chatManager.setMessages(groupId, messages);
            this.renderChatMessages();
        });

        socket.on('user-joined', (data) => {
            chatManager.setActiveUsers(data.groupId || this.currentChatGroupId, data.activeUsers);
            this.displaySystemMessage(`${data.userName} joined the group`);
        });

        socket.on('user-left', (data) => {
            chatManager.setActiveUsers(data.groupId || this.currentChatGroupId, data.activeUsers);
            this.displaySystemMessage(`${data.userName} left the group`);
        });

        socket.on('connect_error', () => {
            this.updateChatStatus('Chat server unavailable');
        });
    }

    updateChatStatus(status) {
        const statusEl = document.getElementById('chatStatus');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.className = 'chat-status ' + (socketConnected ? 'connected' : 'disconnected');
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        if (tabName === 'browse') {
            this.renderBrowseTab();
        } else if (tabName === 'my-groups') {
            this.renderMyGroupsTab();
        }
    }

    renderBrowseTab() {
        const searchQuery = document.getElementById('searchInput').value;
        const difficulty = document.getElementById('difficultyFilter').value;

        const filteredGroups = groupManager.searchGroups(searchQuery, difficulty);
        const groupsList = document.getElementById('groupsList');
        const noGroupsMsg = document.getElementById('noGroupsMsg');

        if (filteredGroups.length === 0) {
            groupsList.innerHTML = '';
            noGroupsMsg.style.display = 'block';
        } else {
            noGroupsMsg.style.display = 'none';
            groupsList.innerHTML = filteredGroups.map(group => this.createGroupCard(group, false)).join('');

            document.querySelectorAll('.group-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (!e.target.closest('.btn')) {
                        this.showGroupModal(parseInt(card.dataset.groupId));
                    }
                });
            });

            document.querySelectorAll('.btn-join-group').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const groupId = parseInt(btn.dataset.groupId);
                    this.handleJoinGroup(groupId);
                });
            });
        }
    }

    renderMyGroupsTab() {
        const userGroups = groupManager.getUserGroups();
        const myGroupsList = document.getElementById('myGroupsList');
        const noMyGroupsMsg = document.getElementById('noMyGroupsMsg');

        if (userGroups.length === 0) {
            myGroupsList.innerHTML = '';
            noMyGroupsMsg.style.display = 'block';
        } else {
            noMyGroupsMsg.style.display = 'none';
            myGroupsList.innerHTML = userGroups.map(group => this.createGroupCard(group, true)).join('');

            document.querySelectorAll('.group-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (!e.target.closest('.btn')) {
                        this.showGroupModal(parseInt(card.dataset.groupId));
                    }
                });
            });

            document.querySelectorAll('.btn-leave-group').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const groupId = parseInt(btn.dataset.groupId);
                    this.handleLeaveGroup(groupId);
                });
            });

            document.querySelectorAll('.btn-chat').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const groupId = parseInt(btn.dataset.groupId);
                    this.openGroupChat(groupId);
                });
            });
        }
    }

    createGroupCard(group, isUserGroup) {
        const isFull = group.members.length >= group.maxMembers;
        const isUserMember = groupManager.isUserMember(group.id, authManager.currentUser.name);

        const difficultyClass = `badge-level-${group.difficulty.toLowerCase()}`;
        const memberPercentage = Math.round((group.members.length / group.maxMembers) * 100);

        let actionButton = '';
        if (isUserGroup) {
            actionButton = `
                <button class="btn btn-danger btn-sm btn-leave-group" data-group-id="${group.id}">
                    Leave
                </button>
                <button class="btn btn-secondary btn-sm chat-btn btn-chat" data-group-id="${group.id}">
                    💬 Chat
                </button>
            `;
        } else if (isUserMember) {
            actionButton = `
                <button class="btn btn-secondary btn-sm" disabled>
                    Already Joined
                </button>
            `;
        } else if (isFull) {
            actionButton = `
                <button class="btn btn-sm" disabled>
                    Group Full
                </button>
            `;
        } else {
            actionButton = `
                <button class="btn btn-success btn-sm btn-join-group" data-group-id="${group.id}">
                    Join Group
                </button>
            `;
        }

        return `
            <div class="group-card" data-group-id="${group.id}">
                <div class="group-header">
                    <h3 class="group-title">${group.groupName}</h3>
                    <div class="group-meta">
                        <span class="badge badge-subject">${group.subject}</span>
                        <span class="badge ${difficultyClass}">${group.difficulty}</span>
                    </div>
                </div>

                <p class="group-description">${group.description}</p>

                <div class="group-info">
                    <div class="info-item">
                        <strong>Code:</strong> ${group.courseCode}
                    </div>
                    <div class="info-item">
                        <strong>Time:</strong> ${group.meetingTime}
                    </div>
                    <div class="info-item">
                        <strong>Location:</strong> ${group.location}
                    </div>
                </div>

                <div class="group-members">
                    <strong>${group.members.length}/${group.maxMembers}</strong> members
                    <div style="background: #e5e7eb; height: 4px; border-radius: 2px; margin-top: 0.5rem; overflow: hidden;">
                        <div style="background: #6366f1; height: 100%; width: ${memberPercentage}%;"></div>
                    </div>
                </div>

                <div class="group-actions">
                    ${actionButton}
                </div>
            </div>
        `;
    }

    showGroupModal(groupId) {
        const group = groupManager.getGroupById(groupId);
        if (!group) return;

        const isUserMember = groupManager.isUserMember(groupId, authManager.currentUser.name);
        const isFull = group.members.length >= group.maxMembers;
        const difficultyClass = `badge-level-${group.difficulty.toLowerCase()}`;

        let modalActions = '';
        if (isUserMember) {
            modalActions = `
                <button class="btn btn-danger" onclick="uiManager.handleLeaveGroup(${groupId})">
                    Leave Group
                </button>
                <button class="btn btn-secondary" onclick="uiManager.openGroupChat(${groupId})">
                    💬 Open Chat
                </button>
            `;
        } else if (!isFull) {
            modalActions = `
                <button class="btn btn-success" onclick="uiManager.handleJoinGroup(${groupId})">
                    Join Group
                </button>
            `;
        } else {
            modalActions = `
                <button class="btn" disabled>Group is Full</button>
            `;
        }

        const modalBody = `
            <h2 class="modal-group-title">${group.groupName}</h2>

            <div class="group-meta" style="margin-bottom: 1.5rem;">
                <span class="badge badge-subject">${group.subject}</span>
                <span class="badge ${difficultyClass}">${group.difficulty}</span>
            </div>

            <div class="modal-group-info">
                <div class="modal-info-row">
                    <div class="modal-info-label">Course Code</div>
                    <div class="modal-info-value">${group.courseCode}</div>
                </div>

                <div class="modal-info-row">
                    <div class="modal-info-label">Description</div>
                    <div class="modal-info-value">${group.description}</div>
                </div>

                <div class="modal-info-row">
                    <div class="modal-info-label">Meeting Time</div>
                    <div class="modal-info-value">${group.meetingTime}</div>
                </div>

                <div class="modal-info-row">
                    <div class="modal-info-label">Location/Platform</div>
                    <div class="modal-info-value">${group.location}</div>
                </div>

                <div class="modal-info-row">
                    <div class="modal-info-label">Members</div>
                    <div class="modal-info-value">${group.members.length} / ${group.maxMembers}</div>
                </div>
            </div>

            <div class="modal-members">
                <h3>Group Members (${group.members.length})</h3>
                <div class="members-list">
                    ${group.members.map((member, idx) => `
                        <div class="member-item">
                            <span>${member}</span>
                            ${member === group.creatorId ? '<span class="member-badge">Creator</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="modal-actions">
                ${modalActions}
            </div>
        `;

        document.getElementById('modalBody').innerHTML = modalBody;
        document.getElementById('groupModal').classList.add('show');
    }

    closeModal() {
        document.getElementById('groupModal').classList.remove('show');
    }

    openGroupChat(groupId) {
        const group = groupManager.getGroupById(groupId);
        if (!group) return;

        this.currentChatGroupId = groupId;
        document.getElementById('chatGroupName').textContent = group.groupName;

        document.getElementById('chatMessages').innerHTML = '';
        document.getElementById('chatInput').value = '';

        chatManager.joinGroup(groupId, authManager.currentUser.name);

        document.getElementById('chatModal').classList.add('show');
    }

    closeChatModal() {
        if (this.currentChatGroupId) {
            chatManager.leaveGroup(this.currentChatGroupId, authManager.currentUser.name);
            this.currentChatGroupId = null;
        }
        document.getElementById('chatModal').classList.remove('show');
    }

    handleSendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();

        if (!message || !this.currentChatGroupId) return;

        if (socketConnected) {
            chatManager.sendMessage(this.currentChatGroupId, authManager.currentUser.name, message);
        } else {
            this.showToast('Chat server not available', 'error');
        }

        input.value = '';
        input.focus();
    }

    displayMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        const isOwnMessage = message.userName === authManager.currentUser.name;

        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${isOwnMessage ? 'own' : ''}`;

        const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageEl.innerHTML = `
            <div class="message-bubble ${isOwnMessage ? 'own' : 'other'}">
                ${!isOwnMessage ? `<div class="message-sender">${message.userName}</div>` : ''}
                <div>${this.escapeHtml(message.message)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;

        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    displaySystemMessage(text) {
        const chatMessages = document.getElementById('chatMessages');
        const systemMsg = document.createElement('div');
        systemMsg.className = 'system-message';
        systemMsg.textContent = text;
        chatMessages.appendChild(systemMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    renderChatMessages() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';

        const messages = chatManager.loadMessages(this.currentChatGroupId);
        messages.forEach(msg => this.displayMessage(msg));

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    handleCreateGroup(e) {
        e.preventDefault();

        const groupData = {
            groupName: document.getElementById('groupName').value,
            subject: document.getElementById('subject').value,
            courseCode: document.getElementById('courseCode').value,
            difficulty: document.getElementById('difficulty').value,
            description: document.getElementById('description').value,
            meetingTime: document.getElementById('meetingTime').value,
            location: document.getElementById('location').value,
            maxMembers: parseInt(document.getElementById('maxMembers').value),
            creatorName: authManager.currentUser.name
        };

        groupManager.createGroup(groupData);
        this.showToast('Study group created successfully!', 'success');

        e.target.reset();
        this.switchTab('browse');
    }

    handleJoinGroup(groupId) {
        if (groupManager.joinGroup(groupId, authManager.currentUser.name)) {
            this.showToast(`Joined the study group!`, 'success');
            this.closeModal();
            this.renderBrowseTab();
            this.renderMyGroupsTab();
        } else {
            this.showToast('Could not join group. It might be full.', 'error');
        }
    }

    handleLeaveGroup(groupId) {
        if (confirm('Are you sure you want to leave this group?')) {
            if (groupManager.leaveGroup(groupId, authManager.currentUser.name)) {
                this.showToast('You have left the study group.', 'success');
                this.closeModal();
                this.closeChatModal();
                this.renderMyGroupsTab();
                this.renderBrowseTab();
            }
        }
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('remove');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Sample data initialization
function initializeSampleData() {
    if (groupManager.groups.length === 0) {
        const sampleGroups = [
            {
                id: 1,
                groupName: 'Calculus Masters',
                subject: 'Mathematics',
                courseCode: 'MATH 201',
                difficulty: 'Advanced',
                description: 'Advanced calculus study group for students tackling multivariable calculus and differential equations.',
                meetingTime: 'Tuesday & Thursday, 6:00 PM',
                location: 'Library Room 301',
                maxMembers: 8,
                members: ['Demo User'],
                creatorId: 'Demo User',
                creatorName: 'Demo User',
                createdAt: new Date().toISOString()
            },
            {
                id: 2,
                groupName: 'Python Beginners',
                subject: 'Computer Science',
                courseCode: 'CS 101',
                difficulty: 'Beginner',
                description: 'Perfect for students just starting their journey in Python programming. We cover basics, variables, loops, and functions.',
                meetingTime: 'Monday & Wednesday, 5:00 PM',
                location: 'Computer Lab B2',
                maxMembers: 10,
                members: ['Demo User'],
                creatorId: 'Demo User',
                creatorName: 'Demo User',
                createdAt: new Date().toISOString()
            },
            {
                id: 3,
                groupName: 'Biology Lab Prep',
                subject: 'Biology',
                courseCode: 'BIO 301',
                difficulty: 'Intermediate',
                description: 'Preparing for upcoming biology lab practicals. Discuss experiments, data analysis, and lab report writing.',
                meetingTime: 'Friday, 4:00 PM',
                location: 'Science Building Room 105',
                maxMembers: 6,
                members: ['Demo User'],
                creatorId: 'Demo User',
                creatorName: 'Demo User',
                createdAt: new Date().toISOString()
            },
            {
                id: 4,
                groupName: 'History Essay Club',
                subject: 'History',
                courseCode: 'HIST 251',
                difficulty: 'Intermediate',
                description: 'Share essay drafts, discuss historical themes, and get feedback from peers on historical analysis and arguments.',
                meetingTime: 'Saturday, 2:00 PM',
                location: 'Zoom Link in description',
                maxMembers: 12,
                members: ['Demo User'],
                creatorId: 'Demo User',
                creatorName: 'Demo User',
                createdAt: new Date().toISOString()
            }
        ];

        sampleGroups.forEach(group => {
            groupManager.groups.push(group);
            groupManager.groupIdCounter = Math.max(groupManager.groupIdCounter, group.id + 1);
        });

        groupManager.saveToStorage();
        groupManager.saveCounterToStorage();
    }
}

// Initialize the app
let uiManager;
document.addEventListener('DOMContentLoaded', () => {
    uiManager = new UIManager();
});
