# VoxPro Manager

A web-based application for managing media assets and assigning them to function keys for quick access during broadcasts.

## Features

- Search and browse media assets
- Assign media to function keys (F1-F12)
- Play audio and video with a single keystroke
- Manage media assignments

## Installation

1. Clone this repository
2. Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize Netlify site
netlify init

# Deploy
netlify deploy --prod
```

## Environment Variables

The application requires the following environment variables:

- `XANO_API_BASE`: The base URL for your Xano API (default: `https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX`)

## Project Structure

```
voxpro-manager/
├── index.html                # Landing page
├── assets/
│   └── voxpro-manager.js     # Main application logic
├── templates/
│   └── voxpro-manager.html   # Main application HTML
├── _redirects                # Netlify redirects
├── _headers                  # Netlify headers
├── netlify.toml              # Netlify configuration
└── netlify/
    └── functions/
        ├── fetch-media.js    # Media proxy function
        └── xano-proxy.js     # Xano API proxy function
```

## Usage

1. Navigate to `/voxpro-manager` to access the application
2. Search for media assets
3. Select a media asset and assign it to a function key
4. Press the function key to play the assigned media

## API Integration

The application integrates with the Xano API to fetch and manage media assets. The following endpoints are used:

- `/auth/ping`: Check if the API is available
- `/assignments/get`: Get all assignments
- `/assignments/create`: Create a new assignment
- `/assignments/delete`: Delete an assignment
- `/media/search`: Search for media assets

## License

This project is licensed under the MIT License.
