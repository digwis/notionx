import { getTurnstilePublicConfig } from "@/lib/settings";
import { TurnstileField } from "@/components/TurnstileField";

type Props = {
  action?: string;
};

/** Server wrapper: only renders Turnstile when fully configured. */
export async function AuthTurnstile({ action = "auth" }: Props) {
  const cfg = await getTurnstilePublicConfig();
  if (!cfg.enabled || !cfg.siteKey) return null;
  return <TurnstileField siteKey={cfg.siteKey} action={action} />;
}
