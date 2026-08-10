import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  empty: "IDとパスワードを入力してください。",
  invalid: "IDまたはパスワードが正しくありません。"
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/orders");

  const message = searchParams.error ? MESSAGES[searchParams.error] : null;

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-head">
          <p className="brand-eyebrow">RECSGPS ORDER SYSTEM</p>
          <h1 className="brand-title" style={{ marginBottom: 0 }}>
            ログイン
          </h1>
        </div>

        <div className="login-body">
          {message && <div className="error-box">{message}</div>}

          <form action={loginAction}>
            <div className="field">
              <label htmlFor="loginId">ID</label>
              <input
                id="loginId"
                name="loginId"
                type="text"
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">パスワード</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="submit-btn">
              ログイン
            </button>
          </form>

          <p className="login-foot">
            RECSGPS（リモート始動阻止装置／GPS装置）受発注システム
            <br />
            MIAMIホールディングス株式会社
          </p>
        </div>
      </div>
    </div>
  );
}
