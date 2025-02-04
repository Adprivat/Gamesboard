const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Definiere den Datenordner im Arbeitsverzeichnis
const DATA_DIR = path.join(process.cwd(), 'gamedata');
const DATA_FILE = path.join(DATA_DIR, 'games.json');
const VOTE_RECORD_FILE = path.join(DATA_DIR, 'vote_records.json');

// Sicherstellen, dass der Datenordner existiert
function initializeDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log("Data directory created at:", DATA_DIR);
  }
}

// Sicherstellen, dass die Daten-Dateien existieren
function initializeDataFile() {
  initializeDataDirectory();
  
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = { games: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    console.log("Games data file created at:", DATA_FILE);
  }
  if (!fs.existsSync(VOTE_RECORD_FILE)) {
    const initialVoteRecord = {};
    fs.writeFileSync(VOTE_RECORD_FILE, JSON.stringify(initialVoteRecord, null, 2));
    console.log("Vote record file created at:", VOTE_RECORD_FILE);
  }
}

// Hilfsfunktion zum Erstellen von Backups
function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(DATA_DIR, 'backups', timestamp);
  
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    
    if (fs.existsSync(DATA_FILE)) {
      fs.copyFileSync(DATA_FILE, path.join(backupDir, 'games.json'));
    }
    if (fs.existsSync(VOTE_RECORD_FILE)) {
      fs.copyFileSync(VOTE_RECORD_FILE, path.join(backupDir, 'vote_records.json'));
    }
    
    console.log("Backup created at:", backupDir);
    return true;
  } catch (error) {
    console.error("Error creating backup:", error);
    return false;
  }
}

function readDataFile() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const initialData = { games: [] };
      fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
      console.log("Games data file created at:", DATA_FILE);
      return initialData;
    }
    const data = fs.readFileSync(DATA_FILE);
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data file:', error);
    return { games: [] };
  }
}

function writeDataFile(data) {
  try {
    // Erstelle ein Backup vor dem Schreiben
    createBackup();
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log("Data file updated successfully");
    return true;
  } catch (error) {
    console.error('Error writing data file:', error);
    return false;
  }
}

// Vote Record Funktionen
function readVoteRecord() {
  try {
    const data = fs.readFileSync(VOTE_RECORD_FILE);
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading vote record file:', error);
    return {};
  }
}

function writeVoteRecord(data) {
  try {
    // Erstelle ein Backup vor dem Schreiben
    createBackup();
    
    fs.writeFileSync(VOTE_RECORD_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing vote record file:', error);
    return false;
  }
}

function hasVotedToday(userId) {
  const voteRecord = readVoteRecord();
  const lastVoteDate = voteRecord[userId];
  if (!lastVoteDate) return false;
  const today = new Date().toISOString().split('T')[0];
  return lastVoteDate === today;
}

function recordVote(userId) {
  const voteRecord = readVoteRecord();
  const today = new Date().toISOString().split('T')[0];
  voteRecord[userId] = today;
  writeVoteRecord(voteRecord);
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  mainWindow.loadFile('index.html');

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  initializeDataFile();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC-Handler
ipcMain.handle('get-games', async () => {
  const data = readDataFile();
  return data.games;
});

ipcMain.handle('save-games', async (event, games) => {
  const data = { games };
  writeDataFile(data);
  return { success: true };
});

ipcMain.handle('vote-game', async (event, gameId, voteValue, userId) => {
  // Prüfe, ob der User heute schon abgestimmt hat
  if (hasVotedToday(userId)) {
    return { 
      success: false, 
      message: 'You have already voted today. Please come back tomorrow!' 
    };
  }

  const data = readDataFile();
  const game = data.games.find(g => g.id === gameId);
  if (!game) {
    return { success: false, message: 'Game not found.' };
  }

  game.points = (game.points || 0) + voteValue;
  writeDataFile(data);
  
  // Speichere den Vote-Record nur für den User
  recordVote(userId);
  
  return { success: true, game };
});

ipcMain.handle('edit-game', async (event, gameId, newPoints, newName) => {
  const data = readDataFile();
  const game = data.games.find(g => g.id === gameId);
  
  if (!game) {
    return { 
      success: false, 
      message: 'Game not found.' 
    };
  }

  // Prüfe, ob der neue Name bereits existiert (außer bei gleichem Spiel)
  if (newName && newName !== game.name) {
    const nameExists = data.games.some(g => 
      g.id !== gameId && 
      g.name.toLowerCase() === newName.toLowerCase()
    );
    
    if (nameExists) {
      return {
        success: false,
        message: 'A game with this name already exists.'
      };
    }
  }

  // Aktualisiere die Spieledaten
  if (newName) game.name = newName.trim();
  if (typeof newPoints === 'number') game.points = newPoints;

  if (writeDataFile(data)) {
    return { 
      success: true, 
      game,
      message: 'Game updated successfully.' 
    };
  } else {
    return { 
      success: false, 
      message: 'Error saving game data.' 
    };
  }
});

ipcMain.handle('add-game', async (event, gameName) => {
  console.log("add-game called with gameName:", gameName);
  
  if (!gameName || gameName.trim() === '') {
    return { 
      success: false, 
      message: "Please enter a valid game name" 
    };
  }

  const data = readDataFile();
  if (!Array.isArray(data.games)) {
    data.games = [];
  }

  // Check if game already exists
  if (data.games.some(game => game.name.toLowerCase() === gameName.toLowerCase())) {
    return {
      success: false,
      message: "A game with this name already exists"
    };
  }

  // Finde die niedrigste verfügbare ID
  const usedIds = data.games.map(game => parseInt(game.id)).sort((a, b) => a - b);
  let nextId = 1;
  
  for (const currentId of usedIds) {
    if (currentId !== nextId) {
      break;
    }
    nextId++;
  }
  
  // Prüfe ob die ID im erlaubten Bereich liegt
  if (nextId > 500) {
    return { 
      success: false, 
      message: "No available IDs between 1 and 500. Please delete some games first." 
    };
  }

  const newGame = {
    id: nextId.toString(),
    name: gameName.trim(),
    points: 0
  };
  
  data.games.push(newGame);
  if (!writeDataFile(data)) {
    return {
      success: false,
      message: "Error saving game. Please try again."
    };
  }
  
  console.log("New game added:", newGame);
  return { success: true, game: newGame };
});

ipcMain.handle('remove-game', async (event, gameId) => {
  const data = readDataFile();
  data.games = data.games.filter(g => g.id !== gameId);
  writeDataFile(data);
  return { success: true };
});

ipcMain.handle('reset-vote-lock', async () => {
  try {
    // Leere Vote-Records-Datei erstellen
    const emptyVoteRecord = {};
    writeVoteRecord(emptyVoteRecord);
    
    return { 
      success: true, 
      message: 'Vote lock has been reset. All users can vote again.' 
    };
  } catch (error) {
    console.error('Error resetting vote lock:', error);
    return { 
      success: false, 
      message: 'Error resetting vote lock.' 
    };
  }
});

// Neuer IPC-Handler für das Abrufen des Datenpfads
ipcMain.handle('get-data-path', () => {
  return DATA_DIR;
});
