import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { ClientBusinessModel, ClientOnboardingQuiz, ClientSupplierRegion } from "../../types";
import { loginClientRemote, registerClientRemote } from "../../lib/clientProfileStorage";
import { useI18n } from "../../i18n/context";
import { cn } from "../../lib/cn";

const inputClass =
  "w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2.5 text-sm text-ds-text shadow-ds placeholder:text-ds-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary";

const MAX_KYC_BYTES = 380_000;

const MONTHLY_BANDS = [
  { value: "<50", label: "Menos de 50 unidades / mês" },
  { value: "50-500", label: "50 a 500 unidades / mês" },
  { value: "500-2000", label: "500 a 2.000 unidades / mês" },
  { value: "2000+", label: "Mais de 2.000 unidades / mês" },
] as const;

type Tab = "novo" | "entrar";
type WizardStep = 1 | 2 | 3;

function fileToDataUrl(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (file.size > MAX_KYC_BYTES) {
      resolve(undefined);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      resolve(r.length > MAX_KYC_BYTES ? undefined : r);
    };
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

export function ClientEntrarPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const reloginHintShown = useRef(false);
  const navigate = useNavigate();
  const proofInput = useRef<HTMLInputElement>(null);
  const idInput = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("novo");
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [busy, setBusy] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [proofLabel, setProofLabel] = useState("");
  const [idLabel, setIdLabel] = useState("");

  const [productCategories, setProductCategories] = useState("");
  const [monthlyVolumeBand, setMonthlyVolumeBand] = useState<string>(MONTHLY_BANDS[1]!.value);
  const [supplierRegion, setSupplierRegion] = useState<ClientSupplierRegion>("usa");
  const [businessModel, setBusinessModel] = useState<ClientBusinessModel>("private_label");

  const [loginEmail, setLoginEmail] = useState("");
  const [senhaEntrar, setSenhaEntrar] = useState("");
  const [senhaRegisto, setSenhaRegisto] = useState("");
  const [senhaRegistoConfirm, setSenhaRegistoConfirm] = useState("");

  useEffect(() => {
    if (searchParams.get("relogin") !== "perfil" || reloginHintShown.current) return;
    reloginHintShown.current = true;
    toast.info(t("client.session.reloginToast"), { duration: 12_000 });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("relogin");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, t]);

  const resetWizard = () => {
    setWizardStep(1);
    setProofFile(null);
    setIdFile(null);
    setProofLabel("");
    setIdLabel("");
    setSenhaRegisto("");
    setSenhaRegistoConfirm("");
  };

  const validateStep1 = (): string | null => {
    if (!nome.trim()) return "Indique o nome da conta ou empresa.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Indique um email válido.";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) return "Indique um telefone válido (mín. 8 dígitos; pode incluir código do país).";
    if (addressLine1.trim().length < 4) return "Indique o endereço — linha 1 (rua, número, edifício…).";
    if (city.trim().length < 2) return "Indique a cidade ou localidade.";
    if (country.trim().length < 2) return "Indique o país.";
    if (region.trim().length < 2 && postalCode.trim().length < 2) {
      return "Indique pelo menos o código postal ou a região (estado, província, condado…).";
    }
    if (senhaRegisto.length < 8) return "Defina uma senha com pelo menos 8 caracteres.";
    if (senhaRegisto !== senhaRegistoConfirm) return "As senhas não coincidem.";
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!proofFile) return "Carregue o comprovante de endereço (conta de serviços, extrato, etc.).";
    if (!idFile) return "Carregue a foto do documento (RG, carta de condução ou passaporte).";
    return null;
  };

  const validateStep3 = (): string | null => {
    if (!productCategories.trim()) return "Descreva os tipos de produto que planeia enviar.";
    return null;
  };

  const onRegistar = async () => {
    const e1 = validateStep1();
    if (e1) {
      toast.error(e1);
      return;
    }
    const e2 = validateStep2();
    if (e2) {
      toast.error(e2);
      return;
    }
    const e3 = validateStep3();
    if (e3) {
      toast.error(e3);
      return;
    }

    setBusy(true);
    try {
      const proofOfAddressDataUrl = await fileToDataUrl(proofFile!);
      const idDocumentDataUrl = await fileToDataUrl(idFile!);
      if (!proofOfAddressDataUrl) {
        toast.error("Comprovante muito grande.", { description: `Máximo ~${Math.round(MAX_KYC_BYTES / 1024)} KB por arquivo (demo).` });
        return;
      }
      if (!idDocumentDataUrl) {
        toast.error("Documento muito grande.", { description: `Máximo ~${Math.round(MAX_KYC_BYTES / 1024)} KB por arquivo (demo).` });
        return;
      }

      const onboardingQuiz: ClientOnboardingQuiz = {
        productCategories: productCategories.trim(),
        monthlyVolumeBand,
        supplierRegion,
        businessModel,
      };

      await registerClientRemote({
        name: nome.trim(),
        email: email.trim(),
        password: senhaRegisto,
        phone: phone.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim(),
        city: city.trim(),
        region: region.trim(),
        postalCode: postalCode.trim(),
        country: country.trim(),
        proofOfAddressDataUrl,
        idDocumentDataUrl,
        onboardingQuiz,
      });

      toast.success("Conta criada.", {
        description:
          "Documentos recebidos. A equipe analisa em até 5 horas úteis para validar a suite. Você já pode explorar o portal.",
      });
      navigate("/app/dashboard", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar.");
    } finally {
      setBusy(false);
    }
  };

  const onEntrar = async () => {
    const em = loginEmail.trim();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      toast.error("Indique um e-mail válido.");
      return;
    }
    if (!senhaEntrar) {
      toast.error("Indique a senha.");
      return;
    }
    setBusy(true);
    try {
      await loginClientRemote(em, senhaEntrar);
      toast.success("Sessão iniciada.");
      navigate("/app/dashboard", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  };

  const onPickProof = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setProofFile(f ?? null);
    setProofLabel(f?.name ?? "");
  }, []);

  const onPickId = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setIdFile(f ?? null);
    setIdLabel(f?.name ?? "");
  }, []);

  return (
    <div className="min-h-screen bg-ds-bg px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">Portal cliente</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ds-text">Entrar ou criar conta</h1>
          <p className="mt-2 text-sm text-ds-muted">
            <strong>Novo:</strong> dados de contato e endereço (qualquer país), comprovante de endereço, documento de
            identificação e um quiz rápido — fica tudo associado à sua <strong>suite</strong>. O prep vê a suite em{" "}
            <strong>Admin → Clients</strong>. Requer <code className="rounded bg-ds-bg px-1 text-xs">npm run dev</code>{" "}
            (API na porta 8787).
          </p>
        </div>

        <div className="flex rounded-ds-btn bg-ds-surface p-0.5 shadow-ds ring-1 ring-ds-border" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "novo"}
            onClick={() => {
              setTab("novo");
              resetWizard();
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-ds-btn py-2.5 text-sm font-bold transition",
              tab === "novo" ? "bg-ds-primary text-white shadow-ds" : "text-ds-muted hover:text-ds-text",
            )}
          >
            <UserPlus className="size-4" aria-hidden />
            Sou novo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "entrar"}
            onClick={() => setTab("entrar")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-ds-btn py-2.5 text-sm font-bold transition",
              tab === "entrar" ? "bg-ds-primary text-white shadow-ds" : "text-ds-muted hover:text-ds-text",
            )}
          >
            <LogIn className="size-4" aria-hidden />
            Já tenho conta
          </button>
        </div>

        <div className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
          {tab === "novo" ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">
                  Passo {wizardStep} de 3
                </p>
                <div className="flex gap-1">
                  {[1, 2, 3].map((s) => (
                    <span
                      key={s}
                      className={cn(
                        "size-2 rounded-full",
                        wizardStep >= s ? "bg-ds-primary" : "bg-ds-border",
                      )}
                    />
                  ))}
                </div>
              </div>

              {wizardStep === 1 ? (
                <div className="space-y-4">
                  <h2 className="text-base font-bold text-ds-text">Dados da conta e endereço</h2>
                  <label className="block text-sm font-semibold text-ds-muted">
                    Nome da conta ou empresa
                    <input
                      className={cn(inputClass, "mt-1")}
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      autoComplete="organization"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-ds-muted">
                    Email
                    <input className={cn(inputClass, "mt-1")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </label>
                  <label className="block text-sm font-semibold text-ds-muted">
                    Telefone de contato
                    <input
                      className={cn(inputClass, "mt-1")}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      inputMode="tel"
                      placeholder="+55, +351, +1…"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-ds-muted">
                    Morada — linha 1 (rua, número, andar)
                    <input
                      className={cn(inputClass, "mt-1")}
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      autoComplete="address-line1"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-ds-muted">
                    Linha 2 (opcional — apartamento, bloco, referência)
                    <input
                      className={cn(inputClass, "mt-1")}
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      autoComplete="address-line2"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-ds-muted">
                      Cidade ou localidade
                      <input
                        className={cn(inputClass, "mt-1")}
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        autoComplete="address-level2"
                      />
                    </label>
                    <label className="block text-sm font-semibold text-ds-muted">
                      País
                      <input
                        className={cn(inputClass, "mt-1")}
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        autoComplete="country-name"
                        placeholder="Brasil, Portugal, United States…"
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-ds-muted">
                      Estado / província / região (opcional se o CEP for suficiente)
                      <input
                        className={cn(inputClass, "mt-1")}
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        autoComplete="address-level1"
                        placeholder="SP, Lisboa, Ontario…"
                      />
                    </label>
                    <label className="block text-sm font-semibold text-ds-muted">
                      Código postal (CEP, ZIP, código local…)
                      <input
                        className={cn(inputClass, "mt-1")}
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        autoComplete="postal-code"
                        placeholder="01310-100, 1000-001, SW1A 1AA…"
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-ds-muted">
                      Senha do portal (mín. 8 caracteres)
                      <input
                        className={cn(inputClass, "mt-1")}
                        type="password"
                        value={senhaRegisto}
                        onChange={(e) => setSenhaRegisto(e.target.value)}
                        autoComplete="new-password"
                      />
                    </label>
                    <label className="block text-sm font-semibold text-ds-muted">
                      Confirmar senha
                      <input
                        className={cn(inputClass, "mt-1")}
                        type="password"
                        value={senhaRegistoConfirm}
                        onChange={(e) => setSenhaRegistoConfirm(e.target.value)}
                        autoComplete="new-password"
                      />
                    </label>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const err = validateStep1();
                        if (err) toast.error(err);
                        else setWizardStep(2);
                      }}
                      className="rounded-ds-btn bg-ds-primary px-4 py-2.5 text-sm font-bold text-white shadow-ds"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              ) : null}

              {wizardStep === 2 ? (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-ds-muted hover:text-ds-primary"
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    Voltar
                  </button>
                  <h2 className="text-base font-bold text-ds-text">Documentos (primeiro acesso)</h2>
                  <p className="text-sm text-ds-muted">
                    A nossa equipe analisa comprovante de endereço e identificação em <strong>até 5 horas úteis</strong>{" "}
                    (meta operacional — demo). Formatos: PDF, PNG ou JPEG. Tamanho máximo ~{Math.round(MAX_KYC_BYTES / 1024)}{" "}
                    KB cada.
                  </p>
                  <div className="rounded-ds-btn border border-ds-border bg-ds-bg p-4">
                    <p className="text-sm font-semibold text-ds-text">Comprovante de endereço</p>
                    <p className="mt-1 text-xs text-ds-muted">Conta de serviços, contrato de aluguel ou extrato com o endereço visível.</p>
                    <input ref={proofInput} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={onPickProof} />
                    <button
                      type="button"
                      onClick={() => proofInput.current?.click()}
                      className="mt-2 rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm font-semibold text-ds-text shadow-ds"
                    >
                      Escolher arquivo
                    </button>
                    {proofLabel ? <p className="mt-2 text-xs font-medium text-ds-text">{proofLabel}</p> : null}
                  </div>
                  <div className="rounded-ds-btn border border-ds-border bg-ds-bg p-4">
                    <p className="text-sm font-semibold text-ds-text">Documento com foto</p>
                    <p className="mt-1 text-xs text-ds-muted">RG, carta de condução (driver license) ou passaporte — legível.</p>
                    <input ref={idInput} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={onPickId} />
                    <button
                      type="button"
                      onClick={() => idInput.current?.click()}
                      className="mt-2 rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm font-semibold text-ds-text shadow-ds"
                    >
                      Escolher arquivo
                    </button>
                    {idLabel ? <p className="mt-2 text-xs font-medium text-ds-text">{idLabel}</p> : null}
                  </div>
                  <div className="flex justify-between gap-2">
                    <button type="button" onClick={() => setWizardStep(1)} className="rounded-ds-btn border border-ds-border px-4 py-2 text-sm font-semibold">
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const err = validateStep2();
                        if (err) toast.error(err);
                        else setWizardStep(3);
                      }}
                      className="rounded-ds-btn bg-ds-primary px-4 py-2 text-sm font-bold text-white shadow-ds"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              ) : null}

              {wizardStep === 3 ? (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-ds-muted hover:text-ds-primary"
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    Voltar
                  </button>
                  <h2 className="text-base font-bold text-ds-text">Perfil operacional (quiz rápido)</h2>
                  <label className="block text-sm font-semibold text-ds-muted">
                    Que tipo de produtos planeia enviar?
                    <textarea
                      className={cn(inputClass, "mt-1 min-h-[88px] resize-y")}
                      value={productCategories}
                      onChange={(e) => setProductCategories(e.target.value)}
                      placeholder="Ex.: suplementos, cosméticos, eletrónica de consumo…"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-ds-muted">
                    Volume mensal aproximado
                    <select className={cn(inputClass, "mt-1")} value={monthlyVolumeBand} onChange={(e) => setMonthlyVolumeBand(e.target.value)}>
                      {MONTHLY_BANDS.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset>
                    <legend className="text-sm font-semibold text-ds-muted">Fornecedores</legend>
                    <div className="mt-2 flex flex-col gap-2 text-sm">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="radio" name="sup" checked={supplierRegion === "usa"} onChange={() => setSupplierRegion("usa")} />
                        Dentro dos EUA
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="radio" name="sup" checked={supplierRegion === "international"} onChange={() => setSupplierRegion("international")} />
                        Importação / fora dos EUA
                      </label>
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="text-sm font-semibold text-ds-muted">Modelo de negócio</legend>
                    <div className="mt-2 flex flex-col gap-2 text-sm">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="radio" name="bm" checked={businessModel === "dropshipping"} onChange={() => setBusinessModel("dropshipping")} />
                        Dropshipping
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="radio" name="bm" checked={businessModel === "online_arbitrage"} onChange={() => setBusinessModel("online_arbitrage")} />
                        Online arbitrage
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="radio" name="bm" checked={businessModel === "private_label"} onChange={() => setBusinessModel("private_label")} />
                        Marca própria / private label
                      </label>
                    </div>
                  </fieldset>
                  <div className="flex justify-between gap-2 pt-2">
                    <button type="button" onClick={() => setWizardStep(2)} className="rounded-ds-btn border border-ds-border px-4 py-2 text-sm font-semibold">
                      Voltar
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onRegistar()}
                      className="inline-flex items-center justify-center gap-2 rounded-ds-btn bg-ds-primary px-4 py-3 text-sm font-bold text-white shadow-ds disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                      Criar conta e receber suite
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-ds-muted">
                E-mail
                <input
                  className={cn(inputClass, "mt-1")}
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="O mesmo e-mail do registo"
                />
              </label>
              <label className="block text-sm font-semibold text-ds-muted">
                Senha
                <input
                  className={cn(inputClass, "mt-1")}
                  type="password"
                  value={senhaEntrar}
                  onChange={(e) => setSenhaEntrar(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Senha do portal"
                />
              </label>
              <p className="text-xs text-ds-muted">
                A sessão fica neste navegador. Após <strong>reset demo</strong> no admin, use o <strong>e-mail</strong> e a{" "}
                <strong>senha</strong> do aviso (ex.: <code className="rounded bg-ds-bg px-1">10001@demo.dbx</code> e{" "}
                <code className="rounded bg-ds-bg px-1">demo1234</code>). A sua <strong>suite</strong> continua visível no painel depois de entrar.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onEntrar()}
                className="flex w-full items-center justify-center gap-2 rounded-ds-btn bg-ds-primary px-4 py-3 text-sm font-bold text-white shadow-ds disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Entrar
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-ds-muted">
          <Link to="/" className="font-semibold text-ds-primary hover:underline">
            Voltar à página inicial
          </Link>
          <span className="mx-2">·</span>
          <Link to="/admin" className="font-semibold text-ds-primary hover:underline">
            Consola interna (admin)
          </Link>
        </p>
      </div>
    </div>
  );
}
