-- 在服务器上以 MySQL root 身份执行一次（可以按需换成别的库名和账号）
CREATE DATABASE IF NOT EXISTS attendance
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'attendance'@'%' IDENTIFIED BY '改成你的密码';
GRANT ALL PRIVILEGES ON attendance.* TO 'attendance'@'%';
FLUSH PRIVILEGES;

-- 本地开发用的库（可选）
CREATE DATABASE IF NOT EXISTS attendance_dev
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON attendance_dev.* TO 'attendance'@'%';
FLUSH PRIVILEGES;
