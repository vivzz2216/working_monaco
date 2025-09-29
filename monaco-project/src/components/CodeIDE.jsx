import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { loadPyodide } from "pyodide";

export default function CodeIDE() {
  const [pyodide, setPyodide] = useState(null);
  const [code, setCode] = useState('print("Hello world")');
  const [language, setLanguage] = useState("python");
  const [output, setOutput] = useState("");

  // Load Pyodide once on mount
  useEffect(() => {
    const initPyodide = async () => {
      const py = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
      });
      setPyodide(py);
    };
    initPyodide();
  }, []);

  const handleRun = async () => {
    try {
      if (language === "python") {
        if (!pyodide) {
          setOutput("Python interpreter is still loading...");
          return;
        }
        // Redirect stdout to capture print output
        await pyodide.runPythonAsync(`import sys\nfrom io import StringIO\n_sys_stdout = sys.stdout\nsys.stdout = StringIO()`);
        try {
          await pyodide.runPythonAsync(code);
          const outputText = await pyodide.runPythonAsync("sys.stdout.getvalue()");
          setOutput(String(outputText));
        } finally {
          // Restore stdout
          await pyodide.runPythonAsync("sys.stdout = _sys_stdout");
        }
      } else if (language === "javascript") {
        const res = eval(code);
        setOutput(String(res));
      } else {
        setOutput(`Run not supported for ${language} yet.`);
      }
    } catch (err) {
      setOutput(err.message);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "sans-serif" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: "8px", padding: "8px", borderBottom: "1px solid #ddd" }}>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
        </select>
        <button onClick={handleRun}>Run</button>
      </div>

      {/* Editor */}
      <div style={{ flexGrow: 1 }}>
        <Editor
          height="70%"
          language={language}
          value={code}
          theme="vs-dark"
          onChange={(value) => setCode(value)}
          options={{
            automaticLayout: true,
            fontSize: 16,
            minimap: { enabled: false },
          }}
        />
      </div>

      {/* Output */}
      <div
        style={{
          height: "30%",
          backgroundColor: "#1e1e1e",
          color: "#fff",
          padding: "8px",
          overflowY: "auto",
        }}
      >
        <h4>Output:</h4>
        <pre>{output}</pre>
      </div>
    </div>
  );
}
