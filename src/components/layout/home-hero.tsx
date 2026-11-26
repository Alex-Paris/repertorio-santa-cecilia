import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { AmbientImage } from "@/components/brand/ambient-image";
import { buttonVariants } from "@/components/ui/button";

export function HomeHero() {
  return <section data-hero data-bleed className="home-hero" aria-labelledby="inicio-titulo">
    <div className="home-hero-art" aria-hidden="true"><AmbientImage image="santa-cecilia-igreja" sizes="(max-width: 767px) 100vw, 70vw" eager /></div>
    <div className="home-hero-inner"><div className="home-hero-copy">
      <span className="mb-3 block text-xs font-semibold tracking-wider text-gold-strong uppercase">Repertório Santa Cecília</span>
      <h1 id="inicio-titulo">Música que reúne.</h1>
      <p>Prepare os cantos da celebração e tenha seu repertório sempre à mão.</p>
      <Link href="/preparar-missa" className={`${buttonVariants({size:"lg"})} button-primary`}><CalendarDays aria-hidden />Preparar próxima missa</Link>
    </div></div>
  </section>;
}
