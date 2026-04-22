import { useCallback, useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import type { ShippingLabelFile } from "../../types";
import { useClientProfile } from "../../context/ClientProfileContext";
import { loadAddedClientOrders, updateClientOrder } from "../../lib/clientOrdersStorage";
import { cn } from "../../lib/cn";
import { FbaPrepPlanMissingNote, FbaPrepPlanPanel } from "../../ui/FbaPrepPlanPanel";

const MAX_BYTES = Math.floor(1.35 * 1024 * 1024);
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,.pdf";

function readOneFile(file: File): Promise<ShippingLabelFile> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_BYTES) {
      reject(new Error("BIG"));
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      const u = r.result;
      if (typeof u !== "string") reject(new Error("READ"));
      else resolve({ name: file.name, dataUrl: u });
    };
    r.onerror = () => reject(new Error("READ"));
    r.readAsDataURL(file);
  });
}

export function ClientFbaMasterLabelsPage() {
  const { profile } = useClientProfile();
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const uid = useId();
  const [amazon, setAmazon] = useState<ShippingLabelFile | null>(null);
  const [carrier, setCarrier] = useState<ShippingLabelFile | null>(null);

  const order = useMemo(() => {
    if (!orderId) return undefined;
    return loadAddedClientOrders().find((o) => o.id === orderId);
  }, [orderId]);

  useEffect(() => {
    if (!order || order.service !== "FBA") return;
    setAmazon(order.fbaAmazonBoxLabel ?? null);
    setCarrier(order.fbaCarrierLabel ?? null);
  }, [order]);

  useEffect(() => {
    if (!orderId || !order) return;
    if (order.service !== "FBA") {
      toast.error("Este fluxo é só para pedidos FBA.");
      navigate("/app/pedidos", { replace: true });
    }
  }, [order, orderId, navigate]);

  const onAmazon = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setAmazon(await readOneFile(file));
    } catch {
      toast.error("Arquivo inválido ou muito grande (máx. ~1,3 MB).");
    }
  }, []);

  const onCarrier = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setCarrier(await readOneFile(file));
    } catch {
      toast.error("Arquivo inválido ou muito grande (máx. ~1,3 MB).");
    }
  }, []);

  const submit = () => {
    void (async () => {
      if (!orderId || !order) return;
      if (!amazon || !carrier) {
        toast.error("Carrega as duas etiquetas: Amazon (caixa) e transportadora (UPS/FedEx).");
        return;
      }
      const ok = await updateClientOrder(
        orderId,
        {
          fbaAmazonBoxLabel: amazon,
          fbaCarrierLabel: carrier,
        },
        { role: "client", suite: profile.suite },
      );
      if (!ok) {
        toast.error("Não foi possível salvar. Tente arquivos menores.");
        return;
      }
      toast.success("Etiquetas da caixa master guardadas.", {
        description: "O prep pode prosseguir com colagem e coleta.",
      });
      navigate("/app/pedidos");
    })();
  };

  if (!orderId) {
    return null;
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
        <p className="text-sm text-ds-muted">Pedido não encontrado.</p>
        <Link to="/app/pedidos" className="font-semibold text-ds-primary underline">
          Voltar aos pedidos
        </Link>
      </div>
    );
  }

  const inputClass =
    "mt-2 block w-full max-w-md text-sm text-ds-text file:mr-3 file:rounded-ds-btn file:border file:border-ds-border file:bg-ds-bg file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ds-text hover:file:border-ds-primary/30";

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <Link
        to="/app/pedidos"
        className="inline-flex items-center gap-1 text-sm font-semibold text-ds-muted transition hover:text-ds-primary"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Voltar aos pedidos
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ds-text">Etiquetas da caixa master — FBA</h1>
        <p className="mt-1 text-sm text-ds-muted">
          Pedido <strong className="text-ds-text">{order.id}</strong>. Depois de criar o envio no Seller Central com as
          medidas que o prep enviou, carrega aqui as <strong className="text-ds-text">duas</strong> etiquetas que vão na
          caixa master.
        </p>
      </div>

      <div className="space-y-2">
        <FbaPrepPlanPanel order={order} variant="client" />
        <FbaPrepPlanMissingNote order={order} />
      </div>

      <div className="space-y-5 rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <div>
          <label className="text-xs font-semibold text-ds-muted" htmlFor={`${uid}-amz`}>
            1. Etiqueta Amazon (Box Labels)
          </label>
          <input id={`${uid}-amz`} type="file" accept={ACCEPT} onChange={onAmazon} className={inputClass} />
          {amazon ? (
            <p className="mt-1 text-xs font-medium text-ds-primary">
              ✓ {amazon.name}{" "}
              <a href={amazon.dataUrl} target="_blank" rel="noopener noreferrer" className="text-ds-text underline">
                pré-visualizar
              </a>
            </p>
          ) : null}
        </div>
        <div>
          <label className="text-xs font-semibold text-ds-muted" htmlFor={`${uid}-carr`}>
            2. Etiqueta transportadora (UPS / FedEx)
          </label>
          <input id={`${uid}-carr`} type="file" accept={ACCEPT} onChange={onCarrier} className={inputClass} />
          {carrier ? (
            <p className="mt-1 text-xs font-medium text-ds-primary">
              ✓ {carrier.name}{" "}
              <a href={carrier.dataUrl} target="_blank" rel="noopener noreferrer" className="text-ds-text underline">
                pré-visualizar
              </a>
            </p>
          ) : null}
        </div>

        <p className="rounded-ds-btn border border-ds-soft-amber-border bg-ds-soft-amber p-3 text-xs text-ds-soft-amber-icon">
          O sistema <strong className="text-ds-text">não guarda</strong> até teres <strong className="text-ds-text">as duas</strong>{" "}
          etiquetas — evita envios incompletos para o prep.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={submit}
            className={cn(
              "rounded-ds-btn bg-cta-gradient px-5 py-2.5 text-sm font-bold text-white shadow-ds focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary",
              (!amazon || !carrier) && "opacity-60",
            )}
          >
            Guardar etiquetas da caixa
          </button>
          <Link
            to="/app/guia-envio-fba"
            className="rounded-ds-btn border border-ds-border bg-ds-bg px-4 py-2.5 text-sm font-semibold text-ds-text"
          >
            Ver guia FBA
          </Link>
        </div>
      </div>
    </div>
  );
}
