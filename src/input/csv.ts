import fs from "fs";

export interface ProfileRecord {
  username: string;
  url: string;
  message: string;
}

export function readProfiles(
  filePath: string
): ProfileRecord[] {
  const content = fs.readFileSync(
    filePath,
    "utf-8"
  );

  const lines = content
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const [, ...rows] = lines;

  return rows.map(row => {
    const [username, url, message] =
      row.split(",");

    return {
      username,
      url,
      message,
    };
  });
}