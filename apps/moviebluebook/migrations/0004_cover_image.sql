-- 给 posts 表加 cover_image 列（指向 /api/files/<key> 或外部 URL）
ALTER TABLE posts ADD COLUMN cover_image TEXT;
