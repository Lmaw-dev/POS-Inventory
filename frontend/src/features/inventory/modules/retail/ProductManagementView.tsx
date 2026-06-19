import { useState } from 'react';
import { Search, Save, Trash2, Plus, X, PackageSearch, AlertTriangle, ShieldAlert, Boxes } from 'lucide-react';
import { categorySubcategories } from '../../app/utils/constants';
import {
  useDeleteRetailInventoryMutation,
  useRetailInventoryRecordsQuery,
  useRetailLocationsQuery,
  useSaveRetailInventoryMutation,
} from '../lib/retail';

const categories = Object.keys(categorySubcategories);

const conditionBadgeClass = (condition: string) => {
  const map: Record<string, string> = {
    Excellent: 'bg-secondary/10 text-secondary',
    Good: 'bg-secondary/10 text-secondary',
    Fair: 'bg-warning/10 text-warning',
    Damaged: 'bg-destructive/10 text-destructive',
  };
  return map[condition] ?? 'bg-muted text-muted-foreground';
};

const blankNewItem = () => ({
  name: '',
  description: '',
  imageUrl: '',
  sku: '',
  category: '',
  subcategory: '',
  targetCustomer: 'Unisex',
  size: '',
  condition: 'Good',
  price: 0,
  minStock: 0,
  maxStock: 0,
  reorderPoint: 0,
  locationId: '',
});

