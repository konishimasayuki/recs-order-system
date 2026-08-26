"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  getCurrentUser,
  requireUser,
  setSessionCookie
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { mutateState, newId, nextInvoiceNumber, nextOrderNumber, readState } from "@/lib/store";
import { Delivery, Order, User, deliveredQuantity } from "@/lib/types";
import { notifyNewOrder, sendTestMail } from "@/lib/mail";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function int(fd: FormData, key: string): number {
  const n = Number(str(fd, key));
  return Number.isFinite(n) ? Math.floor(n) : NaN;
}

// ---------------- 認証 ----------------

export async function loginAction(formData: FormData) {
  const loginId = str(formData, "loginId");
  const password = String(formData.get("password") ?? "");

  if (!loginId || !password) {
    redirect("/login?error=empty");
  }

  const state = await readState();
  const user = state.users.find(
    (u) => u.loginId.toLowerCase() === loginId.toLowerCase() && u.active
  );

  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=invalid");
  }

  setSessionCookie(user.id);
  redirect(user.role === "admin" ? "/admin" : "/orders");
}

export async function logoutAction() {
  clearSessionCookie();
  redirect("/login");
}

// ---------------- 発注側 ----------------

export async function createOrderAction(formData: FormData) {
  const user = await requireUser("customer");

  const quantity = int(formData, "quantity");
  const shippingAddress = str(formData, "shippingAddress");
  const contactName = str(formData, "contactName");
  const email = str(formData, "email");
  const desiredDeliveryDate = str(formData, "desiredDeliveryDate");
  const note = str(formData, "note");

  if (!Number.isFinite(quantity) || quantity < 1) {
    redirect("/orders/new?error=quantity");
  }
  if (!shippingAddress) {
    redirect("/orders/new?error=address");
  }

  const order = await mutateState<Order>((state) => {
    const created: Order = {
      id: newId("o"),
      orderNumber: nextOrderNumber(state),
      userId: user.id,
      companyName: user.companyName,
      contactName: contactName || user.contactName,
      email: email || user.email,
      quantity,
      unitPrice: user.defaultUnitPrice,
      shippingAddress,
      note,
      // 受注側が受け付けるまでは ordered（発注側の表示は「発注済」）
      status: "ordered",
      orderedAt: new Date().toISOString(),
      invoiceNumber: null,
      invoicedAt: null,
      desiredDeliveryDate
    };
    state.orders.push(created);
    return created;
  });

  await notifyNewOrder(order);

  revalidatePath("/orders");
  revalidatePath("/admin");
  redirect(`/orders/${order.id}?ok=created`);
}

export async function cancelOrderAction(formData: FormData) {
  const user = await requireUser();
  const orderId = str(formData, "orderId");

  await mutateState((state) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;
    const isOwner = order.userId === user.id;
    if (user.role !== "admin" && !isOwner) return;
    // 発注側は受付前・受付済のうちのみ取消可能。受注側はいつでも可能。
    if (user.role !== "admin" && order.status !== "ordered" && order.status !== "pending") {
      return;
    }
    if (deliveredQuantity(order.id, state.deliveries) > 0) return;
    order.status = "cancelled";
  });

  revalidatePath("/orders");
  revalidatePath("/admin");
  redirect(user.role === "admin" ? `/admin/orders/${orderId}?ok=cancelled` : `/orders/${orderId}?ok=cancelled`);
}

// ---------------- 受注側：受付 ----------------

/**
 * 発注を受け付けて「受付済」にする。受注側の一覧・詳細で
 * 「受付待」のときだけ押せる。
 */
