import Icon from "../../Icons";
import type { IconName } from "../../Icons";

export default function Stat({
  icon,
  title,
  value,
  color,
  caption,
}: {
  icon: IconName;
  title: string;
  value: string;
  color: "mint" | "blue" | "cream" | "peach";
  caption?: string;
}) {
  return (
    <div className={`stat ${color}`}>
      <Icon name={icon} size={33} />
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        {caption && <small>{caption}</small>}
      </div>
    </div>
  );
}
