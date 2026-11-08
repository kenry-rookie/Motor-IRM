-- Corre una sola vez, al crear el volumen por primera vez.
-- Base aparte para las pruebas de integración (npm test): se vacía en cada
-- corrida y así nunca se tocan los datos de desarrollo.
CREATE DATABASE motor_irm_test OWNER motor_irm;
