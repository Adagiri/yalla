# Step 3: Create the load secrets function
echo "📝 Step 3: Creating load-secrets function..."
mkdir -p src/utils

cat > src/utils/load-secrets.ts << 'EOF'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export async function loadSecrets(): Promise<void> {
  if (process.env.APP_NODE_ENV === 'development') {
    console.log('🔧 Development mode - using .env file');
    return;
  }

  const environment = process.env.APP_NODE_ENV || 'staging';
  const secretName = `yalla-api/${environment}`;
  
  console.log(`🔐 Loading secrets for: ${environment}`);
  
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);
    
    if (!response.SecretString) {
      throw new Error(`No secrets found for ${secretName}`);
    }

    const secrets = JSON.parse(response.SecretString);
    
    Object.entries(secrets).forEach(([key, value]) => {
      process.env[key] = value as string;
    });
    
    console.log(`✅ Loaded ${Object.keys(secrets).length} secrets from ${secretName}`);
    
  } catch (error) {
    console.error(`❌ Failed to load secrets:`, error);
    console.log('🔄 Continuing with existing environment variables...');
  }
}
EOF

echo "✅ Created src/utils/load-secrets.ts"
