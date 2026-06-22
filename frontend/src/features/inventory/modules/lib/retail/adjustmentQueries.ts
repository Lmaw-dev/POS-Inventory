import { useQuery } from '@tanstack/react-query';
import {
  approveAdjustment,
  createAdjustment,
  getAdjustments,
  rejectAdjustment,
} from '../../../app/api/client';
import { domainQueryKeys } from '../domainQueries';
import { retailQueryKeys, useRetailMutation } from './shared';

// Adjustment types the backend accepts (CreateAdjustmentDto.AdjustmentTypeEnum).
export type RetailAdjustmentType = 'ADD' | 'REMOVE' | 'DAMAGE' | 'LOST' | 'FOUND' | 'RECOUNT';
export type RetailAdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type RetailStockAdjustment = {
  id: string;
  adjustmentNumber: string;
  type: RetailAdjustmentType;
  reason: string;
  status: RetailAdjustmentStatus;
  rejectionReason?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  createdBy?: { id: string; name?: string | null; email?: string | null } | null;
  reviewedBy?: { id: string; name?: string | null; email?: string | null } | null;
  items: Array<{
    id: string;
    quantityChange: number;
    inventoryItem?: { id: string; name: string; category?: string; unit?: string | null } | null;
    location?: { id: string; name: string } | null;
  }>;
};

export type CreateRetailAdjustmentInput = {
  type: RetailAdjustmentType;
  reason: string;
  items: Array<{
    inventoryItemId: string;
    quantityChange: number;
    locationId: string;
    notes?: string;
  }>;
};

export function useRetailStockAdjustmentsQuery(status?: RetailAdjustmentStatus) {
  return useQuery({
    queryKey: [...domainQueryKeys.adjustments, { module: 'RETAIL', status: status ?? 'all' }],
    queryFn: () =>
      getAdjustments({ module: 'RETAIL', status }) as Promise<RetailStockAdjustment[]>,
  });
}

export function useCreateRetailStockAdjustmentMutation() {
  return useRetailMutation(
    (input: CreateRetailAdjustmentInput) =>
      createAdjustment({ ...input, module: 'RETAIL' }),
    [retailQueryKeys.adjustments, retailQueryKeys.inventory, retailQueryKeys.stockMovements],
  );
}

export function useApproveRetailStockAdjustmentMutation() {
  return useRetailMutation(
    (id: string) => approveAdjustment(id, 'RETAIL'),
    [retailQueryKeys.adjustments, retailQueryKeys.inventory, retailQueryKeys.stockMovements],
  );
}

export function useRejectRetailStockAdjustmentMutation() {
  return useRetailMutation(
    ({ id, reason }: { id: string; reason: string }) => rejectAdjustment(id, reason, 'RETAIL'),
    [retailQueryKeys.adjustments],
  );
}
