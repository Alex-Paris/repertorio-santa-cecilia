import { cn } from "cn";
import { UserRoundX } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/layout/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { lookupSession } from "@/server/auth/session";
import { isSignUpEnabled } from "@/server/auth/sign-up-policy";
import { getFacebookConfig } from "@/server/auth/facebook-config";

import { SignUpForm } from "./sign-up-form";
import { FacebookAuthButton } from "./facebook-auth-button";

export async function SignUpScreen() {
  const lookup = await lookupSession(await headers());

  if (lookup.status === "authenticated") {
    redirect("/conta");
  }

  if (!isSignUpEnabled(process.env)) {
    return (
      <EmptyState
        icon={UserRoundX}
        title="Novos cadastros estão desativados"
        description="A criação de contas está temporariamente indisponível. Tente novamente mais tarde."
        action={
          <Link href="/entrar" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Ir para o login
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {getFacebookConfig(process.env) && <FacebookAuthButton />}
      <SignUpForm />
    </div>
  );
}
