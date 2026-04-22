import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { jsonAdminHeaders } from "../../lib/authHeaders";
import { apiUrl } from "../../lib/apiUrl";
import { WalletStatementTable } from "../../components/WalletStatementTable";
import { fetchAdminWalletLedger, postAdminWalletAdjust, type WalletLedgerEntryDto } from "../../lib/walletApi";
import type { AdminClientCard, ClientBusinessModel, ClientSupplierRegion } from "../../types";
import { PageHeader } from "../../ui/PageHeader";
import { useI18n } from "../../i18n/context";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";

type AdminKycPayload = {
  suite: string;
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  verificationStatus: string;
  proofOfAddressDataUrl: string | null;
  idDocumentDataUrl: string | null;
};

type ClientsLoadError = "html" | "http" | "json" | null;

function DocPreview({ label, dataUrl, emptyLabel }: { label: string; dataUrl: string | null; emptyLabel: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2">
      <p className="text-xs font-semibold text-zinc-700">{label}</p>
      <div className="mt-1 min-h-[200px] overflow-auto rounded-lg bg-white">
        {!dataUrl ? (
          <p className="p-4 text-xs text-zinc-500">{emptyLabel}</p>
        ) : dataUrl.startsWith("data:application/pdf") ? (
          <iframe title={label} src={dataUrl} className="h-[min(480px,50vh)] w-full border-0" />
        ) : (
          <img alt="" src={dataUrl} className="mx-auto max-h-[min(480px,50vh)] w-auto max-w-full object-contain" />
        )}
      </div>
    </div>
  );
}

async function parseAdminClientsResponse(
  res: Response,
): Promise<{ clients: AdminClientCard[] | null; loadError: ClientsLoadError }> {
  const text = await res.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<")) {
    return { clients: null, loadError: "html" };
  }
  if (!res.ok) {
    return { clients: null, loadError: "http" };
  }
  try {
    const data = JSON.parse(text) as { clients?: AdminClientCard[] };
    return { clients: Array.isArray(data.clients) ? data.clients : [], loadError: null };
  } catch {
    return { clients: null, loadError: "json" };
  }
}

async function parseKycResponse(res: Response): Promise<{ data: AdminKycPayload | null; error: string | null }> {
  const text = await res.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<")) {
    return { data: null, error: "__html__" };
  }
  try {
    const j = JSON.parse(text) as AdminKycPayload & { error?: string };
    if (!res.ok) {
      return { data: null, error: typeof j.error === "string" ? j.error : "__http__" };
    }
    return { data: j as AdminKycPayload, error: null };
  } catch {
    return { data: null, error: "__json__" };
  }
}

const inputClass =
  "w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600";

