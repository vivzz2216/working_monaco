import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

const TerminalComponent = ({ containerId, isConnected }) => {
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const fitAddon = useRef(null);
  const websocket = useRef(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal with VS Code-like settings
    terminal.current = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selection: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      },
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      tabStopWidth: 4,
      bellStyle: 'none',
      convertEol: true,
      disableStdin: false,
      allowTransparency: false,
      allowProposedApi: true,
      cols: 80,
      rows: 24,
      logLevel: 'warn', // Reduce xterm.js logging
      cursorInactiveStyle: 'block',
      fastScrollModifier: 'alt',
      macOptionIsMeta: false,
      rightClickSelectsWord: true,
      // Enable proper key handling
      altClickMovesCursor: false,
      wordSeparator: ' ()[]{}\'"`<>|&;',
      // Ensure proper line feed handling
      convertEol: true
    });

    // Add addons
    fitAddon.current = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(webLinksAddon);

    // Open terminal
    terminal.current.open(terminalRef.current);
    
    // Initially disable input until WebSocket is connected
    terminal.current.options.disableStdin = true;
    
    // Fit terminal after a short delay to ensure proper initialization
    const fitTerminal = () => {
      if (fitAddon.current && terminal.current && terminalRef.current) {
        try {
          // Check if terminal is properly initialized and has dimensions
          if (terminal.current.element && 
              terminal.current.element.offsetWidth > 0 && 
              terminal.current.element.offsetHeight > 0) {
            fitAddon.current.fit();
            // Send resize after fitting
            setTimeout(() => {
              sendResize();
            }, 50);
          }
        } catch (error) {
          console.warn('Error fitting terminal:', error);
        }
      }
    };

    // Initial fit with multiple retries - use requestAnimationFrame for better timing
    requestAnimationFrame(() => {
      setTimeout(fitTerminal, 200);
      setTimeout(fitTerminal, 500);
      setTimeout(fitTerminal, 1000);
      setTimeout(fitTerminal, 2000);
    });

    // Handle terminal input
    terminal.current.onData((data) => {
      console.log('Terminal input received:', data, 'WebSocket state:', websocket.current?.readyState);
      
      // Handle Enter key specifically
      if (data === '\r' || data === '\n' || data === '\r\n') {
        console.log('Enter key pressed, sending to WebSocket');
        if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
          websocket.current.send('\r');
          console.log('Enter key sent to WebSocket');
        } else {
          console.log('WebSocket not ready for Enter key, state:', websocket.current?.readyState);
          // Echo the newline locally
          if (terminal.current) {
            terminal.current.write('\r\n');
          }
        }
        return;
      }
      
      if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
        console.log('Sending to WebSocket:', data);
        websocket.current.send(data);
      } else {
        console.log('WebSocket not ready, state:', websocket.current?.readyState);
        // Echo input locally if WebSocket is not ready
        if (terminal.current) {
          terminal.current.write(data);
        }
      }
    });

    // Handle terminal resize
    const sendResize = () => {
      if (websocket.current && websocket.current.readyState === WebSocket.OPEN && terminal.current) {
        const cols = terminal.current.cols;
        const rows = terminal.current.rows;
        const resizeMessage = JSON.stringify({ type: 'resize', cols, rows });
        console.log('Sending resize:', resizeMessage);
        websocket.current.send(resizeMessage);
      }
    };

    // Handle window resize
    const handleResize = () => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (fitAddon.current && terminal.current && terminal.current.element &&
              terminal.current.element.offsetWidth > 0 && 
              terminal.current.element.offsetHeight > 0) {
            try {
              fitAddon.current.fit();
              // Send resize message to backend
              sendResize();
            } catch (error) {
              console.warn('Error fitting terminal on resize:', error);
            }
          }
        }, 200);
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (websocket.current) {
        try {
          websocket.current.close();
        } catch (error) {
          console.warn('Error closing WebSocket:', error);
        }
      }
      if (terminal.current) {
        try {
          terminal.current.dispose();
        } catch (error) {
          console.warn('Error disposing terminal:', error);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!containerId || !isConnected) return;

    // Connect to WebSocket with retry logic
    const connectWebSocket = () => {
      // Use the correct WebSocket URL
      const wsUrl = `ws://localhost:8000/ws/term/${containerId}`;
      console.log('Connecting to WebSocket:', wsUrl);
      
      // Close existing connection if any
      if (websocket.current) {
        try {
          websocket.current.close();
        } catch (e) {
          console.warn('Error closing existing WebSocket:', e);
        }
        websocket.current = null;
      }
      
      // Wait a bit before creating new connection
      setTimeout(() => {
        try {
          console.log('Creating WebSocket connection to:', wsUrl);
          websocket.current = new WebSocket(wsUrl);
          console.log('WebSocket created, initial state:', websocket.current.readyState);
        } catch (error) {
          console.error('Error creating WebSocket:', error);
          return;
        }

        websocket.current.onopen = () => {
        console.log('Terminal WebSocket connected - state:', websocket.current.readyState);
        if (terminal.current) {
          // Write welcome message and prompt
          terminal.current.write('\r\n\x1b[32m✓ Terminal connected to container\x1b[0m\r\n');
          terminal.current.write('\x1b[36mType commands to interact with your Python environment\x1b[0m\r\n');
          terminal.current.write('\x1b[32m$ \x1b[0m');
          
          // Enable input
          terminal.current.options.disableStdin = false;
          
          // Send initial resize message
          setTimeout(() => {
            sendResize();
          }, 100);
          
          // Focus the terminal to ensure it can receive input
          terminal.current.focus();
          // Ensure terminal is ready for input
          setTimeout(() => {
            if (terminal.current) {
              terminal.current.focus();
              terminal.current.options.disableStdin = false;
            }
          }, 100);
        }
      };

    websocket.current.onmessage = (event) => {
      console.log('Received from WebSocket:', event.data);
      if (terminal.current && event.data) {
        try {
          terminal.current.write(event.data);
        } catch (error) {
          console.warn('Error writing to terminal:', error);
        }
      }
    };

      websocket.current.onclose = (event) => {
        console.log('Terminal WebSocket disconnected:', event.code, event.reason);
        if (terminal.current) {
          // Disable input when disconnected
          terminal.current.options.disableStdin = true;
          
          if (event.code === 1006) {
            terminal.current.write('\r\n\x1b[31m❌ Connection lost. Container may not be running.\x1b[0m\r\n');
            terminal.current.write('\x1b[33mPlease click "Start Container" to restart.\x1b[0m\r\n');
            terminal.current.write('\x1b[32m$ \x1b[0m');
          } else if (event.code === 1000) {
            terminal.current.write('\r\n\x1b[33mTerminal connection closed normally\x1b[0m\r\n');
          } else {
            terminal.current.write('\r\n\x1b[31mTerminal disconnected (code: ' + event.code + ')\x1b[0m\r\n');
            terminal.current.write('\x1b[32m$ \x1b[0m');
          }
        }
      };

      websocket.current.onerror = (error) => {
        console.error('Terminal WebSocket error:', error);
        console.error('WebSocket state:', websocket.current?.readyState);
        if (terminal.current) {
          // Disable input on error
          terminal.current.options.disableStdin = true;
          
          terminal.current.write('\r\n\x1b[31m❌ Terminal connection error.\x1b[0m\r\n');
          terminal.current.write('\x1b[33mMake sure the container is running and try again.\x1b[0m\r\n');
          terminal.current.write('\x1b[32m$ \x1b[0m');
        }
      };
      }, 200); // Wait 200ms before creating new connection
    };

    // Initial connection attempt
    connectWebSocket();

    return () => {
      if (websocket.current) {
        try {
          websocket.current.close();
        } catch (error) {
          console.warn('Error closing WebSocket:', error);
        }
      }
    };
  }, [containerId, isConnected]);

  return (
    <div className="w-full h-full bg-ide-bg">
      <div className="h-8 bg-ide-sidebar border-b border-ide-border flex items-center px-4">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <span className="ml-4 text-ide-text text-sm">Terminal</span>
        {isConnected ? (
          <span className="ml-auto text-green-400 text-xs">● Connected</span>
        ) : (
          <span className="ml-auto text-yellow-400 text-xs">● Connecting...</span>
        )}
      </div>
      <div 
        ref={terminalRef} 
        className="w-full h-full p-2"
        style={{ height: 'calc(100% - 2rem)' }}
        onClick={() => {
          // Focus terminal when clicked
          if (terminal.current) {
            terminal.current.focus();
          }
        }}
      />
    </div>
  );
};

export default TerminalComponent;
