import {
  forwardRef,
  type CSSProperties,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";

type DropdownSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
  containerStyle?: CSSProperties;
};

const baseContainer: CSSProperties = {
  position: "relative",
  width: "100%",
};

const baseSelect: CSSProperties = {
  height: 40,
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(15,23,42,0.18)",
  background: "rgba(255,255,255,0.88)",
  color: "rgba(15,23,42,0.95)",
  padding: "0 36px 0 12px",
  outline: "none",
  fontWeight: 700,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  cursor: "pointer",
};

const arrowStyle: CSSProperties = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
  color: "rgba(15,23,42,0.85)",
};

const DropdownSelect = forwardRef<HTMLSelectElement, DropdownSelectProps>(
  function DropdownSelect({ children, containerStyle, style, ...props }, ref) {
    return (
      <div style={{ ...baseContainer, ...containerStyle }}>
        <select
          {...props}
          ref={ref}
          style={{
            ...baseSelect,
            ...style,
          }}
        >
          {children}
        </select>
        <ChevronDown size={16} style={arrowStyle} />
      </div>
    );
  },
);

export default DropdownSelect;
