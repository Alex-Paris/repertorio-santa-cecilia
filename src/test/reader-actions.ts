import { fireEvent, screen, within } from "@testing-library/react";

/** Executa o mesmo percurso do usuário: abrir ajuste, alterar e voltar à leitura. */
export function clickReaderControl(name: string): void {
  const font = /fonte|tamanho padrão/.test(name);
  const trigger = screen.queryByRole("button", { name:font ? "Tamanho do texto e ajustes" : /^Alterar tom:/ });
  if (!trigger) {
    fireEvent.click(screen.getByRole("button", {name}));
    return;
  }
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", {name:font ? "Ajustes de leitura" : "Tom da música"});
  fireEvent.click(within(dialog).getByRole("button", {name}));
  fireEvent.click(within(dialog).getByRole("button", {name:"Fechar painel"}));
}
