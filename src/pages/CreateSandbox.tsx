import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Plus, Minus, AlertCircle } from 'lucide-react';
import { sandboxApi } from '../api/sandbox';
import type { CreateSandboxRequest } from '../types/sandbox';
import styles from './CreateSandbox.module.css';

export function CreateSandbox() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    projectName: '',
    imageUri: 'sandbox-registry.cn-zhangjiakou.cr.aliyuncs.com/opensandbox/code-interpreter:latest',
    timeout: 3600,
    cpu: '500m',
    memory: '512Mi',
    entrypoint: ['sh', '-c', 'sleep infinity'],
    envVars: [] as { key: string; value: string }[],
    metadata: [] as { key: string; value: string }[],
  });

  const createMutation = useMutation({
    mutationFn: sandboxApi.create,
    onSuccess: (data) => navigate(`/sandbox/${data.id}`),
    onError: (err: any) => {
      setError(err.response?.data?.message || '创建失败，请重试');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 构建 metadata，包含项目名
    const metadata: Record<string, string> = {};
    if (formData.projectName.trim()) {
      metadata['project.name'] = formData.projectName.trim();
    }
    if (formData.metadata.length > 0) {
      Object.assign(metadata, Object.fromEntries(formData.metadata.map((v) => [v.key, v.value])));
    }

    const request: CreateSandboxRequest = {
      image: { uri: formData.imageUri },
      timeout: formData.timeout,
      resourceLimits: {
        cpu: formData.cpu,
        memory: formData.memory,
      },
      entrypoint: formData.entrypoint,
      env:
        formData.envVars.length > 0
          ? Object.fromEntries(formData.envVars.map((v) => [v.key, v.value]))
          : undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    createMutation.mutate(request);
  };

  const addEnvVar = () => {
    setFormData((prev) => ({
      ...prev,
      envVars: [...prev.envVars, { key: '', value: '' }],
    }));
  };

  const removeEnvVar = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      envVars: prev.envVars.filter((_, i) => i !== index),
    }));
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    setFormData((prev) => ({
      ...prev,
      envVars: prev.envVars.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    }));
  };

  const addMetadata = () => {
    setFormData((prev) => ({
      ...prev,
      metadata: [...prev.metadata, { key: '', value: '' }],
    }));
  };

  const removeMetadata = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      metadata: prev.metadata.filter((_, i) => i !== index),
    }));
  };

  const updateMetadata = (index: number, field: 'key' | 'value', value: string) => {
    setFormData((prev) => ({
      ...prev,
      metadata: prev.metadata.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    }));
  };

  return (
    <div className={styles.container}>
      <Link to="/" className={styles.backLink}>
        <ArrowLeft size={18} />
        返回列表
      </Link>

      <h1>创建沙箱</h1>
      <p className={styles.subtitle}>配置并创建一个新的沙箱实例</p>

      {error && (
        <div className={styles.error}>
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.section}>
          <h3>基本信息</h3>
          <div className={styles.field}>
            <label>项目名称</label>
            <input
              type="text"
              value={formData.projectName}
              onChange={(e) => setFormData((prev) => ({ ...prev, projectName: e.target.value }))}
              placeholder="例如: my-project, test-env"
            />
            <span className={styles.hint}>用于区分不同项目的沙箱</span>
          </div>
        </div>

        <div className={styles.section}>
          <h3>镜像配置</h3>
          <div className={styles.field}>
            <label>镜像地址 *</label>
            <input
              type="text"
              value={formData.imageUri}
              onChange={(e) => setFormData((prev) => ({ ...prev, imageUri: e.target.value }))}
              placeholder="例如: python:3.11, ubuntu:22.04"
              required
            />
          </div>
        </div>

        <div className={styles.section}>
          <h3>资源配置</h3>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>超时时间（秒）*</label>
              <input
                type="number"
                value={formData.timeout}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, timeout: parseInt(e.target.value) }))
                }
                min={60}
                max={86400}
                required
              />
              <span className={styles.hint}>60 - 86400 秒</span>
            </div>
            <div className={styles.field}>
              <label>CPU</label>
              <input
                type="text"
                value={formData.cpu}
                onChange={(e) => setFormData((prev) => ({ ...prev, cpu: e.target.value }))}
                placeholder="500m"
              />
            </div>
            <div className={styles.field}>
              <label>内存</label>
              <input
                type="text"
                value={formData.memory}
                onChange={(e) => setFormData((prev) => ({ ...prev, memory: e.target.value }))}
                placeholder="512Mi"
              />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h3>入口命令 *</h3>
          <div className={styles.field}>
            <input
              type="text"
              value={formData.entrypoint.join(' ')}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  entrypoint: e.target.value.split(' ').filter(Boolean),
                }))
              }
              placeholder="sh -c 'sleep infinity'"
              required
            />
            <span className={styles.hint}>以空格分隔的命令</span>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>环境变量</h3>
            <button type="button" className={styles.addBtn} onClick={addEnvVar}>
              <Plus size={16} />
              添加
            </button>
          </div>
          {formData.envVars.map((envVar, index) => (
            <div key={index} className={styles.kvRow}>
              <input
                type="text"
                value={envVar.key}
                onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                placeholder="KEY"
              />
              <input
                type="text"
                value={envVar.value}
                onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                placeholder="VALUE"
              />
              <button type="button" className={styles.removeBtn} onClick={() => removeEnvVar(index)}>
                <Minus size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>元数据</h3>
            <button type="button" className={styles.addBtn} onClick={addMetadata}>
              <Plus size={16} />
              添加
            </button>
          </div>
          {formData.metadata.map((meta, index) => (
            <div key={index} className={styles.kvRow}>
              <input
                type="text"
                value={meta.key}
                onChange={(e) => updateMetadata(index, 'key', e.target.value)}
                placeholder="KEY"
              />
              <input
                type="text"
                value={meta.value}
                onChange={(e) => updateMetadata(index, 'value', e.target.value)}
                placeholder="VALUE"
              />
              <button type="button" className={styles.removeBtn} onClick={() => removeMetadata(index)}>
                <Minus size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <Link to="/" className={styles.cancelBtn}>
            取消
          </Link>
          <button type="submit" className={styles.submitBtn} disabled={createMutation.isPending}>
            {createMutation.isPending ? '创建中...' : '创建沙箱'}
          </button>
        </div>
      </form>
    </div>
  );
}
