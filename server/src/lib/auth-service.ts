import { db, toPublicUser, type PublicUser } from "./db.js";
import { unauthorized } from "./errors.js";

export function logIn(username: string, password: string): PublicUser {
  const user = Array.from(db.users.values()).find((u) => u.username === username);
  // One message for both cases, so login can't be used to discover usernames.
  if (!user || user.password !== password) throw unauthorized("Unknown username or password");
  return toPublicUser(user);
}
