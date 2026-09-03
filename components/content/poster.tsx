import Image from "next/image";
import { cn } from "@/lib/utils";

const SIZES = { xs: "h-12 w-9", sm: "h-16 w-12", md: "h-[120px] w-[80px]", lg: "h-[240px] w-[160px]", card: "aspect-[3/4] w-full" };

export function Poster({ src, alt, size = "sm", className, priority, sizes }: { src: string | null | undefined; alt: string; size?: keyof typeof SIZES; className?: string; priority?: boolean; sizes?: string }) {
  const isProxy = src?.startsWith("/api/img");
  const isSvg = src?.endsWith(".svg");
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-md bg-muted", SIZES[size], className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized={isProxy || isSvg}
          sizes={sizes ?? (size === "card" ? "(max-width: 640px) 40vw, 200px" : "160px")}
          className={cn("object-cover", isSvg && "p-2 object-contain")}
          priority={priority}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground/60">
          <span className="text-xl">🎞</span>
        </div>
      )}
    </div>
  );
}