export default function ProductManagementView({
  currentUser,
}: {
  currentUser: { email: string; role: string } | null;
}) {
  const itemsQuery = useRetailInventoryRecordsQuery();
  const locationsQuery = useRetailLocationsQuery();
  const saveInventoryMutation = useSaveRetailInventoryMutation();
  const deleteInventoryMutation = useDeleteRetailInventoryMutation();
  const items = itemsQuery.data ?? [];
  const locations = locationsQuery.data ?? [];
  const loading = itemsQuery.isLoading || locationsQuery.isLoading;
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newItemForm, setNewItemForm] = useState(blankNewItem());

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  const openItem = (item: any) => {
    setSelectedItem(item);
    setShowDeleteConfirm(false);
    setForm({
      name: item.name ?? '',
      description: item.description ?? '',
      imageUrl: item.imageUrl ?? '',
      sku: item.sku ?? '',
      category: item.category ?? '',
      subcategory: item.subcategory ?? '',
      targetCustomer: item.targetCustomer ?? 'Unisex',
      size: item.size ?? '',
      condition: item.condition ?? 'Good',
      price: item.price ?? 0,
      minStock: item.minStock ?? 0,
      maxStock: item.maxStock ?? 0,
      reorderPoint: item.reorderPoint ?? 0,
      locationId: item.locationId ?? '',
    });
  };

  const handleSave = async () => {
    if (!selectedItem || !form.name.trim()) return;
    setSaving(true);
    try {
      await saveInventoryMutation.mutateAsync({
        id: selectedItem.id,
        data: {
          name: form.name.trim(),
          description: form.description?.trim() || null,
          imageUrl: form.imageUrl?.trim() || null,
          sku: form.sku?.trim() || undefined,
          category: form.category,
          subcategory: form.subcategory,
          targetCustomer: form.targetCustomer,
          size: form.size,
          condition: form.condition,
          price: Number(form.price),
          minStock: Number(form.minStock),
          maxStock: Number(form.maxStock),
          reorderPoint: Number(form.reorderPoint),
          locationId: form.locationId || undefined,
        },
      });
    } catch (err: any) {
      alert(err.message ?? 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      await deleteInventoryMutation.mutateAsync(selectedItem.id);
      setSelectedItem(null);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      alert(err.message ?? 'Failed to delete item');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newItemForm.name.trim() || !newItemForm.category || !newItemForm.locationId) {
      alert('Name, Category, and Location are required');
      return;
    }
    setSaving(true);
    try {
      await saveInventoryMutation.mutateAsync({
        data: {
          name: newItemForm.name.trim(),
          description: newItemForm.description.trim() || null,
          imageUrl: newItemForm.imageUrl.trim() || null,
          sku: newItemForm.sku?.trim() || undefined,
          itemType: 'RETAIL_ITEM',
          category: newItemForm.category,
          subcategory: newItemForm.subcategory,
          targetCustomer: newItemForm.targetCustomer,
          size: newItemForm.size,
          condition: newItemForm.condition,
          quantity: 0,
          price: Number(newItemForm.price),
          unit: 'pcs',
          minStock: Number(newItemForm.minStock),
          maxStock: Number(newItemForm.maxStock),
          reorderPoint: Number(newItemForm.reorderPoint),
          locationId: newItemForm.locationId,
        },
      });
      setNewItemForm(blankNewItem());
      setShowNewItemModal(false);
    } catch (err: any) {
      alert(err.message ?? 'Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (item.name ?? '').toLowerCase().includes(q) || (item.sku ?? '').toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const subcategoryOptions = form.category ? (categorySubcategories[form.category] ?? []) : [];
  const newSubcategoryOptions = newItemForm.category ? (categorySubcategories[newItemForm.category] ?? []) : [];

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading product catalog…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl rounded-[12px] border border-destructive/30 bg-destructive/10 p-6">
        <div className="flex items-center gap-3 text-destructive mb-2">
          <ShieldAlert className="size-6" />
          <h2 className="text-[18px] font-bold">Admin Access Required</h2>
        </div>
        <p className="text-[13px] text-destructive">Product Management is restricted to Admin and Manager roles.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[30px] font-bold text-foreground">Product Management</h2>
          <p className="text-[14px] text-muted-foreground mt-1">Edit item master data — name, category, pricing, and stock thresholds.</p>
        </div>
        <button
          onClick={() => setShowNewItemModal(true)}
          className="bg-secondary text-white px-4 py-2 rounded-[8px] text-[14px] font-medium flex items-center gap-2 hover:bg-secondary transition-colors"
        >
          <Plus className="size-4" />
          New Item
        </button>
      </div>

      {/* Warning banner */}
      <div className="mb-4 rounded-[10px] border border-warning bg-warning/10 p-3 text-warning flex items-start gap-3">
        <AlertTriangle className="size-4 flex-shrink-0 mt-0.5" />
        <p className="text-[13px]">Changes here affect item master data only. Quantity changes should go through Purchase Orders, Goods Received, or Adjustments.</p>
      </div>

      {/* Split panel */}
      <div className="grid grid-cols-[320px_1fr] gap-4 flex-1 min-h-0">
        {/* Left: item list */}
        <div className="bg-white border border-border rounded-[14px] p-4 flex flex-col overflow-hidden">
          <div className="mb-3 flex items-center gap-2">
            <PackageSearch className="size-5 text-secondary" />
            <h3 className="font-semibold text-foreground text-[14px]">Product Catalog</h3>
            <span className="ml-auto text-[12px] text-muted-foreground">{filteredItems.length} items</span>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name or SKU…"
              className="w-full pl-9 pr-3 py-2 border border-border rounded-[8px] text-[13px] focus:outline-none focus:border-secondary"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="mb-3 w-full px-3 py-2 border border-border rounded-[8px] text-[13px] focus:outline-none focus:border-secondary"
          >
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => openItem(item)}
                className={`w-full text-left px-3 py-3 rounded-[8px] border transition-colors ${selectedItem?.id === item.id ? 'border-secondary bg-secondary/10' : 'border-transparent hover:bg-muted'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-medium text-foreground truncate">{item.name}</p>
                  <span className={`flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${conditionBadgeClass(item.condition ?? 'Good')}`}>
                    {item.condition ?? 'Good'}
                  </span>
                </div>
                <p className="text-[12px] text-muted-foreground mt-0.5">{item.category}{item.subcategory ? ` › ${item.subcategory}` : ''}</p>
                <p className="text-[12px] text-muted-foreground">₱{Number(item.price).toLocaleString()} • qty: {item.quantity}</p>
              </button>
            ))}
            {filteredItems.length === 0 && (
              <div className="py-8 text-center text-[13px] text-muted-foreground">No items found</div>
            )}
          </div>
        </div>

        {/* Right: edit panel */}
        <div className="bg-white border border-border rounded-[14px] p-6 overflow-y-auto">
          {!selectedItem ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Boxes className="size-12 text-muted mx-auto mb-3" />
                <p className="text-[14px] text-muted-foreground">Select an item from the list to edit its master data</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[20px] font-bold text-foreground">{selectedItem.name}</h3>
                  <p className="text-[12px] text-muted-foreground">SKU: {selectedItem.sku || '—'} • Current qty: {selectedItem.quantity}</p>
                </div>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[13px] text-destructive font-medium">Delete this item?</span>
                    <button onClick={handleDelete} disabled={saving} className="px-3 py-1.5 bg-destructive text-white rounded-[6px] text-[13px] font-medium hover:bg-destructive disabled:opacity-60">
                      Yes, delete
                    </button>
                    <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 border border-border text-foreground rounded-[6px] text-[13px]">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowDeleteConfirm(true)} className="p-2 hover:bg-destructive/10 text-destructive rounded-[6px] transition-colors flex-shrink-0" title="Delete item">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              {/* Basic fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[12px] font-medium text-foreground mb-1">Item Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[12px] font-medium text-foreground mb-1">Menu Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe the product shown in the retail menu" className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary resize-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[12px] font-medium text-foreground mb-1">Product Picture</label>
                  <input type="url" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://example.com/product.jpg" className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
                  <input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setForm((current: any) => ({ ...current, imageUrl: String(reader.result ?? '') })); reader.readAsDataURL(file); }} className="mt-2 block w-full text-[12px] text-muted-foreground file:mr-2 file:rounded-[6px] file:border-0 file:bg-secondary/10 file:px-3 file:py-2 file:text-secondary" />
                  {form.imageUrl && <img src={form.imageUrl} alt="Product preview" className="mt-3 h-40 w-full rounded-[8px] border border-border object-cover" />}
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">SKU</label>
                  <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="Optional" className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">Size</label>
                  <input value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} placeholder="e.g., M, L, XL" className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value, subcategory: '' })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary">
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">Subcategory</label>
                  <select value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })} disabled={!form.category} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary disabled:opacity-50">
                    <option value="">Select subcategory</option>
                    {subcategoryOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">Target Customer</label>
                  <select value={form.targetCustomer} onChange={e => setForm({ ...form, targetCustomer: e.target.value })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Unisex">Unisex</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">Condition</label>
                  <select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary">
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
              </div>

              {/* Pricing & Thresholds */}
              <div className="border-t border-border/50 pt-4">
                <h4 className="text-[13px] font-semibold text-foreground mb-3">Pricing & Stock Thresholds</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-foreground mb-1">Selling Price (₱)</label>
                    <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-foreground mb-1">Min Stock</label>
                    <input type="number" min="0" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-foreground mb-1">Max Stock</label>
                    <input type="number" min="0" value={form.maxStock} onChange={e => setForm({ ...form, maxStock: e.target.value })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-foreground mb-1">Reorder Point</label>
                    <input type="number" min="0" value={form.reorderPoint} onChange={e => setForm({ ...form, reorderPoint: e.target.value })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="border-t border-border/50 pt-4">
                <h4 className="text-[13px] font-semibold text-foreground mb-3">Location</h4>
                <select value={form.locationId} onChange={e => setForm({ ...form, locationId: e.target.value })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary">
                  <option value="">— No location assigned —</option>
                  {locations.map((loc: any) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                </select>
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-secondary text-white rounded-[8px] text-[14px] font-medium hover:bg-secondary transition-colors disabled:opacity-60 flex items-center gap-2">
                  <Save className="size-4" />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Item Modal */}
      {showNewItemModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-[14px] p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-border shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[20px] font-bold text-foreground">Add New Product</h3>
              <button onClick={() => setShowNewItemModal(false)} className="p-1 hover:bg-muted rounded-[6px]">
                <X className="size-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">Item Name *</label>
                <input value={newItemForm.name} onChange={e => setNewItemForm({ ...newItemForm, name: e.target.value })} placeholder="e.g., Vintage Denim Jacket" className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">Menu Description</label>
                <textarea value={newItemForm.description} onChange={e => setNewItemForm({ ...newItemForm, description: e.target.value })} rows={3} placeholder="Describe this product" className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary resize-none" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">Product Picture</label>
                <input type="url" value={newItemForm.imageUrl} onChange={e => setNewItemForm({ ...newItemForm, imageUrl: e.target.value })} placeholder="https://example.com/product.jpg" className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
                <input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setNewItemForm(current => ({ ...current, imageUrl: String(reader.result ?? '') })); reader.readAsDataURL(file); }} className="mt-2 block w-full text-[12px] text-muted-foreground file:mr-2 file:rounded-[6px] file:border-0 file:bg-secondary/10 file:px-3 file:py-2 file:text-secondary" />
                {newItemForm.imageUrl && <img src={newItemForm.imageUrl} alt="Product preview" className="mt-2 h-36 w-full rounded-[8px] border border-border object-cover" />}
              </div>
              <div>
                <label className="block text-[12px] font-medium text-foreground mb-1">SKU (optional)</label>
                <input value={newItemForm.sku} onChange={e => setNewItemForm({ ...newItemForm, sku: e.target.value })} placeholder="Leave blank to auto-generate" className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">Category *</label>
                  <select value={newItemForm.category} onChange={e => setNewItemForm({ ...newItemForm, category: e.target.value, subcategory: '' })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary">
                    <option value="">Select</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">Subcategory</label>
                  <select value={newItemForm.subcategory} onChange={e => setNewItemForm({ ...newItemForm, subcategory: e.target.value })} disabled={!newItemForm.category} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary disabled:opacity-50">
                    <option value="">Select</option>
                    {newSubcategoryOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">Target Customer</label>
                  <select value={newItemForm.targetCustomer} onChange={e => setNewItemForm({ ...newItemForm, targetCustomer: e.target.value })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Unisex">Unisex</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">Size</label>
                  <input value={newItemForm.size} onChange={e => setNewItemForm({ ...newItemForm, size: e.target.value })} placeholder="e.g., M, L, XL" className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">Condition</label>
                  <select value={newItemForm.condition} onChange={e => setNewItemForm({ ...newItemForm, condition: e.target.value })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary">
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">Selling Price (₱)</label>
                  <input type="number" min="0" step="0.01" value={newItemForm.price} onChange={e => setNewItemForm({ ...newItemForm, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">Min Stock</label>
                  <input type="number" min="0" value={newItemForm.minStock} onChange={e => setNewItemForm({ ...newItemForm, minStock: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">Max Stock</label>
                  <input type="number" min="0" value={newItemForm.maxStock} onChange={e => setNewItemForm({ ...newItemForm, maxStock: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">Reorder Point</label>
                  <input type="number" min="0" value={newItemForm.reorderPoint} onChange={e => setNewItemForm({ ...newItemForm, reorderPoint: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-foreground mb-1">Location *</label>
                  <select value={newItemForm.locationId} onChange={e => setNewItemForm({ ...newItemForm, locationId: e.target.value })} className="w-full px-3 py-2 border border-border rounded-[8px] text-[14px] focus:outline-none focus:border-secondary">
                    <option value="">Select location</option>
                    {locations.map((loc: any) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowNewItemModal(false)} className="flex-1 px-4 py-2 border border-border text-foreground rounded-[8px] text-[14px] hover:bg-muted">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 px-4 py-2 bg-secondary text-white rounded-[8px] text-[14px] font-medium hover:bg-secondary disabled:opacity-60">
                {saving ? 'Creating…' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
