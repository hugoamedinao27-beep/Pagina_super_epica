CREATE DATABASE IF NOT EXISTS tienda_super_wai
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE tienda_super_wai;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    rol ENUM('admin', 'empleado') NOT NULL DEFAULT 'empleado',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS asistencia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tipo ENUM('entrada', 'salida') NOT NULL,
    fecha DATE GENERATED ALWAYS AS (DATE(fecha_hora)) STORED,
    fecha_hora DATETIME NOT NULL,
    CONSTRAINT fk_asistencia_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_asistencia_usuario_fecha_tipo (usuario_id, fecha, tipo),
    KEY idx_asistencia_fecha_tipo_hora (fecha, tipo, fecha_hora)
) ENGINE=InnoDB;
