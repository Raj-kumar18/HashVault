import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend/.env and root .env reliably across any working directory
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const NODE_ENV = process.env.NODE_ENV || "development";

export const env = {
  NODE_ENV,
  PORT: Number(process.env.PORT) || 5001,
  MONGODB_URI: process.env.MONGODB_URI || "",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  SESSION_SECRET:
    process.env.SESSION_SECRET ||
    (NODE_ENV === "development"
      ? "logsentinel_development_session_secret_key_at_least_32_characters_long"
      : null),
};

if (NODE_ENV === "production") {
  const { MONGODB_URI, CORS_ORIGIN, SESSION_SECRET } = env;

  if (!MONGODB_URI || !CORS_ORIGIN || !SESSION_SECRET) {
    throw new Error("Missing required production environment variables.");
  }

  if (SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
}
