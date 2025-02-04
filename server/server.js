const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const socketIo = require('socket.io');

const app = express();
const PORT = process.env.PORT || 8081;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors({
    origin: [
        'https://localhost:8081',
        'https://localhost',
        'https://*.ext-twitch.tv',
        'https://*.twitch.tv',
        'https://*.railway.app',
        'https://gamesboard-production.up.railway.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    optionsSuccessStatus: 200
}));
app.use(express.json());

// Statische Dateien
app.use(express.static(path.join(__dirname, 'extension')));
app.use('/static', express.static(path.join(__dirname, 'extension')));

// Root-Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'extension', 'panel.html'));
});

// Basis-Route für Gesundheitscheck
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Extension Panel
app.get('/panel.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'extension', 'panel.html'));
});

// Extension Config
app.get('/config.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'extension', 'config.html'));
});

// Extension Manifest
app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'extension', 'manifest.json'));
});

// Spiele-Daten Route
app.get('/games', (req, res) => {
    try {
        // Erstelle gamedata Ordner falls nicht vorhanden
        const gamedataDir = path.join(process.cwd(), 'gamedata');
        if (!fs.existsSync(gamedataDir)) {
            fs.mkdirSync(gamedataDir);
        }

        const dataPath = path.join(gamedataDir, 'games.json');
        // Erstelle leere games.json falls nicht vorhanden
        if (!fs.existsSync(dataPath)) {
            fs.writeFileSync(dataPath, JSON.stringify({ games: [] }, null, 2));
        }

        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        // Stelle sicher, dass wir ein Array zurückgeben
        const games = Array.isArray(data) ? data : (data.games || []);
        res.json(games);
    } catch (error) {
        console.error('Fehler beim Lesen der Spieldaten:', error);
        res.status(500).json({ error: 'Fehler beim Lesen der Spieldaten' });
    }
});

