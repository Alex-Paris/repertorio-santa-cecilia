import { cn } from "cn";
import { UserRoundX } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/layout/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { lookupSession } from "@/server/auth/session";
import { isSignUpEnabled } from "@/server/auth/sign-up-policy";

import { SignUpForm } from "./sign-up-form";

export async function SignUpScreen() {
  const lookup = await lookupSession(await headers());

  if (lookup.status === "authenticated") {
    redirect("/conta");
  }

  if (!isSignUpEnabled(process.env.NODE_ENV, process.env.AUTH_ALLOW_DEV_SIGNUP)) {
    return (
      <EmptyState
        icon={UserRoundX}
        title="Novos cadastros estão desativados"
        description="A criação de contas ficará disponível quando a verificação de e-mail e a recuperação de senha estiverem prontas."
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
      <SignUpForm />
    </div>
  );
}
