CREATE TYPE shipment_status AS ENUM ('WAITING_PICKUP','PICKED_UP','IN_TRANSIT','DELIVERED','FAILED');
CREATE TABLE shipments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 seller_order_id UUID NOT NULL REFERENCES seller_orders(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 tracking_code VARCHAR(80) NOT NULL,
 status shipment_status NOT NULL DEFAULT 'WAITING_PICKUP',
 delivery_attempt INTEGER NOT NULL DEFAULT 1 CHECK (delivery_attempt >= 1),
 delivered_at TIMESTAMPTZ(6), returned_confirmed_at TIMESTAMPTZ(6),
 version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX shipments_seller_order_id_key ON shipments(seller_order_id);
CREATE UNIQUE INDEX shipments_tracking_code_key ON shipments(tracking_code);
CREATE INDEX shipments_status_updated_id_idx ON shipments(status,updated_at,id);
CREATE TABLE shipment_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 from_status shipment_status, to_status shipment_status NOT NULL,
 delivery_attempt INTEGER NOT NULL CHECK (delivery_attempt >= 1),
 reason VARCHAR(500), operation_key VARCHAR(160) NOT NULL,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX shipment_events_operation_key_key ON shipment_events(operation_key);
CREATE INDEX shipment_events_shipment_created_id_idx ON shipment_events(shipment_id,created_at,id);
CREATE TRIGGER shipment_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON shipment_events FOR EACH STATEMENT EXECUTE FUNCTION reject_payment_ledger_mutation();
