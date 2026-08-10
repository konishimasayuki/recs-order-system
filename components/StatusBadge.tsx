import { ORDER_STATUS_LABEL, OrderStatus } from "@/lib/types";

const CLASS: Record<OrderStatus, string> = {
  pending: "badge-pending",
  invoiced: "badge-invoiced",
  delivered: "badge-delivered",
  cancelled: "badge-cancelled"
};

export default function StatusBadge({
  status,
  delivered,
  quantity
}: {
  status: OrderStatus;
  delivered?: number;
  quantity?: number;
}) {
  const partial =
    status !== "cancelled" &&
    status !== "delivered" &&
    typeof delivered === "number" &&
    delivered > 0;

  if (partial) {
    return (
      <span className="badge badge-partial">
        一部納品（{delivered}/{quantity}）
      </span>
    );
  }

  return <span className={`badge ${CLASS[status]}`}>{ORDER_STATUS_LABEL[status]}</span>;
}
