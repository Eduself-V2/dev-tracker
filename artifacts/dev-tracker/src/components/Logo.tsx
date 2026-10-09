import { cn } from "@/lib/utils";

const base = import.meta.env.BASE_URL;

/** Dev Tracker app-icon mark; swaps to the dark variant under the `.dark` theme. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <>
      <img src={`${base}logo-icon.png`} alt="Dev Tracker" className={cn("shrink-0 dark:hidden", className)} />
      <img src={`${base}logo-icon-dark.png`} alt="Dev Tracker" className={cn("shrink-0 hidden dark:block", className)} />
    </>
  );
}
