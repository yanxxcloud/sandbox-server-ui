import { useState, useRef, useEffect, useCallback } from 'react';
import { TerminalWebSocket } from '../api/backend';
import styles from './Terminal.module.css';

interface TerminalProps {
  sandboxId: string;
}

interface OutputLine {
  type: 'stdout' | 'stderr' | 'info' | 'input';
  text: string;
}

export function Terminal({ sandboxId }: TerminalProps) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentDir, setCurrentDir] = useState('~');
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<TerminalWebSocket | null>(null);
  const connectionMessageAddedRef = useRef(false); // 跟踪是否已添加连接消息

  // WebSocket 连接
  useEffect(() => {
    // 如果已经有连接，先断开
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }
    
    // 重置状态
    connectionMessageAddedRef.current = false;
    setIsConnected(false);
    setIsExecuting(false);
    
    const ws = new TerminalWebSocket(sandboxId, {
      onStdout: (data) => {
        setOutput(prev => [...prev, { type: 'stdout', text: data }]);
      },
      onStderr: (data) => {
        setOutput(prev => [...prev, { type: 'stderr', text: data }]);
        setIsExecuting(false);
      },
      onExit: (code) => {
        if (code !== 0) {
          setOutput(prev => [...prev, { type: 'info', text: `Exit code: ${code}` }]);
        }
        setIsExecuting(false);
        // 命令执行完成后，重新聚焦输入框
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      },
      onError: (error) => {
        setOutput(prev => [...prev, { type: 'stderr', text: `Error: ${error}` }]);
        setIsExecuting(false);
        // 错误后也重新聚焦输入框
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      },
      onConnected: () => {
        setIsConnected(true);
        // 只在第一次连接时添加消息，避免重复（React StrictMode 会导致重复渲染）
        if (!connectionMessageAddedRef.current) {
          connectionMessageAddedRef.current = true;
          setOutput(prev => {
            // 双重检查：确保输出中没有连接消息
            const hasConnectionMessage = prev.some(
              line => line.type === 'info' && 
              (line.text.includes('Connected to sandbox') || line.text.includes('Connecting to sandbox'))
            );
            if (hasConnectionMessage) {
              return prev;
            }
            return [
              ...prev.filter(line => 
                !(line.type === 'info' && line.text.includes('Connecting to sandbox'))
              ),
              { type: 'info', text: `Connected to sandbox: ${sandboxId.slice(0, 8)}...` },
              { type: 'info', text: 'Type commands to execute. Use ↑↓ for history.' },
              { type: 'info', text: '' },
            ];
          });
        }
      },
    });
    
    ws.connect();
    wsRef.current = ws;

    return () => {
      connectionMessageAddedRef.current = false;
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, [sandboxId]);

  // 自动滚动到底部
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  // 当命令执行完成时，自动聚焦输入框
  useEffect(() => {
    if (!isExecuting && isConnected && inputRef.current) {
      // 使用 setTimeout 确保 DOM 更新完成后再聚焦
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isExecuting, isConnected]);

  // 点击终端区域时聚焦输入框
  const focusInput = useCallback(() => {
    if (inputRef.current && isConnected && !isExecuting) {
      inputRef.current.focus();
    }
  }, [isConnected, isExecuting]);

  const executeCommand = () => {
    if (!input.trim() || isExecuting || !isConnected) return;

    const cmd = input.trim();
    
    // 添加输入行
    setOutput(prev => [...prev, { 
      type: 'input', 
      text: `${currentDir} $ ${cmd}`,
    }]);
    
    // 更新历史
    setHistory(prev => {
      const newHistory = prev.filter(h => h !== cmd);
      return [...newHistory, cmd];
    });
    setHistoryIndex(-1);
    setInput('');

    // 特殊命令处理
    if (cmd === 'clear' || cmd === 'cls') {
      setOutput([]);
      // 清屏后重新聚焦输入框
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
      return;
    }

    setIsExecuting(true);

    // 处理 cd 命令更新提示符
    if (cmd.startsWith('cd ')) {
      const dir = cmd.substring(3).trim();
      if (dir === '~' || dir === '$HOME') {
        setCurrentDir('~');
      } else if (dir.startsWith('/')) {
        setCurrentDir(dir);
      } else if (dir === '..') {
        setCurrentDir(prev => {
          const parts = prev.split('/').filter(p => p);
          parts.pop();
          return parts.length > 0 ? '/' + parts.join('/') : '~';
        });
      } else {
        setCurrentDir(prev => prev === '~' ? `~/${dir}` : `${prev}/${dir}`);
      }
    }

    // 通过 WebSocket 发送命令
    wsRef.current?.send(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'c' && e.ctrlKey) {
      if (isExecuting) {
        setOutput(prev => [...prev, { type: 'stderr', text: '^C' }]);
        setIsExecuting(false);
      } else {
        setInput('');
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setOutput([]);
    }
  };

  return (
    <div className={styles.terminal} onClick={focusInput}>
      <div className={styles.titleBar}>
        <div className={styles.buttons}>
          <span className={styles.btnClose}></span>
          <span className={styles.btnMinimize}></span>
          <span className={styles.btnMaximize}></span>
        </div>
        <div className={styles.title}>
          sandbox@{sandboxId.slice(0, 8)} — bash
          {!isConnected && ' (connecting...)'}
        </div>
        <div className={styles.spacer}></div>
      </div>
      
      <div className={styles.content} ref={terminalRef}>
        {output.map((line, i) => (
          <div
            key={i}
            className={`${styles.line} ${styles[line.type]}`}
          >
            {line.text}
          </div>
        ))}
        
        <div className={styles.inputLine}>
          <span className={styles.prompt}>{currentDir} $</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.input}
            autoFocus
            disabled={!isConnected || isExecuting}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
