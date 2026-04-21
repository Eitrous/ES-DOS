import { useState, useEffect, useRef } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { getAutocompleteResult } from './core/autocomplete.js';
import { createCommandExecutor } from './core/commands/executor.js';
import { FILE_SYSTEM } from './core/filesystem/data.js';
import { Analytics } from '@vercel/analytics/react';

const commandExecutor = createCommandExecutor({ fileSystem: FILE_SYSTEM });

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

function App() {
  // 历史输出
  const [outputHistory, setOutputHistory] = useState([]);
  // 历史输入
  const [inputHistory, setInputHistory] = useState([]);
  // 历史输入指针
  const [historyIndex, setHistoryIndex] = useState(0);
  // 正在输入的命令
  const [currentInput, setCurrentInput] = useState('');
  // Tab 补全循环状态
  const [tabCycle, setTabCycle] = useState(null);
  // 可输入状态
  const [inputEnable, setInputEnable] = useState(false);
  // 当前路径
  const [currentPath, setCurrentPath] = useState('C:\\');
  // 字体颜色
  const [textColor] = useState('#c0c0c0');

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // '    ___________       ____  ____  _____ \n   / ____/ ___/      / __ \\/ __ \\/ ___/ \n  / __/  \\__ \\______/ / / / / / /\\__ \\ \n / /___ ___/ /_____/ /_/ / /_/ /___/ / \n/_____//____/     /_____/\\____//____/  \n',
  useEffect(() => {
    const boostSequence = [
      'GSTRenko(R) Eindows 98\n   (C)Copyright Eitrous 2026.\n\n             :===========.     :===========.      \n               :===========.     -===========      \n                 -===========      -===========     \n                   -===========      -==========-    \n                     -==========-      ===========-   \n     -==========-      -==========-       			     \n       -==========-      ===========-                  \n         ===========-      ===========:                 \n           ===========:     .===========:                \n            .===========:     .===========:               \n\n',

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

  const setInputWithCursor = (nextValue) => {
    setCurrentInput(nextValue);

    setTimeout(() => {
      if (inputRef.current) {
        const cursorPosition = nextValue.length;
        inputRef.current.selectionStart = inputRef.current.selectionEnd =
          cursorPosition;
      }
    }, 0);
  };

  // 执行命令
  const executeCommand = (cmd) => {
    setInputEnable(false);
    setTabCycle(null);

    if (cmd.trim() !== '') {
      setInputHistory((prev) => {
        const newHistory = [...prev, cmd];
        setHistoryIndex(newHistory.length);
        return newHistory;
      });
    }

    const result = commandExecutor.execute({
      input: cmd,
      currentPath,
    });

    if (result.clearScreen) {
      setOutputHistory(Array.isArray(result.output) ? result.output : []);
      if (result.shouldEnableInput) {
        setInputEnable(true);
      }
      return;
    }

    if (result.nextPath) {
      setCurrentPath(result.nextPath);
    }

    if (result.redirect) {
      setTimeout(() => {
        window.location.href = result.redirect.url;
      }, result.redirect.delayMs || 2000);
    }

    setOutputHistory((prev) => [
      ...prev,
      `${currentPath}>${cmd}`,
      ...(result.output || []),
      '\n',
    ]);

    if (result.shouldEnableInput) {
      setInputEnable(true);
    }
  };

  const applyAutocomplete = (direction = 1) => {
    const hasActiveCycle =
      tabCycle &&
      tabCycle.currentPath === currentPath &&
      (currentInput === tabCycle.sourceInput ||
        tabCycle.cycleInputs.includes(currentInput));

    if (hasActiveCycle) {
      const cycleInputs = tabCycle.cycleInputs;

      if (cycleInputs.length > 0) {
        const currentIndex = cycleInputs.indexOf(currentInput);
        let nextIndex = 0;

        if (currentIndex === -1) {
          nextIndex = direction >= 0 ? 0 : cycleInputs.length - 1;
        } else {
          nextIndex =
            (currentIndex + direction + cycleInputs.length) %
            cycleInputs.length;
        }

        setInputWithCursor(cycleInputs[nextIndex]);
      }

      return;
    }

    const completion = getAutocompleteResult({
      input: currentInput,
      currentPath,
      fileSystem: FILE_SYSTEM,
      commandDefinitions: commandExecutor.commandDefinitions,
    });

    if (!completion) {
      setTabCycle(null);
      return;
    }

    if (completion.suggestions && completion.suggestions.length > 0) {
      setOutputHistory((prev) => [
        ...prev,
        `${currentPath}>${currentInput}`,
        `  ${completion.suggestions.join('  ')}`,
        '\n',
      ]);
    }

    if (
      typeof completion.nextInput === 'string' &&
      completion.nextInput !== currentInput
    ) {
      setInputWithCursor(completion.nextInput);
    }

    if (completion.cycleInputs && completion.cycleInputs.length > 0) {
      setTabCycle({
        sourceInput: completion.nextInput,
        cycleInputs: completion.cycleInputs,
        currentPath,
      });
    } else {
      setTabCycle(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      executeCommand(currentInput);
      setCurrentInput('');
      setTabCycle(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      applyAutocomplete(e.shiftKey ? -1 : 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setTabCycle(null);

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
      setTabCycle(null);

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
    setTabCycle(null);
  };

  return (
    <>
      <DosGlobalStyle color={textColor} />
      <Analytics />
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
