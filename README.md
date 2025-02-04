# GamesBoard - Twitch Extension

A Twitch Extension that allows viewers to vote for games they want to see streamed.

## Features

- Game voting system
- Real-time updates via Socket.io
- Admin panel for game management
- Vote cooldown system
- Backup and restore functionality

## Setup

1. Install dependencies:
```bash
npm install
```

2. For local development, generate SSL certificates:
```bash
npm run generate-cert
```

3. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## Deployment

1. Create a GitHub repository and push the code
2. Sign up at [Railway.app](https://railway.app)
3. Create a new project and connect it to your GitHub repository
4. Railway will automatically deploy your application

## Environment Variables

- `PORT`: Server port (default: 8081)
- `NODE_ENV`: Set to 'production' for production environment

## License

MIT 