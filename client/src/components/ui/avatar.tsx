import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** Round photo, falling back to the initial or a person glyph. */
function Avatar({
  src,
  alt = "",
  name,
  size = 36,
  editable,
  className,
  fallbackClassName,
}: {
  src?: string;
  alt?: string;
  name?: string;
  size?: number;
  editable?: boolean;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <span className={cn("swl-avatar", className)} style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={alt} />
      ) : (
        <span
          className={cn("swl-avatar__ph font-semibold", fallbackClassName)}
          style={{ fontSize: Math.round(size * 0.42) }}
        >
          {name ? name.charAt(0).toUpperCase() : <Icon name="person" size={Math.round(size * 0.42)} />}
        </span>
      )}
      {editable && (
        <span className="swl-avatar__badge">
          <Icon name="photo_camera" size={13} />
        </span>
      )}
    </span>
  );
}

export { Avatar };
