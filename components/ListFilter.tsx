"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export interface FilterFieldDef {
  /** URLクエリのキー */
  name: string;
  label: string;
  /** 現在値。"all" は未適用を表す */
  value: string;
  options: { value: string; label: string }[];
}

/**
 * 一覧カード共通の絞り込み。
 * カード見出しの右に「絞り込み」ボタンを置き、押すと条件が開く。
 * 条件はプルダウンを選んだ瞬間に適用され、URLのクエリに保存される。
 * 絞り込み中はボタンに件数バッジを出し、条件も開いた状態で表示する。
 */
export default function ListFilter({ fields }: { fields: FilterFieldDef[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const activeCount = fields.filter((f) => f.value !== "all").length;
  const [open, setOpen] = useState(activeCount > 0);

  function apply(name: string, value: string) {
    const params = new URLSearchParams();
    for (const f of fields) {
      const v = f.name === name ? value : f.value;
      if (v !== "all") params.set(f.name, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <>
      <button
        type="button"
        className={`filter-toggle${activeCount > 0 ? " active" : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        絞り込み
        {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="filter-bar" style={isPending ? { opacity: 0.6 } : undefined}>
          {fields.map((f) => (
            <div className="filter-field" key={f.name}>
              <label htmlFor={`filter-${f.name}`}>{f.label}</label>
              <select
                id={`filter-${f.name}`}
                value={f.value}
                onChange={(e) => apply(f.name, e.target.value)}
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {activeCount > 0 && (
            <div className="filter-actions">
              <Link href={pathname} className="link">
                解除
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
