import type { Colecao } from "./types";

async function tratar<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let msg = `Erro ${r.status}`;
    try {
      msg = (await r.json()).erro ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}

const json = { "Content-Type": "application/json" };

export const api = {
  listar: <T>(c: Colecao) => fetch(`/api/${c}`, { cache: "no-store" }).then((r) => tratar<T[]>(r)),
  criar: <T>(c: Colecao, corpo: unknown) =>
    fetch(`/api/${c}`, { method: "POST", headers: json, body: JSON.stringify(corpo) }).then((r) =>
      tratar<T>(r),
    ),
  atualizar: <T>(c: Colecao, id: string, corpo: unknown) =>
    fetch(`/api/${c}/${id}`, { method: "PUT", headers: json, body: JSON.stringify(corpo) }).then(
      (r) => tratar<T>(r),
    ),
  remover: (c: Colecao, id: string) =>
    fetch(`/api/${c}/${id}`, { method: "DELETE" }).then((r) => tratar<void>(r)),
  perfil: <T>() => fetch(`/api/perfil`, { cache: "no-store" }).then((r) => tratar<T>(r)),
  salvarPerfil: <T>(corpo: unknown) =>
    fetch(`/api/perfil`, { method: "PUT", headers: json, body: JSON.stringify(corpo) }).then((r) =>
      tratar<T>(r),
    ),
};

export function formatarData(iso: string) {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

export function formatarMes(v: string) {
  if (!v) return "";
  const [a, m] = v.split("-");
  return m && a ? `${m}/${a}` : v;
}

export function hojeISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function novoId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Abre só links http(s). */
export function ehLinkSeguro(v: string) {
  return /^https?:\/\//i.test(v);
}
