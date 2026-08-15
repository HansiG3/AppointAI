import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  llm: {
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL || 'claude-3-5-sonnet-20241022',
  },
  app: {
    timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
    clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  },
};

// Validate required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

export default config;
