import Image from "next/image";

export function WorkspaceIllustration({
  className,
  caption,
  sizes = "(min-width: 1280px) 32vw, 38vw",
  priority = false,
  src = "/projectpilot-workspace.png",
}: {
  className: string;
  caption?: string;
  sizes?: string;
  priority?: boolean;
  src?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`} aria-hidden="true">
      <Image src={src} alt="" fill priority={priority} sizes={sizes} className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-violet-950/25 via-transparent to-white/10" />
      <div className="absolute left-5 top-5 flex size-12 items-center justify-center rounded-2xl border border-white/40 bg-white/20 text-white shadow-lg backdrop-blur-md">
        <svg viewBox="0 0 24 24" className="size-7 drop-shadow" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3 9.8 14.2M21 3l-7.1 18-4.1-6.8L3 10.1 21 3Z" /></svg>
      </div>
      {caption && <p className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/30 bg-violet-950/35 px-4 py-3 text-sm font-medium leading-relaxed text-white shadow-lg backdrop-blur-md">{caption}</p>}
    </div>
  );
}
