import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { AmazonLeadsProMarketing } from "../../components/AmazonLeadsProMarketing";

export function ClientAmazonLeadsProLandingPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <Link
        to="/app/dashboard"
        className="inline-flex items-center gap-1 text-sm font-semibold text-ds-muted transition hover:text-ds-primary"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Painel
      </Link>
      <AmazonLeadsProMarketing variant="portal" />
    </div>
  );
}
