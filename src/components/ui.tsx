"use client";

import { useEffect, type ButtonHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, type InputHTMLAttributes } from "react";
import { cx } from "@/lib/format";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "filled" | "tonal" | "outlined" | "text" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
};

export function Button({ variant = "filled", size = "md", icon, className, children, type = "button", onPointerDown, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx("md-btn", `md-btn-${variant}`, size === "lg" && "md-btn-lg", size === "sm" && "md-btn-sm", className)}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.defaultPrevented || props.disabled) return;
        const target = event.currentTarget;
        const rect = target.getBoundingClientRect();
        const span = document.createElement("span");
        const ripple = Math.max(rect.width, rect.height);
        span.className = "md-ripple";
        span.style.width = `${ripple}px`;
        span.style.height = `${ripple}px`;
        span.style.left = `${event.clientX - rect.left - ripple / 2}px`;
        span.style.top = `${event.clientY - rect.top - ripple / 2}px`;
        target.appendChild(span);
        span.addEventListener("animationend", () => span.remove());
      }}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  support?: string;
  error?: string;
  trailing?: ReactNode;
};

export function TextField({ label, support, error, trailing, className, ...props }: FieldProps) {
  return (
    <div className={cx("field-wrap", className)}>
      <label className={cx("md-field", error && "is-error")}>
        <input aria-label={label} placeholder=" " {...props} />
        <span className="label">{label}</span>
        {trailing ? <span className="field-trailing">{trailing}</span> : null}
      </label>
      {error ? <p className="field-error">{error}</p> : support ? <p className="field-support">{support}</p> : null}
    </div>
  );
}

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  support?: string;
  error?: string;
};

export function TextArea({ label, support, error, ...props }: AreaProps) {
  return (
    <div className="field-wrap">
      <label className={cx("md-field", error && "is-error")}>
        <textarea aria-label={label} placeholder=" " {...props} />
        <span className="label">{label}</span>
      </label>
      {error ? <p className="field-error">{error}</p> : support ? <p className="field-support">{support}</p> : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  support,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  support?: string;
}) {
  return (
    <div className="switch-row">
      <button type="button" role="switch" aria-label={label} aria-checked={checked} className="md-switch" onClick={() => onChange(!checked)}>
        <i />
      </button>
      <div>
        <div className="switch-label">{label}</div>
        {support ? <p className="field-support">{support}</p> : null}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; title?: string }[];
  label?: string;
}) {
  return (
    <div>
      {label ? <div className="field-label">{label}</div> : null}
      <div className="md-seg" role="group" aria-label={label}>
        {options.map((option) => (
          <button key={option.value} type="button" aria-pressed={value === option.value} title={option.title} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Dialog({
  open,
  title,
  onClose,
  children,
  wide,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="md-scrim" role="presentation" onMouseDown={onClose}>
      <div className={cx("md-dialog", wide && "md-dialog-wide")} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="dialog-head">
          <h2 className="h3">{title}</h2>
          <Button variant="text" onClick={onClose}>关闭</Button>
        </div>
        {children}
        {footer ? <div className="dialog-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function LinearProgress({ label }: { label?: string }) {
  return (
    <div>
      {label ? <p className="field-support" style={{ marginBottom: 8 }}>{label}</p> : null}
      <div className="md-progress" role="progressbar" aria-label={label || "进行中"}>
        <span />
      </div>
    </div>
  );
}
