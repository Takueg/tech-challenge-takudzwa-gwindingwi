import { Icon } from "@/components/ui/icon";

const STYLE: Record<string, { icon: string; tile: string }> = {
  Food: { icon: "restaurant", tile: "var(--light-blue)" },
  Fun: { icon: "confirmation_number", tile: "var(--vivid-blue)" },
  Rent: { icon: "key", tile: "var(--ocean-blue)" },
  Lodging: { icon: "bed", tile: "var(--ocean-blue)" },
  Travel: { icon: "flight", tile: "var(--vivid-blue)" },
  Other: { icon: "receipt_long", tile: "var(--light-blue)" },
};

export function CategoryTile({ category }: { category: string }) {
  const { icon, tile } = STYLE[category] ?? STYLE.Other;
  return <IconTile icon={icon} background={tile} />;
}

/** 57×53 tile with a honeydew icon on blue. */
export function IconTile({ icon, background }: { icon: string; background: string }) {
  return (
    <span className="swl-itile" style={{ background }}>
      <Icon name={icon} size={24} />
    </span>
  );
}
