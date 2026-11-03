export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/** Keeps only the errors already showing that still apply, so typing clears a fixed field without flagging new ones. */
export function revalidate<K extends string>(shown: FieldErrors<K>, all: FieldErrors<K>): FieldErrors<K> {
  const kept: FieldErrors<K> = {};
  for (const key of Object.keys(shown) as K[]) {
    if (all[key]) kept[key] = all[key];
  }
  return kept;
}

export function hasErrors(errors: FieldErrors<string>): boolean {
  return Object.values(errors).some(Boolean);
}

/** "Fix the 2 highlighted fields to add this expense." Empty when there's nothing to fix. */
export function errorSummary(errors: FieldErrors<string>, goal: string): string {
  const count = Object.values(errors).filter(Boolean).length;
  if (count === 0) return "";
  return count === 1 ? `Fix the highlighted field to ${goal}.` : `Fix the ${count} highlighted fields to ${goal}.`;
}

export function validateDescription(description: string): string | undefined {
  const trimmed = description.trim();
  if (!trimmed) return "Add a short description";
  if (trimmed.length > 60) return "Keep it under 60 characters";
  return undefined;
}

export function validateGroupName(name: string, existingNames: string[]): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return "Give your group a name";
  if (trimmed.length > 40) return "Keep the name under 40 characters";
  if (existingNames.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
    return `You already have a group called “${trimmed}”`;
  }
  return undefined;
}

export type ProfileValues = { name: string; email: string; bio: string };

export function validateProfile(values: ProfileValues): FieldErrors<keyof ProfileValues> {
  const errors: FieldErrors<keyof ProfileValues> = {};
  const name = values.name.trim();
  const email = values.email.trim();
  if (!name) errors.name = "Enter your name";
  else if (name.length > 40) errors.name = "Keep your name under 40 characters";
  if (!email) errors.email = "Enter your email";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Enter an email like name@example.com";
  if (values.bio.length > 160) errors.bio = "Keep your bio under 160 characters";
  return errors;
}

const PHOTO_TYPES = /^image\/(png|jpe?g|webp)$/;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** Why this file can't be a profile photo, if it can't. */
export function validatePhoto(file: { type: string; size: number }): string | undefined {
  if (!PHOTO_TYPES.test(file.type)) return "That file isn’t a photo. Choose a JPG, PNG or WebP.";
  if (file.size > MAX_PHOTO_BYTES) {
    const megabytes = (file.size / 1048576).toFixed(1).replace(".", ",");
    return `That photo is ${megabytes} MB. Choose one under 2 MB.`;
  }
  return undefined;
}
