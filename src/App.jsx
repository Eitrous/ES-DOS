import { useState, useEffect, useRef } from 'react';
import styled, { createGlobalStyle } from 'styled-components';

// 黑底白字，去掉滚动条
const DosGlobalStyle = createGlobalStyle`
  body {
    background-color: #000000;
    color: ${(props) => props.color || '#c0c0c0'};
    margin: 0;
    overflow: hidden;
    font-family: 'Perfect DOS VGA 437', sans-serif;
    font-size: 24px;
    -webkit-font-smoothing: none;
  }
`;

const Container = styled.div`
  width: 100vw;
  height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  overflow-y: auto;

  /* 允许滚动 */
  &::-webkit-scrollbar {
    display: none;
  }
`;

// 光标动画
const BlinkingCursor = styled.span`
  color: #c0c0c0;
  background-color: #000000;
  animation: blink 0.5s step-end infinite;

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }
`;

// 文件系统
const FILE_SYSTEM = {
  type: 'DIR',
  children: {
    WINDOWS: {
      type: 'DIR',
      children: {
        SYSTEM32: {
          type: 'DIR',
          children: {
            DRIVERS: {
              type: 'DIR',
              children: {},
            },
          },
        },
      },
    },
    DOCUMENTS: {
      type: 'DIR',
      children: {
        'RESUME.TXT': {
          type: 'TXT',
          size: '1024',
          content: 'this is RESUME.TXT',
        },
        'README.TXT': {
          type: 'TXT',
          size: '18',
          content: 'this is README.TXT',
        },
      },
    },
  },
};

