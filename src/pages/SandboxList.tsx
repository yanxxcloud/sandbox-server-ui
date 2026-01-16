import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  RefreshCw,
  Trash2,
  Pause,
  Play,
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
} from 'lucide-react';
import { sandboxApi } from '../api/sandbox';
import { StatusBadge } from '../components/StatusBadge';
import styles from './SandboxList.module.css';

const STATES = ['Pending', 'Running', 'Pausing', 'Paused', 'Stopping', 'Terminated', 'Failed'];

export function SandboxList() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sandboxes', page, pageSize, selectedStates],
    queryFn: () =>
      sandboxApi.list({
        page,
        pageSize,
        state: selectedStates.length > 0 ? selectedStates : undefined,
      }),
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: sandboxApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sandboxes'] }),
  });

  const pauseMutation = useMutation({
    mutationFn: sandboxApi.pause,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sandboxes'] }),
  });

  const resumeMutation = useMutation({
    mutationFn: sandboxApi.resume,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sandboxes'] }),
  });

  const toggleState = (state: string) => {
    setSelectedStates((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
    );
    setPage(1);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除这个沙箱吗？')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>沙箱列表</h1>
          <p className={styles.subtitle}>
            共 {data?.pagination.totalItems ?? 0} 个沙箱
          </p>
        </div>
        <div className={styles.actions}>
          <button
            className={`${styles.filterBtn} ${showFilters ? styles.active : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            筛选
          </button>
          <button className={styles.refreshBtn} onClick={() => refetch()}>
            <RefreshCw size={18} />
            刷新
          </button>
          <Link to="/create" className={styles.createBtn}>
            创建沙箱
          </Link>
        </div>
      </div>

      {showFilters && (
        <div className={styles.filters}>
          <span className={styles.filterLabel}>状态筛选：</span>
          <div className={styles.filterTags}>
            {STATES.map((state) => (
              <button
                key={state}
                className={`${styles.filterTag} ${selectedStates.includes(state) ? styles.selected : ''}`}
                onClick={() => toggleState(state)}
              >
                {state}
              </button>
            ))}
          </div>
          {selectedStates.length > 0 && (
            <button className={styles.clearFilters} onClick={() => setSelectedStates([])}>
              清除筛选
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className={styles.loading}>加载中...</div>
      ) : data?.items.length === 0 ? (
        <div className={styles.empty}>
          <Search size={48} />
          <p>暂无沙箱</p>
          <Link to="/create" className={styles.createBtn}>
            创建第一个沙箱
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>项目名称</th>
                  <th>ID</th>
                  <th>镜像</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>过期时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((sandbox) => {
                  const projectName = sandbox.metadata?.['project.name'] || '-';
                  return (
                  <tr key={sandbox.id}>
                    <td>
                      <span className={styles.projectName}>{projectName}</span>
                    </td>
                    <td>
                      <code className={styles.id}>{sandbox.id.slice(0, 12)}...</code>
                    </td>
                    <td>
                      <span className={styles.image}>{sandbox.image.uri}</span>
                    </td>
                    <td>
                      <StatusBadge state={sandbox.status.state} />
                    </td>
                    <td>{format(new Date(sandbox.createdAt), 'yyyy-MM-dd HH:mm')}</td>
                    <td>{format(new Date(sandbox.expiresAt), 'yyyy-MM-dd HH:mm')}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <Link
                          to={`/sandbox/${sandbox.id}`}
                          className={styles.actionBtn}
                          title="查看详情"
                        >
                          <Eye size={16} />
                        </Link>
                        {sandbox.status.state === 'Running' && (
                          <button
                            className={styles.actionBtn}
                            onClick={() => pauseMutation.mutate(sandbox.id)}
                            title="暂停"
                          >
                            <Pause size={16} />
                          </button>
                        )}
                        {sandbox.status.state === 'Paused' && (
                          <button
                            className={styles.actionBtn}
                            onClick={() => resumeMutation.mutate(sandbox.id)}
                            title="恢复"
                          >
                            <Play size={16} />
                          </button>
                        )}
                        <button
                          className={`${styles.actionBtn} ${styles.danger}`}
                          onClick={() => handleDelete(sandbox.id)}
                          title="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data && data.pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className={styles.pageBtn}
              >
                <ChevronLeft size={18} />
                上一页
              </button>
              <span className={styles.pageInfo}>
                第 {page} / {data.pagination.totalPages} 页
              </span>
              <button
                disabled={!data.pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className={styles.pageBtn}
              >
                下一页
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