// Abstimmungs-Route
app.post('/vote', (req, res) => {
    try {
        const { game, user } = req.body;
        
        // Validation
        if (!game || !user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Game and user must be specified' 
            });
        }

        // Load current game data
        const gamedataDir = path.join(process.cwd(), 'gamedata');
        const dataPath = path.join(gamedataDir, 'games.json');
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const games = data.games || [];

        // Find the game
        const gameIndex = games.findIndex(g => g.name === game);
        if (gameIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Game not found' 
            });
        }

        // Increase votes
        games[gameIndex].votes = (games[gameIndex].votes || 0) + 1;

        // Save updated data
        fs.writeFileSync(dataPath, JSON.stringify({ games }, null, 2));

        res.json({ 
            success: true, 
            message: 'Vote successful',
            games 
        });
    } catch (error) {
        console.error('Error during voting:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Update game
app.put('/games/:oldName', (req, res) => {
    try {
        const { oldName } = req.params;
        const { name: newName, votes } = req.body;

        const gamedataDir = path.join(process.cwd(), 'gamedata');
        const dataPath = path.join(gamedataDir, 'games.json');
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const games = data.games || [];

        const gameIndex = games.findIndex(g => g.name === oldName);
        if (gameIndex === -1) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Update game name and votes
        games[gameIndex].name = newName;
        if (votes !== undefined) {
            games[gameIndex].votes = parseInt(votes) || 0;
        }
        
        fs.writeFileSync(dataPath, JSON.stringify({ games }, null, 2));
        
        // Emit update event
        io.emit('adminUpdate', { type: 'gameUpdate', games });

        res.json({ success: true, games });
    } catch (error) {
        console.error('Error updating game:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add new game
app.post('/games', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Game name is required' });
        }

        const gamedataDir = path.join(process.cwd(), 'gamedata');
        const dataPath = path.join(gamedataDir, 'games.json');
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const games = data.games || [];

        // Check if game already exists
        if (games.some(g => g.name === name)) {
            return res.status(400).json({ error: 'Game already exists' });
        }

        // Add new game
        games.push({ name, votes: 0 });
        fs.writeFileSync(dataPath, JSON.stringify({ games }, null, 2));
        
        // Emit update event
        io.emit('adminUpdate', { type: 'gameAdded', games });

        res.json({ success: true, games });
    } catch (error) {
        console.error('Error adding game:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete game
app.delete('/games/:name', (req, res) => {
    try {
        const { name } = req.params;

        const gamedataDir = path.join(process.cwd(), 'gamedata');
        const dataPath = path.join(gamedataDir, 'games.json');
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const games = data.games || [];

        const gameIndex = games.findIndex(g => g.name === name);
        if (gameIndex === -1) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Remove game
        games.splice(gameIndex, 1);
        fs.writeFileSync(dataPath, JSON.stringify({ games }, null, 2));
        
        // Emit update event
        io.emit('adminUpdate', { type: 'gameDeleted', games });

        res.json({ success: true, games });
    } catch (error) {
        console.error('Error deleting game:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Save vote settings
app.post('/settings/vote', (req, res) => {
    try {
        const { voteCooldown, subMultiplier, modMultiplier } = req.body;
        const settingsPath = path.join(process.cwd(), 'gamedata', 'settings.json');
        const settings = fs.existsSync(settingsPath) 
            ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) 
            : {};

        settings.vote = { voteCooldown, subMultiplier, modMultiplier };
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

        res.json({ success: true, settings: settings.vote });
    } catch (error) {
        console.error('Error saving vote settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Save Twitch settings
app.post('/settings/twitch', (req, res) => {
    try {
        const { channelName, oauthToken, voteCommand } = req.body;
        const settingsPath = path.join(process.cwd(), 'gamedata', 'settings.json');
        const settings = fs.existsSync(settingsPath) 
            ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) 
            : {};

        settings.twitch = { channelName, oauthToken, voteCommand };
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

        res.json({ success: true, settings: settings.twitch });
    } catch (error) {
        console.error('Error saving Twitch settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export data
app.get('/export', (req, res) => {
    try {
        const gamedataDir = path.join(process.cwd(), 'gamedata');
        const dataPath = path.join(gamedataDir, 'games.json');
        const settingsPath = path.join(gamedataDir, 'settings.json');

        const games = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const settings = fs.existsSync(settingsPath) 
            ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
            : {};

        res.json({ games, settings });
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Import data
app.post('/import', (req, res) => {
    try {
        const { games, settings } = req.body;
        const gamedataDir = path.join(process.cwd(), 'gamedata');
        
        if (games) {
            fs.writeFileSync(
                path.join(gamedataDir, 'games.json'),
                JSON.stringify(games, null, 2)
            );
        }
        
        if (settings) {
            fs.writeFileSync(
                path.join(gamedataDir, 'settings.json'),
                JSON.stringify(settings, null, 2)
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error importing data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset votes
app.post('/reset-votes', (req, res) => {
    try {
        const gamedataDir = path.join(process.cwd(), 'gamedata');
        const dataPath = path.join(gamedataDir, 'games.json');
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const games = data.games || [];

        // Reset all votes to 0
        games.forEach(game => game.votes = 0);
        fs.writeFileSync(dataPath, JSON.stringify({ games }, null, 2));
        
        // Emit update event
        io.emit('adminUpdate', { type: 'votesReset', games });

        res.json({ success: true, games });
    } catch (error) {
        console.error('Error resetting votes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create backup
app.post('/backup', (req, res) => {
    try {
        const gamedataDir = path.join(process.cwd(), 'gamedata');
        const backupDir = path.join(gamedataDir, 'backups');
        
        // Create backup directory if it doesn't exist
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }

        // Create backup of games and settings
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `backup_${timestamp}.json`);

        const games = JSON.parse(fs.readFileSync(path.join(gamedataDir, 'games.json'), 'utf8'));
        const settings = fs.existsSync(path.join(gamedataDir, 'settings.json'))
            ? JSON.parse(fs.readFileSync(path.join(gamedataDir, 'settings.json'), 'utf8'))
            : {};

        fs.writeFileSync(backupPath, JSON.stringify({ games, settings }, null, 2));

        res.json({ success: true, backupPath });
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

let server;

if (isProduction) {
    // In production, use standard HTTP (Railway/Heroku will handle SSL)
    server = http.createServer(app);
} else {
    // In development, use HTTPS with local certificates
    const sslOptions = {
        key: fs.readFileSync(path.join(__dirname, 'config', 'key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'config', 'cert.pem'))
    };
    server = https.createServer(sslOptions, app);
}

// Socket.io Integration
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Socket.io Event Handler
io.on('connection', (socket) => {
    console.log('Neue Socket.io Verbindung etabliert');
    
    // Test-Event Handler
    socket.on('test', (data) => {
        console.log('Test-Nachricht erhalten:', data);
        socket.emit('test_response', {
            message: 'Hallo Client!',
            timestamp: new Date().toISOString()
        });
    });

    // NEU: Vote-Event Handler
    socket.on('vote', (data) => {
        console.log('Vote erhalten:', data);
        io.emit('voteUpdate', data); // Broadcast an alle Clients
    });

    socket.on('disconnect', () => {
        console.log('Socket.io Verbindung getrennt');
    });
});

// Server starten
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);
    console.log(`Access via ${isProduction ? 'http' : 'https'}://localhost:${PORT}`);
}); 