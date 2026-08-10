import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { InvoiceDocument } from "@/lib/invoice-pdf";
import { readState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const state = await readState();
  const order = state.orders.find((o) => o.id === params.orderId);
  if (!order) {
    return NextResponse.json({ error: "注文が見つかりません。" }, { status: 404 });
  }

  // 発注側は自社の注文のみ閲覧できる
  if (user.role !== "admin" && order.userId !== user.id) {
    return NextResponse.json({ error: "閲覧権限がありません。" }, { status: 403 });
  }

  if (!order.invoiceNumber || order.unitPrice === null) {
    return NextResponse.json({ error: "請求書は未発行です。" }, { status: 409 });
  }

  let buffer: Buffer;
  try {
    // フォント欠落やPDF生成の失敗を、原因の分かる応答にして返す
    buffer = await renderToBuffer(
      React.createElement(InvoiceDocument, { order, seller: state.seller }) as any
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
      "Content-Disposition": `inline; filename="invoice-${order.invoiceNumber}.pdf"`,
      "Cache-Control": "no-store"
    }
  });
}
