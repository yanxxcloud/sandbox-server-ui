import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Trash2,
  Pause,
  Play,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Terminal as TerminalIcon,
  FolderOpen,
} from 'lucide-react';
import { sandboxApi } from '../api/sandbox';
import { StatusBadge } from '../components/StatusBadge';
import { Terminal } from '../components/Terminal';
import { FileManager } from '../components/FileManager';
import styles from './SandboxDetail.module.css';

export function SandboxDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewHours, setRenewHours] = useState(1);
  const [activeTab, setActiveTab] = useState<'terminal' | 'files'>('terminal');

  const { data: sandbox, isLoading } = useQuery({
    queryKey: ['sandbox', id],
    queryFn: () => sandboxApi.get(id!),
    enabled: !!id,
    refetchInterval: 3000,
  });

  // 注释掉 endpoints 查询，API 返回 404
  // const { data: endpoints, isLoading: endpointsLoading } = useQuery({
  //   queryKey: ['endpoints', id],
  //   queryFn: () => sandboxApi.getEndpoints(id!),
  //   enabled: !!id && !!sandbox,
  //   refetchInterval: 3000,
  // });
  const endpoints: { endpoint: string }[] = [];
  const endpointsLoading = false;

  const deleteMutation = useMutation({
    mutationFn: sandboxApi.delete,
    onSuccess: () => navigate('/'),
  });

  const pauseMutation = useMutation({
    mutationFn: sandboxApi.pause,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sandbox', id] }),
  });

  const resumeMutation = useMutation({
    mutationFn: sandboxApi.resume,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sandbox', id] }),
  });

  const renewMutation = useMutation({
    mutationFn: (expiresAt: string) => sandboxApi.renew(id!, { expiresAt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sandbox', id] });
      setShowRenewModal(false);
    },
  });

  const handleDelete = () => {
    if (window.confirm('确定要删除这个沙箱吗？')) {
      deleteMutation.mutate(id!);
    }
  };

  const handleRenew = () => {
    const newExpiry = new Date();
    newExpiry.setHours(newExpiry.getHours() + renewHours);
    renewMutation.mutate(newExpiry.toISOString());
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return <div className={styles.loading}>加载中...</div>;
  }

  if (!sandbox) {
    return (
      <div className={styles.notFound}>
        <p>沙箱不存在</p>
        <Link to="/">返回列表</Link>
      </div>
    );
  }

  const isRunning = sandbox.status.state === 'Running';

  return (
    <div className={styles.container}>
      <Link to="/" className={styles.backLink}>
        <ArrowLeft size={18} />
        返回列表
      </Link>

      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1>{sandbox.metadata?.['project.name'] || '沙箱详情'}</h1>
          <StatusBadge state={sandbox.status.state} />
        </div>
        <div className={styles.actions}>
          {sandbox.status.state === 'Running' && (
            <button className={styles.actionBtn} onClick={() => pauseMutation.mutate(id!)}>
              <Pause size={18} />
              暂停
            </button>
          )}
          {sandbox.status.state === 'Paused' && (
            <button className={styles.actionBtn} onClick={() => resumeMutation.mutate(id!)}>
              <Play size={18} />
              恢复
            </button>
          )}
          <button className={styles.actionBtn} onClick={() => setShowRenewModal(true)}>
            <Clock size={18} />
            续期
          </button>
          <button className={`${styles.actionBtn} ${styles.danger}`} onClick={handleDelete}>
            <Trash2 size={18} />
            删除
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h3>基本信息</h3>
          <div className={styles.infoList}>
            <div className={styles.infoItem}>
              <span className={styles.label}>ID</span>
              <div className={styles.valueWithCopy}>
                <code>{sandbox.id}</code>
                <button onClick={() => copyToClipboard(sandbox.id)} className={styles.copyBtn}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.label}>镜像</span>
              <code className={styles.image}>{sandbox.image.uri}</code>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.label}>入口命令</span>
              <code>{sandbox.entrypoint.join(' ')}</code>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.label}>创建时间</span>
              <span>{format(new Date(sandbox.createdAt), 'yyyy-MM-dd HH:mm:ss')}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.label}>过期时间</span>
              <span>{format(new Date(sandbox.expiresAt), 'yyyy-MM-dd HH:mm:ss')}</span>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h3>状态信息</h3>
          <div className={styles.infoList}>
            <div className={styles.infoItem}>
              <span className={styles.label}>状态</span>
              <StatusBadge state={sandbox.status.state} />
            </div>
            {sandbox.status.reason && (
              <div className={styles.infoItem}>
                <span className={styles.label}>原因</span>
                <span>{sandbox.status.reason}</span>
              </div>
            )}
            {sandbox.status.message && (
              <div className={styles.infoItem}>
                <span className={styles.label}>消息</span>
                <span>{sandbox.status.message}</span>
              </div>
            )}
            {sandbox.status.lastTransitionAt && (
              <div className={styles.infoItem}>
                <span className={styles.label}>最后状态变更</span>
                <span>
                  {format(new Date(sandbox.status.lastTransitionAt), 'yyyy-MM-dd HH:mm:ss')}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <h3>端点 (Endpoints)</h3>
          {endpointsLoading ? (
            <div className={styles.emptyEndpoints}>加载中...</div>
          ) : endpoints && endpoints.length > 0 ? (
            <div className={styles.endpoints}>
              {endpoints.map((ep, index) => (
                <div key={index} className={styles.endpoint}>
                  <ExternalLink size={16} />
                  <a href={ep.endpoint.startsWith('http') ? ep.endpoint : `http://${ep.endpoint}`} target="_blank" rel="noopener noreferrer">
                    {ep.endpoint}
                  </a>
                  <button onClick={() => copyToClipboard(ep.endpoint)} className={styles.copyBtn}>
                    <Copy size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyEndpoints}>
              {sandbox.status.state === 'Running' ? '暂无端点' : '沙箱未运行，无可用端点'}
            </div>
          )}
        </div>

        {sandbox.metadata && Object.keys(sandbox.metadata).length > 0 && (
          <div className={styles.card}>
            <h3>元数据</h3>
            <div className={styles.metadata}>
              {Object.entries(sandbox.metadata).map(([key, value]) => (
                <div key={key} className={styles.metaItem}>
                  <span className={styles.metaKey}>{key}</span>
                  <span className={styles.metaValue}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 沙箱交互区域 */}
      {isRunning && (
        <div className={styles.interactiveSection}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'terminal' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('terminal')}
            >
              <TerminalIcon size={16} />
              终端
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'files' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('files')}
            >
              <FolderOpen size={16} />
              文件管理
            </button>
          </div>

          <div className={styles.tabContent}>
            {activeTab === 'terminal' && <Terminal sandboxId={id!} />}
            {activeTab === 'files' && <FileManager sandboxId={id!} />}
          </div>
        </div>
      )}

      {!isRunning && (
        <div className={styles.notRunningHint}>
          <p>沙箱未运行，无法使用终端和文件管理功能</p>
        </div>
      )}

      {showRenewModal && (
        <div className={styles.modalOverlay} onClick={() => setShowRenewModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>续期沙箱</h3>
            <p>选择延长的时间</p>
            <div className={styles.renewOptions}>
              {[1, 2, 4, 8, 12, 24].map((hours) => (
                <button
                  key={hours}
                  className={`${styles.renewOption} ${renewHours === hours ? styles.selected : ''}`}
                  onClick={() => setRenewHours(hours)}
                >
                  {hours} 小时
                </button>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowRenewModal(false)}>
                取消
              </button>
              <button className={styles.confirmBtn} onClick={handleRenew}>
                确认续期
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
