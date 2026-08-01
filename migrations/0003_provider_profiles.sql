ALTER TABLE api_key_profiles ADD COLUMN provider TEXT NOT NULL DEFAULT 'qwen';
ALTER TABLE api_key_profiles ADD COLUMN base_url TEXT NOT NULL DEFAULT 'https://dashscope.aliyuncs.com/compatible-mode/v1';
