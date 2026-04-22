import Link from "next/link";

type Props = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
};

export function CtaButton({ href, children, variant = "primary", className = "" }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-6 py-3.5 text-sm font-bold tracking-tight transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 sm:text-base";

  const styles = {
    primary:
      "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-950/50 hover:brightness-110 active:scale-[0.98]",
    secondary:
      "border border-zinc-600 bg-zinc-900/80 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800",
    ghost: "text-violet-300 hover:text-white underline-offset-4 hover:underline",
  };

  if (variant === "ghost") {
    return (
      <Link href={href} className={`${base} ${styles.ghost} ${className}`}>
        {children}
      </Link>
    );
  }

  return (
    <Link href={href} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </Link>
  );
}
