import { useState, type KeyboardEvent } from "react";
import { FieldError } from "@/components/app/form-parts";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string };

/** Searchable multi-select. Its parent owns `open`, so Esc can close the list without closing the dialog. */
export function MemberPicker({
  label,
  people,
  selected,
  onChange,
  open,
  onOpenChange,
  error,
  noPeopleMessage = "There’s no one else to add yet",
}: {
  label: string;
  people: Person[];
  selected: string[];
  onChange: (ids: string[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error?: string;
  noPeopleMessage?: string;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = people.filter((person) => !needle || person.name.toLowerCase().includes(needle));
  const allShownOn = shown.length > 0 && shown.every((person) => selected.includes(person.id));
  const chosen = people.filter((person) => selected.includes(person.id));
  const summary =
    chosen.length === 0
      ? "Choose people"
      : chosen.length === people.length
        ? "Everyone"
        : chosen.map((person) => person.name).join(", ");

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id]);

  function toggleAll() {
    const shownIds = shown.map((person) => person.id);
    onChange(
      allShownOn
        ? selected.filter((id) => !shownIds.includes(id))
        : [...new Set([...selected, ...shownIds])]
    );
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (shown.length === 1) toggle(shown[0].id);
  }

  return (
    <div className={cn("app-ms", open && "is-open", error && "app-invalid-ms")}>
      <Label id="ms-label">{label}</Label>
      <button
        type="button"
        className="app-ms__trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="ms-panel"
        aria-labelledby="ms-label ms-val"
        aria-describedby={error ? "ms-err" : undefined}
        aria-invalid={error ? true : undefined}
        onClick={() => {
          setQuery("");
          onOpenChange(!open);
        }}
      >
        <span id="ms-val" className={cn("app-ms__value", chosen.length === 0 && "app-ms__value--empty")}>
          {summary}
        </span>
        {chosen.length > 0 && (
          <span className="app-ms__count" aria-hidden="true">
            {chosen.length}
          </span>
        )}
        <span className="app-ms__chev" aria-hidden="true">
          <Icon name="expand_more" size={18} />
        </span>
      </button>
      {open && (
        <div id="ms-panel" className="app-ms__panel" role="group" aria-label="Choose members">
          <div className="app-ms__search">
            <Icon name="search" size={18} />
            <input
              type="search"
              className="app-ms__input"
              placeholder="Search people"
              aria-label="Search people"
              autoFocus
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKey}
            />
          </div>
          {shown.length === 0 ? (
            <p className="app-ms__empty">{needle ? `No one matches “${query.trim()}”` : noPeopleMessage}</p>
          ) : (
            <>
              <div className="app-ms__opt app-ms__opt--all">
                <Checkbox
                  label={`${needle ? "Select All Matches" : "Select All"} (${shown.length})`}
                  checked={allShownOn}
                  onCheckedChange={toggleAll}
                />
              </div>
              <div className="app-ms__list">
                {shown.map((person) => (
                  <div key={person.id} className="app-ms__opt">
                    <Checkbox
                      label={person.name}
                      checked={selected.includes(person.id)}
                      onCheckedChange={() => toggle(person.id)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="app-ms__foot">
            <span aria-live="polite">
              {chosen.length} of {people.length} selected
            </span>
            {chosen.length > 0 && (
              <button type="button" className="app-ms__clear" onClick={() => onChange([])}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
      {error && <FieldError id="ms-err">{error}</FieldError>}
    </div>
  );
}
