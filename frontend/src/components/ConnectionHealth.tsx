"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/api";

type Health = { ambassador_id: number; full_name: string; status: string; message: string;
  expires_at: string | null; days_remaining: number | null; needs_attention: boolean };
type HealthPage = { connections: Health[]; total: number; page_size: number };

export default function ConnectionHealth({ admin = false }: { admin?: boolean }) {
  const [own, setOwn] = useState<Health | null>(null);
  const [list, setList] = useState<HealthPage | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let running = false;
    const controller = new AbortController();
    async function load() {
      if (running || document.hidden) return;
      running = true;
      try {
        const r = await authFetch(`http://127.0.0.1:8000/${admin ? "admin" : "ambassador"}/connections/health${admin ? `?page=${page}` : ""}`, { signal: controller.signal });
        const result = await r.json();
        if (!r.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Could not check connection expiry.");
        if (active) {
          if (admin) {
            if (page > Math.max(1,Math.ceil(result.total/result.page_size))) { setPage(1); return; }
            setList(result);
          } else setOwn(result);
          setError("");
        }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Could not check connection expiry."); }
      finally { running = false; }
    }
    void load();
    const timer = window.setInterval(() => void load(),60000);
    const focus = () => void load();
    window.addEventListener("focus",focus);
    return () => { active = false; controller.abort(); clearInterval(timer); window.removeEventListener("focus",focus); };
  }, [admin,page]);
  const expiry = (value: string | null) => value ? new Date(value).toLocaleString() : "Not recorded";
  return <section className={`my-6 rounded-2xl border p-6 text-[#202629] ${own?.needs_attention ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"}`}>
    <h2 className="text-xl font-bold">{admin ? "Connection expiry warnings" : "Instagram connection expiry"}</h2>
    {error && <p role="status" className="mt-3 text-sm text-red-800">{error}</p>}
    {!own && !list && !error && <p className="mt-3 text-sm text-gray-600">Checking saved connection details...</p>}
    {own && <div className="mt-3 text-sm"><p className={own.needs_attention ? "font-semibold text-amber-900" : "text-gray-700"}>{own.message}</p>
      {own.expires_at && <p className="mt-2 text-gray-700">Access expiry: {expiry(own.expires_at)}</p>}
      {(own.needs_attention || own.status === "NOT_CONNECTED") && <Link href="/ambassador/social-accounts" className="mt-3 inline-block font-semibold text-[#238C89] underline">Open Instagram to {own.status === "NOT_CONNECTED" ? "connect" : "reconnect"} →</Link>}
    </div>}
    {list && <><p className="mt-2 text-sm text-gray-700">Connections expiring within 7 days, expired connections and accounts needing renewal. This list reads saved metadata; it does not change authorization.</p>
      <div className="mt-4 divide-y">{list.connections.map(row => <article key={row.ambassador_id} className="py-4 text-sm"><Link href={`/admin/ambassadors/${row.ambassador_id}`} className="font-semibold text-[#6855B5] underline">{row.full_name}</Link><p className="mt-1 text-amber-900">{row.message}</p>{row.expires_at && <p className="mt-1 text-gray-600">Access expiry: {expiry(row.expires_at)}</p>}</article>)}
        {!list.total && <p className="py-3 text-sm text-gray-600">No connected accounts currently need an expiry warning.</p>}
      </div>
      {list.total > list.page_size && <nav aria-label="Connection warning pages" className="mt-4 flex items-center gap-4 text-sm"><button disabled={page===1} onClick={() => setPage(p => p-1)} className="rounded-lg border px-3 py-2 disabled:opacity-50">Previous</button><span>Page {page} of {Math.ceil(list.total/list.page_size)}</span><button disabled={page*list.page_size>=list.total} onClick={() => setPage(p => p+1)} className="rounded-lg border px-3 py-2 disabled:opacity-50">Next</button></nav>}
    </>}
  </section>;
}
