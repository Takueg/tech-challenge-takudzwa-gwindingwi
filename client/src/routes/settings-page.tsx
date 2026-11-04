import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorBanner, FieldError, TextField } from "@/components/app/form-parts";
import { HeaderActions, PageLayout } from "@/components/app/page-layout";
import { Panel } from "@/components/app/panel";
import { ErrorState } from "@/components/app/states";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedControl, Tabs } from "@/components/ui/tabs";
import { useCurrentUser, useCurrentUserId, useCurrentUserRecord } from "@/context/current-user";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { useMyGroups } from "@/hooks/use-data";
import { errorMessage, httpStatusOf } from "@/lib/error-message";
import { notify } from "@/lib/notify";
import { setTheme, storedTheme, type Theme } from "@/lib/theme";
import { useTRPC, type RouterOutputs } from "@/lib/trpc";
import { useInvalidateExpenseData } from "@/lib/use-invalidate-expense-data";
import { validatePhoto, validateProfile, type ProfileValues } from "@/lib/validation";
import { cn } from "@/lib/utils";

type User = RouterOutputs["users"]["list"][number];
type Form = ProfileValues & { avatar: string };

const toForm = (user: User): Form => ({
  name: user.name,
  email: user.email,
  bio: user.bio ?? "",
  avatar: user.avatarUrl ?? "",
});

function ProfileSkeleton() {
  const tile = "flex flex-col gap-2.5 rounded-[18px] bg-sheet px-[18px] py-4";
  return (
    <section className="swl-panel gap-6" role="status">
      <span className="sr-only">Loading your profile…</span>
      <div className="swl-panel__head" aria-hidden="true">
        <h2 className="swl-panel__title">Profile</h2>
        <Skeleton width={150} height={44} radius={30} />
      </div>
      <div aria-hidden="true" className="flex items-center gap-[22px]">
        <Skeleton round width={96} height={96} />
        <div className="flex flex-col gap-3">
          <Skeleton line width={120} height={20} />
          <Skeleton line width={140} height={12} />
        </div>
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-4">
        <div className={tile}>
          <Skeleton line width={44} height={10} />
          <Skeleton line width="40%" />
        </div>
        <div className={tile}>
          <Skeleton line width={44} height={10} />
          <Skeleton line width="70%" />
        </div>
        <div className={cn(tile, "col-span-2")}>
          <Skeleton line width={44} height={10} />
          <Skeleton line width="55%" />
        </div>
      </div>
    </section>
  );
}

