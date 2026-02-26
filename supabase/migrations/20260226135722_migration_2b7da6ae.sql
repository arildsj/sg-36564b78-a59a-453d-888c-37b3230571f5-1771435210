-- Dropp den eksisterende policyen som ikke fungerer
DROP POLICY IF EXISTS "Authenticated users can insert gateways" ON sms_gateways;