export async function acceptOrderAction(formData: FormData) {
  await requireUser("admin");
  const orderId = str(formData, "orderId");
  const returnTo = str(formData, "returnTo");

  await mutateState((state) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order || order.status !== "ordered") return;
    order.status = "pending";
  });

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/orders");

  // 戻り先には必ず ok を付ける。同じURLに戻すとクライアント側のキャッシュで
  // 更新前の一覧が表示されてしまうため
  if (returnTo && returnTo.startsWith("/admin")) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}ok=accepted`);
  }
  redirect(`/admin/orders/${orderId}?ok=accepted`);
}

// ---------------- 受注側：単価・請求書 ----------------

export async function updateUnitPriceAction(formData: FormData) {
  await requireUser("admin");
  const orderId = str(formData, "orderId");
  const raw = str(formData, "unitPrice");
  const unitPrice = Number(raw);

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    redirect(`/admin/orders/${orderId}?error=price`);
  }

  await mutateState((state) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;
    order.unitPrice = Math.round(unitPrice);
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
  redirect(`/admin/orders/${orderId}?ok=price`);
}

export async function issueInvoiceAction(formData: FormData) {
  await requireUser("admin");
  const orderId = str(formData, "orderId");

  const result = await mutateState<"ok" | "noprice" | "notfound">((state) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return "notfound";
    if (order.unitPrice === null) {
      // 単価が未保存でも発注元に標準単価があればそれを適用して発行する。
      // 詳細画面は標準単価をそのまま表示しており、保存操作を挟ませない
      const customer = state.users.find((u) => u.id === order.userId);
      if (customer?.defaultUnitPrice != null) {
        order.unitPrice = customer.defaultUnitPrice;
      } else {
        return "noprice";
      }
    }
    if (!order.invoiceNumber) {
      order.invoiceNumber = nextInvoiceNumber(state);
      order.invoicedAt = new Date().toISOString();
    }
    // 請求書を出す時点で受付済とみなす
    if (order.status === "ordered" || order.status === "pending") {
      order.status = "invoiced";
    }
    return "ok";
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
  redirect(
    result === "ok"
      ? `/admin/orders/${orderId}?ok=invoiced`
      : `/admin/orders/${orderId}?error=${result}`
  );
}

// ---------------- 受注側：納品 ----------------

export async function registerDeliveryAction(formData: FormData) {
  await requireUser("admin");
  const orderId = str(formData, "orderId");
  const quantity = int(formData, "quantity");
  const deliveredAt = str(formData, "deliveredAt");
  const trackingNumber = str(formData, "trackingNumber");
  const note = str(formData, "note");

  /**
   * ダッシュボードの「対応中の受注」からも登録できるようにする。
   * その場合は注文詳細ではなくダッシュボードへ戻し、失敗時は
   * 入力中だった発注元の登録欄を開いたままにする。
   */
  const companyId = str(formData, "companyId");
  const backToDashboard = str(formData, "returnTo") === "dashboard";
  const failureUrl = (reason: string) =>
    backToDashboard
      ? `/admin?error=${reason}&deliver=${companyId}`
      : `/admin/orders/${orderId}?error=${reason}`;

  if (!orderId) {
    redirect(failureUrl("orderTarget"));
  }
  if (!Number.isFinite(quantity) || quantity < 1) {
    redirect(failureUrl("deliveryQuantity"));
  }

  const result = await mutateState<"ok" | "over" | "notfound">((state) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return "notfound";
    const already = deliveredQuantity(order.id, state.deliveries);
    if (already + quantity > order.quantity) return "over";

    const delivery: Delivery = {
      id: newId("d"),
      orderId: order.id,
      quantity,
      deliveredAt: deliveredAt || new Date().toISOString().slice(0, 10),
      trackingNumber,
      note,
      createdAt: new Date().toISOString()
    };
    state.deliveries.push(delivery);

    if (already + quantity >= order.quantity) {
      order.status = "delivered";
    } else if (order.status === "ordered" || order.status === "pending") {
      // 納品に着手した時点で受付前のままにはしない
      order.status = order.invoiceNumber ? "invoiced" : "pending";
    }
    return "ok";
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/deliveries");
  revalidatePath("/admin");
  if (result !== "ok") {
    redirect(failureUrl(result));
  }
  redirect(
    backToDashboard ? "/admin?ok=delivered" : `/admin/orders/${orderId}?ok=delivered`
  );
}

export async function deleteDeliveryAction(formData: FormData) {
  await requireUser("admin");
  const deliveryId = str(formData, "deliveryId");
  const orderId = str(formData, "orderId");

  await mutateState((state) => {
    const idx = state.deliveries.findIndex((d) => d.id === deliveryId);
    if (idx < 0) return;
    state.deliveries.splice(idx, 1);

    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;
    const remaining = deliveredQuantity(order.id, state.deliveries);
    if (remaining < order.quantity && order.status === "delivered") {
      order.status = order.invoiceNumber ? "invoiced" : "pending";
    }
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/deliveries");
  redirect(`/admin/orders/${orderId}?ok=deliveryRemoved`);
}

// ---------------- 受注側：請求元設定 ----------------

export async function updateSellerAction(formData: FormData) {
  await requireUser("admin");

  await mutateState((state) => {
    state.seller = {
      name: str(formData, "name") || state.seller.name,
      postalCode: str(formData, "postalCode"),
      address: str(formData, "address"),
      tel: str(formData, "tel"),
      fax: str(formData, "fax"),
      contact: str(formData, "contact"),
      registrationNumber: str(formData, "registrationNumber"),
      bankName: str(formData, "bankName"),
      branchName: str(formData, "branchName"),
      accountType: str(formData, "accountType") || "普通",
      accountNumber: str(formData, "accountNumber"),
      accountHolder: str(formData, "accountHolder"),
      invoiceNotice: str(formData, "invoiceNotice"),
      paymentTerms: str(formData, "paymentTerms")
    };
  });

  revalidatePath("/admin/settings");
  redirect("/admin/settings?tab=seller&ok=saved");
}

export async function sendTestMailAction() {
  await requireUser("admin");
  const error = await sendTestMail();
  redirect(
    error
      ? `/admin/settings?tab=seller&mailtest=${encodeURIComponent(error)}`
      : "/admin/settings?tab=seller&mailtest=ok"
  );
}

// ---------------- 受注側：アカウント管理 ----------------

export async function createAccountAction(formData: FormData) {
  await requireUser("admin");

  const loginId = str(formData, "loginId");
  const password = String(formData.get("password") ?? "");
  const companyName = str(formData, "companyName");
  const unitPriceRaw = str(formData, "defaultUnitPrice");

  if (!loginId || password.length < 4 || !companyName) {
    redirect("/admin/settings?mode=new&error=input");
  }

  const result = await mutateState<string | "duplicate">((state) => {
    if (state.users.some((u) => u.loginId.toLowerCase() === loginId.toLowerCase())) {
      return "duplicate";
    }
    const user: User = {
      id: newId("u"),
      loginId,
      passwordHash: hashPassword(password),
      role: "customer",
      companyName,
      contactName: str(formData, "contactName"),
      email: str(formData, "email"),
      postalCode: str(formData, "postalCode"),
      address: str(formData, "address"),
      tel: str(formData, "tel"),
      defaultUnitPrice: unitPriceRaw ? Math.round(Number(unitPriceRaw)) : null,
      active: true,
      createdAt: new Date().toISOString()
    };
    state.users.push(user);
    return user.id;
  });

  revalidatePath("/admin/settings");
  // 作成直後はその会社を選択した状態で一覧に戻し、続けて設定を確認できるようにする
  redirect(
    result === "duplicate"
      ? "/admin/settings?mode=new&error=duplicate"
      : `/admin/settings?ok=created&select=${result}`
  );
}

export async function updateAccountAction(formData: FormData) {
  await requireUser("admin");
  const userId = str(formData, "userId");
  const unitPriceRaw = str(formData, "defaultUnitPrice");
  const newPassword = String(formData.get("newPassword") ?? "");

  await mutateState((state) => {
    const user = state.users.find((u) => u.id === userId);
    if (!user) return;
    user.companyName = str(formData, "companyName") || user.companyName;
    user.contactName = str(formData, "contactName");
    user.email = str(formData, "email");
    user.postalCode = str(formData, "postalCode");
    user.address = str(formData, "address");
    user.tel = str(formData, "tel");
    user.defaultUnitPrice = unitPriceRaw ? Math.round(Number(unitPriceRaw)) : null;
    user.active = str(formData, "active") === "1";
    if (newPassword.length >= 4) {
      user.passwordHash = hashPassword(newPassword);
    }
  });

  revalidatePath("/admin/settings");
  redirect(`/admin/settings?ok=updated&select=${userId}`);
}

export async function updateOwnProfileAction(formData: FormData) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  await mutateState((state) => {
    const user = state.users.find((u) => u.id === current.id);
    if (!user) return;
    user.contactName = str(formData, "contactName");
    user.email = str(formData, "email");
    user.postalCode = str(formData, "postalCode");
    user.address = str(formData, "address");
    user.tel = str(formData, "tel");
  });

  revalidatePath("/orders");
  redirect("/orders?ok=profile");
}
