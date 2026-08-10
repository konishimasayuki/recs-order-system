import { redirect } from "next/navigation";

/** アカウント管理は設定タブに統合した。旧URLからは転送する */
export default function AdminAccountsPage() {
  redirect("/admin/settings");
}
