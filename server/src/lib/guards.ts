import { db, type Group, type User } from "./db.js";
import { conflict, notFound } from "./errors.js";

export function requireGroup(groupId: string): Group {
  const group = db.groups.get(groupId);
  if (!group) throw notFound(`Group ${groupId} not found`);
  return group;
}

/** Same error for a stranger as for a missing group, so ids can't be probed. */
export function requireGroupForMember(groupId: string, userId: string): Group {
  const group = db.groups.get(groupId);
  if (!group?.memberIds.includes(userId)) throw notFound(`Group ${groupId} not found`);
  return group;
}

export function requireNotArchived(group: Group, message: string): void {
  if (group.archivedAt) throw conflict(message);
}

export function requireUser(userId: string): User {
  const user = db.users.get(userId);
  if (!user) throw notFound(`User ${userId} not found`);
  return user;
}

export function userName(userId: string): string {
  return db.users.get(userId)?.name ?? "Unknown";
}
