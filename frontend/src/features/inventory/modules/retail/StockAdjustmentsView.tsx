import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, ShieldAlert, Check, X, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  useRetailInventoryRecordsQuery,
  useRetailLocationsQuery,
  useRetailStockAdjustmentsQuery,
  useCreateRetailStockAdjustmentMutation,
  useApproveRetailStockAdjustmentMutation,
  useRejectRetailStockAdjustmentMutation,
  type RetailAdjustmentType,
  type RetailStockAdjustment,
} from '../lib/retail';

// Each type maps to a stock direction. RECOUNT is special: the entered number is the
// new counted quantity, and the change is the difference from current stock.
const ADJUSTMENT_TYPES: {
  type: RetailAdjustmentType;
  title: string;
  desc: string;
  direction: 'increase' | 'decrease' | 'set';
  amountLabel: string;
}[] = [
  { type: 'ADD', title: 'Add Stock', desc: 'Manually add units (e.g. correction)', direction: 'increase', amountLabel: 'Quantity to add' },
  { type: 'FOUND', title: 'Found', desc: 'Uncounted stock discovered', direction: 'increase', amountLabel: 'Quantity found' },
  { type: 'REMOVE', title: 'Remove Stock', desc: 'Manually remove units', direction: 'decrease', amountLabel: 'Quantity to remove' },
  { type: 'DAMAGE', title: 'Damaged', desc: 'Units no longer sellable', direction: 'decrease', amountLabel: 'Quantity damaged' },
  { type: 'LOST', title: 'Lost / Shrinkage', desc: 'Missing or stolen units', direction: 'decrease', amountLabel: 'Quantity lost' },
  { type: 'RECOUNT', title: 'Recount', desc: 'Set exact counted quantity', direction: 'set', amountLabel: 'Counted quantity' },
];

