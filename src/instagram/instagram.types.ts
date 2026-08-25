export interface InstagramProfile {
  username: string;
  url: string;
}

export interface MessageResult {
  success: boolean;
  username?: string;
  error?: string;
}