function ProfileView({ user, groupCount, onEdit }: { user: User; groupCount: number; onEdit: () => void }) {
  const tile = "flex flex-col gap-1.5 rounded-[18px] bg-sheet px-[18px] py-4";
  const term = "type-p500-12-1 text-muted-foreground";
  const value = "m-0 type-p500-15-22 text-strong";
  return (
    <Panel
      title="Profile"
      className="gap-6"
      actions={
        <Button variant="outline" onClick={onEdit}>
          <Icon name="edit" size={20} />
          Edit Profile
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-[22px]">
        <Avatar src={user.avatarUrl || undefined} alt="Your profile photo" size={96} />
        <div className="flex flex-col gap-2">
          <span className="type-p600-22-28 text-strong">{user.name}</span>
          <span className="type-s400-14-20 text-muted-foreground">
            Member of {groupCount} {groupCount === 1 ? "group" : "groups"}
          </span>
        </div>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-4">
        <div className={tile}>
          <dt className={term}>Name</dt>
          <dd className={value}>{user.name}</dd>
        </div>
        <div className={tile}>
          <dt className={term}>Email</dt>
          <dd className={cn(value, "[overflow-wrap:anywhere]")}>{user.email}</dd>
        </div>
        <div className={cn(tile, "col-span-2")}>
          <dt className={term}>Bio</dt>
          {user.bio?.trim() ? (
            <dd className="m-0 type-p400-15-22 whitespace-pre-line text-strong">{user.bio}</dd>
          ) : (
            <dd className="m-0 type-s400-15-22 text-muted-foreground">
              No bio yet. Add a line so group members recognise you.
            </dd>
          )}
        </div>
      </dl>
    </Panel>
  );
}

function ProfileForm({ user, onDone }: { user: User; onDone: () => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateExpenseData();
  const saved = toForm(user);
  const {
    values: form,
    setValues: setForm,
    errors,
    setErrors,
    summary,
    setSummary,
    update: patch,
    check,
  } = useValidatedForm<Form, keyof ProfileValues>(saved, validateProfile, "save");
  const [photoError, setPhotoError] = useState("");
  const [bannerError, setBannerError] = useState("");

  const updateUser = useMutation(trpc.users.update.mutationOptions({ meta: { handlesError: true } }));
  const updateAvatar = useMutation(trpc.users.updateAvatar.mutationOptions({ meta: { handlesError: true } }));
  const pending = updateUser.isPending || updateAvatar.isPending;

  const dirty =
    form.name !== saved.name || form.email !== saved.email || form.bio !== saved.bio || form.avatar !== saved.avatar;

  function blur(key: "name" | "email") {
    if (form[key] === saved[key] && !errors[key]) return;
    setErrors({ ...errors, [key]: validateProfile(form)[key] });
  }

  function pickPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = validatePhoto(file);
    if (problem) {
      setPhotoError(problem);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, avatar: String(reader.result) }));
      setPhotoError("");
    };
    reader.onerror = () => setPhotoError("We couldn’t read that file. Try another photo.");
    reader.readAsDataURL(file);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setBannerError("");
    if (!check()) return;
    try {
      await updateUser.mutateAsync({ userId: user.id, name: form.name.trim(), email: form.email.trim(), bio: form.bio });
      if (form.avatar !== saved.avatar) await updateAvatar.mutateAsync({ userId: user.id, avatarUrl: form.avatar });
    } catch (error) {
      if (httpStatusOf(error) === 409) {
        setErrors({ email: errorMessage(error) });
        setSummary("We couldn’t save. Check the highlighted field.");
      } else {
        setBannerError(errorMessage(error));
      }
      return;
    }
    await queryClient.invalidateQueries(trpc.users.pathFilter());
    invalidate();
    onDone();
    notify.success({ title: "Profile Saved", body: "People in your groups will see the update." });
  }

  const bioOver = form.bio.length > 160;
  const photoChanged = form.avatar !== saved.avatar;
  const photoHint = photoChanged
    ? form.avatar
      ? "New photo. Save to keep it."
      : "Photo removed. Save to confirm."
    : "JPG, PNG or WebP, up to 2 MB.";

  return (
    <form noValidate onSubmit={save} aria-labelledby="pf-title" aria-busy={pending} className="swl-panel gap-6">
      <div className="swl-panel__head">
        <h2 id="pf-title" className="swl-panel__title">
          Edit Profile
        </h2>
        {dirty && (
          <span role="status" className="inline-flex items-center gap-2 type-p500-13-1">
            <span aria-hidden="true" className="size-2 rounded-full bg-ocean" />
            Unsaved changes
          </span>
        )}
      </div>

      {bannerError && <ErrorBanner title="We couldn’t save your profile">{bannerError}</ErrorBanner>}

      <div className="flex flex-wrap items-center gap-[22px]">
        <label htmlFor="pf-photo" className="app-avatar-pick" aria-hidden="true">
          <Avatar src={form.avatar || undefined} alt="Your profile photo" size={96} editable />
        </label>
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2 has-[input:focus-visible]:[&_label]:outline-2 has-[input:focus-visible]:[&_label]:outline-offset-2">
            <input
              id="pf-photo"
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-describedby="pf-photo-msg"
              disabled={pending}
              onChange={pickPhoto}
            />
            <label htmlFor="pf-photo" className="swl-btn swl-btn--secondary h-11 min-w-0 text-base">
              {form.avatar ? "Change Photo" : "Upload Photo"}
            </label>
            {form.avatar && (
              <Button
                variant="text"
                disabled={pending}
                onClick={() => {
                  setForm({ ...form, avatar: "" });
                  setPhotoError("");
                }}
              >
                Remove
              </Button>
            )}
          </div>
          <div id="pf-photo-msg">
            {photoError ? (
              <span role="alert" className="app-err pl-0">
                <Icon name="error" size={16} />
                {photoError}
              </span>
            ) : (
              <span className="app-hint pl-0">{photoHint}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-4 gap-y-5">
        <TextField
          id="pf-name"
          label="Name"
          autoFocus
          autoComplete="name"
          aria-required
          disabled={pending}
          value={form.name}
          onChange={(event) => patch({ name: event.target.value })}
          onBlur={() => blur("name")}
          error={errors.name}
        />
        <TextField
          id="pf-email"
          label="Email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="email"
          aria-required
          disabled={pending}
          value={form.email}
          onChange={(event) => patch({ email: event.target.value })}
          onBlur={() => blur("email")}
          error={errors.email}
          hint="People in your groups see this."
        />
      </div>

      <div className="swl-field">
        <Label htmlFor="pf-bio">
          Bio <span className="font-normal text-muted-foreground">(Optional)</span>
        </Label>
        <Textarea
          id="pf-bio"
          rows={4}
          placeholder="A line about you, so group members recognise you"
          aria-describedby="pf-bio-msg"
          disabled={pending}
          invalid={Boolean(errors.bio)}
          value={form.bio}
          onChange={(event) => patch({ bio: event.target.value })}
        />
        <div id="pf-bio-msg" className="flex justify-between gap-3">
          {errors.bio ? <FieldError>{errors.bio}</FieldError> : <span className="app-hint">Shown to people in your groups.</span>}
          <span
            className={cn(
              "flex-none pr-4 type-p400-12-18 text-muted-foreground",
              bioOver && "font-semibold text-danger"
            )}
          >
            {form.bio.length}/160
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save Changes"}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
        {!dirty && !pending && !summary && (
          <span className="type-p400-13-18 text-muted-foreground">No changes to save</span>
        )}
        <span role="status" aria-live="polite" className="type-p500-13-18 text-danger">
          {summary}
        </span>
      </div>
    </form>
  );
}

function AppearancePanel() {
  const [theme, setThemeState] = useState<Theme>(storedTheme);
  useEffect(() => setTheme(theme), [theme]);
  return (
    <Panel title="Appearance">
      <Tabs value={theme === "dark" ? "Dark" : "Light"} onValueChange={(value) => setThemeState(value === "Dark" ? "dark" : "light")}>
        <SegmentedControl options={["Light", "Dark"]} aria-label="Theme" />
      </Tabs>
    </Panel>
  );
}

function DemoToolsPanel({ users }: { users: User[] }) {
  const currentUserId = useCurrentUserId();
  const { setCurrentUserId } = useCurrentUser();
  return (
    <Panel title="Demo Tools">
      <div className="flex flex-col gap-2">
        <Label id="dm-viewing">Viewing As</Label>
        <Select
          inPanel
          aria-labelledby="dm-viewing"
          options={users.map((user) => ({ value: user.id, label: user.name }))}
          value={currentUserId}
          onValueChange={(userId) => {
            setCurrentUserId(userId);
            const name = users.find((user) => user.id === userId)?.name;
            notify.info({ title: `Now Viewing As ${name}`, body: `Balances and “You” now refer to ${name}.` });
          }}
        />
        <span className="app-hint">Switch whose balances you see without logging out. Only for demo data.</span>
      </div>
    </Panel>
  );
}

export function SettingsPage() {
  const { user, users, isLoading, isError, refetch } = useCurrentUserRecord();
  const groups = useMyGroups();
  const [editing, setEditing] = useState(false);
  const groupCount = groups.data?.length ?? 0;

  return (
    <PageLayout
      busy={isLoading}
      header={
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="flex flex-col gap-2.5">
            <h1 className="m-0 type-p600-30-36">Settings</h1>
            <p className="m-0 type-s400-16-1_3">Your profile, how the app looks, and your account.</p>
          </div>
          <HeaderActions className="flex-[0_1_560px]" />
        </div>
      }
    >
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[999_1_560px]">
          {isLoading ? (
            <ProfileSkeleton />
          ) : isError || !user ? (
            <Panel>
              <ErrorState title="We Couldn’t Load Your Profile" onRetry={() => refetch()} />
            </Panel>
          ) : editing ? (
            <ProfileForm key={user.id} user={user} onDone={() => setEditing(false)} />
          ) : (
            <ProfileView user={user} groupCount={groupCount} onEdit={() => setEditing(true)} />
          )}
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
          <AppearancePanel />
          <DemoToolsPanel users={users ?? []} />
        </div>
      </div>
    </PageLayout>
  );
}
