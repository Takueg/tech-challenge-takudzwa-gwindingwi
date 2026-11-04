import { db, toPublicUser, type PublicUser } from "./db.js";
import { conflict } from "./errors.js";
import { requireUser } from "./guards.js";

export function listUsers(): PublicUser[] {
  return Array.from(db.users.values()).map(toPublicUser);
}

export function updateUser(input: { userId: string; name: string; email: string; bio?: string }): PublicUser {
  const user = requireUser(input.userId);
  const email = input.email.toLowerCase();
  if (Array.from(db.users.values()).some((u) => u.id !== user.id && u.email.toLowerCase() === email)) {
    throw conflict("That email is already used by another account");
  }
  user.name = input.name;
  user.email = input.email;
  user.bio = input.bio;
  for (const expense of db.expenses.values()) {
    if (expense.paidByUserId === user.id) expense.paidByUserName = user.name;
  }
  return toPublicUser(user);
}

export function updateAvatar(userId: string, avatarUrl: string): PublicUser {
  const user = requireUser(userId);
  user.avatarUrl = avatarUrl;
  return toPublicUser(user);
}
