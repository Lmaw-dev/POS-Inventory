import { useState, useMemo } from 'react';
import { Sidebar } from '../../shared/components/Sidebar';
import { Page, type StoreBrand } from '../../shared/App';
import type { StaffType, StoreType } from '../../auth/types/auth';
import { useOrders } from '../context/RetailOrderContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, ShoppingBag, X, TrendingUp } from 'lucide-react';
import { DateFilterControl, type DateFilterMode } from '../../shared/components/DateFilterControl';
import { getLocalDateKey, parseLocalDateKey } from '../../shared/utils/date';

interface RetailPOSDashboardProps {
  onLogout: () => void;
  onNavigate: (page: Page) => void;
  isAdmin?: boolean;
  storeBrand?: StoreBrand;
  userName?: string | null;
  storeType?: StoreType;
  staffType?: StaffType;
}

function TopItemImage({ src, name }: { src?: string | null; name: string }) {
  return (
    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
      <span className="text-xs text-muted-foreground">{name.charAt(0).toUpperCase()}</span>
      {src ? (
        <img
          src={src}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      ) : null}
    </div>
  );
}

export function RetailPOSDashboard({ onLogout, onNavigate, isAdmin = false, storeBrand, userName, storeType = 'RETAIL_STORE', staffType }: RetailPOSDashboardProps) {
  const { orders } = useOrders();
  const today = getLocalDateKey();
  const [selectedDate, setSelectedDate] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterMode>('today');
  const [showTopItemsModal, setShowTopItemsModal] = useState(false);

  // Exclude void and fully refunded transactions from dashboard metrics
  const countedOrders = orders.filter(o => o.paymentStatus === 'Paid' || o.paymentStatus === 'Partially Refunded');
  const todayOrders = countedOrders.filter(o => o.date === today);
  const totalSalesToday = todayOrders.reduce((sum, o) => sum + o.amountNumber, 0);
  const totalTransactionsToday = todayOrders.length;
  const totalCustomers = new Set(countedOrders.map((order) => order.customer?.trim()).filter(Boolean)).size
    + countedOrders.filter((order) => !order.customer?.trim()).length;
  const recentTransactions = [...countedOrders].slice(0, 5);

  // Top Selling Items (same design as restaurant POS)

  const salesDataByFilter = {
    week: [
      { id: 'week-mon', label: 'Mon', sales: 3200 },
      { id: 'week-tue', label: 'Tue', sales: 4100 },
      { id: 'week-wed', label: 'Wed', sales: 3800 },
      { id: 'week-thu', label: 'Thu', sales: 5200 },
      { id: 'week-fri', label: 'Fri', sales: 6100 },
      { id: 'week-sat', label: 'Sat', sales: 7800 },
      { id: 'week-sun', label: 'Sun', sales: 6500 },
    ],
    month: [
      { id: 'month-w1', label: 'Week 1', sales: 18000 },
      { id: 'month-w2', label: 'Week 2', sales: 22000 },
      { id: 'month-w3', label: 'Week 3', sales: 19500 },
      { id: 'month-w4', label: 'Week 4', sales: 25000 },
    ],
    year: [
      { id: 'year-jan', label: 'Jan', sales: 65000 },
      { id: 'year-feb', label: 'Feb', sales: 71000 },
      { id: 'year-mar', label: 'Mar', sales: 78000 },
      { id: 'year-apr', label: 'Apr', sales: 82000 },
      { id: 'year-may', label: 'May', sales: 89000 },
    ],
  };

  const salesData = useMemo(() => {
    return salesDataByFilter[dateFilter as keyof typeof salesDataByFilter] || salesDataByFilter.week;
  }, [dateFilter]);

  const databaseSalesData = useMemo(() => {
    const paidOrders = orders.filter((order) => order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Refunded');
    const now = new Date();

    if (dateFilter === 'today') {
      return [{
        id: `today-${today}`,
        label: 'Today',
        sales: paidOrders.filter((order) => order.date === today).reduce((sum, order) => sum + order.amountNumber, 0),
      }];
    }

    if (dateFilter === 'date') {
      return [{
        id: `date-${selectedDate || today}`,
        label: selectedDate || today,
        sales: paidOrders.filter((order) => order.date === (selectedDate || today)).reduce((sum, order) => sum + order.amountNumber, 0),
      }];
    }

    if (dateFilter === 'week') {
      return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(now);
        date.setDate(now.getDate() - (6 - index));
        const dateKey = getLocalDateKey(date);
        return {
          id: `day-${dateKey}`,
          label: date.toLocaleDateString('en-US', { weekday: 'short' }),
          sales: paidOrders.filter((order) => order.date === dateKey).reduce((sum, order) => sum + order.amountNumber, 0),
        };
      });
    }

    if (dateFilter === 'year') {
      return Array.from({ length: 12 }, (_, month) => {
        const date = new Date(now.getFullYear(), month, 1);
        return {
          id: `month-${month}`,
          label: date.toLocaleDateString('en-US', { month: 'short' }),
          sales: paidOrders
            .filter((order) => {
              const orderDate = parseLocalDateKey(order.date);
              return orderDate.getFullYear() === now.getFullYear() && orderDate.getMonth() === month;
            })
            .reduce((sum, order) => sum + order.amountNumber, 0),
        };
      });
    }

    const target = new Date(now.getFullYear(), now.getMonth(), 1);
    return Array.from({ length: 5 }, (_, week) => ({
      id: `week-${week + 1}`,
      label: `Week ${week + 1}`,
      sales: paidOrders
        .filter((order) => {
          const orderDate = parseLocalDateKey(order.date);
          return orderDate.getFullYear() === target.getFullYear()
            && orderDate.getMonth() === target.getMonth()
            && Math.floor((orderDate.getDate() - 1) / 7) === week;
        })
        .reduce((sum, order) => sum + order.amountNumber, 0),
    }));
  }, [dateFilter, orders, selectedDate]);

  const databaseTopSellingItems = useMemo(() => {
    const itemMap = new Map<string, { id: string; name: string; sold: number; revenue: string; revenueValue: number; image: string }>();

    orders.filter((order) => order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Refunded').forEach((order) => {
      order.items.forEach((item) => {
        const current = itemMap.get(item.name) ?? { id: item.name, name: item.name, sold: 0, revenue: 'PHP 0.00', revenueValue: 0, image: item.image || storeBrand?.logo || '' };
        if ((!current.image || current.image === storeBrand?.logo) && item.image) {
          current.image = item.image;
        }
        current.sold += item.quantity;
        current.revenueValue += item.price * item.quantity;
        current.revenue = `PHP ${current.revenueValue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        itemMap.set(item.name, current);
      });
    });

    return Array.from(itemMap.values()).sort((a, b) => b.sold - a.sold);
  }, [orders, storeBrand?.logo]);

  const visibleTopSellingItems = databaseTopSellingItems.slice(0, 4);

  return (
    <div className="flex h-screen">
      <Sidebar currentPage="retail-pos-dashboard" onNavigate={onNavigate} onLogout={onLogout} isAdmin={isAdmin} storeType={storeType} staffType={staffType} storeBrand={storeBrand} userName={userName} />

      <div className="flex-1 overflow-auto bg-background">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl text-primary mb-1">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Welcome back! Here's what's happening today.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-card rounded-xl shadow-sm border border-border p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Total Sales Today</p>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <h2 className="text-2xl text-primary">₱{totalSalesToday.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
              <p className="text-xs text-muted-foreground mt-1">{totalTransactionsToday} transactions</p>
            </div>

            <div className="bg-card rounded-xl shadow-sm border border-border p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Transactions Today</p>
                <ShoppingBag className="w-4 h-4 text-blue-500" />
              </div>
              <h2 className="text-2xl text-primary">{totalTransactionsToday}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {totalTransactionsToday > 0 ? `Avg: ₱${(totalSalesToday / totalTransactionsToday).toFixed(2)}` : 'No sales yet'}
              </p>
            </div>

            <div className="bg-card rounded-xl shadow-sm border border-border p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <Calendar className="w-4 h-4 text-purple-500" />
              </div>
              <h2 className="text-2xl text-primary">{totalCustomers}</h2>
              <p className="text-xs text-muted-foreground mt-1">All-time unique customers</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="lg:col-span-2 bg-card rounded-xl shadow-sm border border-border p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base text-primary">Sales Overview</h3>
                <div className="flex items-center gap-2">
                  <DateFilterControl
                    mode={dateFilter}
                    selectedDate={selectedDate}
                    onModeChange={setDateFilter}
                    onDateChange={setSelectedDate}
                    className="px-2.5 py-1 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-input-background"
                  />
                </div>
              </div>

              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={databaseSalesData} key={dateFilter}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [`₱${value.toLocaleString()}`, 'Sales']}
                  />
                  <Line key="sales-line" type="monotone" dataKey="sales" stroke="#008967" strokeWidth={2} dot={{ fill: '#008967', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-xl shadow-sm border border-border p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base text-primary">Best Selling</h3>
                <button
                  onClick={() => setShowTopItemsModal(true)}
                  className="text-xs text-primary hover:underline"
                >
                  View All
                </button>
              </div>

              <div className="space-y-3">
                {visibleTopSellingItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <TopItemImage src={item.image} name={item.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.sold} sold</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-primary">{item.revenue}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-sm border border-border p-5">
            <h3 className="text-base text-primary mb-4">Recent Transactions</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Transaction #</th>
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Customer</th>
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Date</th>
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Items</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Amount</th>
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.length > 0 ? (
                    recentTransactions.map((order) => (
                      <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 text-xs">{order.id}</td>
                        <td className="py-2.5 text-xs">{order.customer?.trim() || 'Walk-in Customer'}</td>
                        <td className="py-2.5 text-xs">{order.date}</td>
                        <td className="py-2.5 text-xs">{order.items.length} items</td>
                        <td className="py-2.5 text-xs text-right text-primary font-medium">
                          ₱{order.amountNumber.toFixed(2)}
                        </td>
                        <td className="py-2.5 text-xs">
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">
                            {order.paymentMethod || 'Cash'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                        No transactions yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Top Items Modal */}
      {showTopItemsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-border">
              <h2 className="text-lg text-primary">All Top Selling Items</h2>
              <button onClick={() => setShowTopItemsModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#0f172a]">
                    <th className="sticky top-0 bg-[#0f172a] px-4 py-3 text-left text-xs font-semibold text-emerald-400 uppercase tracking-widest z-10 shadow-[0_1px_0_0_#008967]">Rank</th>
                    <th className="sticky top-0 bg-[#0f172a] px-4 py-3 text-left text-xs font-semibold text-emerald-400 uppercase tracking-widest z-10 shadow-[0_1px_0_0_#008967]">Item</th>
                    <th className="sticky top-0 bg-[#0f172a] px-4 py-3 text-left text-xs font-semibold text-emerald-400 uppercase tracking-widest z-10 shadow-[0_1px_0_0_#008967]">Sold</th>
                    <th className="sticky top-0 bg-[#0f172a] px-4 py-3 text-left text-xs font-semibold text-emerald-400 uppercase tracking-widest z-10 shadow-[0_1px_0_0_#008967]">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {databaseTopSellingItems.map((item, index) => (
                    <tr key={item.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                      <td className="px-3 py-3">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <TopItemImage src={item.image} name={item.name} />
                          <p className="text-sm truncate">{item.name}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm">{item.sold} orders</td>
                      <td className="px-3 py-3 text-sm text-primary">{item.revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


