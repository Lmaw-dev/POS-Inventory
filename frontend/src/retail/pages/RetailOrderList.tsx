import { useState } from 'react';
import { Sidebar } from '../../shared/components/Sidebar';
import { Page, type StoreBrand } from '../../shared/App';
import type { StaffType, StoreType } from '../../auth/types/auth';
import { X, Search, Eye, Receipt, RotateCcw, Printer, XCircle } from 'lucide-react';
import { useOrders, Order } from '../context/RetailOrderContext';
import { ThermalReceipt } from './RetailThermalReceipt';
import { useStoreSettings } from '../../shared/context/StoreSettingsContext';
import { DateFilterControl, type DateFilterMode } from '../../shared/components/DateFilterControl';
import { getLocalDateKey, parseLocalDateKey } from '../../shared/utils/date';

interface RetailOrderListProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  isAdmin?: boolean;
  storeBrand?: StoreBrand;
  userName?: string | null;
  storeType?: StoreType;
  staffType?: StaffType;
}

function normalizeSearchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function RetailOrderList({ onNavigate, onLogout, isAdmin = false, storeBrand, userName, storeType = 'RETAIL_STORE', staffType }: RetailOrderListProps) {
  const { orders, refundOrderItems, voidTransaction } = useOrders();
  const { settings } = useStoreSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [datePreset, setDatePreset] = useState<DateFilterMode>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [orderToRefund, setOrderToRefund] = useState<Order | null>(null);
  const [selectedRefundItems, setSelectedRefundItems] = useState<{ [key: number]: boolean }>({});
  const [refundReason, setRefundReason] = useState('');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [orderToVoid, setOrderToVoid] = useState<Order | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const canProcessTransactions = !isAdmin && (staffType === 'POS_STAFF' || !staffType);

  const getTransactionNumber = (order: Order) => {
    if (order.transactionNumber) {
      return order.transactionNumber.startsWith('RET-') ? order.transactionNumber : `RET-${order.transactionNumber}`;
    }

    return `RET-${order.id}`;
  };

  const isWithinDateFilter = (date: string) => {
    const todayString = getLocalDateKey();
    const today = parseLocalDateKey(todayString);
    const start = new Date(today);

    if (datePreset === 'all') {
      return true;
    }

    if (datePreset === 'today') {
      return date === todayString;
    }

    if (datePreset === 'date') {
      return !dateFilter || date === dateFilter;
    }

    if (datePreset === 'week') {
      start.setDate(today.getDate() - 6);
    } else if (datePreset === 'month') {
      start.setDate(1);
    } else {
      start.setMonth(0, 1);
    }

    const startString = getLocalDateKey(start);
    return date >= startString && date <= todayString;
  };

  const filteredOrders = orders.filter(order => {
    const term = searchTerm.toLowerCase();
    const transactionNumber = getTransactionNumber(order).toLowerCase();
    const normalizedTerm = normalizeSearchValue(searchTerm);
    const normalizedTransactionNumber = normalizeSearchValue(getTransactionNumber(order));
    const normalizedOrderId = normalizeSearchValue(order.id);
    const matchesSearch = !term ||
      transactionNumber.includes(term) ||
      order.id.toLowerCase().includes(term) ||
      (order.customer && order.customer.toLowerCase().includes(term)) ||
      Boolean(normalizedTerm && (
        normalizedTransactionNumber.includes(normalizedTerm) ||
        normalizedOrderId.includes(normalizedTerm)
      ));
    const matchesPayment = paymentFilter === 'All' || order.paymentStatus === paymentFilter;
    const matchesDate = isWithinDateFilter(order.date);
    return matchesSearch && matchesPayment && matchesDate;
  });

  const getPaymentBadge = (status: string) => {
    if (status === 'Paid') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'Refunded') return 'bg-gray-50 text-gray-700 border-gray-300';
    if (status === 'Partially Refunded') return 'bg-orange-50 text-orange-700 border-orange-200';
    if (status === 'Void') return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-red-50 text-red-700 border-red-200';
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowDetails(true);
  };

  const handleViewReceipt = (order: Order) => {
    setSelectedOrder(order);
    setShowReceiptModal(true);
  };

  const handleRefundClick = (order: Order) => {
    if (!canProcessTransactions) return;
    if (!settings.enable_refund) return;
    setOrderToRefund(order);
    setSelectedRefundItems({});
    setRefundReason('');
    setShowRefundModal(true);
  };

  const toggleRefundItem = (index: number) => {
    setSelectedRefundItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleRefundConfirm = () => {
    if (!canProcessTransactions) return;
    if (!settings.enable_refund) return;
    if (!orderToRefund) return;

    const selectedIndices = Object.keys(selectedRefundItems)
      .filter(key => selectedRefundItems[Number(key)])
      .map(key => Number(key));

    // Must have at least one item selected
    if (selectedIndices.length === 0) return;

    // Refund selected items
    refundOrderItems(orderToRefund.id, selectedIndices, refundReason || 'Customer request');

    setShowRefundModal(false);
    setOrderToRefund(null);
    setSelectedRefundItems({});
    setRefundReason('');
  };

  const handleVoidClick = (order: Order) => {
    if (!canProcessTransactions) return;
    if (!settings.enable_void) return;
    setOrderToVoid(order);
    setVoidReason('');
    setShowVoidModal(true);
  };

  const handleVoidConfirm = () => {
    if (!canProcessTransactions) return;
    if (!settings.enable_void) return;
    if (!orderToVoid || !voidReason.trim()) return;

    voidTransaction(orderToVoid.id, voidReason, 'Cashier');

    setShowVoidModal(false);
    setOrderToVoid(null);
    setVoidReason('');
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar currentPage="retail-transactions" onNavigate={onNavigate} onLogout={onLogout} isAdmin={isAdmin} storeType={storeType} staffType={staffType} storeBrand={storeBrand} userName={userName} />

      <div className="flex-1 overflow-auto p-8">
        <div className="mb-6">
          <h1 className="text-[28px] text-primary" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: '0.04em' }}>
            Transaction History
          </h1>
          <p className="text-sm text-muted-foreground">View and manage all sales transactions</p>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-border p-4 mb-5">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by transaction # or customer..."
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              <option value="All">All Payments</option>
              <option value="Paid">Paid</option>
              <option value="Not Paid">Not Paid</option>
              <option value="Refunded">Refunded</option>
              <option value="Partially Refunded">Partially Refunded</option>
              <option value="Void">Void</option>
            </select>

            <DateFilterControl
              mode={datePreset}
              selectedDate={dateFilter}
              onModeChange={setDatePreset}
              onDateChange={setDateFilter}
              className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            />

            {(searchTerm || paymentFilter !== 'All' || dateFilter || datePreset !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setPaymentFilter('All');
                  setDateFilter('');
                  setDatePreset('all');
                }}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Transaction #</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Items</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Payment</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => (
                    <tr key={`${order.id}-${getTransactionNumber(order)}`} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono">{getTransactionNumber(order)}</td>
                      <td className="px-4 py-3 text-sm">{order.customer || 'Walk-in Customer'}</td>
                      <td className="px-4 py-3 text-sm">{order.date}</td>
                      <td className="px-4 py-3 text-sm">{order.time}</td>
                      <td className="px-4 py-3 text-sm">{order.items.length} items</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-primary">
                        ₱{order.amountNumber.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs border ${getPaymentBadge(order.paymentStatus)}`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewDetails(order)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                          <button
                            onClick={() => handleViewReceipt(order)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Receipt"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            Receipt
                          </button>
                          {canProcessTransactions && settings.enable_refund && (order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Refunded') && !order.items.every(item => item.refunded) && (
                            <button
                              onClick={() => handleRefundClick(order)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Refund"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Refund
                            </button>
                          )}
                          {canProcessTransactions && settings.enable_void && order.paymentStatus === 'Paid' && (
                            <button
                              onClick={() => handleVoidClick(order)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Void Transaction"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredOrders.length} of {orders.length} transactions
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h2 className="text-lg text-primary">Transaction Details</h2>
              <button
                onClick={() => setShowDetails(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Transaction #</p>
                  <p className="text-sm font-mono">{getTransactionNumber(selectedOrder)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Customer</p>
                  <p className="text-sm">{selectedOrder.customer || 'Walk-in Customer'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Date & Time</p>
                  <p className="text-sm">{selectedOrder.date} {selectedOrder.time}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Payment Status</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs border ${getPaymentBadge(selectedOrder.paymentStatus)}`}>
                    {selectedOrder.paymentStatus}
                  </span>
                </div>
                {selectedOrder.contactNumber && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Contact</p>
                    <p className="text-sm">{selectedOrder.contactNumber}</p>
                  </div>
                )}
                {selectedOrder.paymentMethod && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Payment Method</p>
                    <p className="text-sm">{selectedOrder.paymentMethod}</p>
                  </div>
                )}
                {selectedOrder.cashier && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Cashier</p>
                    <p className="text-sm">{selectedOrder.cashier}</p>
                  </div>
                )}
              </div>

              {(selectedOrder.paymentStatus === 'Refunded' || selectedOrder.paymentStatus === 'Partially Refunded') && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-medium text-red-800 mb-3">Refund Information</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedOrder.refundTransactionId && (
                      <div>
                        <p className="text-xs text-red-700 mb-1">Refund ID</p>
                        <p className="text-sm font-mono">{selectedOrder.refundTransactionId}</p>
                      </div>
                    )}
                    {selectedOrder.refundDate && (
                      <div>
                        <p className="text-xs text-red-700 mb-1">Refund Date</p>
                        <p className="text-sm">{selectedOrder.refundDate}</p>
                      </div>
                    )}
                    {selectedOrder.refundReason && (
                      <div className="col-span-2">
                        <p className="text-xs text-red-700 mb-1">Reason</p>
                        <p className="text-sm">{selectedOrder.refundReason}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedOrder.paymentStatus === 'Void' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-medium text-purple-800 mb-3">Void Information</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedOrder.voidDate && (
                      <div>
                        <p className="text-xs text-purple-700 mb-1">Void Date</p>
                        <p className="text-sm">{selectedOrder.voidDate}</p>
                      </div>
                    )}
                    {selectedOrder.voidBy && (
                      <div>
                        <p className="text-xs text-purple-700 mb-1">Voided By</p>
                        <p className="text-sm">{selectedOrder.voidBy}</p>
                      </div>
                    )}
                    {selectedOrder.voidReason && (
                      <div className="col-span-2">
                        <p className="text-xs text-purple-700 mb-1">Reason</p>
                        <p className="text-sm">{selectedOrder.voidReason}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-sm font-medium mb-3">Items</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className={`flex justify-between items-start p-3 border rounded-lg ${
                      item.refunded ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-border'
                    }`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${item.refunded ? 'line-through text-red-600' : ''}`}>
                            {item.name}
                          </p>
                          {item.refunded && (
                            <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">REFUNDED</span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-1">
                          {item.size && (
                            <span className="text-xs bg-white px-2 py-0.5 rounded border">Size: {item.size}</span>
                          )}
                          {item.color && (
                            <span className="text-xs bg-white px-2 py-0.5 rounded border">{item.color}</span>
                          )}
                          <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                        </div>
                      </div>
                      <p className={`text-sm font-medium ${item.refunded ? 'line-through text-red-600' : 'text-primary'}`}>
                        ₱{(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₱{selectedOrder.subtotal.toFixed(2)}</span>
                </div>
                {selectedOrder.serviceFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service Fee</span>
                    <span>₱{selectedOrder.serviceFee.toFixed(2)}</span>
                  </div>
                )}
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount {selectedOrder.discountType && `(${selectedOrder.discountType})`}</span>
                    <span>- ₱{selectedOrder.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-medium text-primary border-t border-border pt-2">
                  <span>Total</span>
                  <span>₱{selectedOrder.amountNumber.toFixed(2)}</span>
                </div>
                {selectedOrder.paymentStatus === 'Paid' && selectedOrder.cashReceived && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cash Received</span>
                      <span>₱{selectedOrder.cashReceived.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Change</span>
                      <span>₱{(selectedOrder.changeGiven || 0).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-border">
              <button
                onClick={() => setShowDetails(false)}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {canProcessTransactions && showRefundModal && orderToRefund && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h2 className="text-lg text-primary">Process Refund</h2>
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setOrderToRefund(null);
                  setSelectedRefundItems({});
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="bg-muted rounded-lg p-3 mb-4">
                <p className="text-sm"><strong>Transaction #:</strong> {getTransactionNumber(orderToRefund)}</p>
                <p className="text-sm"><strong>Customer:</strong> {orderToRefund.customer || 'Walk-in Customer'}</p>
                <p className="text-sm"><strong>Date:</strong> {orderToRefund.date}</p>
              </div>

              <p className="text-sm text-muted-foreground mb-3">
                Select items to refund (leave empty to refund all remaining items):
              </p>

              <div className="space-y-2 mb-4">
                {orderToRefund.items.map((item, index) => {
                  if (item.refunded) {
                    return (
                      <div key={index} className="flex items-start gap-3 p-3 border border-red-200 bg-red-50 rounded-lg opacity-60">
                        <div className="flex-1">
                          <p className="text-sm font-medium line-through text-red-600">{item.name}</p>
                          <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">Already Refunded</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <label
                      key={index}
                      className="flex items-start gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRefundItems[index] || false}
                        onChange={() => toggleRefundItem(index)}
                        className="mt-1 accent-primary"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.name}</p>
                        <div className="flex gap-2 mt-1">
                          {item.size && (
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Size: {item.size}</span>
                          )}
                          {item.color && (
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{item.color}</span>
                          )}
                          <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-primary">₱{(item.price * item.quantity).toFixed(2)}</p>
                    </label>
                  );
                })}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Refund Reason</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Enter reason for refund (e.g., Defective item, Wrong size, Customer request)"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={3}
                />
              </div>

              <div className={`border rounded-lg p-3 ${(() => {
                const selectedCount = Object.values(selectedRefundItems).filter(Boolean).length;
                if (selectedCount === 0) {
                  return 'bg-yellow-50 border-yellow-200';
                }
                return 'bg-red-50 border-red-200';
              })()}`}>
                <p className={`text-sm ${(() => {
                  const selectedCount = Object.values(selectedRefundItems).filter(Boolean).length;
                  if (selectedCount === 0) {
                    return 'text-yellow-800';
                  }
                  return 'text-red-800';
                })()}`}>
                  {(() => {
                    const selectedCount = Object.values(selectedRefundItems).filter(Boolean).length;

                    if (selectedCount === 0) {
                      return <><strong>Notice:</strong> Please select at least one item to refund.</>;
                    } else {
                      return <><strong>Warning:</strong> This action cannot be undone. {selectedCount} item(s) will be refunded.</>;
                    }
                  })()}
                </p>
              </div>
            </div>

            <div className="p-5 border-t border-border flex gap-3">
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setOrderToRefund(null);
                  setSelectedRefundItems({});
                  setRefundReason('');
                }}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRefundConfirm}
                disabled={Object.values(selectedRefundItems).filter(Boolean).length === 0}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300"
              >
                Confirm Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="overflow-y-auto flex-1">
              <ThermalReceipt
                orderNumber={getTransactionNumber(selectedOrder)}
                customerName={selectedOrder.customer || 'Walk-in Customer'}
                items={selectedOrder.items || []}
                subtotal={selectedOrder.subtotal || 0}
                serviceFee={selectedOrder.serviceFee || 0}
                tax={selectedOrder.tax || 0}
                discount={selectedOrder.discount || 0}
                discountType={selectedOrder.discountType}
                total={selectedOrder.amountNumber || 0}
                cashReceived={selectedOrder.cashReceived}
                changeGiven={selectedOrder.changeGiven}
                paymentMethod={selectedOrder.paymentMethod}
                date={selectedOrder.date}
                time={selectedOrder.time}
                receiptId={selectedOrder.receiptId}
                paymentId={selectedOrder.paymentId}
                cashier={selectedOrder.cashier || userName || 'Staff'}
                paymentStatus={selectedOrder.paymentStatus}
                refundTransactionId={selectedOrder.refundTransactionId}
                refundDate={selectedOrder.refundDate}
                refundReason={selectedOrder.refundReason}
                voidDate={selectedOrder.voidDate}
                voidReason={selectedOrder.voidReason}
                voidBy={selectedOrder.voidBy}
                storeBrand={storeBrand}
              />
            </div>
            <div className="p-4 border-t border-border flex gap-3 bg-white">
              <button
                onClick={() => setShowReceiptModal(false)}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors text-sm"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {canProcessTransactions && showVoidModal && orderToVoid && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h2 className="text-lg text-primary">Void Transaction</h2>
              <button
                onClick={() => {
                  setShowVoidModal(false);
                  setOrderToVoid(null);
                  setVoidReason('');
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              <div className="bg-muted rounded-lg p-3 mb-4">
                <p className="text-sm"><strong>Transaction #:</strong> {getTransactionNumber(orderToVoid)}</p>
                <p className="text-sm"><strong>Customer:</strong> {orderToVoid.customer || 'Walk-in Customer'}</p>
                <p className="text-sm"><strong>Amount:</strong> ₱{orderToVoid.amountNumber.toFixed(2)}</p>
                <p className="text-sm"><strong>Date:</strong> {orderToVoid.date}</p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-purple-800">
                  <strong>Warning:</strong> Voiding this transaction will mark it as cancelled and exclude it from sales reports. This action cannot be undone.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Void Reason <span className="text-red-600">*</span></label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Enter reason for voiding (e.g., Cashier error, Training transaction, Duplicate entry)"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={3}
                />
              </div>

              {!voidReason.trim() && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-4">
                  <p className="text-xs text-yellow-800">
                    <strong>Notice:</strong> Void reason is required.
                  </p>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-border flex gap-3">
              <button
                onClick={() => {
                  setShowVoidModal(false);
                  setOrderToVoid(null);
                  setVoidReason('');
                }}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleVoidConfirm}
                disabled={!voidReason.trim()}
                className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
