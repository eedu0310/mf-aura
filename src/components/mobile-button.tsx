import { ReactNode } from "react";

interface MobileButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  children: ReactNode;
  className?: string;
}

export function MobileButton({
  onClick,
  disabled,
  variant = "primary",
  children,
  className = "",
}: MobileButtonProps) {
  const baseStyles = "w-full md:w-auto py-3 md:py-2 px-4 rounded-lg font-medium transition active:scale-95 disabled:opacity-50";
  
  const variants = {
    primary: "bg-aura-petrol-500 text-white hover:bg-aura-petrol-600",
    secondary: "bg-aura-bg text-aura-graphite hover:bg-aura-mist",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}