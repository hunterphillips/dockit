"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAIPanel } from "@/context/AIPanelContext";
import DiffPreview from "./DiffPreview";
import styles from "./ChatPanel.module.css";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface EditProposal {
  proposed: string;
  userRequest: string;
}

interface Props {
  owner: string;
  repo: string;
}

async function streamSSE(
  body: object,
  onChunk: (text: string) => void,
  signal: AbortSignal
) {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return;
      try {
        const { text } = JSON.parse(data) as { text: string };
        onChunk(text);
      } catch {
        // skip malformed chunks
      }
    }
  }
}

export default function ChatPanel({ owner, repo }: Props) {
  const { open, toggle, docState, onEditAppliedRef } = useAIPanel();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"qa" | "edit">("qa");
  const [loading, setLoading] = useState(false);
  const [editProposal, setEditProposal] = useState<EditProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, editProposal]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    setEditProposal(null);

    const userMsg: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    const apiMessages = nextMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const currentDoc = docState
      ? { filePath: docState.filePath, content: docState.content }
      : undefined;

    if (mode === "qa") {
      // Add placeholder assistant message for streaming
      setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

      abortRef.current = new AbortController();
      try {
        await streamSSE(
          { owner, repo, messages: apiMessages, mode: "qa", currentDoc },
          (chunk) => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = { ...last, content: last.content + chunk };
              }
              return updated;
            });
          },
          abortRef.current.signal
        );
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message);
          // Remove the empty assistant placeholder on error
          setMessages((prev) =>
            prev[prev.length - 1]?.content === "" ? prev.slice(0, -1) : prev
          );
        }
      } finally {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.streaming) {
            updated[updated.length - 1] = { ...last, streaming: false };
          }
          return updated;
        });
        setLoading(false);
      }
    } else {
      // Edit mode: full response
      if (!docState) {
        setError("No document is currently open. Navigate to a doc first.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner,
            repo,
            messages: apiMessages,
            mode: "edit",
            currentDoc,
          }),
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        const { proposed } = (await res.json()) as { proposed: string };
        setEditProposal({ proposed, userRequest: text });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
  }, [input, loading, messages, mode, owner, repo, docState]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEditApplied = (newContent: string, newSha: string) => {
    setEditProposal(null);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Changes applied and committed." },
    ]);
    // Update DocPageClient state
    if (onEditAppliedRef.current) {
      onEditAppliedRef.current(newContent, newSha);
    }
  };

  const handleEditDiscard = () => {
    setEditProposal(null);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Edit discarded." },
    ]);
  };

  const handleClear = () => {
    setMessages([]);
    setEditProposal(null);
    setError(null);
  };

  return (
    <div className={`${styles.panel} ${open ? styles.panelOpen : ""}`} aria-label="AI assistant panel">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>Ask AI</span>
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeBtn} ${mode === "qa" ? styles.modeBtnActive : ""}`}
              onClick={() => { setMode("qa"); setEditProposal(null); setError(null); }}
            >
              Q&A
            </button>
            <button
              className={`${styles.modeBtn} ${mode === "edit" ? styles.modeBtnActive : ""}`}
              onClick={() => { setMode("edit"); setEditProposal(null); setError(null); }}
            >
              Edit
            </button>
          </div>
        </div>
        <button className={styles.closeBtn} onClick={toggle} aria-label="Close AI panel">
          ×
        </button>
      </div>

      {/* Context bar */}
      {docState ? (
        <div className={styles.contextBar}>
          <div className={styles.contextLabel}>Current doc</div>
          <div className={styles.contextPath}>{docState.filePath}</div>
        </div>
      ) : (
        <div className={styles.contextBar}>
          <div className={styles.contextLabel}>No document open</div>
        </div>
      )}

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 && !editProposal ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>✦</span>
            <span className={styles.emptyText}>
              {mode === "qa"
                ? "Ask a question about your documentation."
                : "Describe the edit you'd like to make to the current document."}
            </span>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`${styles.message} ${msg.role === "user" ? styles.messageUser : ""}`}
              >
                <span className={styles.messageRole}>
                  {msg.role === "user" ? "You" : "AI"}
                </span>
                <div className={styles.messageContent}>
                  {msg.content}
                  {msg.streaming && <span className={styles.cursor} />}
                </div>
              </div>
            ))}

            {loading && mode === "edit" && (
              <div className={styles.message}>
                <span className={styles.messageRole}>AI</span>
                <div className={styles.loadingDots}>
                  <div className={styles.dot} />
                  <div className={styles.dot} />
                  <div className={styles.dot} />
                </div>
              </div>
            )}

            {editProposal && docState && (
              <DiffPreview
                owner={owner}
                repo={repo}
                filePath={docState.filePath}
                original={docState.content}
                proposed={editProposal.proposed}
                sha={docState.sha}
                userRequest={editProposal.userRequest}
                onApplied={handleEditApplied}
                onDiscard={handleEditDiscard}
              />
            )}

            {error && <div className={styles.errorMsg}>{error}</div>}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        {mode === "edit" && !docState && (
          <div className={styles.noDocNote}>
            Open a document to use edit mode.
          </div>
        )}
        {mode === "edit" && docState && (
          <div className={styles.editModeNote}>
            Describe the change — AI will propose an edit to{" "}
            <strong>{docState.filePath.split("/").pop()}</strong>.
          </div>
        )}
        <textarea
          className={styles.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === "qa"
              ? "Ask a question… (⌘↵ to send)"
              : "Describe the edit… (⌘↵ to send)"
          }
          disabled={loading || (mode === "edit" && !docState)}
          rows={3}
        />
        <div className={styles.sendRow}>
          {messages.length > 0 && (
            <button
              className={styles.hint}
              onClick={handleClear}
              style={{ marginRight: "auto", cursor: "pointer", border: "none", background: "none" }}
            >
              Clear
            </button>
          )}
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!input.trim() || loading || (mode === "edit" && !docState)}
          >
            {loading ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
