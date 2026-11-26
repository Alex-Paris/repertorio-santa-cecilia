
import { AmbientImage } from "@/components/brand/ambient-image";
import type { AmbientImageId } from "@/components/brand/ambient-images";
import { celebrationDisplayTitle, formatLongDate, type LiturgicalCelebrationContext } from "../domain/calendar";
import { SeasonTag } from "./liturgy-tags";

/** A ambientação segue os metadados já carregados, sem inferir datas ou leituras. */
export function celebrationImage(context: Pick<LiturgicalCelebrationContext, "season" | "celebrations">): AmbientImageId {
  return context.celebrations.includes("pentecostes") ? "pentecostes" : context.season;
}

export function CelebrationAmbience({ context }: { context:LiturgicalCelebrationContext }) {
  const image = celebrationImage(context);
  return <>
    <section className="celebration-ambience" data-season={image} aria-label="Celebração escolhida">
      <div className="celebration-art" aria-hidden="true"><AmbientImage image={image} sizes={image === "pentecostes" ? "100px" : "(max-width: 767px) 100vw, 360px"} eager /></div>
      <div className="celebration-content">
        <SeasonTag season={context.season} />
        <h2 className="mt-2 text-xl leading-snug font-semibold">{celebrationDisplayTitle(context)}</h2>
        <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">{formatLongDate(context.date)}</p>
      </div>
    </section>

  </>;
}
