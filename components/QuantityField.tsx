"use client";

import { useState } from "react";
import { yen } from "@/lib/types";

export default function QuantityField({ unitPrice }: { unitPrice: number | null }) {
  const [quantity, setQuantity] = useState(1);
  const total = unitPrice === null ? null : quantity * unitPrice;

  return (
    <>
      <div className="field">
        <label htmlFor="quantity">注文台数</label>
        <div className="qty-row">
          <button
            type="button"
            className="qty-btn"
            aria-label="台数を1減らす"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setQuantity(Number.isFinite(v) && v > 0 ? v : 1);
            }}
            required
          />
          <button
            type="button"
            className="qty-btn"
            aria-label="台数を1増やす"
            onClick={() => setQuantity((q) => q + 1)}
          >
            ＋
          </button>
          <span className="field-hint" style={{ marginTop: 0 }}>
            {unitPrice === null
              ? "単価は受注確定後にご案内します"
              : `単価 ${yen(unitPrice)}（税込）`}
          </span>
        </div>
      </div>

      <div className="total-panel">
        <span className="total-panel-label">ご注文金額（予定）</span>
        {total === null ? (
          <span className="total-panel-pending">単価確定後にご案内します</span>
        ) : (
          <span className="total-panel-value">
            {yen(total)}
            <small>税込</small>
          </span>
        )}
      </div>
    </>
  );
}
