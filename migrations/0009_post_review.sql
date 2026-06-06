-- 内容审核流
-- status: draft | pending_review | published | rejected
-- 公共 /blog 与 /api/posts 只显示 status = published 且 owner = admin_email 的文章
-- 普通用户创建时默认 draft；点“提交审核”后变 pending_review
-- 管理员可 approve → published / reject → rejected / return → draft

ALTER TABLE posts ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE posts ADD COLUMN reject_reason TEXT;
ALTER TABLE posts ADD COLUMN reviewed_by TEXT;
ALTER TABLE posts ADD COLUMN reviewed_at TEXT;

-- 历史数据：管理员账户发的文章直接视为已发布
UPDATE posts
   SET status = 'published',
       reviewed_at = datetime('now'),
       reviewed_by = owner_email
 WHERE owner_email = 'zhaofilms@gmail.com';

CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
