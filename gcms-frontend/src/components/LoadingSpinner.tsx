import type { CSSProperties } from "react";

type LoadingSpinnerProps = {
  size?: number;
  color?: string;
  thickness?: number;
};

export default function LoadingSpinner({
  size = 16,
  color = "currentColor",
  thickness = 2,
}: LoadingSpinnerProps) {
  const spinnerStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    border: `${thickness}px solid ${color}`,
    borderRightColor: "transparent",
    animation: "gcms-spin 0.7s linear infinite",
    flexShrink: 0,
  };

  return <span aria-hidden="true" style={spinnerStyle} />;
}
