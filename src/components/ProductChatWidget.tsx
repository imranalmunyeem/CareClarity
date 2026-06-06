import { Loader2, MessageCircle, Send, ShieldCheck, X } from "lucide-react";
import type { AppCopy } from "../lib/i18n";
import type { ProductChatMessage } from "../lib/productChatSchema";

interface ProductChatWidgetProps {
  isOpen: boolean;
  question: string;
  history: ProductChatMessage[];
  error: string;
  isLoading: boolean;
  copy: AppCopy["chat"];
  onClose: () => void;
  onToggle: () => void;
  onQuestionChange: (value: string) => void;
  onSubmit: () => void;
}

export function ProductChatWidget({
  isOpen,
  question,
  history,
  error,
  isLoading,
  copy,
  onClose,
  onToggle,
  onQuestionChange,
  onSubmit,
}: ProductChatWidgetProps) {
  return (
    <aside className={isOpen ? "floating-chat open" : "floating-chat"} aria-label={copy.asideLabel}>
      {isOpen ? (
        <section
          id="product-chat-panel"
          className="floating-chat-panel"
          aria-labelledby="product-chat-heading"
        >
          <header className="floating-chat-header">
            <span className="chat-icon floating-chat-icon" aria-hidden="true">
              <MessageCircle size={18} />
            </span>
            <div>
              <h3 id="product-chat-heading">{copy.heading}</h3>
              <p>{copy.intro}</p>
            </div>
            <button className="chat-close" type="button" onClick={onClose} title={copy.closeChat} aria-label={copy.closeChat}>
              <X size={18} />
            </button>
          </header>

          {history.length ? (
            <div className="chat-log" aria-live="polite">
              {history.map((message, index) => (
                <article
                  key={`${message.role}-${index}-${message.content.slice(0, 16)}`}
                  className={message.role === "user" ? "chat-bubble user" : "chat-bubble assistant"}
                >
                  <span>{message.role === "user" ? copy.you : "CareClarity"}</span>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="chat-empty">{copy.empty}</p>
          )}

          <label className="field-label" htmlFor="product-chat-question">
            {copy.productQuestion}
          </label>
          <textarea
            id="product-chat-question"
            className="chat-input"
            placeholder={copy.placeholder}
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
          />
          <button
            className="secondary-button chat-button"
            type="button"
            onClick={onSubmit}
            disabled={isLoading || question.trim().length < 3}
          >
            {isLoading ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            <span>{isLoading ? copy.replying : copy.askCareClarity}</span>
          </button>
          {error ? (
            <p className="sentence-error" role="alert">
              {error}
            </p>
          ) : null}
          <p className="chat-safety">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>{copy.safety}</span>
          </p>
        </section>
      ) : null}

      <button
        className="chat-launcher"
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={isOpen ? "product-chat-panel" : undefined}
      >
        <MessageCircle size={19} aria-hidden="true" />
        <span>{isOpen ? copy.helpClose : copy.helpOpen}</span>
      </button>
    </aside>
  );
}
