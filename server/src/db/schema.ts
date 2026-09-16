/**
 * 建表语句，全部幂等，容器每次启动执行一遍。
 * 全部使用 utf8mb4，date 列一律 DATE 类型（不要 DATETIME），避免时区换算。
 */
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS records (
     date DATE NOT NULL,
     portion ENUM('full','morning','afternoon','absent') NOT NULL,
     reason VARCHAR(16) NULL,
     note VARCHAR(200) NULL,
     by_name VARCHAR(32) NULL,
     updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     PRIMARY KEY (date)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS holidays (
     date DATE NOT NULL,
     label VARCHAR(64) NOT NULL DEFAULT '',
     PRIMARY KEY (date)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS terms (
     id INT NOT NULL AUTO_INCREMENT,
     name VARCHAR(64) NOT NULL,
     start_date DATE NOT NULL,
     end_date DATE NOT NULL,
     is_active TINYINT(1) NOT NULL DEFAULT 0,
     PRIMARY KEY (id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS app_settings (
     k VARCHAR(64) NOT NULL,
     v TEXT NOT NULL,
     PRIMARY KEY (k)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];
