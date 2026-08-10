"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * 受注一覧の絞り込み。選んだ瞬間に適用され、「絞り込む」ボタンを押す
 * 手間をなくす。状態はURLのクエリに持つため、リロードや共有でも保たれる。
 */
export default function OrdersFilter({
  statusOptions,
  companyOptions,
  status,
  company
}: {
  statusOptions: FilterOption[];
  companyOptions: FilterOption[];
  status: string;
  company: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isFiltered = status !== "all" || company !== "all";

  function apply(nextStatus: string, nextCompany: string) {
    const params = new URLSearchParams();
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextCompany !== "all") params.set("company", nextCompany);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/admin/orders?${qs}` : "/admin/orders");
    });
  }

  return (
    <div className="filter-bar" style={isPending ? { opacity: 0.6 } : undefined}>
      <div className="filter-field">
        <label htmlFor="filter-status">状況</label>
        <select
          id="filter-status"
          value={status}
          onChange={(e) => apply(e.target.value, company)}
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor="filter-company">発注元</label>
        <select
          id="filter-company"
          value={company}
          onChange={(e) => apply(status, e.target.value)}
        >
          {companyOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {isFiltered && (
        <div className="filter-actions">
          <Link href="/admin/orders" className="link">
            解除
          </Link>
        </div>
      )}
    </div>
  );
}
