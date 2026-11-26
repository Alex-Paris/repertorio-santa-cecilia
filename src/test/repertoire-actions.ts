import { fireEvent, screen, within } from "@testing-library/react";

/** Localiza a linha e abre suas ações antes de consultar o controle acessível. */
export function getRepertoireAction(name: string | RegExp, index = 0): HTMLElement {
  const matches = (label:string) => typeof name === "string" ? label === name : name.test(label);
  const row = [...document.querySelectorAll<HTMLElement>("[data-item-id]")].filter(candidate =>
    [...candidate.querySelectorAll("button[aria-label]")].some(button => matches(button.getAttribute("aria-label") ?? "")))[index];
  if (!row) return screen.getByRole("button", {name});
  const trigger = within(row).getByRole("button", {name:/^Mais ações de /});
  if (trigger.getAttribute("aria-expanded") !== "true") fireEvent.click(trigger);
  return within(row).getByRole("button", {name});
}
