import { TERMS_SECTIONS, TERMS_UPDATED } from "@/lib/terms-content";

/** Renders the Terms & Conditions body (used in the popup and the /terms page). */
export function TermsContent() {
  return (
    <div className="space-y-5 text-sm leading-relaxed">
      <p className="text-muted-foreground">Last updated: {TERMS_UPDATED}</p>
      {TERMS_SECTIONS.map((s) => (
        <section key={s.heading}>
          <h3 className="font-semibold text-foreground mb-1.5">{s.heading}</h3>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            {s.points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
