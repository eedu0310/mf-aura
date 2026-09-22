import { Star } from "lucide-react";

export function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          className={i <= value ? "fill-aura-gold text-aura-gold" : "text-aura-mist"}
        />
      ))}
    </div>
  );
}
