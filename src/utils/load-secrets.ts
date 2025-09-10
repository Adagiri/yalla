import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

export async function loadSecrets(): Promise<void> {
  const environment = process.env.APP_NODE_ENV || 'staging';
  const secretName = `yalla-api/${environment}`;
  console.log(process.env.APP_AWS_ACCESS_KEY_ID);
  console.log(secretName);
  console.log(`🔐 Loading secrets for: ${environment}`);

  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY || '',
    },
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
      console.log(key, value)
      console.log(11111111111111111111, process.env.MONGO_URI);
    });

    console.log(
      `✅ Loaded ${Object.keys(secrets).length} secrets from ${secretName}`
    );
  } catch (error) {
    console.error(`❌ Failed to load secrets:`, error);
    console.log('🔄 Continuing with existing environment variables...');
  }
}
