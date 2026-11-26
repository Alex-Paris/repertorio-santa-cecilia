import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";

import { OverlayPanel } from "./overlay-panel";

afterEach(cleanup);

function Example() {
  const [open,setOpen]=useState(false);
  return <OverlayPanel keepMounted open={open} onOpenChange={setOpen} title="Escolher repertório" trigger={<button>Meu repertório</button>}>
    <label>Nome do repertório<input defaultValue="Ensaio" /></label>
  </OverlayPanel>;
}

describe("painel sobreposto", () => {
  it("fica fechado até a ação explícita e preserva o rascunho ao reabrir", () => {
    render(<Example />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Meu repertório"}));
    const panel=screen.getByRole("dialog",{name:"Escolher repertório"});
    fireEvent.change(within(panel).getByLabelText("Nome do repertório"),{target:{value:"Ensaio de sábado"}});
    fireEvent.click(within(panel).getByRole("button",{name:"Fechar painel"}));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Meu repertório"}));
    expect((screen.getByLabelText("Nome do repertório") as HTMLInputElement).value).toBe("Ensaio de sábado");
  });

  it("fecha com Escape e devolve o foco ao acionador", async () => {
    render(<Example />);
    const trigger=screen.getByRole("button",{name:"Meu repertório"});
    trigger.focus();fireEvent.click(trigger);
    const close=screen.getByRole("button",{name:"Fechar painel"});
    close.focus();fireEvent.keyDown(close,{key:"Escape"});
    await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(()=>expect(document.activeElement).toBe(trigger));
  });
});
