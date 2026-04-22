import type { AnchorHTMLAttributes, ComponentProps } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { postGrowthLandingConversionEvent } from "../../lib/growthProgramApi";

type LinkProps = ComponentProps<typeof Link>;

export function GrowthLandingCta({
  placement,
  suite,
  className,
  onClick,
  children,
  ...rest
}: LinkProps & { placement: string; suite?: string }) {
  return (
    <Link
      {...rest}
      className={cn(className)}
      onClick={(e) => {
        postGrowthLandingConversionEvent(placement, suite);
        onClick?.(e);
      }}
    >
      {children}
    </Link>
  );
}

export function GrowthLandingAnchor({
  placement,
  suite,
  className,
  children,
  onClick,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { placement: string; suite?: string }) {
  return (
    <a
      {...rest}
      className={cn(className)}
      onClick={(e) => {
        postGrowthLandingConversionEvent(placement, suite);
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}
