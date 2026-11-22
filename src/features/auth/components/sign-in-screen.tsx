import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { FormError } from "@/components/layout/form-error";
import { lookupSession } from "@/server/auth/session";

import { SignInForm } from "./sign-in-form";

export async function SignInScreen() {
  const lookup = await lookupSession(await headers());

  if (lookup.status === "authenticated") {
    redirect("/conta");
  }

  return (
    <div className="space-y-5">
      {lookup.status === "unavailable" && (
        <FormError message="O serviço de contas está indisponível no momento." />
      )}
      <SignInForm />
    </div>
  );
}
