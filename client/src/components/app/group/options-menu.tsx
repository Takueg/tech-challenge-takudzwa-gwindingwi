import { useState, type RefObject } from "react";
import { DropdownMenu } from "radix-ui";
import { Icon } from "@/components/ui/icon";

/**
 * The only place to archive or delete a group. Neither is allowed while anyone owes money, which the server
 * also enforces. The menu lines up under the group name, not the button.
 */
export function GroupOptionsMenu({
  groupName,
  archived,
  hasOpenBalances,
  titleRef,
  triggerRef,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  groupName: string;
  archived: boolean;
  hasOpenBalances: boolean;
  titleRef: RefObject<HTMLHeadingElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  const [alignOffset, setAlignOffset] = useState(0);
  const title = "flex flex-col gap-[3px]";
  const settleFirst = "Everyone needs to settle up first";
  const description = "type-p400-13-18 text-muted-foreground";
  return (
    <DropdownMenu.Root
      modal={false}
      onOpenChange={(open) => {
        const [name, trigger] = [titleRef.current, triggerRef.current];
        if (open && name && trigger) {
          setAlignOffset(name.getBoundingClientRect().left - trigger.getBoundingClientRect().left);
        }
      }}
    >
      <DropdownMenu.Trigger
        ref={triggerRef}
        className="app-iconbtn"
        aria-label={`Group options for ${groupName}`}
        title="Group options"
      >
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-honeydew text-ink">
          <Icon name="more_horiz" size={20} />
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          alignOffset={alignOffset}
          sideOffset={8}
          aria-label="Group options"
          className="z-40 box-border flex w-[320px] flex-col gap-0.5 rounded-[20px] bg-dialog p-2.5 text-foreground"
        >
          <DropdownMenu.Item
            className="app-option"
            disabled={!archived && hasOpenBalances}
            onSelect={archived ? onUnarchive : onArchive}
          >
            <Icon name="archive" size={20} />
            <span className={title}>
              <span className="app-option__title">{archived ? "Unarchive Group" : "Archive Group"}</span>
              <span className={description}>
                {archived
                  ? "Put it back on your dashboard"
                  : hasOpenBalances
                    ? settleFirst
                    : "Hide it from your dashboard and make it read-only"}
              </span>
            </span>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="mx-2.5 my-1.5 h-px bg-[var(--rule)]" />
          <DropdownMenu.Item className="app-option app-option--danger" disabled={hasOpenBalances} onSelect={onDelete}>
            <Icon name="delete" size={20} />
            <span className={title}>
              <span className="app-option__title">Delete Group</span>
              <span className={description}>
                {hasOpenBalances ? settleFirst : "Removes every expense and payment. Can’t be undone."}
              </span>
            </span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
