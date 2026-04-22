import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { AmazonLeadsProMarketing } from "../components/AmazonLeadsProMarketing";

export function AmazonLeadsProPublicPage() {
  return (
    <div className="min-h-screen bg-ds-bg px-4 py-10 text-ds-text">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm font-semibold text-ds-muted transition hover:text-ds-primary"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Início
        </Link>
        <div className="mt-6">
          <AmazonLeadsProMarketing variant="public" />
        </div>
      </div>
    </div>
  );
}
