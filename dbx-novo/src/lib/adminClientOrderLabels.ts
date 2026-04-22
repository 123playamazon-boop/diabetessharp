import type { ClientOrder, ClientOrderStatus } from "../types";
import { NON_AMAZON_MARKETPLACE_LABEL } from "../types";

/** Rótulo de serviço para tabelas admin (pedidos `ClientOrder`). */
export function adminClientOrderServiceLabel(o: ClientOrder, t: (k: string) => string): string {
  if (o.service === "FBM") return t("admin.service.fbm");
  if (o.service === "FBA") return t("admin.service.fba");
  if (o.service === "USA_DOMESTIC") return t("admin.service.usa");
  if (o.service === "WALMART_CUSTOMER") return t("admin.service.walmartCustomer");
  if (o.service === "WALMART_WAREHOUSE") return t("admin.service.walmartWarehouse");
  if (o.service === "EBAY") return t("admin.service.ebay");
  if (o.service === "INTL_ML") return t("admin.service.intlMl");
  if (o.service === "INTL_BR") return t("admin.service.intlBr");
  if (o.service === "PREP_KIT") return t("admin.service.prepKit");
  if (o.service === "OUTRO") {
    if (o.nonAmazonMarketplace === "other" && o.otherPlatformName?.trim()) return o.otherPlatformName.trim();
    if (o.nonAmazonMarketplace) return NON_AMAZON_MARKETPLACE_LABEL[o.nonAmazonMarketplace];
    if (o.otherPlatformName?.trim()) return o.otherPlatformName.trim();
    return t("admin.service.other");
  }
  return o.service;
}

export function adminClientOrderStatusLabel(s: ClientOrderStatus, t: (k: string) => string): string {
  return t(`admin.orders.status.${s}`);
}
