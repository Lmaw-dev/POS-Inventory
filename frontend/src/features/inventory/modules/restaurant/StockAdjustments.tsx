import { useMemo, useState } from "react";
import { AlertTriangle, Check, Clock, Search, ShieldAlert, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "../../app/hooks/useSession";
import {
  useRestaurantInventoryQuery,
  useRestaurantLocationsQuery,
  useRestaurantStockAdjustmentsQuery,
  useCreateRestaurantStockAdjustmentMutation,
  useApproveRestaurantStockAdjustmentMutation,
  useRejectRestaurantStockAdjustmentMutation,
  type RestaurantAdjustmentType,
  type RestaurantStockAdjustment,
} from "../lib/restaurant";

const ADJUSTMENT_TYPES: {
  type: RestaurantAdjustmentType;
  title: string;
  desc: string;
  direction: "increase" | "decrease" | "set";
  amountLabel: string;
}[] = [
  { type: "ADD", title: "Add Stock", desc: "Manually add units (e.g. correction)", direction: "increase", amountLabel: "Quantity to add" },
  { type: "FOUND", title: "Found", desc: "Uncounted stock discovered", direction: "increase", amountLabel: "Quantity found" },
  { type: "REMOVE", title: "Remove Stock", desc: "Manually remove units", direction: "decrease", amountLabel: "Quantity to remove" },
  { type: "DAMAGE", title: "Damaged / Spoiled", desc: "Units no longer usable", direction: "decrease", amountLabel: "Quantity damaged" },
  { type: "LOST", title: "Lost / Shrinkage", desc: "Missing units", direction: "decrease", amountLabel: "Quantity lost" },
  { type: "RECOUNT", title: "Recount", desc: "Set exact counted quantity", direction: "set", amountLabel: "Counted quantity" },
];

const statusBadgeClass = (status: string) => {
  const map: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    APPROVED: "bg-emerald-100 text-emerald-800",
    REJECTED: "bg-red-100 text-red-800",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : "-");

export function StockAdjustments({ embedded = false }: { embedded?: boolean } = {}) {
  const { currentUser } = useSession();
  const canReview = currentUser?.role === "Admin" || currentUser?.role === "Manager";

  const { data: items = [] } = useRestaurantInventoryQuery();
  const { data: locations = [] } = useRestaurantLocationsQuery() as { data?: { id: string; name: string }[] };
  const { data: adjustments = [] } = useRestaurantStockAdjustmentsQuery();
  const createMutation = useCreateRestaurantStockAdjustmentMutation();
  const approveMutation = useApproveRestaurantStockAdjustmentMutation();
  const rejectMutation = useRejectRestaurantStockAdjustmentMutation();

  const [itemSearch, setItemSearch] = useState("");
  const [backendId, setBackendId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [type, setType] = useState<RestaurantAdjustmentType>("DAMAGE");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const selectedItem = items.find((i) => i.backendId === backendId);
  const currentQty = Number(selectedItem?.stock ?? 0);
  const typeMeta = ADJUSTMENT_TYPES.find((t) => t.type === type)!;
  const amountNum = parseFloat(amount) || 0;

  // Signed change applied to stock, matching the backend's newQty = prevQty + change.
  const delta =
    typeMeta.direction === "set"
      ? amountNum - currentQty
      : typeMeta.direction === "increase"
        ? amountNum
        : -amountNum;
  const newQty = currentQty + delta;

  const canSubmit =
    !!backendId &&
    !!locationId &&
    !!reason.trim() &&
    (typeMeta.direction === "set" ? amount !== "" : amountNum > 0) &&
    newQty >= 0 &&
    delta !== 0;

  const filteredItems = items.filter((i) => {
    const q = itemSearch.toLowerCase();
    return (i.name || "").toLowerCase().includes(q) || (i.sku || "").toLowerCase().includes(q);
  });

  const visibleAdjustments = useMemo(() => {
    if (statusFilter === "ALL") return adjustments;
    return adjustments.filter((a) => a.status === statusFilter);
  }, [adjustments, statusFilter]);

  const pendingCount = useMemo(() => adjustments.filter((a) => a.status === "PENDING").length, [adjustments]);

  const selectItem = (id: string) => {
    setBackendId(id);
    const item = items.find((i) => i.backendId === id);
    setLocationId(item?.locationId ?? "");
  };

  const resetForm = () => {
    setBackendId("");
    setLocationId("");
    setAmount("");
    setReason("");
    setNotes("");
    setType("DAMAGE");
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selectedItem) return;
    try {
      await createMutation.mutateAsync({
        type,
        reason: reason.trim(),
        items: [
          {
            inventoryItemId: backendId,
            quantityChange: delta,
            locationId,
            notes: notes.trim() || undefined,
          },
        ],
      });
      toast.success("Adjustment submitted for approval");
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit adjustment");
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync(id);
      toast.success("Adjustment approved - stock updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve adjustment");
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectReason.trim()) return;
    try {
      await rejectMutation.mutateAsync({ id: rejectingId, reason: rejectReason.trim() });
      toast.success("Adjustment rejected");
      setRejectingId(null);
      setRejectReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject adjustment");
    }
  };

  return (
    <div className={embedded ? "" : "p-8"}>
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Stock Adjustments</h1>
          <p className="text-sm text-muted-foreground">
            Record manual stock corrections: damage, spoilage, loss, found stock, or recounts. Every approved adjustment writes an audited stock movement.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[440px_1fr]">
        {/* Create form */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">New Adjustment</h2>
          </div>

          {/* Item */}
          <label className="mb-1 block text-xs text-foreground">Item *</label>
          {!backendId ? (
            <>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Search item by name or SKU..."
                  className="w-full rounded-lg border border-input bg-input-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="mb-4 max-h-[200px] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {filteredItems.slice(0, 50).map((i) => (
                  <button
                    key={i.backendId ?? i.id}
                    type="button"
                    onClick={() => selectItem(i.backendId ?? "")}
                    className="w-full px-3 py-2 text-left transition-colors hover:bg-muted/50"
                  >
                    <p className="truncate text-sm font-medium text-foreground">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.location} - stock: {i.stock} {i.unit}</p>
                  </button>
                ))}
                {filteredItems.length === 0 && <div className="px-3 py-6 text-center text-xs text-muted-foreground">No items found</div>}
              </div>
            </>
          ) : (
            <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{selectedItem?.name}</p>
                <p className="text-xs text-muted-foreground">Current stock: {currentQty} {selectedItem?.unit}</p>
              </div>
              <button type="button" onClick={resetForm} className="flex-shrink-0 text-xs text-primary hover:underline">Change</button>
            </div>
          )}

          {/* Location */}
          <label className="mb-1 block text-xs text-foreground">Location *</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mb-4 w-full rounded-lg border border-input bg-input-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">Select location</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>

          {/* Type */}
          <label className="mb-1 block text-xs text-foreground">Adjustment Type *</label>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {ADJUSTMENT_TYPES.map(({ type: t, title, desc }) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  type === t ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <p className="font-semibold text-foreground">{title}</p>
                <p className="mt-0.5 text-muted-foreground">{desc}</p>
              </button>
            ))}
          </div>

          {/* Amount */}
          <label className="mb-1 block text-xs text-foreground">{typeMeta.amountLabel} *</label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="mb-2 w-full rounded-lg border border-input bg-input-background px-3 py-2 text-sm outline-none focus:border-primary"
          />

          {/* Preview */}
          {backendId && amount !== "" && (
            <div className={`mb-4 rounded-lg px-3 py-2 text-sm ${newQty < 0 ? "bg-red-50 text-red-700" : "bg-muted text-foreground"}`}>
              {newQty < 0 ? (
                <span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Would make stock negative - not allowed.</span>
              ) : (
                <>Current {currentQty} -&gt; <span className="font-semibold">New {newQty}</span> ({delta >= 0 ? "+" : ""}{delta})</>
              )}
            </div>
          )}

          {/* Reason */}
          <label className="mb-1 block text-xs text-foreground">Reason *</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Spoiled during storage"
            className="mb-4 w-full rounded-lg border border-input bg-input-background px-3 py-2 text-sm outline-none focus:border-primary"
          />

          {/* Notes */}
          <label className="mb-1 block text-xs text-foreground">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any extra detail..."
            className="mb-4 w-full resize-none rounded-lg border border-input bg-input-background px-3 py-2 text-sm outline-none focus:border-primary"
          />

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || createMutation.isPending}
            className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {createMutation.isPending ? "Submitting..." : "Submit for Approval"}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            Adjustments are recorded as <span className="font-medium">pending</span> and only change stock once an Admin or Manager approves them.
          </p>
        </div>

        {/* History */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Adjustment History</h2>
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{pendingCount} pending</span>
            )}
          </div>

          <div className="mb-3 flex gap-1">
            {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === s ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="max-h-[640px] space-y-2 overflow-y-auto">
            {visibleAdjustments.map((adj) => (
              <AdjustmentCard
                key={adj.id}
                adj={adj}
                canReview={canReview}
                onApprove={() => handleApprove(adj.id)}
                onReject={() => { setRejectingId(adj.id); setRejectReason(""); }}
                approving={approveMutation.isPending}
              />
            ))}
            {visibleAdjustments.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No {statusFilter === "ALL" ? "" : statusFilter.toLowerCase()} adjustments.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-lg">
            <div className="mb-2 flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-5 w-5" />
              <h3 className="text-lg font-bold">Reject Adjustment</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">Provide a reason. The adjustment will be marked rejected and won't change stock.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Reason for rejection..."
              className="mb-4 w-full resize-none rounded-lg border border-input bg-input-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectingId(null)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">Cancel</button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || rejectMutation.isPending} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {rejectMutation.isPending ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdjustmentCard({
  adj,
  canReview,
  onApprove,
  onReject,
  approving,
}: {
  adj: RestaurantStockAdjustment;
  canReview: boolean;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
}) {
  const line = adj.items[0];
  const change = line?.quantityChange ?? 0;
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{line?.inventoryItem?.name ?? "Item"}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(adj.status)}`}>{adj.status}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {adj.type} - {change >= 0 ? "+" : ""}{change} {line?.inventoryItem?.unit ?? ""} - {line?.location?.name ?? "-"}
          </p>
          <p className="mt-1 text-xs text-foreground">{adj.reason}</p>
          {adj.status === "REJECTED" && adj.rejectionReason && (
            <p className="mt-1 text-xs text-red-700">Rejected: {adj.rejectionReason}</p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {adj.adjustmentNumber} - by {adj.createdBy?.name ?? adj.createdBy?.email ?? "Unknown"} - {formatDate(adj.createdAt)}
          </p>
        </div>
        {canReview && adj.status === "PENDING" && (
          <div className="flex flex-shrink-0 flex-col gap-1.5">
            <button onClick={onApprove} disabled={approving} className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">
              <Check className="h-3.5 w-3.5" /> Approve
            </button>
            <button onClick={onReject} className="flex items-center gap-1 rounded-md border border-red-600 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
              <X className="h-3.5 w-3.5" /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
