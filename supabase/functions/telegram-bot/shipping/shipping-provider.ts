export type ShippingProviderName = 'novaposhta';

export type ShipmentStatus =
  | 'created'
  | 'in_transit'
  | 'arrived'
  | 'delivered'
  | 'refused'
  | 'cancelled'
  | 'error';

export interface City {
  ref: string;
  name: string;
  area?: string;
}

export interface Warehouse {
  ref: string;
  name: string;
  cityRef: string;
  cityName?: string;
  type: 'warehouse' | 'parcel_locker';
  address?: string;
  number?: string;
}

export interface SearchCitiesParams {
  query: string;
  limit?: number;
}

export interface SearchWarehousesParams {
  cityRef: string;
  query?: string;
  type?: 'warehouse' | 'parcel_locker' | 'all';
  limit?: number;
}

export interface CreateWaybillParams {
  orderId: string;
  orderNumber: string;
  recipientName: string;
  recipientPhone: string;
  cityRef: string;
  warehouseRef: string;
  description: string;
  cost: number;
  payerType: 'Sender' | 'Recipient';
  weight?: number;
  seatsAmount?: number;
}

export interface CreateWaybillResult {
  ok: boolean;
  ttn?: string;
  ref?: string;
  cost?: number;
  rawResponse?: Record<string, unknown>;
  error?: string;
}

export interface TrackShipmentResult {
  ok: boolean;
  status: ShipmentStatus;
  statusCode?: string;
  statusText?: string;
  rawResponse?: Record<string, unknown>;
  error?: string;
}

export interface GetDocumentsResult {
  ok: boolean;
  documents?: { type: string; url: string; data?: string }[];
  rawResponse?: Record<string, unknown>;
  error?: string;
}

export interface CancelWaybillResult {
  ok: boolean;
  rawResponse?: Record<string, unknown>;
  error?: string;
}

export interface ShippingProvider {
  name: ShippingProviderName;
  label: string;
  enabled: boolean;
  searchCities(params: SearchCitiesParams): Promise<{ ok: boolean; cities?: City[]; error?: string }>;
  searchWarehouses(params: SearchWarehousesParams): Promise<{ ok: boolean; warehouses?: Warehouse[]; error?: string }>;
  createWaybill(params: CreateWaybillParams): Promise<CreateWaybillResult>;
  trackShipment(ttn: string): Promise<TrackShipmentResult>;
  getDocuments(ttn: string): Promise<GetDocumentsResult>;
  cancelWaybill(ref: string): Promise<CancelWaybillResult>;
}
