"use client";

import Image, { type ImageLoaderProps } from "next/image";

import { AMBIENT_IMAGES, type AmbientImageId } from "./ambient-images";

/** As variantes já estão otimizadas: não há download externo nem uma segunda conversão. */
export function AmbientImage({ image, sizes, className, eager = false, compactSaint = false }: {
  image: AmbientImageId;
  sizes: string;
  className?: string;
  eager?: boolean;
  compactSaint?: boolean;
}) {
  const asset = AMBIENT_IMAGES[image];
  const original = asset.variants.at(-1)!;
  const loader = ({ width }: ImageLoaderProps) => `/images/${(asset.variants.find(variant => variant.width >= width) ?? original).file}`;
  const portrait = AMBIENT_IMAGES["santa-cecilia-lira"];
  return (
    <picture>
      {compactSaint && <source media="(max-width: 767px)" srcSet={portrait.variants.map(variant => `/images/${variant.file} ${variant.width}w`).join(", ")} sizes="100px" />}
      <Image loader={loader} src={`/images/${original.file}`} width={original.width} height={original.height}
        sizes={sizes} alt="" className={className} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} />
    </picture>
  );
}
