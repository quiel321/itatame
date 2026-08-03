type PreviewProtectionOverlayProps = {
  compact?: boolean;
  className?: string;
};

export default function PreviewProtectionOverlay({ compact = false, className = "" }: PreviewProtectionOverlayProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-10 select-none overflow-hidden ${className}`}
    >
      <div
        className="absolute inset-0 opacity-55"
        style={{
          backgroundImage: [
            "repeating-linear-gradient(45deg, transparent 0 31px, rgba(255,255,255,.72) 32px 33px, transparent 34px 64px)",
            "repeating-linear-gradient(-45deg, transparent 0 31px, rgba(255,90,31,.52) 32px 33px, transparent 34px 64px)",
          ].join(","),
          maskImage: "linear-gradient(to bottom, transparent 1%, black 8%, black 92%, transparent 99%)",
        }}
      />

      <div className={`absolute inset-0 grid rotate-[-22deg] content-around justify-items-center opacity-70 ${compact ? "gap-8" : "gap-14"}`}>
        {Array.from({ length: compact ? 4 : 6 }).map((_, index) => (
          <span
            key={index}
            className={`rounded-full border border-white/20 bg-black/35 px-3 py-1 font-black uppercase tracking-[0.16em] text-white shadow-lg backdrop-blur-[1px] ${compact ? "text-[6px]" : "text-[9px] md:text-[11px]"}`}
          >
            Retratt • reprodução não autorizada
          </span>
        ))}
      </div>

      <div className={`absolute inset-x-0 bottom-0 border-t border-white/15 bg-black/80 text-center backdrop-blur-sm ${compact ? "px-2 py-1.5" : "px-4 py-3"}`}>
        <p className={`font-black uppercase text-white ${compact ? "text-[6px] tracking-[0.1em]" : "text-[9px] tracking-[0.18em] md:text-[10px]"}`}>
          Compartilhar sem autorização é ilegal
        </p>
        {!compact && <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.16em] text-retratt">Compre o arquivo original • valorize o fotógrafo</p>}
      </div>
    </div>
  );
}
