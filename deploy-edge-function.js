const fs = require('fs');
const path = require('path');

// Manually read .env.local file
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

const SUPABASE_PROJECT_REF = 'vrbzjgvdlnkffwjhbvkh';
const SUPABASE_ACCESS_TOKEN = envVars.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_ACCESS_TOKEN || SUPABASE_ACCESS_TOKEN === 'your_supabase_access_token_here') {
  console.error('❌ Error: SUPABASE_ACCESS_TOKEN not found or is placeholder');
  console.log('\n📋 To get your access token:');
  console.log('1. Go to: https://supabase.com/dashboard/account/tokens');
  console.log('2. Click "Generate new token"');
  console.log('3. Copy the token');
  console.log('4. Update .env.local: SUPABASE_ACCESS_TOKEN=your_token_here');
  process.exit(1);
}

// Read the Edge Function code
const functionPath = path.join(__dirname, 'supabase', 'functions', 'inbound-message', 'index.ts');
const functionCode = fs.readFileSync(functionPath, 'utf8');

console.log('🚀 Deploying inbound-message Edge Function...');
console.log(`📂 Reading from: ${functionPath}`);
console.log(`📊 Code size: ${functionCode.length} bytes`);

// Use fetch API (Node 18+)
const deployFunction = async () => {
  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/functions/inbound-message`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug: 'inbound-message',
          name: 'inbound-message',
          verify_jwt: false,
          import_map: false,
          entrypoint_path: 'index.ts',
          body: functionCode,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Deployment failed:');
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    console.log('✅ Edge Function deployed successfully!');
    console.log(`📦 Version: ${result.version || 'latest'}`);
    console.log(`🔗 URL: https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/inbound-message`);
  } catch (error) {
    console.error('❌ Deployment error:', error.message);
    process.exit(1);
  }
};

deployFunction();