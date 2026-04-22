import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useClientProfile } from "../../context/ClientProfileContext";
import { useI18n } from "../../i18n/context";
import { clearDemoBrowserState } from "../../lib/demoSessionReset";
import { pullClientProfileFromServer, saveClientProfile } from "../../lib/clientProfileStorage";
import { getCustomerReturnMerchandiseFeePerUnitUsd } from "../../lib/customerReturnFee";
import { formatUsd } from "../../lib/prepCenterPricing";
import { postDemoFullReset, postWalletAdjust } from "../../lib/walletApi";
import { PageHeader } from "../../ui/PageHeader";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";

export function ClientFinancialPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { profile } = useClientProfile();
  const [topup, setTopup] = useState("50");
  const [busy, setBusy] = useState(false);

  const returnFeeLabels = useMemo(
    () => ({
      free: formatUsd(getCustomerReturnMerchandiseFeePerUnitUsd("basic")),
      prem: formatUsd(getCustomerReturnMerchandiseFeePerUnitUsd("premium")),
    }),
    [],
  );

  const sync = async () => {
    const r = await pullClientProfileFromServer();
    if (r.ok) {
      toast.success(t("client.financial.refresh"));
      return;
    }
    if (r.reason === "not_found") {
      toast.error(t("client.session.reloginToast"));
      return;
    }
    toast.error(t("client.financial.syncFail"));
  };

  const onTopup = async () => {
    const n = Number(topup.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    setBusy(true);
    try {
      const r = await postWalletAdjust({
        suite: profile.suite,
        deltaUsd: Math.round(n * 100) / 100,
        reason: "card_sim_topup",
        reference: `topup-${Date.now()}`,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      saveClientProfile({ ...profile, balanceUsd: r.balanceUsd });
      toast.success(t("client.financial.topupOk"));
    } finally {
      setBusy(false);
    }
  };

  const onFullReset = async () => {
    if (
      !window.confirm(
        `${t("client.financial.resetTitle")}\n\n${t("client.financial.resetBody")}`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const r = await postDemoFullReset();
      if (!r.ok) {
        toast.error(r.error || t("client.financial.resetFail"));
        return;
      }
      clearDemoBrowserState();
      toast.success(
        t("client.financial.resetOk", {
          suite: r.loginSuite,
          name: r.loginName,
          email: r.loginEmail,
          password: r.loginPassword,
          balance: String(r.balanceUsd),
        }),
      );
      navigate("/app/entrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow={t("client.financial.eyebrow")}
        title={t("client.financial.title")}
        subtitle={t("client.financial.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <div className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.financial.balance")}</p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-ds-text">US$ {profile.balanceUsd.toFixed(2)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void sync()}
            className="rounded-ds-btn border border-ds-border bg-ds-bg px-4 py-2 text-xs font-bold uppercase tracking-wide text-ds-text hover:bg-white"
          >
            {t("client.financial.refresh")}
          </button>
          <Link
            to="/app/extrato"
            className="inline-flex items-center justify-center rounded-ds-btn bg-ds-primary px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-ds transition hover:opacity-95"
          >
            {t("client.financial.openStatement")}
          </Link>
          <Link
            to="/app/taxas"
            className="inline-flex items-center justify-center rounded-ds-btn border border-ds-border bg-ds-surface px-4 py-2 text-xs font-black uppercase tracking-wide text-ds-primary shadow-ds transition hover:bg-ds-bg"
          >
            {t("client.financial.linkFees")}
          </Link>
        </div>
      </div>

      <div className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <p className="text-sm font-semibold text-ds-text">{t("client.financial.topupButton")}</p>
        <p className="mt-1 text-xs text-ds-muted">{t("client.financial.topupHint")}</p>
        <label className="mt-4 block text-xs font-semibold uppercase text-ds-muted">
          {t("client.financial.topupLabel")}
          <input
            className="mt-1 w-full rounded-ds-btn border border-ds-border bg-white px-3 py-2 text-sm tabular-nums text-ds-text"
            value={topup}
            onChange={(e) => setTopup(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onTopup()}
          className="mt-4 w-full rounded-ds-btn bg-ds-primary px-4 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-ds hover:opacity-95"
        >
          {t("client.financial.topupButton")}
        </button>
      </div>

      <p className="text-center text-xs text-ds-muted">{t("client.financial.shipFeeHint")}</p>

      <p className="text-center text-xs leading-relaxed text-ds-muted">
        {t("client.financial.returnDebitHint", returnFeeLabels)}{" "}
        <Link to="/app/estoque?aba=retornos" className="font-semibold text-ds-primary underline underline-offset-2 hover:opacity-90">
          {t("client.financial.returnDebitHintInventory")}
        </Link>
        {" · "}
        <Link to="/app/premium" className="font-semibold text-ds-primary underline underline-offset-2 hover:opacity-90">
          {t("client.financial.returnDebitHintPremium")}
        </Link>
      </p>

      <div className="rounded-ds-card border border-ds-error/30 bg-red-50/50 p-5 shadow-ds">
        <p className="text-sm font-bold text-ds-error">{t("client.financial.resetTitle")}</p>
        <p className="mt-2 text-xs leading-relaxed text-ds-text">{t("client.financial.resetBody")}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onFullReset()}
          className="mt-4 w-full rounded-ds-btn border border-ds-error bg-white px-4 py-3 text-sm font-bold uppercase tracking-wide text-ds-error hover:bg-red-50"
        >
          {t("client.financial.resetButton")}
        </button>
      </div>
    </div>
  );
}
