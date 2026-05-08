import {
  forwardRef,
  type CSSProperties,
  type InputHTMLAttributes,
} from "react";
import { CalendarDays } from "lucide-react";

type FormattedDateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  displayStyle?: CSSProperties;
  placeholderText?: string;
};

function formatLongDate(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const wrapperStyle: CSSProperties = {
  position: "relative",
  width: "100%",
};

const visibleInputStyle: CSSProperties = {
  height: 40,
  width: "100%",
  borderRadius: 10,
  border: "1px solid var(--border)",
  padding: "0 40px 0 10px",
  outline: "none",
  background: "white",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  fontWeight: 700,
  fontSize: 14,
  boxSizing: "border-box",
};

const hiddenInputStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  opacity: 0,
  cursor: "pointer",
};

const iconStyle: CSSProperties = {
  position: "absolute",
  right: 12,
  top: "50%",
  transform: "translateY(-50%)",
  color: "rgba(15,23,42,0.82)",
  pointerEvents: "none",
};

const FormattedDateInput = forwardRef<HTMLInputElement, FormattedDateInputProps>(
  function FormattedDateInput(
    { value, displayStyle, placeholderText = "Select date", disabled, ...props },
    ref,
  ) {
    const textValue =
      typeof value === "string" && value.trim().length > 0
        ? formatLongDate(value)
        : placeholderText;

    return (
      <div style={{ ...wrapperStyle, opacity: disabled ? 0.65 : 1 }}>
        <div
          style={{
            ...visibleInputStyle,
            ...displayStyle,
            color:
              typeof value === "string" && value.trim().length > 0
                ? displayStyle?.color ?? "var(--text)"
                : "#6b7280",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {textValue}
        </div>
        <CalendarDays size={16} style={iconStyle} />
        <input
          {...props}
          ref={ref}
          type="date"
          value={value}
          disabled={disabled}
          style={hiddenInputStyle}
        />
      </div>
    );
  },
);

export default FormattedDateInput;
