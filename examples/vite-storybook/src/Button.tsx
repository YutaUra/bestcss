import { css } from "@best-css/core";

const base = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    opacity: 0.85;
  }
`;

const variants = {
  primary: css`
    background: #2563eb;
    color: #fff;
  `,
  secondary: css`
    background: #f3f4f6;
    color: #111827;
  `,
  danger: css`
    background: #dc2626;
    color: #fff;
  `,
} as const;

export interface ButtonProps {
  variant?: keyof typeof variants;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button = ({
  variant = "primary",
  children,
  onClick,
}: ButtonProps) => (
  <button
    type="button"
    className={`${base} ${variants[variant]}`}
    onClick={onClick}
  >
    {children}
  </button>
);
