import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import ListFilter from "@/components/ListFilter";
import Pagination, { clampPage } from "@/components/Pagination";
import { requireUser } from "@/lib/auth";
import { parseMulti } from "@/lib/filters";
import { invoicesOf } from "@/lib/queries";
import { readState } from "@/lib/store";
import { calcInvoiceAmounts, formatDate, yen } from "@/lib/types";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

export default async function AdminInvoicesPage({
  searchParams
}: {
  searchParams: { company?: string; page?: string; ok?: string; no?: string };
}) {
  const user = await requireUser("admin");
  const state = await readState();
  const customers = state.users.filter((u) => u.role === "customer");

  const companySelected = parseMulti(
    searchParams.company,
    customers.map((c) => c.id)
  );
  const all = invoicesOf(state);
  const invoices =
    companySelected.length === 0
      ? all
      : all.filter((inv) => companySelected.includes(inv.userId));

  const page = clampPage(searchParams.page, invoices.length, PER_PAGE);
  const pageInvoices = invoices.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalAmount = invoices.reduce(
    (s, inv) => s + calcInvoiceAmounts(inv).totalAmount,
    0
  );

  return (
    <div className="page-shell">
      <AppHeader user={user} current="/admin/invoices" />

      <div className="container">
        {searchParams.ok === "issued" && (
          <div className="success-box">
            請求書{searchParams.no ? ` ${searchParams.no}` : ""}を発行しました。
          </div>
        )}

        <div className="card">
          <div className="card-head">
            <div className="card-head-text">
              <h2 className="card-title">請求書</h2>
              <p className="card-desc">
                表示中 {invoices.length} 件／{yen(totalAmount)}
              </p>
            </div>
            <Link href="/admin/invoices/new" className="btn btn-gold btn-sm">
              まとめて請求する
            </Link>
          </div>

          <ListFilter
            fields={[
              {
                name: "company",
                label: "発注元",
                values: companySelected,
                columns: 2,
                options: customers.map((c) => ({
                  value: c.id,
                  label: c.companyName
                }))
              }
            ]}
          />

          {invoices.length === 0 ? (
            <div className="empty-state">まだ請求書はありません。</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table pair-cards">
                <thead>
                  <tr>
                    <th>請求書番号</th>
                    <th>発行日</th>
                    <th>発注元</th>
                    <th className="num">台数</th>
                    <th className="num">金額（税込）</th>
                    <th>対象の注文</th>
                  </tr>
                </thead>
                <tbody>
                  {pageInvoices.map((inv) => {
                    const amounts = calcInvoiceAmounts(inv);
                    return (
                      <tr key={inv.id}>
                        <td className="mono" data-label="請求書番号">
                          <a
                            className="link"
                            href={`/api/invoice/${inv.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {inv.invoiceNumber}
                          </a>
                        </td>
                        <td className="mono" data-label="発行日">
                          {formatDate(inv.issuedAt)}
                        </td>
                        <td data-label="発注元">{inv.companyName}</td>
                        <td className="num" data-label="台数">
                          {amounts.quantity} 台
                        </td>
                        <td className="num" data-label="金額（税込）">
                          {yen(amounts.totalAmount)}
                        </td>
                        <td className="mono span-2" data-label="対象の注文">
                          {inv.lines
                            .map((l) => `${l.orderNumber}（${l.quantity}台）`)
                            .join(" / ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            total={invoices.length}
            page={page}
            perPage={PER_PAGE}
            basePath="/admin/invoices"
            params={{ company: companySelected.join(",") }}
          />
        </div>
      </div>
    </div>
  );
}