function App() {
  // 历史输出
  const [outputHistory, setOutputHistory] = useState([]);
  // 历史输入
  const [inputHistory, setInputHistory] = useState([]);
  // 历史输入指针
  const [historyIndex, setHistoryIndex] = useState(0);
  // 正在输入的命令
  const [currentInput, setCurrentInput] = useState('');
  // 可输入状态
  const [inputEnable, setInputEnable] = useState(false);
  // 当前路径
  const [currentPath, setCurrentPath] = useState('C:\\');
  // 字体颜色
  const [textColor, setTextColor] = useState('#c0c0c0');

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // '    ___________       ____  ____  _____ \n   / ____/ ___/      / __ \\/ __ \\/ ___/ \n  / __/  \\__ \\______/ / / / / / /\\__ \\ \n / /___ ___/ /_____/ /_/ / /_/ /___/ / \n/_____//____/     /_____/\\____//____/  \n',
  useEffect(() => {
    const boostSequence = [
      'GSTRenko(R) Eindows 98\n   (C)Copyright Eitrous 2026.\n\n ███████╗███████╗      ██████╗  ██████╗ ███████╗\n██╔════╝██╔════╝      ██╔══██╗██╔═══██╗██╔════╝\n█████╗  ███████╗█████╗██║  ██║██║   ██║███████╗\n██╔══╝  ╚════██║╚════╝██║  ██║██║   ██║╚════██║\n███████╗███████║      ██████╔╝╚██████╔╝███████║\n╚══════╝╚══════╝      ╚═════╝  ╚═════╝ ╚══════╝\n\n',
      '',
      "Now you are in Eindows 98 ES-DOS prompt. Type 'HELP' for help.",
      '',
    ];

    let delay = 2000;
    const timers = [];

    boostSequence.forEach((line, index) => {
      const timerId = setTimeout(() => {
        setOutputHistory((prev) => [...prev, line]);
        if (index === boostSequence.length - 1) {
          setOutputHistory((prev) => [...prev, '\n']);
          setInputEnable(true);
        }
      }, delay);
      timers.push(timerId);
      delay += 500; // 每段间隔
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  // 自动滚到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [outputHistory, currentInput]);

  // 保持焦点在输入框
  const keepFocus = () => inputRef.current?.focus();

  // 路径解析
  const getDirByPath = (fs, pathStr) => {
    if (pathStr === 'C:' || pathStr === 'C:\\') return fs;

    const parts = pathStr.replace('C:\\', '').split('\\').filter(Boolean);

    let current = fs;

    for (const part of parts) {
      if (
        current.type === 'DIR' &&
        current.children &&
        current.children[part]
      ) {
        current = current.children[part];
      } else {
        return null;
      }
    }

    return current;
  };

  // 执行命令
  const executeCommand = (cmd) => {
    setInputEnable(false);

    if (cmd.trim() !== '') {
      setInputHistory((prev) => {
        const newHistory = [...prev, cmd];
        setHistoryIndex(newHistory.length);
        return newHistory;
      });
    }

    const command = cmd.trim().toUpperCase();
    const parts = command.split(' ').filter((i) => i !== ' ');
    const baseCmd = parts[0];
    const arg = parts[1];

    let output = [];

    switch (baseCmd) {
      case 'HELP':
        output = [
          'Supported Commands:',
          '  CD      - Open fold',
          '  DIR     - List files and directories',
          '  CLS     - Clear the screen',
          '  VER     - Display version',
          '  EXIT    - Return to Windows 98',
          '  REBOOT  - Restart system',
          '  GITHUB  - Redirecting to the GitHub repository',
          '  BLOG    - Redirecting to the 0x3f-Blog',
        ];
        setInputEnable(true);
        break;

      case 'VER':
        output = ['ES-DOS version 1.00'];
        setInputEnable(true);
        break;

      case 'CLS':
        setInputEnable(true);
        setOutputHistory([]);
        return;

      case 'DIR': {
        const targetDir = getDirByPath(FILE_SYSTEM, currentPath);

        if (!targetDir || targetDir.type !== 'DIR') {
          output = ['   Directory not found error.'];
        } else {
          output = [`\n   Directory 0f ${currentPath}`, '\n'];
          const children = targetDir.children || {};

          if (currentPath !== 'C:\\') {
            output.push(`.                      <DIR>`);
            output.push(`..                     <DIR>`);
          }

          Object.keys(children).forEach((name) => {
            const item = children[name];
            const nameSpacing = ' '.repeat(Math.max(0, 12 - name.length));

            const dirSpacing = ' '.repeat(10);
            if (item.type === 'DIR') {
              output.push(
                `${name}${nameSpacing} ${dirSpacing}<DIR>${dirSpacing}`,
              );
            } else {
              const typeSpacing = ' '.repeat(
                Math.max(0, 12 - item.type.length),
              );
              const sizeSpacing = ' '.repeat(
                Math.max(0, 12 - item.size.length),
              );
              output.push(
                `${name}${nameSpacing} ${item.type}${typeSpacing} ${sizeSpacing}${item.size}`,
              );
            }
          });

          const fileCount = Object.values(children).filter(
            (i) => i.type !== 'DIR',
          ).length;
          const countSpacing = ' '.repeat(
            Math.max(0, 30 - `${fileCount}`.length),
          );
          output.push('', `${countSpacing}${fileCount} file(s)`);
        }
        setInputEnable(true);
        break;
      }

      case 'CD': {
        if (!arg) {
          output = [currentPath];
          setInputEnable(true);
          break;
        }

        let newPath = currentPath;

        if (arg === '\\' || arg === '.') {
          newPath = 'C:\\';
        } else if (arg === '..') {
          if (currentPath.length <= 4) {
            newPath = 'C:\\';
          } else {
            const parts = currentPath.split('\\').filter((p) => p !== '');
            parts.pop();
            newPath = parts.join('\\');

            if (!newPath.endsWith('\\')) newPath += '\\';
            if (newPath === 'C:') newPath = 'C:\\';
          }
        } else if (arg.startsWith('C:\\')) {
          newPath = arg;
        } else {
          newPath = currentPath.endsWith('\\')
            ? currentPath + arg
            : currentPath + '\\' + arg;
        }

        const dirObj = getDirByPath(FILE_SYSTEM, newPath);
        if (dirObj && dirObj.type === 'DIR') {
          setCurrentPath(newPath);
        } else {
          output = ['Invalid directory'];
        }
        setInputEnable(true);
        break;
      }

      case 'EXIT':
        output = ['Eindows is now restarting...'];
        setTimeout(() => {
          window.location.href = 'https://os.0x-3f.com';
        }, 2000);
        break;

      case 'WIN':
        output = ['Eindows is now restarting'];
        setTimeout(() => {
          window.location.href = 'https://os.0x-3f.com';
        }, 2000);
        break;

      case 'REBOOT':
        output = ['ES-DOS is now restarting'];
        setTimeout(() => {
          window.location.href = 'https://dos.0x-3f.com';
        }, 2000);
        break;

      case 'GITHUB':
        output = ['Redirecting...'];
        setTimeout(() => {
          window.location.href = 'https://github.com/Eitrous/ES-DOS';
        }, 2000);
        break;

      case 'BLOG':
        output = ['Redirecting...'];
        setTimeout(() => {
          window.location.href = 'https://0x-3f.com';
        }, 2000);
        break;

      case '':
        setInputEnable(true);
        break;

      default:
        output = ['Bad command or file name'];
        setInputEnable(true);
    }

    setOutputHistory((prev) => [
      ...prev,
      `${currentPath}>${cmd}`,
      ...output,
      '\n',
    ]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      executeCommand(currentInput);
      setCurrentInput('');
      setHistoryIndex(inputHistory.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();

      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentInput(inputHistory[newIndex]);

        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.selectionStart = inputRef.current.selectionEnd =
              inputHistory[newIndex].length;
          }
        }, 0);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();

      if (historyIndex < inputHistory.length) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);

        if (newIndex === inputHistory.length) {
          setCurrentInput('');
        } else {
          setCurrentInput(inputHistory[newIndex]);
        }
      }
    }
  };

  const handleChange = (e) => {
    setCurrentInput(e.target.value);
  };

  return (
    <>
      <DosGlobalStyle color={textColor} />
      <Container ref={containerRef} onClick={keepFocus}>
        {/* 渲染历史记录 */}
        {outputHistory.map((line, i) => (
          <div key={i} style={{ whiteSpace: 'pre-wrap', lineHeight: '1.2' }}>
            {line}
          </div>
        ))}

        {/* 渲染当前输入行 */}
        {inputEnable && (
          <div
            style={{
              display: 'flex',
              lineHeight: '1.2',
            }}>
            <span>{currentPath}&gt;</span>
            <span>{currentInput}</span>
            <BlinkingCursor>
              <span style={{ fontWeight: 'bolder' }}>_</span>
            </BlinkingCursor>
          </div>
        )}

        {!inputEnable && (
          <BlinkingCursor>
            <span style={{ fontWeight: 'bolder' }}>_</span>
          </BlinkingCursor>
        )}

        {/* 接收输入 */}
        <input
          ref={inputRef}
          type='text'
          value={currentInput}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            position: 'absolute',
            opacity: 0,
            top: -1000,
          }}
        />
      </Container>
    </>
  );
}

export default App;
