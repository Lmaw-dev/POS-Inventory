import { useQuery } from '@tanstack/react-query';
import {
  approveAdjustment,
  createAdjustment,
  getAdjustments,
  rejectAdjustment,
} from '../../../app/api/client';
import { domainQueryKeys, useDomainMutation } from '../domainQueries';

// Adjustment types the backend accepts (CreateAdjustmentDto.AdjustmentTypeEnum).
export type RestaurantAdjustmentType = 'ADD' | 'REMOVE' | 'DAMAGE' | 'LOST' | 'FOUND' | 'RECOUNT';
export type RestaurantAdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type RestaurantStockAdjustment = {
  id: string;
  adjustmentNumber: string;
  type: RestaurantAdjustmentType;
  reason: string;
  status: RestaurantAdjustmentStatus;
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

export type CreateRestaurantAdjustmentInput = {
  type: RestaurantAdjustmentType;
  reason: string;
  items: Array<{
    inventoryItemId: string;
    quantityChange: number;
    locationId: string;
    notes?: string;
  }>;
};

export function useRestaurantStockAdjustmentsQuery(status?: RestaurantAdjustmentStatus) {
  return useQuery({
    queryKey: [...domainQueryKeys.adjustments, { module: 'RESTAURANT', status: status ?? 'all' }],
    queryFn: () =>
      getAdjustments({ module: 'RESTAURANT', status }) as Promise<RestaurantStockAdjustment[]>,
  });
}

export function useCreateRestaurantStockAdjustmentMutation() {
  return useDomainMutation(
    (input: CreateRestaurantAdjustmentInput) =>
      createAdjustment({ ...input, module: 'RESTAURANT' }),
    [domainQueryKeys.adjustments, domainQueryKeys.inventory, domainQueryKeys.stockMovements],
  );
}

export function useApproveRestaurantStockAdjustmentMutation() {
  return useDomainMutation(
    (id: string) => approveAdjustment(id, 'RESTAURANT'),
    [domainQueryKeys.adjustments, domainQueryKeys.inventory, domainQueryKeys.stockMovements],
  );
}

export function useRejectRestaurantStockAdjustmentMutation() {
  return useDomainMutation(
    ({ id, reason }: { id: string; reason: string }) => rejectAdjustment(id, reason, 'RESTAURANT'),
    [domainQueryKeys.adjustments],
  );
}
