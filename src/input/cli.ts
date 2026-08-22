import { getInputs } from "./prompts";
import { env } from "../config/env";

export async function getUserInput() {
  if (env.instagramUsername && env.instagramPassword) {
    console.log(`Using credentials from .env for user: ${env.instagramUsername}`);
    return {
      username: env.instagramUsername,
      password: env.instagramPassword,
    };
  }

  return await getInputs();
}