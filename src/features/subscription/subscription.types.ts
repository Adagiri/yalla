export interface SubscriptionPlanFilter {
  ids?: string[];
  name?: string;
  type?: string[];
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface SubscriptionPlanSort {
  field: 'name' | 'type' | 'price' | 'createdAt' | 'updatedAt';
  direction: 'ASC' | 'DESC';
}

export interface DriverSubscriptionFilter {
  ids?: string[];
  driverId?: string;
  planId?: string;
  status?: string[];
  startDateFrom?: Date;
  startDateTo?: Date;
  endDateFrom?: Date;
  endDateTo?: Date;
  autoRenew?: boolean;
}

export interface DriverSubscriptionSort {
  field: 'startDate' | 'endDate' | 'status' | 'createdAt' | 'updatedAt';
  direction: 'ASC' | 'DESC';
}
