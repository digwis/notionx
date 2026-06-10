-- 多用户文章归属：posts 增加 owner_email
-- 前台 /blog 公开列表只显示 owner = admin_email 的文章
-- 后台 /admin 列表对管理员显示全部，对普通用户只显示 owner = 自己邮箱 的文章
-- 默认数据归属全部归到管理员邮箱

ALTER TABLE posts ADD COLUMN owner_email TEXT;

UPDATE posts SET owner_email = 'zhaofilms@gmail.com' WHERE owner_email IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_owner ON posts(owner_email);
