import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { FormError } from "@/components/layout/form-error";
import { lookupSession } from "@/server/auth/session";
import { getFacebookConfig } from "@/server/auth/facebook-config";
import { parseAuthReturn } from "../services/auth-return";

import { SignInForm } from "./sign-in-form";
import { FacebookAuthButton } from "./facebook-auth-button";

export async function SignInScreen({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const returnTo = parseAuthReturn((await searchParams)?.retorno);
  const lookup = await lookupSession(await headers());

  if (lookup.status === "authenticated") {
    redirect(returnTo ?? "/conta");
  }

  return (
    <div className="space-y-5">
      {lookup.status === "unavailable" && (
        <FormError message="O serviço de contas está indisponível no momento." />
      )}
      {getFacebookConfig(process.env) && <FacebookAuthButton />}
      <SignInForm />
    </div>
  );
}
