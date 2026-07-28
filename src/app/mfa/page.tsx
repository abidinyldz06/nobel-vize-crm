import { redirect } from "next/navigation";
import MfaChallenge from "@/components/MfaChallenge";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function MfaPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [{ data: assurance }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (assurance?.currentLevel === "aal2") redirect("/dashboard");
  const factor = factors?.totp.find(item => item.status === "verified");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#060c18] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#1e2d45] bg-[#0d1420] p-7 shadow-2xl">
        <MfaChallenge factorId={factor?.id ?? null} enrollmentRequired={!factor} />
      </div>
    </main>
  );
}
