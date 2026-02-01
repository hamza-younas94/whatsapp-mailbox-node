-- init-db.sql
-- Additional database tables not in Prisma schema

CREATE TABLE IF NOT EXISTS deals (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    contact_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    value DECIMAL(10, 2) DEFAULT 0,
    stage VARCHAR(50) NOT NULL,
    status ENUM('OPEN', 'WON', 'LOST') DEFAULT 'OPEN',
    expected_close_date DATETIME NULL,
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_contact_id (contact_id),
    INDEX idx_status (status),
    INDEX idx_stage (stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
