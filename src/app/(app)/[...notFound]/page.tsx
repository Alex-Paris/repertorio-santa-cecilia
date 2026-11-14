import { notFound } from "next/navigation";

/** Faz endereços desconhecidos usarem o `not-found` deste grupo, com a navegação da aplicação. */
export default function CatchAllPage() {
  notFound();
}
