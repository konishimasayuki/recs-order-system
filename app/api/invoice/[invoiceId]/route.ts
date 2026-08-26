import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { InvoiceDocument } from "@/lib/invoice-pdf";
import { readState } from "@/lib/store";
import { invoicesOfOrder } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const state = await readState();
  // 請求書IDで探す。見つからなければ注文IDとみなし、その注文の最新の請求書を返す
  // （1注文＝1請求書だった頃のリンクを開けるようにするため）
  const invoice =
    state.invoices.find((inv) => inv.id === params.invoiceId) ??
    invoicesOfOrder(params.invoiceId, state.invoices)[0];

  if (!invoice) {
    return NextResponse.json({ error: "請求書が見つかりません。" }, { status: 404 });
  }

  // 発注側は自社の請求書のみ閲覧できる
  if (user.role !== "admin" && invoice.userId !== user.id) {
    return NextResponse.json({ error: "閲覧権限がありません。" }, { status: 403 });
  }

  // 請求先の住所・担当者は明細の1件目の注文から引く
  const order = state.orders.find((o) => o.id === invoice.lines[0]?.orderId);
  if (!order) {
    return NextResponse.json(
      { error: "請求書の元になった注文が見つかりません。" },
      { status: 409 }
    );
  }

  let buffer: Buffer;
  try {
    // フォント欠落やPDF生成の失敗を、原因の分かる応答にして返す
    buffer = await renderToBuffer(
      React.createElement(InvoiceDocument, {
        invoice,
        order,
        seller: state.seller
      }) as any
    );
  } catch (err) {
    console.error("[recsgps] invoice pdf render failed:", err);
    return NextResponse.json(
      { error: "請求書PDFの生成に失敗しました。管理者にお問い合わせください。" },
      { status: 500 }
    );
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "no-store"
    }
  });
}
