import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { PRODUCT_NAME, User } from "@/lib/types";

/**
 * 発注側はタブを出さず、ダッシュボードを起点に各画面へ進む。
 * 新規注文・注文履歴・納品履歴へは /orders のボタンから移動できる。
 */
const CUSTOMER_NAV: { href: string; label: string }[] = [];

const ADMIN_NAV = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/orders", label: "受注一覧" },
  { href: "/admin/deliveries", label: "納品一覧" },
  { href: "/admin/accounts", label: "アカウント" },
  { href: "/admin/settings", label: "請求元設定" }
];

export default function AppHeader({
  user,
  current
}: {
  user: User;
  current: string;
}) {
  const nav = user.role === "admin" ? ADMIN_NAV : CUSTOMER_NAV;

  return (
    <div className="brand-bar">
      <div className="container">
        <div className="brand-bar-inner">
          <div>
            <p className="brand-eyebrow">
              {user.role === "admin" ? "ORDER MANAGEMENT" : "ORDER PORTAL"}
            </p>
            <h1 className="brand-title">RECSGPS 注文システム</h1>
            <p className="brand-sub">{PRODUCT_NAME}</p>
          </div>
          <div className="brand-account">
            <strong>{user.companyName}</strong>
            {user.role === "admin" ? "受注管理者" : "発注アカウント"}（{user.loginId}）
            <form action={logoutAction}>
              <button type="submit" className="logout-link">
                ログアウト
              </button>
            </form>
          </div>
        </div>

        {nav.length > 0 && (
          <nav className="nav-tabs">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={item.href === current ? "active" : ""}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