const statusBadgeClass = (status: string) => {
  const map: Record<string, string> = {
    PENDING: 'bg-warning/10 text-warning',
    APPROVED: 'bg-secondary/10 text-secondary',
    REJECTED: 'bg-destructive/10 text-destructive',
  };
  return map[status] ?? 'bg-muted text-muted-foreground';
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : '-';

export default function StockAdjustmentsView({
  currentUser,
  embedded = false,
}: {
  currentUser: { email: string; role: string } | null;
  embedded?: boolean;
}) {
  const itemsQuery = useRetailInventoryRecordsQuery();
  const locationsQuery = useRetailLocationsQuery();
  const adjustmentsQuery = useRetailStockAdjustmentsQuery();
  const createMutation = useCreateRetailStockAdjustmentMutation();
  const approveMutation = useApproveRetailStockAdjustmentMutation();
  const rejectMutation = useRejectRetailStockAdjustmentMutation();

  const items = itemsQuery.data ?? [];
  const locations = locationsQuery.data ?? [];
  const adjustments = adjustmentsQuery.data ?? [];
  const loading = itemsQuery.isLoading || locationsQuery.isLoading || adjustmentsQuery.isLoading;

  const canReview = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  const [itemSearch, setItemSearch] = useState('');
  const [itemId, setItemId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [type, setType] = useState<RetailAdjustmentType>('DAMAGE');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const selectedItem = items.find((i: any) => i.id === itemId);
  const currentQty = Number(selectedItem?.quantity ?? 0);
  const typeMeta = ADJUSTMENT_TYPES.find((t) => t.type === type)!;
  const amountNum = parseFloat(amount) || 0;

  // Signed change applied to stock, matching the backend's newQty = prevQty + change.
  const delta =
    typeMeta.direction === 'set'
      ? amountNum - currentQty
      : typeMeta.direction === 'increase'
        ? amountNum
        : -amountNum;
  const newQty = currentQty + delta;

  const canSubmit =
    !!itemId &&
    !!locationId &&
    !!reason.trim() &&
    (typeMeta.direction === 'set' ? amount !== '' : amountNum > 0) &&
    newQty >= 0 &&
    delta !== 0;

  const filteredItems = items.filter((i: any) => {
    const q = itemSearch.toLowerCase();
    return (i.name ?? '').toLowerCase().includes(q) || (i.sku ?? '').toLowerCase().includes(q);
  });

  const visibleAdjustments = useMemo(() => {
    if (statusFilter === 'ALL') return adjustments;
    return adjustments.filter((a) => a.status === statusFilter);
  }, [adjustments, statusFilter]);

  const pendingCount = useMemo(
    () => adjustments.filter((a) => a.status === 'PENDING').length,
    [adjustments],
  );

  const selectItem = (id: string) => {
    setItemId(id);
    const item = items.find((i: any) => i.id === id);
    setLocationId(item?.locationId ?? '');
  };

  const resetForm = () => {
    setItemId('');
    setLocationId('');
    setAmount('');
    setReason('');
    setNotes('');
    setType('DAMAGE');
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selectedItem) return;
    try {
      await createMutation.mutateAsync({
        type,
        reason: reason.trim(),
        items: [
          {
            inventoryItemId: itemId,
            quantityChange: delta,
            locationId,
            notes: notes.trim() || undefined,
          },
        ],
      });
      toast.success('Adjustment submitted for approval');
      resetForm();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit adjustment');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync(id);
      toast.success('Adjustment approved - stock updated');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to approve adjustment');
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectReason.trim()) return;
    try {
      await rejectMutation.mutateAsync({ id: rejectingId, reason: rejectReason.trim() });
      toast.success('Adjustment rejected');
      setRejectingId(null);
      setRejectReason('');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to reject adjustment');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading stock adjustments...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {!embedded && (
        <div className="mb-4">
          <h2 className="text-[30px] font-bold text-foreground">Stock Adjustments</h2>
          <p className="text-[14px] text-muted-foreground mt-1">
            Record manual stock corrections: damage, loss, found stock, or recounts. Every approved adjustment writes an audited stock movement.
          </p>
        </div>
      )}

      <div className="grid grid-cols-[420px_1fr] gap-4 flex-1 min-h-0">
        {/* Left: create form */}
        <div className="bg-white border border-border rounded-[14px] p-5 flex flex-col overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal className="size-5 text-secondary" />
            <h3 className="font-semibold text-foreground text-[15px]">New Adjustment</h3>
          </div>

          {/* Item picker */}
          <label className="block text-[12px] font-medium text-foreground mb-1">Item *</label>
          {!itemId ? (
            <>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Search item by name or SKU..."
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-[8px] text-[13px] focus:outline-none focus:border-secondary"
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto border border-border rounded-[8px] divide-y divide-border mb-4">
                {filteredItems.slice(0, 50).map((i: any) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => selectItem(i.id)}
                    className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                  >
                    <p className="text-[13px] font-medium text-foreground truncate">{i.name}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {i.location?.name ?? 'No location'} - qty: {i.quantity} {i.unit ?? ''}
                    </p>
                  </button>
                ))}
                {filteredItems.length === 0 && (
                  <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">No items found</div>
                )}
              </div>
            </>
          ) : (
            <div className="mb-4 flex items-center justify-between gap-2 border border-border rounded-[8px] px-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate">{selectedItem?.name}</p>
                <p className="text-[12px] text-muted-foreground">Current stock: {currentQty} {selectedItem?.unit ?? ''}</p>
              </div>
              <button type="button" onClick={resetForm} className="text-[12px] text-secondary hover:underline flex-shrink-0">Change</button>
            </div>
          )}

          {/* Location */}
          <label className="block text-[12px] font-medium text-foreground mb-1">Location *</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary mb-4"
          >
            <option value="">Select location</option>
            {locations.map((loc: any) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>

          {/* Type */}
          <label className="block text-[12px] font-medium text-foreground mb-1">Adjustment Type *</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {ADJUSTMENT_TYPES.map(({ type: t, title, desc }) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`text-left px-3 py-2 rounded-[8px] border text-[12px] transition-colors ${
                  type === t ? 'border-secondary bg-secondary/10' : 'border-border bg-white hover:bg-muted'
                }`}
              >
                <p className="font-semibold text-foreground">{title}</p>
                <p className="text-muted-foreground mt-0.5">{desc}</p>
              </button>
            ))}
          </div>

          {/* Amount */}
          <label className="block text-[12px] font-medium text-foreground mb-1">{typeMeta.amountLabel} *</label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary mb-2"
          />

          {/* Preview */}
          {itemId && amount !== '' && (
            <div
              className={`rounded-[8px] px-3 py-2 text-[13px] mb-4 ${
                newQty < 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'
              }`}
            >
              {newQty < 0 ? (
                <span className="flex items-center gap-1.5"><AlertTriangle className="size-4" /> Would make stock negative - not allowed.</span>
              ) : (
                <>Current {currentQty} -&gt; <span className="font-semibold">New {newQty}</span> ({delta >= 0 ? '+' : ''}{delta})</>
              )}
            </div>
          )}

          {/* Reason */}
          <label className="block text-[12px] font-medium text-foreground mb-1">Reason *</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Water damage during storage"
            className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary mb-4"
          />

          {/* Notes */}
          <label className="block text-[12px] font-medium text-foreground mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any extra detail..."
            className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary mb-4 resize-none"
          />

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || createMutation.isPending}
            className="px-6 py-2.5 bg-secondary text-white rounded-[8px] text-[14px] font-medium hover:bg-secondary transition-colors disabled:opacity-60"
          >
            {createMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
          </button>
          <p className="text-[11px] text-muted-foreground mt-2">
            Adjustments are recorded as <span className="font-medium">pending</span> and only change stock once an Admin or Manager approves them.
          </p>
        </div>

        {/* Right: adjustments list */}
        <div className="bg-white border border-border rounded-[14px] p-5 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-5 text-secondary" />
            <h3 className="font-semibold text-foreground text-[15px]">Adjustment History</h3>
            {pendingCount > 0 && (
              <span className="text-[11px] bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">{pendingCount} pending</span>
            )}
          </div>

          {/* Status filter */}
          <div className="flex gap-1 mb-3">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                  statusFilter === s ? 'bg-secondary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {visibleAdjustments.map((adj) => (
              <AdjustmentCard
                key={adj.id}
                adj={adj}
                canReview={canReview}
                onApprove={() => handleApprove(adj.id)}
                onReject={() => { setRejectingId(adj.id); setRejectReason(''); }}
                approving={approveMutation.isPending}
              />
            ))}
            {visibleAdjustments.length === 0 && (
              <div className="py-12 text-center text-[13px] text-muted-foreground">
                No {statusFilter === 'ALL' ? '' : statusFilter.toLowerCase()} adjustments.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-[14px] p-6 max-w-md w-full">
            <div className="flex items-center gap-2 mb-2 text-destructive">
              <ShieldAlert className="size-5" />
              <h3 className="text-[18px] font-bold">Reject Adjustment</h3>
            </div>
            <p className="text-[13px] text-muted-foreground mb-4">Provide a reason. The adjustment will be marked rejected and won't change stock.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Reason for rejection..."
              className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary mb-4 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectingId(null)} className="flex-1 px-4 py-2 border border-border rounded-[8px] text-[14px] font-medium text-foreground hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || rejectMutation.isPending} className="flex-1 px-4 py-2 bg-destructive text-white rounded-[8px] text-[14px] font-medium disabled:opacity-50">
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
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
  adj: RetailStockAdjustment;
  canReview: boolean;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
}) {
  const line = adj.items[0];
  const change = line?.quantityChange ?? 0;
  return (
    <div className="border border-border rounded-[10px] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-foreground truncate">{line?.inventoryItem?.name ?? 'Item'}</p>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(adj.status)}`}>{adj.status}</span>
          </div>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {adj.type} - {change >= 0 ? '+' : ''}{change} {line?.inventoryItem?.unit ?? ''} - {line?.location?.name ?? '-'}
          </p>
          <p className="text-[12px] text-foreground mt-1">{adj.reason}</p>
          {adj.status === 'REJECTED' && adj.rejectionReason && (
            <p className="text-[12px] text-destructive mt-1">Rejected: {adj.rejectionReason}</p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            {adj.adjustmentNumber} - by {adj.createdBy?.name ?? adj.createdBy?.email ?? 'Unknown'} - {formatDate(adj.createdAt)}
          </p>
        </div>
        {canReview && adj.status === 'PENDING' && (
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button onClick={onApprove} disabled={approving} className="flex items-center gap-1 px-2.5 py-1 bg-secondary text-white rounded-[6px] text-[12px] font-medium disabled:opacity-50">
              <Check className="size-3.5" /> Approve
            </button>
            <button onClick={onReject} className="flex items-center gap-1 px-2.5 py-1 border border-destructive text-destructive rounded-[6px] text-[12px] font-medium hover:bg-destructive/10">
              <X className="size-3.5" /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
