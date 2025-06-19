# VoxPro Backend API

A Flask-based backend API for the VoxPro Media Management System.

## Features

- File upload and management
- Key assignment system (1-5)
- User management with storage quotas
- Thumbnail generation for images
- CORS support for frontend integration
- SQLite database for metadata storage

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/files/upload` - Upload file
- `GET /api/files/list` - List files
- `GET /api/files/download/<filename>` - Download file
- `POST /api/assign` - Assign file to key
- `GET /api/assignments` - Get assignments

## Deployment

This application is configured for Railway deployment with:
- Python 3.11 runtime
- Flask WSGI server
- SQLite database
- Environment variable configuration

## Environment Variables

- `SECRET_KEY` - Flask secret key
- `PORT` - Server port (auto-configured by Railway)
- `RAILWAY_ENVIRONMENT` - Deployment environment

## Local Development

```bash
cd voxpro-backend
source venv/bin/activate
pip install -r requirements.txt
python src/main.py
```

## Production Deployment

Deploy to Railway by connecting this repository and Railway will automatically:
1. Detect Python application
2. Install dependencies from requirements.txt
3. Run the application using the Procfile
4. Provide HTTPS endpoint and custom domain options

