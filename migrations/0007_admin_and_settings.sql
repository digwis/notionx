-- 单管理员 + 后台系统设置
-- 1) users 增加 role 字段
-- 2) 新建 app_settings 单行表（单管理员系统配置）
-- 3) 升级 0005/0006 的 users 表结构

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- 唯一管理员邮箱：默认 zhaofilms@gmail.com
-- 该用户将在应用启动时通过初始化逻辑被授予 admin 权限
-- 若用户不存在，应用会在首次访问时自动创建并设置密码

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  site_title TEXT NOT NULL DEFAULT 'vinext Blog',
  google_enabled INTEGER NOT NULL DEFAULT 0,
  google_client_id TEXT,
  google_client_secret TEXT,
  google_updated_at TEXT,
  admin_email TEXT NOT NULL DEFAULT 'zhaofilms@gmail.com',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO app_settings (id) VALUES (1);
