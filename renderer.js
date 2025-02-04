const { ipcRenderer } = require('electron');
const tmi = require('tmi.js');

document.addEventListener('DOMContentLoaded', () => {
  let games = [];
  let currentTab = 'alphabetical';
  let currentSort = 'az';
  let selectedGameId = null;
  let selectedGameForEdit = null;
  
  const gameListElem = document.getElementById('gameList');
  const tabAlphabetical = document.getElementById('tab-alphabetical');
  const tabLeaderboard = document.getElementById('tab-leaderboard');
  const searchInput = document.getElementById('searchInput');
  const sortOptions = document.getElementById('sortOptions');
  
  const voteModal = document.getElementById('modal');
  const confirmVoteBtn = document.getElementById('confirmVote');
  const cancelVoteBtn = document.getElementById('cancelVote');
  
  const addGameModal = document.getElementById('addGameModal');
  const newGameNameInput = document.getElementById('newGameName');
  const confirmAddGameBtn = document.getElementById('confirmAddGame');
  const cancelAddGameBtn = document.getElementById('cancelAddGame');
  const addGameButton = document.getElementById('addGameButton');
  
  const editPointsModal = document.getElementById('editPointsModal');
  const editPointsInput = document.getElementById('editPoints');
  const confirmEditPointsBtn = document.getElementById('confirmEditPoints');
  const cancelEditPointsBtn = document.getElementById('cancelEditPoints');
  
  const exportButton = document.getElementById('exportButton');
  const importButton = document.getElementById('importButton');
  const fileInput = document.getElementById('fileInput');
  
  // Twitch-Integration
  let twitchClient = null;
  let twitchSettings = {
    channelName: '',
    token: '',
    subMultiplier: false,
    subPoints: 2,
    voteCommand: '!vote',
    viewerMultiplier: 1,
    globalMultiplier: 1
  };
  
  // Settings Modal Elements
  const settingsButton = document.getElementById('settingsButton');
  const settingsModal = document.getElementById('settingsModal');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const cancelSettingsBtn = document.getElementById('cancelSettings');
  const generateTokenBtn = document.getElementById('generateToken');
  
  // Settings Input Elements
  const channelNameInput = document.getElementById('channelName');
  const twitchTokenInput = document.getElementById('twitchToken');
  const subMultiplierCheckbox = document.getElementById('subMultiplier');
  const subPointsInput = document.getElementById('subPoints');
  const voteCommandInput = document.getElementById('voteCommand');
  const viewerMultiplierInput = document.getElementById('viewerMultiplier');
  const globalMultiplierInput = document.getElementById('globalMultiplier');
  
  // Theme Management
  const defaultTheme = {
    backgroundColor: '#1a1a1a',
    textColor: '#ffffff',
    accentColor: '#2a2a2a',
    fontFamily: 'Arial, sans-serif',
    fontSize: '14',
    itemSpacing: '8',
    borderRadius: '4'
  };
  
  function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const theme = savedTheme ? JSON.parse(savedTheme) : defaultTheme;
    applyTheme(theme);
    updateThemeInputs(theme);
  }
  
  function saveTheme(theme) {
    localStorage.setItem('theme', JSON.stringify(theme));
  }
  
  function applyTheme(theme) {
    document.documentElement.style.setProperty('--background-color', theme.backgroundColor);
    document.documentElement.style.setProperty('--text-color', theme.textColor);
    document.documentElement.style.setProperty('--accent-color', theme.accentColor);
    document.documentElement.style.setProperty('--hover-color', adjustColor(theme.accentColor, 20));
    document.documentElement.style.setProperty('--active-color', adjustColor(theme.accentColor, 40));
    document.documentElement.style.setProperty('--font-family', theme.fontFamily);
    document.documentElement.style.setProperty('--font-size', `${theme.fontSize}px`);
    document.documentElement.style.setProperty('--item-spacing', `${theme.itemSpacing}px`);
    document.documentElement.style.setProperty('--border-radius', `${theme.borderRadius}px`);
  }
  
  function updateThemeInputs(theme) {
    document.getElementById('backgroundColor').value = theme.backgroundColor;
    document.getElementById('textColor').value = theme.textColor;
    document.getElementById('accentColor').value = theme.accentColor;
    document.getElementById('fontFamily').value = theme.fontFamily;
    document.getElementById('fontSize').value = theme.fontSize;
    document.getElementById('itemSpacing').value = theme.itemSpacing;
    document.getElementById('borderRadius').value = theme.borderRadius;
  }
  
  function adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  
  // Theme Event Listeners
  document.getElementById('backgroundColor').addEventListener('input', (e) => {
    const theme = JSON.parse(localStorage.getItem('theme') || JSON.stringify(defaultTheme));
    theme.backgroundColor = e.target.value;
    applyTheme(theme);
    saveTheme(theme);
  });
  
  document.getElementById('textColor').addEventListener('input', (e) => {
    const theme = JSON.parse(localStorage.getItem('theme') || JSON.stringify(defaultTheme));
    theme.textColor = e.target.value;
    applyTheme(theme);
    saveTheme(theme);
  });
  
  document.getElementById('accentColor').addEventListener('input', (e) => {
    const theme = JSON.parse(localStorage.getItem('theme') || JSON.stringify(defaultTheme));
    theme.accentColor = e.target.value;
    applyTheme(theme);
    saveTheme(theme);
  });
  
  document.getElementById('fontFamily').addEventListener('change', (e) => {
    const theme = JSON.parse(localStorage.getItem('theme') || JSON.stringify(defaultTheme));
    theme.fontFamily = e.target.value;
    applyTheme(theme);
    saveTheme(theme);
  });
  
  document.getElementById('fontSize').addEventListener('input', (e) => {
    const theme = JSON.parse(localStorage.getItem('theme') || JSON.stringify(defaultTheme));
    theme.fontSize = e.target.value;
    applyTheme(theme);
    saveTheme(theme);
  });
  
  document.getElementById('itemSpacing').addEventListener('input', (e) => {
    const theme = JSON.parse(localStorage.getItem('theme') || JSON.stringify(defaultTheme));
    theme.itemSpacing = e.target.value;
    applyTheme(theme);
    saveTheme(theme);
  });
  
  document.getElementById('borderRadius').addEventListener('input', (e) => {
    const theme = JSON.parse(localStorage.getItem('theme') || JSON.stringify(defaultTheme));
    theme.borderRadius = e.target.value;
    applyTheme(theme);
    saveTheme(theme);
  });
  
  document.getElementById('resetTheme').addEventListener('click', () => {
    applyTheme(defaultTheme);
    updateThemeInputs(defaultTheme);
    saveTheme(defaultTheme);
  });
  
  // Spiele laden
  async function loadGames() {
    games = await ipcRenderer.invoke('get-games');
    console.log("Loaded games:", games);
    renderGames();
  }
  
  // Spiele sortieren
  function sortGames(gamesList) {
    if (currentTab === 'alphabetical') {
      return gamesList.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    // Leaderboard Sortierung
    switch(currentSort) {
      case 'most':
        return gamesList.sort((a, b) => b.points - a.points);
      case 'least':
        return gamesList.sort((a, b) => a.points - b.points);
      case 'az':
        return gamesList.sort((a, b) => a.name.localeCompare(b.name));
      case 'za':
        return gamesList.sort((a, b) => b.name.localeCompare(a.name));
      default:
        return gamesList.sort((a, b) => b.points - a.points);
    }
  }
  
  // Spiele rendern
  function renderGames() {
    const searchTerm = searchInput.value.toLowerCase();
    let filteredGames = games.filter(game => 
      game.name.toLowerCase().includes(searchTerm)
    );
  
    filteredGames = sortGames(filteredGames);
  
    gameListElem.innerHTML = '';
    if (filteredGames.length === 0) {
      const noGamesMsg = document.createElement('div');
      noGamesMsg.classList.add('game-item');
      noGamesMsg.textContent = searchTerm ? 'No games found matching your search.' : 'No games added yet.';
      gameListElem.appendChild(noGamesMsg);
      return;
    }

    const hasVoted = hasVotedToday(userId);
    
    filteredGames.forEach((game, index) => {
      const gameItem = document.createElement('div');
      gameItem.classList.add('game-item');
      gameItem.dataset.id = game.id;
  
      const numberElem = document.createElement('span');
      numberElem.classList.add('game-number');
      numberElem.textContent = `${index + 1}.`;
  
      const nameElem = document.createElement('span');
      nameElem.classList.add('game-name');
      nameElem.textContent = game.name;
  
      const pointsElem = document.createElement('span');
      pointsElem.classList.add('game-points');
      pointsElem.textContent = `[${game.points || 0}]`;
  
      const idElem = document.createElement('span');
      idElem.classList.add('game-id');
      idElem.textContent = `ID: ${game.id}`;
  
      const actionsElem = document.createElement('div');
      actionsElem.classList.add('game-actions');
  
      const editButton = document.createElement('button');
      editButton.classList.add('action-button');
      editButton.textContent = 'Edit';
      editButton.onclick = (e) => {
        e.stopPropagation();
        openEditPointsModal(game);
      };
  
      const deleteButton = document.createElement('button');
      deleteButton.classList.add('action-button');
      deleteButton.textContent = 'Delete';
      deleteButton.onclick = (e) => {
        e.stopPropagation();
        if(confirm('Are you sure you want to delete this game?')) {
          ipcRenderer.invoke('remove-game', game.id).then(response => {
            if(response.success) {
              loadGames();
            }
          });
        }
      };
  
      const voteButton = document.createElement('button');
      voteButton.classList.add('vote-button');
      voteButton.textContent = hasVoted ? 'Bereits abgestimmt' : 'Vote';
      voteButton.onclick = () => {
        openVoteModal(game.id);
      };
  
      actionsElem.appendChild(editButton);
      actionsElem.appendChild(deleteButton);
      actionsElem.appendChild(voteButton);
  
      gameItem.appendChild(numberElem);
      gameItem.appendChild(nameElem);
      gameItem.appendChild(pointsElem);
      gameItem.appendChild(idElem);
      gameItem.appendChild(actionsElem);
  
      gameItem.addEventListener('click', () => {
        openVoteModal(game.id);
      });
  
      gameListElem.appendChild(gameItem);
    });
  }
  
  // Funktionen für den Abstimmungs-Modal
  function openVoteModal(gameId) {
    selectedGameId = gameId;
    voteModal.classList.remove('hidden');
  }
  
  function closeVoteModal() {
    voteModal.classList.add('hidden');
    selectedGameId = null;
  }
  
  function openEditPointsModal(game) {
    selectedGameForEdit = game;
    document.getElementById('editGameName').value = game.name;
    document.getElementById('editPoints').value = game.points;
    editPointsModal.classList.remove('hidden');
  }
  
  function closeEditPointsModal() {
    editPointsModal.classList.add('hidden');
    selectedGameForEdit = null;
    document.getElementById('editGameName').value = '';
    document.getElementById('editPoints').value = '';
  }
  
  // Prüfen, ob bereits heute für ein Spiel abgestimmt wurde
  function hasVotedToday(userId) {
    const voteRecord = JSON.parse(localStorage.getItem('voteRecord') || '{}');
    const lastVoteDate = voteRecord[userId];
    const today = new Date().toISOString().split('T')[0];
    return lastVoteDate === today;
  }
  
  function recordVote(userId) {
    const voteRecord = JSON.parse(localStorage.getItem('voteRecord') || '{}');
    const today = new Date().toISOString().split('T')[0];
    voteRecord[userId] = today;
    localStorage.setItem('voteRecord', JSON.stringify(voteRecord));
  }
  
  confirmVoteBtn.addEventListener('click', () => {
    if (!selectedGameId) return;
    const userId = 'local_user'; // Lokaler Benutzer ID
    if (hasVotedToday(userId)) {
      alert('Du hast heute bereits abgestimmt.');
      closeVoteModal();
      return;
    }
    ipcRenderer.invoke('vote-game', selectedGameId, 1, userId).then(response => {
      if (response.success) {
        recordVote(userId);
        loadGames();
      }
      closeVoteModal();
    });
  });
  
  cancelVoteBtn.addEventListener('click', () => {
    closeVoteModal();
  });
  
  // Funktionen für den "Spiel hinzufügen"-Modal
  addGameButton.addEventListener('click', () => {
    console.log('Opening add game modal');
    addGameModal.classList.remove('hidden');
    newGameNameInput.value = '';
  });
  
  confirmAddGameBtn.addEventListener('click', async () => {
    console.log('Confirm add game button clicked');
    const gameName = newGameNameInput.value.trim();
    console.log("Trying to add game:", gameName);
    
    if (gameName === '') {
      alert('Please enter a game name');
      return;
    }

    try {
      const response = await ipcRenderer.invoke('add-game', gameName);
      console.log("Response from addGame:", response);
      
      if (response.success) {
        await loadGames();
        addGameModal.classList.add('hidden');
      } else {
        alert(response.message || 'Error adding game');
      }
    } catch (err) {
      console.error("Error adding game:", err);
      alert('Error adding game. Please try again.');
    }
  });
  
  newGameNameInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
      confirmAddGameBtn.click();
    }
  });
  
  cancelAddGameBtn.addEventListener('click', () => {
    console.log('Canceling add game');
    addGameModal.classList.add('hidden');
  });
  
  // Event Listeners für Edit Points Modal
  confirmEditPointsBtn.addEventListener('click', async () => {
    if (!selectedGameForEdit) return;
    
    const newName = document.getElementById('editGameName').value.trim();
    const newPoints = parseInt(document.getElementById('editPoints').value, 10);
    
    if (newName === '') {
      alert('Game name cannot be empty.');
      return;
    }
    
    if (isNaN(newPoints)) {
      alert('Please enter a valid number for points.');
      return;
    }
    
    try {
      const response = await ipcRenderer.invoke('edit-game', selectedGameForEdit.id, newPoints, newName);
      if (response.success) {
        await loadGames();
        closeEditPointsModal();
      } else {
        alert('Error: ' + response.message);
      }
    } catch (error) {
      console.error('Error updating game:', error);
      alert('An error occurred while updating the game.');
    }
  });
  
  cancelEditPointsBtn.addEventListener('click', () => {
    closeEditPointsModal();
  });
  
  // Tab-Wechsel
  tabAlphabetical.addEventListener('click', () => {
    currentTab = 'alphabetical';
    tabAlphabetical.classList.add('active');
    tabLeaderboard.classList.remove('active');
    sortOptions.classList.add('hidden');
    renderGames();
  });
  
  tabLeaderboard.addEventListener('click', () => {
    currentTab = 'leaderboard';
    tabLeaderboard.classList.add('active');
    tabAlphabetical.classList.remove('active');
    sortOptions.classList.remove('hidden');
    currentSort = sortOptions.value;
    renderGames();
  });
  
  // Sucheingabe
  searchInput.addEventListener('input', () => {
    renderGames();
  });
  
  // Sortieroptionen ändern
  sortOptions.addEventListener('change', (e) => {
    if (currentTab === 'leaderboard') {
      currentSort = e.target.value;
      renderGames();
    }
  });
  
  // Export-Funktion
  function exportGames() {
    const exportData = {
      games: games,
      exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `games_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  }
  
  // Import-Funktion
  async function importGames(file) {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      if (!importData.games || !Array.isArray(importData.games)) {
        throw new Error('Invalid file format');
      }
  
      const confirmation = confirm(
        `Do you want to import ${importData.games.length} games?\n` +
        'WARNING: This will replace all existing games!'
      );
  
      if (confirmation) {
        for (const game of importData.games) {
          await ipcRenderer.invoke('add-game', game.name, game.points);
        }
        await loadGames();
        alert('Import completed successfully!');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Error importing data. Please check the file.');
    }
  }
  
  // Event-Listener für Export-Button
  exportButton.addEventListener('click', exportGames);
  
  // Event-Listener für Import-Button und Datei-Input
  importButton.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      importGames(file);
    }
    // Reset file input
    event.target.value = '';
  });
  
  // Lade gespeicherte Einstellungen
  function loadSettings() {
    const savedSettings = localStorage.getItem('twitchSettings');
    if (savedSettings) {
      twitchSettings = JSON.parse(savedSettings);
      channelNameInput.value = twitchSettings.channelName;
      twitchTokenInput.value = twitchSettings.token;
      subMultiplierCheckbox.checked = twitchSettings.subMultiplier;
      subPointsInput.value = twitchSettings.subPoints;
      voteCommandInput.value = twitchSettings.voteCommand;
      viewerMultiplierInput.value = twitchSettings.viewerMultiplier;
      globalMultiplierInput.value = twitchSettings.globalMultiplier;
    }
  }
  
  // Speichere Einstellungen
  function saveSettings() {
    console.log('Saving Twitch settings...');
    twitchSettings = {
      channelName: channelNameInput.value.trim(),
      token: twitchTokenInput.value.trim(),
      subMultiplier: subMultiplierCheckbox.checked,
      subPoints: parseInt(subPointsInput.value, 10),
      voteCommand: voteCommandInput.value.trim(),
      viewerMultiplier: parseInt(viewerMultiplierInput.value, 10),
      globalMultiplier: parseInt(globalMultiplierInput.value, 10)
    };
    
    console.log('New settings:', {
      channelName: twitchSettings.channelName,
      subMultiplier: twitchSettings.subMultiplier,
      subPoints: twitchSettings.subPoints,
      voteCommand: twitchSettings.voteCommand,
      viewerMultiplier: twitchSettings.viewerMultiplier,
      globalMultiplier: twitchSettings.globalMultiplier
    });
    
    localStorage.setItem('twitchSettings', JSON.stringify(twitchSettings));
    connectToTwitch();
    settingsModal.classList.add('hidden');
  }
  
  // Verbinde mit Twitch
  async function connectToTwitch() {
    if (twitchClient) {
      console.log('Disconnecting existing Twitch connection...');
      await twitchClient.disconnect();
      twitchClient = null;
    }

    if (!twitchSettings.channelName || !twitchSettings.token) {
      console.log('Twitch settings incomplete:', {
        channelName: !!twitchSettings.channelName,
        token: !!twitchSettings.token
      });
      return;
    }

    try {
      console.log('Attempting to establish Twitch connection...');
      const channelName = twitchSettings.channelName.toLowerCase();
      
      // Nutze die globale tmi.js-Variable
      twitchClient = new tmi.Client({
        options: { debug: true },
        identity: {
          username: channelName,
          password: twitchSettings.token
        },
        channels: [channelName]
      });

      twitchClient.on('connected', (addr, port) => {
        console.log(`Successfully connected to Twitch! (${addr}:${port})`);
      });

      twitchClient.on('message', (channel, tags, message, self) => {
        console.log('Chat message received:', { channel, message, self });
        if (self) return;

        const args = message.toLowerCase().split(' ');
        console.log('Command detected:', {
          input: args[0],
          expected: twitchSettings.voteCommand.toLowerCase()
        });
        
        if (args[0] === twitchSettings.voteCommand.toLowerCase()) {
          console.log('Vote command detected!');
          handleTwitchVote(tags, args);
        }
      });

      await twitchClient.connect();
      console.log('Connection established!');

    } catch (error) {
      console.error('Error connecting to Twitch:', error);
      alert('Error connecting to Twitch. Please check your settings.');
    }
  }
  
  // Verarbeite Twitch-Votes
  async function handleTwitchVote(tags, args) {
    const voteInput = args.slice(1).join(' ');
    console.log('Processing vote:', { username: tags.username, voteInput });
    
    // Hilfsfunktion zum sicheren Senden von Nachrichten
    async function sendMessage(message) {
      try {
        const channel = '#' + twitchSettings.channelName.toLowerCase();
        await twitchClient.say(channel, `/me ${message}`);
      } catch (error) {
        console.error('Error sending message to Twitch:', error);
      }
    }
    
    if (!voteInput) {
      await sendMessage(`@${tags.username}, please specify a game to vote for!`);
      console.log('No game name or ID provided');
      return;
    }
  
    // Prüfe, ob der User heute schon abgestimmt hat
    if (hasVotedToday(tags.username)) {
      await sendMessage(`@${tags.username}, you have already voted today. Please come back tomorrow!`);
      console.log('User has already voted today:', tags.username);
      return;
    }
  
    // Versuche zuerst, das Spiel über die ID zu finden
    let game = games.find(g => g.id === voteInput);
    
    // Wenn keine ID-Übereinstimmung, suche nach dem Namen
    if (!game) {
      game = games.find(g => g.name.toLowerCase() === voteInput.toLowerCase());
    }
  
    if (!game) {
      await sendMessage(`@${tags.username}, the game "${voteInput}" was not found.`);
      console.log('Game not found:', voteInput);
      return;
    }
  
    let points = 1; // Standardwert
    
    if (twitchSettings.subMultiplier && (tags.subscriber || tags.mod)) {
      const subPoints = parseInt(twitchSettings.subPoints) || 2;
      points = subPoints;
      console.log('Subscriber/Mod multiplier applied:', points);
    } else {
      const viewerPoints = parseInt(twitchSettings.viewerMultiplier) || 1;
      points = viewerPoints;
      console.log('Viewer multiplier applied:', points);
    }
    
    const globalMultiplier = parseInt(twitchSettings.globalMultiplier) || 1;
    points *= globalMultiplier;
    console.log('Final points after global multiplier:', points);
  
    try {
      const response = await ipcRenderer.invoke('vote-game', game.id, points, tags.username);
      if (response.success) {
        console.log('Vote processed successfully');
        recordVote(tags.username);
        loadGames();
        
        const pointsText = points === 1 ? 'point' : 'points';
        await sendMessage(
          `@${tags.username}, your vote for "${game.name}" has been counted with ${points} ${pointsText}!`
        );
      } else {
        console.log('Vote not possible:', response.message);
        await sendMessage(
          `@${tags.username}, your vote could not be counted: ${response.message}`
        );
      }
    } catch (error) {
      console.error('Error processing vote:', error);
      await sendMessage(
        `@${tags.username}, there was an error processing your vote. Please try again later.`
      );
    }
  }
  
  // Event Listeners für Settings
  settingsButton.addEventListener('click', () => {
    loadSettings();
    settingsModal.classList.remove('hidden');
  });
  
  saveSettingsBtn.addEventListener('click', saveSettings);
  
  cancelSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });
  
  generateTokenBtn.addEventListener('click', () => {
    // Öffne Twitch OAuth Token Generator in einem neuen Tab
    window.open('https://twitchapps.com/tmi/', '_blank');
  });
  
  // Initialisiere Twitch-Integration beim Start
  loadSettings();
  if (twitchSettings.channelName && twitchSettings.token) {
    connectToTwitch();
  }
  
  // Initialer Ladevorgang
  loadGames();
  
  // Load theme on startup
  loadTheme();

  // Reset Vote Lock Button Event Listener
  document.getElementById('resetVoteLockButton').addEventListener('click', async () => {
    const confirmation = confirm(
      'Are you sure you want to reset the daily vote lock?\n' +
      'This will:\n' +
      '- Allow all users to vote again\n' +
      '- Reset the daily voting restriction\n' +
      '\nThis action cannot be undone!'
    );

    if (confirmation) {
      try {
        const response = await ipcRenderer.invoke('reset-vote-lock');
        if (response.success) {
          alert('Vote lock has been reset. All users can vote again.');
          // Lokalen Vote-Record auch zurücksetzen
          localStorage.setItem('voteRecord', '{}');
        } else {
          alert('Error: ' + response.message);
        }
      } catch (error) {
        console.error('Error resetting vote lock:', error);
        alert('An error occurred while resetting the vote lock.');
      }
    }
  });

  // Event-Listener für den Open Data Folder Button
  document.getElementById('openDataFolderButton').addEventListener('click', async () => {
    try {
      const dataPath = await ipcRenderer.invoke('get-data-path');
      // Öffne den Ordner im Standard-Dateibrowser
      require('electron').shell.openPath(dataPath);
    } catch (error) {
      console.error('Error opening data folder:', error);
      alert('Error opening data folder. Please check the console for details.');
    }
  });
});
