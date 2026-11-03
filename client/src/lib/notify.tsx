import toast from "react-hot-toast";
import { Icon } from "@/components/ui/icon";

type Kind = "success" | "error" | "info";
type ToastContent = { title: string; body?: string; onUndo?: () => void };

const GLYPH: Record<Kind, string> = { success: "check", error: "error", info: "info" };
const DURATION: Record<Kind, number> = { success: 6000, error: 8000, info: 6000 };

function show(kind: Kind, { title, body, onUndo }: ToastContent) {
  toast.custom(
    (t) => (
      <div className="app-toast" role={kind === "error" ? "alert" : "status"} aria-live="polite" hidden={!t.visible}>
        <span className={`app-toast-icon app-toast-icon--${kind}`}>
          <Icon name={GLYPH[kind]} size={18} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px] pt-[5px]">
          <strong className="[font:600_15px/20px_var(--font-poppins)]">{title}</strong>
          {body && <span className="[font:400_13px/18px_var(--font-poppins)] text-light-green">{body}</span>}
        </span>
        {onUndo && (
          <button
            type="button"
            className="app-toast-action"
            onClick={() => {
              toast.remove(t.id);
              onUndo();
            }}
          >
            Undo
          </button>
        )}
        <button
          type="button"
          className="app-toast-close"
          aria-label="Dismiss notification"
          onClick={() => toast.remove(t.id)}
        >
          <Icon name="close" size={18} />
        </button>
      </div>
    ),
    { duration: DURATION[kind] }
  );
}

export const notify = {
  success: (content: ToastContent) => show("success", content),
  error: (content: ToastContent) => show("error", content),
  info: (content: ToastContent) => show("info", content),
};
