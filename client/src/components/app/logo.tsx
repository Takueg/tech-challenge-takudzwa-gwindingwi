/** The fence-green tile with the two-half circle. */
export function LogoMark({ size = 44 }: { size?: 44 | 56 }) {
  const large = size === 56;
  const glyph = large ? 34 : 26;
  return (
    <span
      aria-hidden="true"
      className="flex flex-none items-center justify-center bg-fence"
      style={{ width: size, height: size, borderRadius: large ? 19 : 15 }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 26 26" aria-hidden="true">
        <path d="M11.8 3.2a10 10 0 0 0 0 19.6z" fill="#00d09e" />
        <path d="M14.2 3.2a10 10 0 0 1 0 19.6z" fill="#f1fff3" />
      </svg>
    </span>
  );
}
