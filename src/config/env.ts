import "dotenv/config";

export const env = {
  instagramUsername: process.env.INSTAGRAM_USERNAME || "",
  instagramPassword: process.env.INSTAGRAM_PASSWORD || "",
  headless: process.env.HEADLESS === "true",
  databaseUrl: process.env.DATABASE_URL || "",
};