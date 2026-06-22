import { useEffect, useState } from 'react';
import { Sidebar } from '../../shared/components/Sidebar';
import { Page, type StoreBrand } from '../../shared/App';
import type { StaffType, StoreType } from '../../auth/types/auth';
import { X, Search, Eye, CreditCard, Printer, RotateCcw, CheckCircle, ChevronDown, Download, Users } from 'lucide-react';
import { useOrders, Order } from '../../shared/context/OrderContext';
import { ThermalReceipt } from '../../shared/components/ThermalReceipt';
import { useStoreSettings } from '../../shared/context/StoreSettingsContext';
import { DeleteConfirmDialog } from '../../shared/components/DeleteConfirmDialog';
import { DateFilterControl, type DateFilterMode } from '../../shared/components/DateFilterControl';
import { getLocalDateKey, parseLocalDateKey } from '../../shared/utils/date';

interface OrderListProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  isAdmin?: boolean;
  storeBrand?: StoreBrand;
  userName?: string | null;
  storeType?: StoreType;
  staffType?: StaffType;
}

type ActiveModal = 'details' | 'payment' | 'payment-success' | 'receipt' | 'refund' | 'void' | null;

const ORDER_TYPES = ['Dine-In', 'Takeout', 'Mixed'];
const PAYMENT_STATUSES = ['Paid', 'Not Paid', 'Void'];
const ORDERS_PER_PAGE = 10;

