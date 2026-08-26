import { OrderStatus, Viewer, orderStatusLabel } from "@/lib/types";

const CLASS: Record<OrderStatus, string> = {
  ordered: "badge-ordered",
  pending: "badge-pending",
  invoiced: "badge-invoiced",
  delivered: "badge-delivered",
  cancelled: "badge-cancelled"
};

export default function StatusBadge({
  status,
  delivered,
  quantity,
  viewer = "admin"
}: {
  status: OrderStatus;
  delivered?: number;
  quantity?: number;
  viewer?: Viewer;
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

  return (
    <span className={`badge ${CLASS[status]}`}>{orderStatusLabel(status, viewer)}</span>
  );
}