function ymdForFilename(): string {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}`;
}

export function AdminClientsPage() {
  const { t, locale } = useI18n();
  const [clients, setClients] = useState<AdminClientCard[]>([]);
  const [loadError, setLoadError] = useState<ClientsLoadError>(null);
  const [suiteFilter, setSuiteFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [approvingSuite, setApprovingSuite] = useState<string | null>(null);
  const [kycModalSuite, setKycModalSuite] = useState<string | null>(null);
  const [kycModal, setKycModal] = useState<AdminKycPayload | null>(null);
  const [kycModalLoading, setKycModalLoading] = useState(false);

  const [balanceModalSuite, setBalanceModalSuite] = useState<string | null>(null);
  const [balanceAmount, setBalanceAmount] = useState("50");
  const [balanceBusy, setBalanceBusy] = useState(false);

  const [editClient, setEditClient] = useState<AdminClientCard | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [passwordSuite, setPasswordSuite] = useState<string | null>(null);
  const [passwordNew, setPasswordNew] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [statementModalSuite, setStatementModalSuite] = useState<string | null>(null);
  const [statementEntries, setStatementEntries] = useState<WalletLedgerEntryDto[]>([]);
  const [statementLoading, setStatementLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "",
    tier: "",
  });

  const supplierLabel = useCallback(
    (r: ClientSupplierRegion) => t(`admin.clients.supplier.${r}`),
    [t],
  );

  const businessLabel = useCallback(
    (m: ClientBusinessModel) => t(`admin.clients.business.${m}`),
    [t],
  );

  const loadErrorMessage = useMemo(() => {
    if (loadError === "html") return t("admin.clients.loadApiHtml");
    if (loadError === "http") return t("admin.clients.loadApiErr");
    if (loadError === "json") return t("admin.clients.loadInvalid");
    return null;
  }, [loadError, t]);

  const filteredClients = useMemo(() => {
    const sQ = suiteFilter.trim().toLowerCase();
    const nQ = nameFilter.trim().toLowerCase();
    return clients.filter((c) => {
      if (sQ && !c.suite.toLowerCase().includes(sQ)) return false;
      if (nQ) {
        const blob = `${c.name} ${c.email}`.toLowerCase();
        if (!blob.includes(nQ)) return false;
      }
      return true;
    });
  }, [clients, suiteFilter, nameFilter]);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(apiUrl("/api/admin/clients"), { headers: jsonAdminHeaders() });
      const { clients: list, loadError: err } = await parseAdminClientsResponse(res);
      if (err || list === null) {
        setLoadError(err ?? "http");
        setClients([]);
        return;
      }
      setClients(list);
    } catch {
      setLoadError("http");
      setClients([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!kycModalSuite) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setKycModalSuite(null);
        setKycModal(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kycModalSuite]);

  useEffect(() => {
    if (!statementModalSuite) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setStatementModalSuite(null);
        setStatementEntries([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [statementModalSuite]);

  const openKycModal = async (suite: string) => {
    setKycModalSuite(suite);
    setKycModal(null);
    setKycModalLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/clients/${encodeURIComponent(suite)}/kyc-docs`), {
        headers: jsonAdminHeaders(),
      });
      const { data, error } = await parseKycResponse(res);
      if (error || !data) {
        const msg =
          error === "__html__"
            ? t("admin.clients.loadApiHtml")
            : error === "__json__"
              ? t("admin.clients.loadInvalid")
              : error === "__http__"
                ? t("admin.clients.kycLoadFail")
                : error;
        toast.error(msg);
        setKycModalSuite(null);
        return;
      }
      setKycModal(data);
    } catch {
      toast.error(t("admin.clients.kycNetworkErr"));
      setKycModalSuite(null);
    } finally {
      setKycModalLoading(false);
    }
  };

  const closeKycModal = () => {
    setKycModalSuite(null);
    setKycModal(null);
  };

  const approveSuite = async (suite: string) => {
    setApprovingSuite(suite);
    try {
      const res = await fetch(apiUrl(`/api/admin/clients/${encodeURIComponent(suite)}/approve`), {
        method: "POST",
        headers: jsonAdminHeaders(),
      });
      const text = await res.text();
      const trimmed = text.trimStart();
      if (trimmed.startsWith("<")) {
        toast.error(t("admin.clients.approveHtmlErr"));
        return;
      }
      let body: { error?: string } = {};
      try {
        body = JSON.parse(text) as { error?: string };
      } catch {
        toast.error(t("admin.clients.approveInvalid"));
        return;
      }
      if (!res.ok) {
        toast.error(typeof body.error === "string" ? body.error : t("admin.clients.approveFail"));
        return;
      }
      toast.success(t("admin.clients.approveToast", { suite }));
      closeKycModal();
      await refresh();
    } catch {
      toast.error(t("admin.clients.approveNetErr"));
    } finally {
      setApprovingSuite(null);
    }
  };

  const openBalanceModal = (suite: string) => {
    setBalanceModalSuite(suite);
    setBalanceAmount("50");
  };

  const closeStatementModal = () => {
    setStatementModalSuite(null);
    setStatementEntries([]);
  };

  const loadStatementLedger = async (suite: string) => {
    setStatementLoading(true);
    try {
      const r = await fetchAdminWalletLedger(suite);
      if (!r.ok) {
        toast.error(r.error || t("admin.clients.statementLoadFail"));
        setStatementEntries([]);
        return;
      }
      setStatementEntries(r.entries);
    } catch {
      toast.error(t("admin.clients.statementLoadFail"));
      setStatementEntries([]);
    } finally {
      setStatementLoading(false);
    }
  };

  const openStatementModal = (suite: string) => {
    setStatementModalSuite(suite);
    setStatementEntries([]);
    void loadStatementLedger(suite);
  };

  const applyBalanceCredit = async () => {
    if (!balanceModalSuite) return;
    const n = Number(balanceAmount.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error(t("admin.clients.balanceInvalid"));
      return;
    }
    setBalanceBusy(true);
    try {
      const r = await postAdminWalletAdjust({
        suite: balanceModalSuite,
        deltaUsd: Math.round(n * 100) / 100,
        reason: "admin_console_credit",
        reference: `admin-${Date.now()}`,
      });
      if (!r.ok) {
        toast.error(r.error || t("admin.clients.balanceFail"));
        return;
      }
      toast.success(t("admin.clients.balanceOk", { balance: r.balanceUsd.toFixed(2) }));
      setBalanceModalSuite(null);
      await refresh();
    } finally {
      setBalanceBusy(false);
    }
  };

  const openEditModal = (c: AdminClientCard) => {
    setEditClient(c);
    setEditForm({
      name: c.name,
      email: c.email,
      phone: c.phone ?? "",
      addressLine1: c.addressLine1 ?? "",
      addressLine2: c.addressLine2 ?? "",
      city: c.city ?? "",
      region: c.region ?? "",
      postalCode: c.postalCode ?? "",
      country: c.country ?? "",
      tier: c.tier ?? "",
    });
  };

  const saveEditModal = async () => {
    if (!editClient) return;
    setEditBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/clients/${encodeURIComponent(editClient.suite)}`), {
        method: "PATCH",
        headers: jsonAdminHeaders(),
        body: JSON.stringify(editForm),
      });
      const text = await res.text();
      let body: { error?: string } = {};
      try {
        body = JSON.parse(text) as { error?: string };
      } catch {
        toast.error(t("admin.clients.patchFail"));
        return;
      }
      if (!res.ok) {
        toast.error(typeof body.error === "string" ? body.error : t("admin.clients.patchFail"));
        return;
      }
      toast.success(t("admin.clients.patchOk"));
      setEditClient(null);
      await refresh();
    } catch {
      toast.error(t("admin.clients.patchFail"));
    } finally {
      setEditBusy(false);
    }
  };

  const toggleBlock = async (c: AdminClientCard) => {
    try {
      const res = await fetch(apiUrl(`/api/admin/clients/${encodeURIComponent(c.suite)}`), {
        method: "PATCH",
        headers: jsonAdminHeaders(),
        body: JSON.stringify({ active: !c.active }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(typeof j.error === "string" ? j.error : t("admin.clients.blockFail"));
        return;
      }
      toast.success(t("admin.clients.blockOk"));
      await refresh();
    } catch {
      toast.error(t("admin.clients.blockFail"));
    }
  };

  const savePasswordReset = async () => {
    if (!passwordSuite) return;
    if (passwordNew.length < 8) {
      toast.error(t("admin.clients.passwordHint"));
      return;
    }
    if (passwordNew !== passwordConfirm) {
      toast.error(t("admin.clients.passwordMismatch"));
      return;
    }
    setPasswordBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/clients/${encodeURIComponent(passwordSuite)}/password`), {
        method: "POST",
        headers: jsonAdminHeaders(),
        body: JSON.stringify({ password: passwordNew }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(typeof j.error === "string" ? j.error : t("admin.clients.passwordFail"));
        return;
      }
      toast.success(t("admin.clients.passwordOk"));
      setPasswordSuite(null);
      setPasswordNew("");
      setPasswordConfirm("");
    } catch {
      toast.error(t("admin.clients.passwordFail"));
    } finally {
      setPasswordBusy(false);
    }
  };

  const removeClient = async (c: AdminClientCard) => {
    if (
      !window.confirm(
        t("admin.clients.removeConfirm", { suite: c.suite, name: c.name }),
      )
    ) {
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/admin/clients/${encodeURIComponent(c.suite)}`), {
        method: "DELETE",
        headers: jsonAdminHeaders(),
      });
      if (!res.ok) {
        toast.error(t("admin.clients.removeFail"));
        return;
      }
      toast.success(t("admin.clients.removeOk"));
      await refresh();
    } catch {
      toast.error(t("admin.clients.removeFail"));
    }
  };

  const kycAddr = kycModal
    ? [
        [kycModal.addressLine1, kycModal.addressLine2].filter(Boolean).join(", "),
        [kycModal.city, kycModal.region].filter(Boolean).join(", "),
        [kycModal.postalCode, kycModal.country].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("admin.clients.eyebrow")}
        title={t("admin.clients.title")}
        subtitle={t("admin.clients.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              {t("admin.clients.refresh")}
            </button>
          </div>
        }
      />

      {loadErrorMessage ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{loadErrorMessage}</p>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-3xl border border-zinc-200/80 bg-white p-3 shadow-sm">
        <input
          className="w-36 rounded-2xl border border-zinc-200 px-3 py-2 text-sm"
          placeholder={t("admin.clients.filterSuitePh")}
          value={suiteFilter}
          onChange={(e) => setSuiteFilter(e.target.value)}
          autoComplete="off"
        />
        <input
          className="min-w-[220px] flex-1 rounded-2xl border border-zinc-200 px-3 py-2 text-sm"
          placeholder={t("admin.clients.filterNamePh")}
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          autoComplete="off"
        />
        <span className="self-center text-xs text-zinc-500">{t("admin.clients.filtersSoon")}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filteredClients.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-12 text-center text-sm text-zinc-600 lg:col-span-2">
            {clients.length === 0 ? t("admin.clients.empty") : t("admin.clients.noneAfterFilter")}
          </p>
        ) : (
          filteredClients.map((c) => {
            const vs = c.verificationStatus ?? "approved";
            const streetBlock = [c.addressLine1?.trim(), c.addressLine2?.trim()].filter(Boolean).join(", ");
            const cityBlock = [c.city?.trim(), c.region?.trim()].filter(Boolean).join(", ");
            const postalBlock = [c.postalCode?.trim(), c.country?.trim()].filter(Boolean).join(" ");
            const addr = [streetBlock, cityBlock, postalBlock].filter(Boolean).join(" · ") || "—";
            const bal = typeof c.balanceUsd === "number" && Number.isFinite(c.balanceUsd) ? c.balanceUsd : 0;
            return (
              <section key={c.suite} className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("admin.clients.colClient")}</div>
                    <div className="mt-1 text-lg font-semibold tracking-tight text-zinc-900">{c.name}</div>
                    <div className="mt-1 text-sm text-zinc-600">{c.email}</div>
                    {c.phone ? <div className="mt-0.5 text-sm text-zinc-600">{c.phone}</div> : null}
                  </div>
                  <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold">
                    {t("admin.clients.suiteBadge", { suite: c.suite })}
                  </div>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-zinc-600">
                  <span className="font-semibold text-zinc-800">{t("admin.clients.address")}:</span> {addr}
                </p>
                <p className="mt-1 text-xs font-semibold text-zinc-800">
                  {t("admin.clients.balanceLine")}:{" "}
                  <span className="tabular-nums text-teal-800">US$ {bal.toFixed(2)}</span>
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900">
                    {c.active ? t("admin.clients.statusActive") : t("admin.clients.statusInactive")}
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                    {c.tier}
                  </span>
                  {c.premiumActive ? (
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-900">
                      {t("admin.clients.premiumBadge")}
                    </span>
                  ) : null}
                  <span
                    className={
                      vs === "pending_review"
                        ? "rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900"
                        : "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900"
                    }
                  >
                    {vs === "pending_review" ? t("admin.clients.kycPending") : t("admin.clients.kycApproved")}
                  </span>
                  {c.hasProofOfAddress ? (
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700">
                      {t("admin.clients.docProof")}
                    </span>
                  ) : null}
                  {c.hasIdDocument ? (
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700">
                      {t("admin.clients.docId")}
                    </span>
                  ) : null}
                </div>

                {(c.productCategories || c.monthlyVolumeBand || c.supplierRegion || c.businessModel) && (
                  <div className="mt-3 rounded-2xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-700">
                    {c.productCategories ? (
                      <p>
                        <span className="font-semibold text-zinc-900">{t("admin.clients.quizProducts")}:</span> {c.productCategories}
                      </p>
                    ) : null}
                    {c.monthlyVolumeBand ? (
                      <p className="mt-1">
                        <span className="font-semibold text-zinc-900">{t("admin.clients.quizVolume")}:</span> {c.monthlyVolumeBand}
                      </p>
                    ) : null}
                    {c.supplierRegion ? (
                      <p className="mt-1">
                        <span className="font-semibold text-zinc-900">{t("admin.clients.quizSuppliers")}:</span>{" "}
                        {supplierLabel(c.supplierRegion)}
                      </p>
                    ) : null}
                    {c.businessModel ? (
                      <p className="mt-1">
                        <span className="font-semibold text-zinc-900">{t("admin.clients.quizModel")}:</span>{" "}
                        {businessLabel(c.businessModel)}
                      </p>
                    ) : null}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void openKycModal(c.suite)}
                    className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-100"
                  >
                    {t("admin.clients.openKyc")}
                  </button>
                  {vs === "pending_review" ? (
                    <button
                      type="button"
                      disabled={approvingSuite === c.suite}
                      onClick={() => void approveSuite(c.suite)}
                      className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                    >
                      {approvingSuite === c.suite ? t("admin.clients.approveBusy") : t("admin.clients.approveRelease")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openBalanceModal(c.suite)}
                    className="rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    {t("admin.clients.adjustBalance")}
                  </button>
                  <button
                    type="button"
                    onClick={() => openStatementModal(c.suite)}
                    className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-100"
                  >
                    {t("admin.clients.openStatement")}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(c)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-zinc-50"
                  >
                    {t("admin.clients.edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordSuite(c.suite);
                      setPasswordNew("");
                      setPasswordConfirm("");
                    }}
                    className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-100"
                  >
                    {t("admin.clients.passwordReset")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleBlock(c)}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900 hover:bg-rose-100"
                  >
                    {c.active ? t("admin.clients.block") : t("admin.clients.unblock")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeClient(c)}
                    className="rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-200"
                  >
                    {t("admin.clients.remove")}
                  </button>
                </div>
              </section>
            );
          })
        )}
      </div>

      {kycModalSuite ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kyc-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeKycModal();
          }}
        >
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <h2 id="kyc-modal-title" className="text-sm font-bold text-zinc-900">
                {t("admin.clients.kycModalTitle", { suite: kycModalSuite })}
              </h2>
              <button
                type="button"
                onClick={closeKycModal}
                className="rounded-lg px-2 py-1 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
              >
                {t("admin.clients.close")}
              </button>
            </div>
            <div className="max-h-[calc(92vh-52px)] overflow-y-auto p-4">
              {kycModalLoading ? (
                <p className="text-sm text-zinc-600">{t("admin.clients.loading")}</p>
              ) : kycModal ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-800">
                    <p>
                      <span className="font-semibold">{t("admin.clients.kycAccount")}:</span> {kycModal.name} · {kycModal.email} ·{" "}
                      {kycModal.phone}
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold">{t("admin.clients.kycAddress")}:</span> {kycAddr || "—"}
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold">{t("admin.clients.kycState")}:</span> {kycModal.verificationStatus}
                    </p>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <DocPreview
                      label={t("admin.clients.kycDocAddress")}
                      dataUrl={kycModal.proofOfAddressDataUrl}
                      emptyLabel={t("admin.clients.docNoFile")}
                    />
                    <DocPreview
                      label={t("admin.clients.kycDocId")}
                      dataUrl={kycModal.idDocumentDataUrl}
                      emptyLabel={t("admin.clients.docNoFile")}
                    />
                  </div>
                  {kycModal.verificationStatus === "pending_review" ? (
                    <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-3">
                      <button type="button" onClick={closeKycModal} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold">
                        {t("admin.clients.closeNoApprove")}
                      </button>
                      <button
                        type="button"
                        disabled={approvingSuite === kycModal.suite}
                        onClick={() => void approveSuite(kycModal.suite)}
                        className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
                      >
                        {approvingSuite === kycModal.suite ? t("admin.clients.approveBusy") : t("admin.clients.approveRelease")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-zinc-600">{t("admin.clients.noData")}</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {balanceModalSuite ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="balance-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBalanceModalSuite(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h2 id="balance-modal-title" className="text-base font-bold text-zinc-900">
              {t("admin.clients.balanceModalTitle", { suite: balanceModalSuite })}
            </h2>
            <p className="mt-2 text-xs text-zinc-600">{t("admin.clients.balanceHint")}</p>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t("admin.clients.balanceAmountLabel")}
              <input
                className={`${inputClass} mt-1`}
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={balanceBusy}
                onClick={() => setBalanceModalSuite(null)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
              >
                {t("admin.clients.balanceCancel")}
              </button>
              <button
                type="button"
                disabled={balanceBusy}
                onClick={() => void applyBalanceCredit()}
                className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {t("admin.clients.balanceApply")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {statementModalSuite ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="statement-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeStatementModal();
          }}
        >
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
              <h2 id="statement-modal-title" className="text-sm font-bold text-zinc-900">
                {t("admin.clients.statementModalTitle", { suite: statementModalSuite })}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={statementLoading}
                  onClick={() => void loadStatementLedger(statementModalSuite)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {t("admin.clients.statementRefresh")}
                </button>
                <button
                  type="button"
                  onClick={closeStatementModal}
                  className="rounded-lg px-2 py-1 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
                >
                  {t("admin.clients.close")}
                </button>
              </div>
            </div>
            <div className="max-h-[calc(92vh-52px)] overflow-y-auto p-4">
              {statementLoading ? (
                <p className="text-sm text-zinc-600">{t("admin.clients.loading")}</p>
              ) : (
                <>
                  <WalletStatementTable
                    entries={statementEntries}
                    locale={locale}
                    t={t}
                    suiteLabel={statementModalSuite}
                    emptyLabel={t("admin.clients.statementEmpty")}
                    csvFilename={`admin-extrato-${statementModalSuite}-${ymdForFilename()}.csv`}
                  />
                  <p className="mt-4 text-xs leading-relaxed text-zinc-500">{t("admin.clients.statementFooter")}</p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {passwordSuite ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwd-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPasswordSuite(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h2 id="pwd-modal-title" className="text-base font-bold text-zinc-900">
              {t("admin.clients.passwordReset")} — {passwordSuite}
            </h2>
            <p className="mt-2 text-xs text-zinc-600">{t("admin.clients.passwordHint")}</p>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t("admin.clients.passwordPlaceholder")}
              <input
                type="password"
                autoComplete="new-password"
                className={`${inputClass} mt-1`}
                value={passwordNew}
                onChange={(e) => setPasswordNew(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t("admin.clients.passwordConfirm")}
              <input
                type="password"
                autoComplete="new-password"
                className={`${inputClass} mt-1`}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={passwordBusy}
                onClick={() => setPasswordSuite(null)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
              >
                {t("admin.clients.cancel")}
              </button>
              <button
                type="button"
                disabled={passwordBusy}
                onClick={() => void savePasswordReset()}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {t("admin.clients.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editClient ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditClient(null);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h2 id="edit-modal-title" className="text-base font-bold text-zinc-900">
              {t("admin.clients.editModalTitle", { suite: editClient.suite })}
            </h2>
            <div className="mt-4 grid gap-3">
              <label className="block text-xs font-semibold text-zinc-600">
                {t("admin.clients.fieldName")}
                <input className={`${inputClass} mt-1`} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </label>
              <label className="block text-xs font-semibold text-zinc-600">
                {t("admin.clients.fieldEmail")}
                <input className={`${inputClass} mt-1`} value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
              </label>
              <label className="block text-xs font-semibold text-zinc-600">
                {t("admin.clients.fieldPhone")}
                <input className={`${inputClass} mt-1`} value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </label>
              <label className="block text-xs font-semibold text-zinc-600">
                {t("admin.clients.fieldAddress1")}
                <input
                  className={`${inputClass} mt-1`}
                  value={editForm.addressLine1}
                  onChange={(e) => setEditForm((f) => ({ ...f, addressLine1: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-semibold text-zinc-600">
                {t("admin.clients.fieldAddress2")}
                <input
                  className={`${inputClass} mt-1`}
                  value={editForm.addressLine2}
                  onChange={(e) => setEditForm((f) => ({ ...f, addressLine2: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-semibold text-zinc-600">
                {t("admin.clients.fieldCity")}
                <input className={`${inputClass} mt-1`} value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} />
              </label>
              <label className="block text-xs font-semibold text-zinc-600">
                {t("admin.clients.fieldRegion")}
                <input className={`${inputClass} mt-1`} value={editForm.region} onChange={(e) => setEditForm((f) => ({ ...f, region: e.target.value }))} />
              </label>
              <label className="block text-xs font-semibold text-zinc-600">
                {t("admin.clients.fieldPostal")}
                <input
                  className={`${inputClass} mt-1`}
                  value={editForm.postalCode}
                  onChange={(e) => setEditForm((f) => ({ ...f, postalCode: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-semibold text-zinc-600">
                {t("admin.clients.fieldCountry")}
                <input
                  className={`${inputClass} mt-1`}
                  value={editForm.country}
                  onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-semibold text-zinc-600">
                {t("admin.clients.fieldTier")}
                <input className={`${inputClass} mt-1`} value={editForm.tier} onChange={(e) => setEditForm((f) => ({ ...f, tier: e.target.value }))} />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={editBusy}
                onClick={() => setEditClient(null)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
              >
                {t("admin.clients.cancel")}
              </button>
              <button
                type="button"
                disabled={editBusy}
                onClick={() => void saveEditModal()}
                className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {t("admin.clients.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