function generateId(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

function normalizeSearchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function OrderList({ onNavigate, onLogout, isAdmin = false, storeBrand, userName, storeType, staffType }: OrderListProps) {
  const { orders, removeOrder, completePayment, voidOrder } = useOrders();
  const { settings } = useStoreSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [datePreset, setDatePreset] = useState<DateFilterMode>('all');

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [changeAmount, setChangeAmount] = useState(0);
  const [currentPaymentId, setCurrentPaymentId] = useState('');
  const [currentReceiptId, setCurrentReceiptId] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundingOrder, setRefundingOrder] = useState<Order | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidingOrder, setVoidingOrder] = useState<Order | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCompletingPayment, setIsCompletingPayment] = useState(false);
  const showTableManagementColumns = settings.enable_table_management;
  const canProcessTransactions = !isAdmin && (staffType === 'POS_STAFF' || !staffType);

  const openModal = (order: Order, modal: ActiveModal) => {
    if ((modal === 'payment' || modal === 'refund' || modal === 'void') && !canProcessTransactions) return;
    if (modal === 'refund' && !settings.enable_refund) return;
    if (modal === 'void' && !settings.enable_void) return;
    setSelectedOrder(order);
    setActiveModal(modal);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedOrder(null);
    setCashReceived('');
    setChangeAmount(0);
    setRefundReason('');
    setVoidReason('');
  };

  const handleConfirmPayment = async () => {
    if (!canProcessTransactions) return;
    if (!selectedOrder) return;
    const cash = parseFloat(cashReceived);
    if (cash < selectedOrder.amountNumber) return;
    if (isCompletingPayment) return;

    const change = cash - selectedOrder.amountNumber;
    const pId = generateId('PAY');
    const rId = generateId('REC');

    setChangeAmount(change);
    setCurrentPaymentId(pId);
    setCurrentReceiptId(rId);
    setIsCompletingPayment(true);

    try {
      await completePayment(selectedOrder.id, { cashReceived: cash, changeGiven: change, cashier: userName ?? undefined, paymentId: pId, receiptId: rId });
      const updates = { paymentStatus: 'Paid' as const, orderStatus: 'Completed' as const, paymentId: pId, receiptId: rId, cashReceived: cash, changeGiven: change, cashier: userName ?? undefined };
      setSelectedOrder(prev => prev ? { ...prev, ...updates } : null);
      setActiveModal('payment-success');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to complete payment.');
    } finally {
      setIsCompletingPayment(false);
    }
  };

  const handleCloseReceiptAfterPayment = () => {
    closeModal();
  };

  const handleRefundSubmit = () => {
    if (!canProcessTransactions) return;
    if (!settings.enable_refund) return;
    if (!selectedOrder || !refundReason.trim()) return;
    setRefundingOrder(selectedOrder);
  };

  const handleVoidSubmit = () => {
    if (!canProcessTransactions) return;
    if (!settings.enable_void) return;
    if (!selectedOrder || !voidReason.trim()) return;
    setVoidingOrder(selectedOrder);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const cashFloat = parseFloat(cashReceived) || 0;
  const isEnough = selectedOrder ? cashFloat >= selectedOrder.amountNumber : false;

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
    const normalizedTerm = normalizeSearchValue(searchTerm);
    const normalizedOrderNumber = normalizeSearchValue(order.orderNumber || '');
    const normalizedOrderId = normalizeSearchValue(order.id);
    const matchesSearch = !term ||
      order.id.toLowerCase().includes(term) ||
      (order.orderNumber || '').toLowerCase().includes(term) ||
      order.customer.toLowerCase().includes(term) ||
      Boolean(normalizedTerm && (
        normalizedOrderId.includes(normalizedTerm) ||
        normalizedOrderNumber.includes(normalizedTerm)
      ));
    const matchesType = typeFilter === 'All' || order.type === typeFilter;
    const matchesPayment = paymentFilter === 'All' || order.paymentStatus === paymentFilter;
    const matchesDate = isWithinDateFilter(order.date);
    return matchesSearch && matchesType && matchesPayment && matchesDate;
  });
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
  const pageStartIndex = (currentPage - 1) * ORDERS_PER_PAGE;
  const paginatedOrders = filteredOrders.slice(pageStartIndex, pageStartIndex + ORDERS_PER_PAGE);
  const visibleStart = filteredOrders.length === 0 ? 0 : pageStartIndex + 1;
  const visibleEnd = Math.min(pageStartIndex + ORDERS_PER_PAGE, filteredOrders.length);
  const tableColumnCount = showTableManagementColumns ? 10 : 7;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, paymentFilter, dateFilter, datePreset]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const getPaymentBadge = (status: string) => {
    if (status === 'Paid') return 'bg-[#dcfce7] text-[#15803d]';
    if (status === 'Void') return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-[#fef2f2] text-[#ef4444]';
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'Dine-In': return 'bg-[#eff6ff] text-[#3b82f6]';
      case 'Takeout': return 'bg-[#fff7ed] text-[#d97706]';
      case 'Mixed': return 'bg-[#f5f3ff] text-[#8b5cf6]';
      default: return 'bg-[#f1f5f9] text-[#64748b]';
    }
  };

  const dineInItems = selectedOrder?.items.filter(i => i.itemType === 'dine-in') ?? [];
  const takeoutItems = selectedOrder?.items.filter(i => i.itemType === 'takeout') ?? [];
  const isMixed = selectedOrder?.type === 'Mixed';

  return (
    <div className="flex h-screen bg-background">
      <Sidebar currentPage="order-list" onNavigate={onNavigate} onLogout={onLogout} isAdmin={isAdmin} storeBrand={storeBrand} userName={userName} storeType={storeType} staffType={staffType} />

      <div className="flex-1 overflow-auto p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[28px] text-primary" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: '0.04em' }}>
            Transaction History
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and track all restaurant orders</p>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-5">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by Order ID or Customer..."
                className="w-full pl-9 pr-4 py-2.5 bg-muted border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Type Filter */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 bg-muted border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              >
                <option value="All">All Types</option>
                {ORDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Payment Filter */}
            <div className="relative">
              <select
                value={paymentFilter}
                onChange={e => setPaymentFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 bg-muted border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              >
                <option value="All">All Payments</option>
                {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Date Filter */}
            <DateFilterControl
              mode={datePreset}
              selectedDate={dateFilter}
              onModeChange={setDatePreset}
              onDateChange={setDateFilter}
              className="appearance-none pl-3 pr-8 py-2.5 bg-muted border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
            />

            <span className="text-xs text-gray-400 ml-auto">{filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className={`w-full ${showTableManagementColumns ? 'min-w-[1180px]' : 'min-w-[880px]'}`}>
              <thead className="bg-muted/30">
                <tr>
                  <th className="w-[13%] text-left px-5 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Order Number</th>
                  <th className="w-[10%] text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Customer</th>
                  <th className="w-[8%] text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Type</th>
                  {showTableManagementColumns && (
                    <>
                      <th className="w-[7%] text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Table</th>
                      <th className="w-[6%] text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Party</th>
                      <th className="w-[7%] text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Queue</th>
                    </>
                  )}
                  <th className="w-[9%] text-right px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Total</th>
                  <th className="w-[8%] text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Payments</th>
                  <th className="w-[9%] text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Date and Time</th>
                  <th className="w-[14%] text-center px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumnCount} className="text-center py-16 text-gray-400 text-sm">
                      No orders found matching your filters.
                    </td>
                  </tr>
                ) : paginatedOrders.map((order) => {
                  const waitingTime = order.isQueued ? Math.floor((new Date().getTime() - new Date(`${order.date} ${order.time}`).getTime()) / 60000) : 0;

                  return (<tr key={order.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-5 text-sm font-mono text-primary whitespace-nowrap overflow-hidden text-ellipsis">
                      {order.orderNumber || order.id}
                    </td>
                    <td className="px-4 py-5 text-sm text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">
                      {order.customer}
                    </td>
                    <td className="px-4 py-5">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getTypeBadge(order.type)}`}>
                        {order.type}
                      </span>
                    </td>
                    {showTableManagementColumns && (
                      <>
                        <td className="px-4 py-5 text-sm text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis">
                          {order.table}
                        </td>
                        <td className="px-4 py-5">
                          {order.partySize ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium whitespace-nowrap">
                              <Users className="w-3 h-3" />
                              {order.partySize}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-5">
                          {order.isQueued ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center justify-center w-fit px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-full whitespace-nowrap">
                                #{order.queuePosition}
                              </span>
                              <span className="text-xs text-gray-500 whitespace-nowrap">{waitingTime} min</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-5 text-sm text-right font-medium whitespace-nowrap">
                      <span className="text-primary">&#8369;{order.amountNumber.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-5">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs border whitespace-nowrap ${getPaymentBadge(order.paymentStatus)}`}>
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-5">
                      <div className="text-xs text-gray-600 whitespace-nowrap">{order.date}</div>
                      <div className="text-xs text-gray-400 whitespace-nowrap">{order.time}</div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                        {/* View Details - always */}
                        <button
                          onClick={() => openModal(order, 'details')}
                          title="View Details"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>

                        {/* Process Payment - only if Not Paid */}
                        {canProcessTransactions && order.paymentStatus === 'Not Paid' && (
                          <button
                            onClick={() => openModal(order, 'payment')}
                            title="Process Payment"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            Payment
                          </button>
                        )}

                        {/* Receipt - only if Paid */}
                        {order.paymentStatus === 'Paid' && (
                          <button
                            onClick={() => openModal(order, 'receipt')}
                            title="View Receipt"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Receipt
                          </button>
                        )}

                        {/* Refund - only if Paid */}
                        {canProcessTransactions && settings.enable_refund && order.paymentStatus === 'Paid' && (
                          <button
                            onClick={() => openModal(order, 'refund')}
                            title="Process Refund"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Refund
                          </button>
                        )}

                        {canProcessTransactions && settings.enable_void && order.paymentStatus === 'Paid' && (
                          <button
                            onClick={() => openModal(order, 'void')}
                            title="Void Transaction"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <X className="w-3.5 h-3.5" />
                            Void
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>);
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Showing {visibleStart} to {visibleEnd} of {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-semibold text-primary">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL: View Details ── */}
      {activeModal === 'details' && selectedOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base text-gray-900" style={{ fontWeight: 600 }}>Order Details</h2>
                <p className="text-xs text-gray-400">{selectedOrder.orderNumber || selectedOrder.id}</p>
              </div>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Customer</p>
                  <p className="text-sm text-gray-800" style={{ fontWeight: 600 }}>{selectedOrder.customer}</p>
                </div>
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Order Type</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getTypeBadge(selectedOrder.type)}`}>
                    {selectedOrder.type}
                  </span>
                </div>
                {selectedOrder.table !== '-' && selectedOrder.table !== '—' && (
                  <div className="bg-muted rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Table</p>
                    <p className="text-sm text-gray-800">{selectedOrder.table}</p>
                  </div>
                )}
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Date & Time</p>
                  <p className="text-sm text-gray-800">{selectedOrder.date} · {selectedOrder.time}</p>
                </div>
              </div>

              {/* Payment Badge */}
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPaymentBadge(selectedOrder.paymentStatus)}`}>
                  {selectedOrder.paymentStatus}
                </span>
              </div>

              {/* Items */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Order Items</p>
                {isMixed ? (
                  <>
                    {dineInItems.length > 0 && (
                      <>
                        <p className="text-xs text-blue-600 font-medium mb-1.5">Dine-In</p>
                        <div className="space-y-2 mb-3">
                          {dineInItems.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm text-gray-700">
                              <span>{item.quantity}× {item.name}</span>
                              <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {takeoutItems.length > 0 && (
                      <>
                        <p className="text-xs text-amber-600 font-medium mb-1.5">Takeout</p>
                        <div className="space-y-2">
                          {takeoutItems.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm text-gray-700">
                              <span>{item.quantity}× {item.name}</span>
                              <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm text-gray-700 border-b border-gray-50 pb-2">
                        <span>{item.quantity}× {item.name}</span>
                        <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="bg-muted rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>₱{selectedOrder.subtotal.toFixed(2)}</span>
                </div>
                {selectedOrder.serviceFee > 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Service Fee</span>
                    <span>₱{selectedOrder.serviceFee.toFixed(2)}</span>
                  </div>
                )}
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-xs text-red-500">
                    <span>Discount ({selectedOrder.discountType} 20%)</span>
                    <span>− ₱{selectedOrder.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-primary border-t border-gray-200 pt-2" style={{ fontWeight: 700 }}>
                  <span>Total</span>
                  <span>₱{selectedOrder.amountNumber.toFixed(2)}</span>
                </div>
              </div>

              {selectedOrder.paymentStatus === 'Not Paid' && (
                <button
                  onClick={() => setActiveModal('payment')}
                  className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                  style={{ fontWeight: 600 }}
                >
                  <CreditCard className="w-4 h-4" />
                  Process Payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Payment ── */}
      {canProcessTransactions && activeModal === 'payment' && selectedOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <h2 className="text-base text-gray-900" style={{ fontWeight: 600 }}>Process Payment</h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Order Summary */}
              <div className="bg-muted rounded-xl p-4 space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Order {selectedOrder.id} — {selectedOrder.customer}</p>
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-600">
                    <span>{item.quantity}× {item.name}</span>
                    <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-2 space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Subtotal</span>
                    <span>₱{selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedOrder.serviceFee > 0 && (
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Service Fee</span>
                      <span>₱{selectedOrder.serviceFee.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-xs text-red-500">
                      <span>Discount ({selectedOrder.discountType} 20%)</span>
                      <span>− ₱{selectedOrder.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-primary pt-1" style={{ fontWeight: 700 }}>
                    <span>Total Amount Due</span>
                    <span>₱{selectedOrder.amountNumber.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Cash Input */}
              <div>
                <label className="block text-sm text-gray-700 mb-2" style={{ fontWeight: 500 }}>Cash Received</label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  placeholder="Enter amount"
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-muted"
                />
              </div>

              {/* Change Preview */}
              {cashReceived && isEnough && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <p className="text-xs text-emerald-600 mb-1">Change</p>
                  <p className="text-2xl text-emerald-700" style={{ fontWeight: 700 }}>₱{(cashFloat - selectedOrder.amountNumber).toFixed(2)}</p>
                </div>
              )}
              {cashReceived && !isEnough && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-xs text-red-500">Insufficient amount. Need ₱{(selectedOrder.amountNumber - cashFloat).toFixed(2)} more.</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={!isEnough || isCompletingPayment}
                  className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontWeight: 600 }}
                >
                  {isCompletingPayment ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Payment Successful ── */}
      {activeModal === 'payment-success' && selectedOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
            <div className="flex justify-end px-6 pt-4">
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="px-6 pb-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-lg text-gray-900 mb-1" style={{ fontWeight: 700 }}>Payment Successful!</h2>
              <p className="text-sm text-gray-400 mb-6">Order {selectedOrder.id} has been paid and marked as completed.</p>

              <div className="bg-muted rounded-xl p-4 text-left space-y-2 mb-6">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Payment ID</span>
                  <span className="text-gray-800 font-medium">{currentPaymentId}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Receipt ID</span>
                  <span className="text-gray-800 font-medium">{currentReceiptId}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Order ID</span>
                  <span className="text-gray-800 font-medium">{selectedOrder.id}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 space-y-1">
                  <div className="flex justify-between text-sm text-gray-700">
                    <span>Total Amount Due</span>
                    <span style={{ fontWeight: 600 }}>₱{selectedOrder.amountNumber.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-700">
                    <span>Amount Received</span>
                    <span>₱{(selectedOrder.cashReceived ?? cashFloat).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span style={{ fontWeight: 600 }}>Change</span>
                    <span style={{ fontWeight: 700 }}>₱{changeAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => setActiveModal('receipt')}
                  className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                  style={{ fontWeight: 600 }}
                >
                  <Printer className="w-4 h-4" />
                  Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Receipt (Thermal Style) ── */}
      {activeModal === 'receipt' && selectedOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-hidden shadow-2xl flex flex-col my-8">
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm text-gray-700" style={{ fontWeight: 600 }}>Receipt Preview</h2>
              <button onClick={handleCloseReceiptAfterPayment} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <ThermalReceipt
              orderNumber={selectedOrder.orderNumber || selectedOrder.id}
              customerName={selectedOrder.customer}
              orderType={selectedOrder.type as 'Dine-In' | 'Takeout' | 'Mixed'}
              table={selectedOrder.table !== '-' && selectedOrder.table !== '—' ? selectedOrder.table : undefined}
              items={selectedOrder.items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                itemType: item.itemType,
              }))}
              subtotal={selectedOrder.subtotal}
              serviceFee={selectedOrder.serviceFee}
              tax={selectedOrder.tax}
              discount={selectedOrder.discount}
              discountType={selectedOrder.discountType}
              total={selectedOrder.amountNumber}
              cashReceived={selectedOrder.cashReceived ?? cashFloat}
              changeGiven={selectedOrder.changeGiven ?? changeAmount}
              date={selectedOrder.date}
              time={selectedOrder.time}
              receiptId={selectedOrder.receiptId || currentReceiptId}
              paymentId={selectedOrder.paymentId || currentPaymentId}
              cashier={selectedOrder.cashier ?? userName ?? 'Staff'}
              storeBrand={storeBrand}
            />

            {/* Actions */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={handleCloseReceiptAfterPayment}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handlePrintReceipt}
                className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                style={{ fontWeight: 600 }}
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
              <button
                onClick={handlePrintReceipt}
                title="Download Receipt"
                className="py-2.5 px-3 border border-primary/20 text-primary hover:bg-primary/10 rounded-xl text-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Refund ── */}
      {canProcessTransactions && activeModal === 'refund' && selectedOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <h2 className="text-base text-red-600" style={{ fontWeight: 600 }}>Process Refund</h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-sm text-red-700 mb-1" style={{ fontWeight: 600 }}>⚠ Refund Warning</p>
                <p className="text-xs text-red-500">This will process a full refund for this order. This action cannot be undone.</p>
              </div>

              <div className="bg-muted rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Order #</span>
                  <span className="text-gray-800 font-medium">{selectedOrder.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Customer</span>
                  <span className="text-gray-800">{selectedOrder.customer}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Refund Amount</span>
                  <span className="text-red-600" style={{ fontWeight: 700 }}>₱{selectedOrder.amountNumber.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2" style={{ fontWeight: 500 }}>Reason for Refund *</label>
                <textarea
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  placeholder="Enter the reason for this refund..."
                  autoFocus
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 bg-muted resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRefundSubmit}
                  disabled={!refundReason.trim()}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontWeight: 600 }}
                >
                  Process Refund
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {canProcessTransactions && activeModal === 'void' && selectedOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <h2 className="text-base text-purple-700" style={{ fontWeight: 600 }}>Void Transaction</h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                <p className="text-sm text-purple-800 mb-1" style={{ fontWeight: 600 }}>Void Warning</p>
                <p className="text-xs text-purple-600">This will mark the paid order as void in the transaction history.</p>
              </div>

              <div className="bg-muted rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Order #</span>
                  <span className="text-gray-800 font-medium">{selectedOrder.orderNumber || selectedOrder.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Customer</span>
                  <span className="text-gray-800">{selectedOrder.customer}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Amount</span>
                  <span className="text-purple-700" style={{ fontWeight: 700 }}>₱{selectedOrder.amountNumber.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2" style={{ fontWeight: 500 }}>Reason for Void *</label>
                <textarea
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  placeholder="Enter the reason for voiding this transaction..."
                  autoFocus
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 bg-muted resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVoidSubmit}
                  disabled={!voidReason.trim()}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontWeight: 600 }}
                >
                  Void Transaction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {canProcessTransactions && (
      <DeleteConfirmDialog
        isOpen={Boolean(refundingOrder)}
        title="Confirm Delete"
        description={`Are you sure you want to refund and remove order ${refundingOrder?.id ?? ''}?`}
        onCancel={() => setRefundingOrder(null)}
        onConfirm={() => {
          if (!refundingOrder) return;
          removeOrder(refundingOrder.id);
          setRefundingOrder(null);
          closeModal();
        }}
      />
      )}
      {canProcessTransactions && (
      <DeleteConfirmDialog
        isOpen={Boolean(voidingOrder)}
        title="Confirm Void"
        description={`Are you sure you want to void order ${voidingOrder?.orderNumber || voidingOrder?.id || ''}?`}
        onCancel={() => setVoidingOrder(null)}
        onConfirm={() => {
          if (!voidingOrder) return;
          void voidOrder(voidingOrder.id)
            .then(() => {
              setVoidingOrder(null);
              closeModal();
            })
            .catch((error) => {
              alert(error instanceof Error ? error.message : 'Unable to void order.');
              setVoidingOrder(null);
          });
        }}
      />
      )}
    </div>
  );
}
