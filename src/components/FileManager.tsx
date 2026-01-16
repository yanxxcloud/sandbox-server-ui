import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Folder,
  File,
  ChevronRight,
  RefreshCw,
  Upload,
  Download,
  Trash2,
  Edit,
  X,
  Save,
} from 'lucide-react';
import { backendApiService } from '../api/backend';
import type { FileInfo } from '../api/backend';
import styles from './FileManager.module.css';

interface FileManagerProps {
  sandboxId: string;
}

export function FileManager({ sandboxId }: FileManagerProps) {
  const queryClient = useQueryClient();
  const [currentPath, setCurrentPath] = useState('/workspace');
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const { data: files, isLoading, refetch } = useQuery({
    queryKey: ['files', sandboxId, currentPath],
    queryFn: () => backendApiService.listFiles(sandboxId, currentPath),
    enabled: !!sandboxId,
  });

  const deleteMutation = useMutation({
    mutationFn: (paths: string[]) => backendApiService.deleteFiles(sandboxId, paths),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', sandboxId] });
      setSelectedFile(null);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (params: { path: string; content: string }) =>
      backendApiService.writeFile(sandboxId, { path: params.path, content: params.content }),
    onSuccess: () => {
      setIsEditing(false);
      setFileContent(editContent);
    },
  });

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSelectedFile(null);
    setFileContent(null);
    setIsEditing(false);
  };

  const goUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    navigateTo('/' + parts.join('/') || '/');
  };

  const handleFileClick = async (file: FileInfo) => {
    if (file.type === 'directory') {
      navigateTo(file.path);
    } else {
      setSelectedFile(file);
      try {
        const result = await backendApiService.readFile(sandboxId, file.path);
        setFileContent(result.content);
        setEditContent(result.content);
      } catch (e) {
        setFileContent('无法读取文件内容');
      }
    }
  };

  const handleDelete = () => {
    if (selectedFile && window.confirm(`确定要删除 ${selectedFile.name} 吗？`)) {
      deleteMutation.mutate([selectedFile.path]);
    }
  };

  const handleSave = () => {
    if (selectedFile) {
      saveMutation.mutate({ path: selectedFile.path, content: editContent });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    try {
      await backendApiService.uploadFile(sandboxId, targetPath, file);
      refetch();
    } catch (error) {
      alert('上传失败');
    }
    e.target.value = '';
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className={styles.fileManager}>
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <button onClick={() => navigateTo('/')}>/</button>
          {pathParts.map((part, index) => (
            <span key={index}>
              <ChevronRight size={14} />
              <button
                onClick={() => navigateTo('/' + pathParts.slice(0, index + 1).join('/'))}
              >
                {part}
              </button>
            </span>
          ))}
        </div>
        <div className={styles.actions}>
          <label className={styles.uploadBtn}>
            <Upload size={16} />
            上传
            <input type="file" onChange={handleUpload} hidden />
          </label>
          <button onClick={() => refetch()}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.fileList}>
          {currentPath !== '/' && (
            <div className={styles.fileItem} onClick={goUp}>
              <Folder size={18} />
              <span>..</span>
            </div>
          )}
          {isLoading ? (
            <div className={styles.loading}>加载中...</div>
          ) : files?.length === 0 ? (
            <div className={styles.empty}>空目录</div>
          ) : (
            files?.map((file) => (
              <div
                key={file.path}
                className={`${styles.fileItem} ${selectedFile?.path === file.path ? styles.selected : ''}`}
                onClick={() => handleFileClick(file)}
              >
                {file.type === 'directory' ? <Folder size={18} /> : <File size={18} />}
                <span className={styles.fileName}>{file.name}</span>
                <span className={styles.fileSize}>
                  {file.type !== 'directory' ? formatSize(file.size) : ''}
                </span>
              </div>
            ))
          )}
        </div>

        {selectedFile && selectedFile.type !== 'directory' && (
          <div className={styles.preview}>
            <div className={styles.previewHeader}>
              <span>{selectedFile.name}</span>
              <div className={styles.previewActions}>
                {!isEditing ? (
                  <>
                    <button onClick={() => setIsEditing(true)} title="编辑">
                      <Edit size={16} />
                    </button>
                    <a
                      href={backendApiService.getDownloadUrl(sandboxId, selectedFile.path)}
                      download
                      title="下载"
                    >
                      <Download size={16} />
                    </a>
                    <button onClick={handleDelete} className={styles.danger} title="删除">
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={handleSave} className={styles.save} title="保存">
                      <Save size={16} />
                    </button>
                    <button onClick={() => { setIsEditing(false); setEditContent(fileContent || ''); }} title="取消">
                      <X size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className={styles.previewContent}>
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className={styles.editor}
                />
              ) : (
                <pre>{fileContent}</pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
