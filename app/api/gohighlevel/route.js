import { NextResponse } from 'next/server';

// Le chiavi API saranno lette dalle variabili d'ambiente di Vercel
const API_KEY = process.env.GOHIGHLEVEL_API_KEY;
const BASE_API_URL = 'https://rest.gohighlevel.com/v1'; // Reverted to original Base URL
// const BASE_API_URL = 'https://services.leadconnectorhq.com'; // New Base URL from docs

async function handleRequest(request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  
  // Log API Key status
  if (API_KEY) {
    console.log(`[API Route] GOHIGHLEVEL_API_KEY found. Starts with: ${API_KEY.substring(0, 5)}...`);
  } else {
    console.error('[API Route] GOHIGHLEVEL_API_KEY is NOT SET or UNDEFINED. This will cause API errors.');
    // Potentially return an error response early if key is missing
    return NextResponse.json({ error: 'API Key is not configured on the server.' }, { status: 500 }); 
  }

  const params = {};
  searchParams.forEach((value, key) => {
    if (key !== 'endpoint') {
      params[key] = value;
    }
  });

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint parameter is required' }, { status: 400 });
  }

  let apiUrl = `${BASE_API_URL}/${endpoint}`;

  if (request.method === 'GET') {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      queryParams.append(key, value);
    }
    const queryString = queryParams.toString();
    if (queryString) {
      apiUrl += `?${queryString}`;
    }
  }

  console.log(`Proxying ${request.method} request to: ${apiUrl}`);
  console.log(`[API Route] Proxying ${request.method} request to GHL: ${apiUrl}`); // Added detailed GHL URL log

  try {
    const requestOptions = {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
        // 'Version': '2021-04-15' // Removed Version Header, not used with rest.gohighlevel.com/v1
      },
    };

    if (request.method !== 'GET' && request.body) {
      try {
        const body = await request.json();
        requestOptions.body = JSON.stringify(body);
        // Content-Type is already set to application/json above
      } catch (error) {
        console.warn("Could not parse request body as JSON or body is empty:", error.message);
        // If body parsing fails for POST/PUT, we might not want to proceed or 
        // GHL might error. For now, it will proceed with no body if parsing failed.
      }
    } else if (request.method === 'GET') {
        // For GET, GHL might not need a body, so we ensure it's not set.
        // Content-Type: application/json is kept as per script.js observation.
        delete requestOptions.body; 
    }

    const response = await fetch(apiUrl, requestOptions);
    console.log(`[API Route] Response status from GHL: ${response.status}`); // Log GHL response status

    const responseBodyText = await response.text(); // Always get text first
    let data;
    try {
        data = JSON.parse(responseBodyText); // Try to parse as JSON
    } catch (e) {
        data = responseBodyText; // If not JSON, use the raw text
    }

    const responseHeaders = {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': '*', // Or specific origin
      'Access-Control-Allow-Methods': 'GET,OPTIONS,POST,PUT,DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    if (typeof data === 'object') {
        responseHeaders['Content-Type'] = 'application/json';
        return new NextResponse(JSON.stringify(data), {
            status: response.status,
            headers: responseHeaders,
        });
    } else {
        const ghlContentType = response.headers.get('content-type');
        if (ghlContentType) {
            responseHeaders['Content-Type'] = ghlContentType;
        }
        return new NextResponse(data, {
            status: response.status,
            headers: responseHeaders,
        });
    }

  } catch (error) {
    console.error('Error proxying to GoHighLevel:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from GoHighLevel proxy', message: error.message },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET(request) {
  return handleRequest(request);
}

export async function POST(request) {
  return handleRequest(request);
}

export async function PUT(request) {
  return handleRequest(request);
}

export async function DELETE(request) {
  return handleRequest(request);
}

export async function OPTIONS(request) {
  // Handle preflight requests
  return new NextResponse(null, {
    status: 204, // No Content
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': '*', // Or specific origin
      'Access-Control-Allow-Methods': 'GET,OPTIONS,POST,PUT,DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}