import { useState, useCallback } from "react";
import { parseGPX } from "../../utils/parseGPX";
import { runnersStore } from "../../store/runnersStore";
import "./Uploader.css";

export function Uploader() {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(async (file) => {
    if (!name.trim()) {
      setError("이름을 먼저 입력해주세요");
      return;
    }
    if (!file.name.endsWith(".gpx")) {
      setError("GPX 파일만 업로드 가능합니다");
      return;
    }

    try {
      const text = await file.text();
      const runner = parseGPX(text, name);
      runnersStore.add(runner);
      setName("");
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [name]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInput = useCallback((e) => {
    handleFile(e.target.files[0]);
    e.target.value = "";
  }, [handleFile]);

  return (
    <div className="uploader">
      <input
        className="name-input"
        type="text"
        placeholder="러너 이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            document.getElementById("gpx-input").click();
          }
        }}
      />
      <div
        className={`drop-zone ${isDragging ? "drag" : ""}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => document.getElementById("gpx-input").click()}
      >
        <span>GPX 드롭 또는 클릭</span>
        <input
          id="gpx-input"
          type="file"
          accept=".gpx"
          style={{ display: "none" }}
          onChange={handleInput}
        />
      </div>
      {error && <div className="upload-error">{error}</div>}
    </div>
  );
}