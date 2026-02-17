const fs = require('fs');
const https = require('https');

// Read the Edge Function code
const functionCode = fs.readFileSync('supabase/functions/inbound-message/index.ts', 'utf8');

// Supabase Management API configuration
const projectRef = 'vrbzjgvdlnkffwjhbvkh';
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_b0f3c5e3f8e44f3d0c1bde0a8f5e3c2d1a4b6c7d8e9f0a1b2c3d4e5f6a7b8c9d';

// Prepare the request payload
const payload = JSON.stringify({
  slug: 'inbound-message',
  name: 'inbound-message',
  verify_jwt: false,
  import_map: false,
  entrypoint_path: 'index.ts'
});

// API endpoint
const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: `/v1/projects/${projectRef}/functions/inbound-message`,
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log('Deploying inbound-message Edge Function...');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', data);
    
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Edge Function deployed successfully!');
    } else {
      console.error('❌ Failed to deploy Edge Function');
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(payload);
req.end();