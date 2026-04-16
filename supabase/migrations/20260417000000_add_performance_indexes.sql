-- Performance indexes za scale
-- Sve operacije su CONCURRENTLY — ne blokiraju production čitanja/pisanja

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_user_checkin
  ON reservations(user_id, check_in DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_user_status
  ON reservations(user_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pending_reservations_user
  ON pending_reservations(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_apartment
  ON reservations(apartment_id, check_in, check_out);
