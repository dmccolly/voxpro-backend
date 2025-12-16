// /.netlify/functions/aircheck-tracks.js
// Backend endpoint for storing/retrieving aircheck player track configuration
// This allows tracks to be editable via admin panel while working across all devices

const XANO_API_BASE = process.env.XANO_API_BASE || 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';
const XANO_API_KEY = process.env.XANO_API_KEY;
const ADMIN_PASSWORD = 'HOIBF###';

// Config key used to identify the aircheck tracks config in Xano
const CONFIG_KEY = 'aircheck_player_tracks';

const DEFAULT_TRACKS = [
  { label: 'Track 1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { label: 'Track 2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { label: 'Track 3', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { label: 'Track 4', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { label: 'Track 5', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { label: 'Track 6', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' }
];

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Password',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // GET - Retrieve current track configuration (public)
    if (event.httpMethod === 'GET') {
      return await getTracks(headers);
    }

    // POST/PUT - Update track configuration (requires admin password)
    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      const adminPassword = event.headers['x-admin-password'] || event.headers['X-Admin-Password'];
      
      if (adminPassword !== ADMIN_PASSWORD) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Unauthorized - Invalid admin password' })
        };
      }

      const body = JSON.parse(event.body);
      return await saveTracks(body.tracks, headers);
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Aircheck tracks error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Server error',
        message: error.message
      })
    };
  }
};

async function getTracks(headers) {
  try {
    // Try to fetch from Xano app_config table
    const fetchOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (XANO_API_KEY) {
      fetchOptions.headers['Authorization'] = `Bearer ${XANO_API_KEY}`;
    }

    const response = await fetch(
      `${XANO_API_BASE}/app_config?key=${CONFIG_KEY}`,
      fetchOptions
    );

    if (response.ok) {
      const data = await response.json();
      // Xano might return an array or single object
      const config = Array.isArray(data) ? data[0] : data;
      
      if (config && config.value) {
        const tracks = typeof config.value === 'string' 
          ? JSON.parse(config.value) 
          : config.value;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ tracks, source: 'database' })
        };
      }
    }

    // If no config found in database, return defaults
    console.log('No config found in Xano, returning defaults');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ tracks: DEFAULT_TRACKS, source: 'defaults' })
    };

  } catch (error) {
    console.error('Error fetching tracks from Xano:', error);
    // Return defaults on error
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ tracks: DEFAULT_TRACKS, source: 'defaults', error: error.message })
    };
  }
}

async function saveTracks(tracks, headers) {
  try {
    if (!tracks || !Array.isArray(tracks)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid tracks data - must be an array' })
      };
    }

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: CONFIG_KEY,
        value: JSON.stringify(tracks)
      })
    };

    if (XANO_API_KEY) {
      fetchOptions.headers['Authorization'] = `Bearer ${XANO_API_KEY}`;
    }

    // First, try to check if config exists
    const checkResponse = await fetch(
      `${XANO_API_BASE}/app_config?key=${CONFIG_KEY}`,
      {
        method: 'GET',
        headers: fetchOptions.headers
      }
    );

    let response;
    const checkData = await checkResponse.json();
    const existingConfig = Array.isArray(checkData) ? checkData[0] : checkData;

    if (existingConfig && existingConfig.id) {
      // Update existing config
      response = await fetch(
        `${XANO_API_BASE}/app_config/${existingConfig.id}`,
        {
          method: 'PATCH',
          headers: fetchOptions.headers,
          body: JSON.stringify({
            value: JSON.stringify(tracks)
          })
        }
      );
    } else {
      // Create new config
      response = await fetch(
        `${XANO_API_BASE}/app_config`,
        fetchOptions
      );
    }

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Xano save error:', errorData);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to save tracks to database',
          details: errorData
        })
      };
    }

    const savedData = await response.json();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Tracks saved successfully',
        tracks: tracks
      })
    };

  } catch (error) {
    console.error('Error saving tracks to Xano:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to save tracks',
        message: error.message
      })
    };
  }
}
